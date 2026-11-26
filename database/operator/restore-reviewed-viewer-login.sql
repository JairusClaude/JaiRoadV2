-- DATABASE OWNER ONLY. Not a migration. One independently reviewed Viewer only.
-- Back up and rehearse on staging. Verify the owner, role, current email,
-- and that no existing Fortify identity belongs to this account.
-- Run this inventory separately. No password hashes or secrets are returned.
SELECT a.id, a.username, a.account_type, a.is_active, a.engineer_id,
       (SELECT count(*) FROM public.users u WHERE u.canonical_user_account_id = a.id) AS linked_logins,
       (SELECT count(*) FROM public.users u WHERE lower(u.email) = lower(a.email)) AS email_matches,
       EXISTS (SELECT 1 FROM jairoads_security.account_provisioning p WHERE p.user_account_id = a.id) AS has_approval
FROM jairoads_next.user_accounts a
WHERE a.account_type = 'Viewer'
ORDER BY a.id;

-- Execute the transaction separately after independent review.
-- Supply real IDs and private review reference; defaults deliberately fail.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $review$
DECLARE
    target_id bigint := NULL;
    approving_id bigint := NULL;
    reference text := '';
    target record;
    approver record;
BEGIN
    IF target_id IS NULL OR approving_id IS NULL OR target_id = approving_id
       OR length(btrim(reference)) NOT BETWEEN 8 AND 500 THEN
        RAISE EXCEPTION 'Complete the verified account IDs and actual review reference first.';
    END IF;
    -- Same lock ordering as canonical provisioning.
    PERFORM pg_advisory_xact_lock_shared(1927710916);
    PERFORM pg_advisory_xact_lock(1927710914);
    PERFORM id FROM public.users WHERE canonical_user_account_id IN (target_id, approving_id)
        ORDER BY id FOR UPDATE;
    PERFORM id FROM jairoads_next.user_accounts WHERE id IN (target_id, approving_id)
        ORDER BY id FOR UPDATE;
    SELECT * INTO STRICT target FROM jairoads_next.user_accounts WHERE id = target_id;
    SELECT * INTO STRICT approver FROM jairoads_next.user_accounts WHERE id = approving_id;
    IF NOT approver.is_active OR approver.account_type <> 'SuperAdmin' OR approver.engineer_id IS NOT NULL
       OR (SELECT count(*) FROM public.users WHERE canonical_user_account_id = approving_id) <> 1
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.canonical_user_account_id = approving_id
                        AND lower(u.email) = lower(approver.email) AND u.password = approver.password) THEN
        RAISE EXCEPTION 'Approving SuperAdmin is not eligible.';
    END IF;
    IF NOT target.is_active OR target.account_type <> 'Viewer' OR target.engineer_id IS NOT NULL
       OR target.email IS NULL OR btrim(target.email) = ''
       OR target.password IS NULL OR target.password !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' THEN
        RAISE EXCEPTION 'Target is not a reviewed active unlinked Viewer with a supported existing bcrypt credential.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.users u WHERE u.canonical_user_account_id = target_id OR lower(u.email) = lower(target.email))
       OR EXISTS (SELECT 1 FROM jairoads_next.user_accounts a WHERE a.id <> target_id AND lower(a.email) = lower(target.email))
       OR EXISTS (SELECT 1 FROM jairoads_security.account_provisioning p WHERE p.user_account_id = target_id) THEN
        RAISE EXCEPTION 'Existing identity or approval found. Stop and review privately; no guessed links.';
    END IF;
    -- Preserve the existing canonical identity, role, and hash. No plaintext
    -- password is supplied, exposed or stored in SQL history. The authorized
    -- SuperAdmin should reset the password immediately after this operation.
    INSERT INTO public.users (name, email, password, user_account_id, canonical_user_account_id, email_verified_at, created_at, updated_at)
    VALUES (target.username, target.email, target.password, NULL, target_id, NULL, now(), now());
    INSERT INTO jairoads_security.account_provisioning
        (user_account_id, provisioned_by, provisioner_role, provisioned_role, engineer_id, method, review_reference)
    VALUES (target_id, approving_id, 'SuperAdmin', 'Viewer', NULL, 'reviewed_transition', btrim(reference));
END
$review$;
COMMIT;
-- Verify linked_logins=1, email_matches=1 and has_approval=true.
-- Then use SuperAdmin User Management > Manage > Reset Password.

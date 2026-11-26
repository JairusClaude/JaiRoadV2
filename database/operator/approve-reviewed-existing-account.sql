-- MANUAL DATABASE-OWNER PROCEDURE ONLY. Never run at application startup.
-- Follow docs/security/approved-account-transition-readiness.md.
-- Confirm private identity/role/profile review, real approving SuperAdmin,
-- backup and staging rehearsal before using on the official database.
-- Run the read-only inventory first. No credentials or hashes are returned.
SELECT a.id, a.username, a.account_type, a.engineer_id, a.is_active,
       e.engineer_status,
       (SELECT count(*) FROM public.users u WHERE u.canonical_user_account_id = a.id) AS login_links,
       EXISTS (SELECT 1 FROM public.users u WHERE u.canonical_user_account_id = a.id
                 AND lower(u.email) = lower(a.email) AND u.password = a.password) AS matching_login,
       p.method AS existing_approval, p.provisioned_role, p.engineer_id AS approved_engineer_id
FROM jairoads_next.user_accounts a
LEFT JOIN jairoads_next.engineers e ON e.id = a.engineer_id
LEFT JOIN jairoads_security.account_provisioning p ON p.user_account_id = a.id
ORDER BY a.id;

-- After reviewing the inventory, select and run ONLY the transaction below.
-- Replace all three placeholders with verified values. The default fails closed.
-- One account per transaction. Never approve a batch based on names or status.
BEGIN;
SET LOCAL lock_timeout = '3s';
DO $review$
DECLARE
    target_id bigint := NULL; -- verified target account ID
    approving_id bigint := NULL; -- verified, currently eligible SuperAdmin ID
    reference text := ''; -- real private review/change-ticket reference, 8–500 chars
    target record;
    approver record;
BEGIN
    IF target_id IS NULL OR approving_id IS NULL OR target_id = approving_id
       OR length(btrim(reference)) NOT BETWEEN 8 AND 500 THEN
        RAISE EXCEPTION 'Complete the verified account IDs and actual review reference first.';
    END IF;
    -- Coordinate with account lifecycle/provisioning and identity changes.
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
    IF NOT target.is_active OR target.account_type NOT IN ('Admin', 'Engineer', 'Viewer')
       OR (target.account_type = 'Engineer' AND target.engineer_id IS NULL)
       OR (SELECT count(*) FROM public.users WHERE canonical_user_account_id = target_id) <> 1
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.canonical_user_account_id = target_id
                        AND lower(u.email) = lower(target.email) AND u.password = target.password) THEN
        RAISE EXCEPTION 'Target has an inactive, invalid or mismatched identity. Review privately.';
    END IF;
    IF target.engineer_id IS NOT NULL THEN
        PERFORM id FROM jairoads_next.engineers WHERE id = target.engineer_id FOR UPDATE;
        IF NOT EXISTS (SELECT 1 FROM jairoads_next.engineers
                        WHERE id = target.engineer_id AND engineer_status = 'Active')
           OR EXISTS (SELECT 1 FROM jairoads_next.user_accounts
                        WHERE engineer_id = target.engineer_id AND id <> target_id) THEN
            RAISE EXCEPTION 'Engineer profile is invalid or shared.';
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM jairoads_security.account_provisioning WHERE user_account_id = target_id) THEN
        RAISE EXCEPTION 'Approval already exists. Immutable evidence must not be overwritten.';
    END IF;
    INSERT INTO jairoads_security.account_provisioning
        (user_account_id, provisioned_by, provisioner_role, provisioned_role, engineer_id, method, review_reference)
    VALUES (target_id, approving_id, 'SuperAdmin', target.account_type, target.engineer_id, 'reviewed_transition', btrim(reference));
END
$review$;
COMMIT;

-- Re-run the inventory and canonical-access-preflight. Then use User Management
-- > Manage > Reset Password. This procedure does not change any password, role,
-- engineer link, account status, schema, grant, or maintenance data.

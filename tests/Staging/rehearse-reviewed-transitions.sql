-- Dedicated synthetic proof: the Laravel runtime cannot self-attest a
-- reviewed historical transition, but a schema owner can after documented
-- identity review. This database contains NO real identities or history.
DO $preconditions$
BEGIN
 IF current_database() <> 'jairoads_scratch_staging_existing'
    OR current_user <> 'postgres'
    OR (SELECT count(*) FROM jairoads_next.user_accounts) <> 3
    OR (SELECT count(*) FROM jairoads_next.audit_logs) <> 1
    OR (SELECT count(*) FROM jairoads_security.account_provisioning
        WHERE user_account_id=3) <> 0 THEN
     RAISE EXCEPTION 'Not the expected disposable account transition fixture';
 END IF;
END;
$preconditions$;

BEGIN;
SET LOCAL ROLE jairoads_app_runtime;
DO $deny_runtime_review$
DECLARE denied boolean := false;
BEGIN
 BEGIN
    INSERT INTO jairoads_security.account_provisioning (
      user_account_id, provisioned_by, provisioner_role, provisioned_role,
      engineer_id, method, review_reference
    ) VALUES (
      3, 1, 'SuperAdmin', 'Engineer', 2, 'reviewed_transition',
      'SYNTHETIC-OWNER-REVIEW-0001'
    );
 EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
 END;
 IF NOT denied THEN
    RAISE EXCEPTION 'Untrusted runtime role forged reviewed transition';
 END IF;
END;
$deny_runtime_review$;
COMMIT;

-- A separately approved, schema-owner review operation is intentionally
-- modeled ONLY with synthetic data. Current time is the review time; no
-- original historical creation date is invented.
INSERT INTO jairoads_security.account_provisioning (
 user_account_id, provisioned_by, provisioner_role, provisioned_role,
 engineer_id, method, review_reference
) VALUES (
 3, 1, 'SuperAdmin', 'Engineer', 2, 'reviewed_transition',
 'SYNTHETIC-OWNER-REVIEW-0001'
);

DO $postconditions$
DECLARE duplicate_denied boolean := false;
BEGIN
 IF (SELECT count(*) FROM jairoads_security.account_provisioning
    WHERE user_account_id=3 AND method='reviewed_transition'
      AND review_reference='SYNTHETIC-OWNER-REVIEW-0001') <> 1
    OR (SELECT count(*) FROM jairoads_next.audit_logs) <> 1 THEN
    RAISE EXCEPTION 'Reviewed synthetic transition altered business history';
 END IF;
 BEGIN
   INSERT INTO jairoads_security.account_provisioning (
     user_account_id, provisioned_by, provisioner_role, provisioned_role,
     engineer_id, method, review_reference
   ) VALUES (3,1,'SuperAdmin','Engineer',2,'reviewed_transition',
             'SYNTHETIC-REPLAY-BLOCKED');
 EXCEPTION WHEN unique_violation THEN
   duplicate_denied := true;
 END;
 IF NOT duplicate_denied THEN
   RAISE EXCEPTION 'Immutable reviewed evidence accepted a duplicate';
 END IF;
END;
$postconditions$;

-- Coordinated naming cutover. Run only when every deployed application uses
-- canonical_user_account_id and the database backup/rollback window is confirmed.
-- Existing immutable audit history and applied migration provenance are retained.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.users, jairoads_next.audit_logs, jairoads_security.account_provisioning IN ACCESS EXCLUSIVE MODE;
DO $check$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='dd_user_account_id')
       OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='canonical_user_account_id')
       OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname IN ('users_dd_user_account_id_fk','users_dd_user_account_id_unique') AND convalidated) <> 2
       OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='jairoads_next.audit_logs'::regclass AND tgname IN ('jairoads_dd_auditlog_reject_changes','jairoads_dd_auditlog_reject_truncate') AND tgenabled='O' AND tgfoid='jairoads_next.jairoads_dd_auditlog_deny_mutation()'::regprocedure) <> 2
       OR EXISTS (SELECT 1 FROM public.users u LEFT JOIN jairoads_next.user_accounts a ON a.id=u.dd_user_account_id WHERE u.dd_user_account_id IS NOT NULL AND a.id IS NULL)
       OR (SELECT count(*) FROM regexp_matches(pg_get_functiondef('jairoads_security.protect_provisioning()'::regprocedure),'dd_user_account_id','g')) <> 2
    THEN RAISE EXCEPTION 'Unexpected account or audit schema; abort cutover'; END IF;
END $check$;
ALTER TABLE public.users RENAME COLUMN dd_user_account_id TO canonical_user_account_id;
ALTER TABLE public.users RENAME CONSTRAINT users_dd_user_account_id_fk TO users_canonical_user_account_id_fk;
ALTER TABLE public.users RENAME CONSTRAINT users_dd_user_account_id_unique TO users_canonical_user_account_id_unique;
DO $body$
DECLARE definition text;
BEGIN
    SELECT pg_get_functiondef('jairoads_security.protect_provisioning()'::regprocedure) INTO definition;
    EXECUTE replace(definition,'dd_user_account_id','canonical_user_account_id');
END $body$;
ALTER FUNCTION jairoads_next.jairoads_dd_auditlog_deny_mutation() RENAME TO jairoads_auditlog_deny_mutation;
ALTER TRIGGER jairoads_dd_auditlog_reject_changes ON jairoads_next.audit_logs RENAME TO jairoads_auditlog_reject_changes;
ALTER TRIGGER jairoads_dd_auditlog_reject_truncate ON jairoads_next.audit_logs RENAME TO jairoads_auditlog_reject_truncate;
DO $verify$
DECLARE definition text;
BEGIN
    SELECT pg_get_functiondef('jairoads_next.jairoads_auditlog_deny_mutation()'::regprocedure) INTO definition;
    EXECUTE replace(definition,'JaiROADS Data Dictionary AuditLog is append-only','JaiROADS audit log is append-only');
    IF (SELECT count(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname IN ('users_canonical_user_account_id_fk','users_canonical_user_account_id_unique') AND convalidated) <> 2
       OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='jairoads_next.audit_logs'::regclass AND tgname IN ('jairoads_auditlog_reject_changes','jairoads_auditlog_reject_truncate') AND tgenabled='O' AND tgfoid='jairoads_next.jairoads_auditlog_deny_mutation()'::regprocedure) <> 2
       OR EXISTS (SELECT 1 FROM public.users u LEFT JOIN jairoads_next.user_accounts a ON a.id=u.canonical_user_account_id WHERE u.canonical_user_account_id IS NOT NULL AND a.id IS NULL)
       OR position('dd_user_account_id' in pg_get_functiondef('jairoads_security.protect_provisioning()'::regprocedure)) > 0
    THEN RAISE EXCEPTION 'Canonical identity or audit validation failed'; END IF;
END $verify$;
-- Rehearsal default. Change to COMMIT only during the coordinated cutover.
ROLLBACK;

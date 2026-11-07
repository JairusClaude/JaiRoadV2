-- Run as disposable database owner AFTER loading fixture, auxiliary
-- proposals, fake users and reviewed role/RLS template. All writes are synthetic.
-- This is not approval to apply the reviewed template on live Supabase.
DO $assertions$
DECLARE trigger_count integer;
BEGIN
 IF to_regclass('jairoads_security.account_provisioning') IS NULL
  OR to_regclass('jairoads_next.audit_notification_recipients') IS NULL THEN
   RAISE EXCEPTION 'Auxiliary tables absent';
 END IF;
 SELECT count(*) INTO trigger_count FROM pg_trigger
 WHERE tgrelid='jairoads_next.audit_logs'::regclass AND NOT tgisinternal AND tgenabled <> 'D';
 IF trigger_count <> 2 THEN
  RAISE EXCEPTION 'Expected exactly two canonical immutable AuditLog triggers, found %',trigger_count;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='jairoads_app_runtime') THEN
  RAISE EXCEPTION 'Restricted review role absent';
 END IF;
 IF has_table_privilege('anon','jairoads_security.account_provisioning','SELECT')
    OR has_table_privilege('authenticated','jairoads_security.account_provisioning','SELECT')
    OR has_table_privilege('service_role','jairoads_security.account_provisioning','SELECT')
    OR has_table_privilege('anon','jairoads_next.audit_notification_recipients','SELECT')
    OR has_table_privilege('authenticated','jairoads_next.audit_notification_recipients','SELECT')
    OR has_table_privilege('service_role','jairoads_next.audit_notification_recipients','SELECT') THEN
     RAISE EXCEPTION 'Unapproved API read privilege';
 END IF;
 IF NOT has_table_privilege('jairoads_app_runtime','jairoads_security.account_provisioning','INSERT')
    OR NOT has_table_privilege('jairoads_app_runtime','jairoads_next.audit_notification_recipients','INSERT')
    OR has_table_privilege('jairoads_app_runtime','jairoads_security.account_provisioning','UPDATE')
    OR has_table_privilege('jairoads_app_runtime','jairoads_next.audit_notification_recipients','DELETE') THEN
     RAISE EXCEPTION 'Restricted-role access mismatch';
 END IF;
END;
$assertions$;

-- Use a non-owner role with actual RLS enabled; no owner/bypassrls assertion
-- can substitute for this test.
BEGIN;
SET LOCAL ROLE jairoads_app_runtime;
INSERT INTO jairoads_security.account_provisioning
(user_account_id,provisioned_by,provisioner_role,provisioned_role,engineer_id,method)
VALUES (2,1,'SuperAdmin','Admin',1,'administrator');
INSERT INTO jairoads_next.audit_notification_recipients
(audit_log_id,recipient_user_id,notification_message)
VALUES (1,2,'Synthetic rehearsal notification.');
DO $nonowner$
BEGIN
 IF (SELECT count(*) FROM jairoads_security.account_provisioning WHERE user_account_id=2) <> 1
    OR (SELECT count(*) FROM jairoads_next.audit_notification_recipients WHERE audit_log_id=1 AND recipient_user_id=2) <> 1 THEN
   RAISE EXCEPTION 'Restricted-role insert/select not functional under RLS';
 END IF;
END;
$nonowner$;
COMMIT;

-- Assert owner-level trigger enforcement too (permissions alone are insufficient).
DO $immutable$
BEGIN
 BEGIN
   UPDATE jairoads_next.audit_notification_recipients SET notification_message='tampered' WHERE audit_log_id=1;
   RAISE EXCEPTION 'Notification mutation unexpectedly succeeded' USING ERRCODE='P0001';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   DELETE FROM jairoads_security.account_provisioning WHERE user_account_id=2;
   RAISE EXCEPTION 'Provenance deletion unexpectedly succeeded' USING ERRCODE='P0001';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE jairoads_next.audit_logs SET description='tampered' WHERE id=1;
   RAISE EXCEPTION 'Canonical audit mutation unexpectedly succeeded' USING ERRCODE='P0001';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$immutable$;

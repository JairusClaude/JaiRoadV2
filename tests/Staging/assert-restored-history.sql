-- Runs only after restoring a known synthetic PG17 archive into the
-- strict scratch database named jairoads_scratch_staging_restored.
DO $guard$
DECLARE enabled_count integer;
BEGIN
 IF current_database() <> 'jairoads_scratch_staging_restored'
  OR current_user <> 'postgres'
  OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
  OR (SELECT count(*) FROM jairoads_next.audit_logs) <> 1
  OR (SELECT count(*) FROM jairoads_next.user_accounts) <> 3
  OR (SELECT count(*) FROM public.users) <> 3
  OR (SELECT count(*) FROM jairoads_security.account_provisioning) <> 2
  OR (SELECT count(*) FROM jairoads_next.audit_notification_recipients) <> 3
  OR (SELECT count(DISTINCT recipient_user_id) FROM jairoads_next.audit_notification_recipients) <> 3
 THEN RAISE EXCEPTION 'Restored history or account cardinality is invalid'; END IF;

 IF EXISTS (
   SELECT 1 FROM pg_class
   WHERE oid IN ('jairoads_security.account_provisioning'::regclass,
                 'jairoads_next.audit_notification_recipients'::regclass)
     AND NOT relrowsecurity
 ) THEN RAISE EXCEPTION 'Restored auxiliary table lost RLS'; END IF;
 SELECT count(*) INTO enabled_count FROM pg_trigger
 WHERE NOT tgisinternal AND tgenabled <> 'D'
   AND (
     (tgrelid='jairoads_next.audit_logs'::regclass
       AND tgname IN ('jairoads_dd_auditlog_reject_changes', 'jairoads_dd_auditlog_reject_truncate'))
     OR (tgrelid='jairoads_next.audit_notification_recipients'::regclass
       AND tgname IN ('audit_notification_recipients_immutable', 'audit_notification_recipients_no_truncate'))
     OR (tgrelid='jairoads_security.account_provisioning'::regclass
       AND tgname IN ('immutable_provisioning', 'immutable_provisioning_truncate'))
   );
 IF enabled_count <> 6 THEN
   RAISE EXCEPTION 'Expected six intact enabled immutable history triggers, got %', enabled_count;
 END IF;

 IF has_table_privilege('anon', 'jairoads_next.audit_notification_recipients', 'SELECT')
  OR has_table_privilege('authenticated', 'jairoads_next.audit_notification_recipients', 'SELECT')
  OR has_table_privilege('service_role', 'jairoads_security.account_provisioning', 'SELECT')
  OR has_table_privilege('jairoads_app_runtime', 'jairoads_security.account_provisioning', 'UPDATE')
  OR has_table_privilege('jairoads_app_runtime', 'jairoads_next.audit_notification_recipients', 'DELETE')
  OR NOT has_table_privilege('jairoads_app_runtime', 'jairoads_next.audit_notification_recipients', 'INSERT')
 THEN RAISE EXCEPTION 'Restored database grants violate append-only boundary'; END IF;

 BEGIN
   UPDATE jairoads_next.audit_logs SET description='forbidden restore modification' WHERE id=1;
   RAISE EXCEPTION 'AuditLog was editable in restored archive';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   DELETE FROM jairoads_security.account_provisioning WHERE user_account_id=2;
   RAISE EXCEPTION 'Provenance was deletable in restored archive';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE jairoads_next.audit_notification_recipients
     SET notification_message='forbidden change' WHERE audit_log_id=1;
   RAISE EXCEPTION 'Notification was editable in restored archive';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$guard$;

BEGIN;
SET LOCAL ROLE jairoads_app_runtime;
DO $runtime$
BEGIN
 IF current_user <> 'jairoads_app_runtime'
    OR NOT row_security_active('jairoads_security.account_provisioning'::regclass)
    OR NOT row_security_active('jairoads_next.audit_notification_recipients'::regclass)
    OR (SELECT count(*) FROM jairoads_next.audit_notification_recipients) <> 3
    OR (SELECT count(*) FROM jairoads_security.account_provisioning) <> 2 THEN
  RAISE EXCEPTION 'Restored RLS/runtime policy cannot see its permitted history';
 END IF;
END;
$runtime$;
COMMIT;

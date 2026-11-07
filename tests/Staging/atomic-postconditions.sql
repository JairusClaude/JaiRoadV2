-- Owner-level integrity tests on disposable synthetic data. No real records.
DO $integrity$
DECLARE event_id bigint; before_logs integer; before_deliveries integer;
BEGIN
 SELECT id INTO STRICT event_id FROM jairoads_next.audit_logs
   WHERE description='Synthetic committed one-event rehearsal';
 SELECT count(*) INTO before_logs FROM jairoads_next.audit_logs;
 SELECT count(*) INTO before_deliveries FROM jairoads_next.audit_notification_recipients;
 IF before_logs <> 2 OR before_deliveries <> 3
   OR EXISTS (SELECT 1 FROM jairoads_next.audit_logs
              WHERE description='Synthetic rollback rehearsal event')
   OR EXISTS (SELECT 1 FROM jairoads_next.audit_notification_recipients
              WHERE recipient_user_id NOT IN (1,2,3))
 THEN
    RAISE EXCEPTION 'Unexpected event or delivery persisted from rollback';
 END IF;

 BEGIN
   INSERT INTO jairoads_next.audit_notification_recipients
    (audit_log_id,recipient_user_id,notification_message)
   VALUES (event_id,1,'Forbidden duplicate');
   RAISE EXCEPTION 'Duplicate event/recipient accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
   INSERT INTO jairoads_next.audit_notification_recipients
    (audit_log_id,recipient_user_id,notification_message)
   VALUES (event_id,999999,'Forbidden orphan recipient');
   RAISE EXCEPTION 'Foreign-key-invalid recipient accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
   INSERT INTO jairoads_next.audit_notification_recipients
    (audit_log_id,recipient_user_id,notification_message)
   VALUES (999999,1,'Forbidden missing event');
   RAISE EXCEPTION 'Foreign-key-invalid AuditLog event accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
   UPDATE jairoads_next.audit_logs SET description='Corrupt' WHERE id=event_id;
   RAISE EXCEPTION 'AuditLog event mutation accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   DELETE FROM jairoads_next.audit_notification_recipients
    WHERE audit_log_id=event_id;
   RAISE EXCEPTION 'Delivery deletion accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   UPDATE jairoads_next.audit_notification_recipients
     SET notification_message='Corrupt' WHERE audit_log_id=event_id;
   RAISE EXCEPTION 'Delivery update accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   TRUNCATE jairoads_next.audit_notification_recipients;
   RAISE EXCEPTION 'Delivery TRUNCATE accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 IF (SELECT count(*) FROM jairoads_next.audit_logs) <> before_logs
    OR (SELECT count(*) FROM jairoads_next.audit_notification_recipients) <> before_deliveries THEN
   RAISE EXCEPTION 'Integrity probes altered retained immutable records';
 END IF;
 IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='jairoads_next'
       AND tablename='audit_notification_recipients'
       AND 'public'=ANY(roles)
 ) OR
    has_table_privilege('anon','jairoads_next.audit_notification_recipients','INSERT')
    OR has_table_privilege('authenticated','jairoads_next.audit_notification_recipients','SELECT')
    OR has_table_privilege('service_role','jairoads_security.account_provisioning','SELECT')
 THEN
   RAISE EXCEPTION 'New security tables were exposed to API roles';
 END IF;
END;
$integrity$;

-- Synthetic, single logical event -> 3 unique recipients, all in ONE transaction.
-- All DML is executed as the restricted backend role (not PostgreSQL owner).
BEGIN;
SET LOCAL ROLE jairoads_app_runtime;
DO $role_guard$
BEGIN
 IF current_user <> 'jairoads_app_runtime'
    OR NOT row_security_active('jairoads_next.audit_logs'::regclass)
    OR NOT row_security_active('jairoads_next.audit_notification_recipients'::regclass)
    OR NOT row_security_active('jairoads_security.account_provisioning'::regclass)
    OR has_table_privilege(current_user, 'jairoads_next.audit_logs', 'UPDATE')
    OR has_table_privilege(current_user, 'jairoads_next.audit_notification_recipients', 'DELETE')
 THEN
    RAISE EXCEPTION 'Expected non-owner RLS-protected append-only writer';
 END IF;
END;
$role_guard$;
-- Server-side provenance for the already-verified synthetic Admin, in the same
-- transaction as a representative new event and linked delivery rows.
INSERT INTO jairoads_security.account_provisioning
 (user_account_id, provisioned_by, provisioner_role, provisioned_role, engineer_id, method)
VALUES (2, 1, 'SuperAdmin', 'Admin', 1, 'administrator');
WITH event AS (
 INSERT INTO jairoads_next.audit_logs
 (user_id, actor_identifier, action, entity_type, entity_id, description)
 VALUES (3, 'Synthetic writer', 'CREATE', 'MaintenanceRecord', 778,
         'Synthetic committed one-event rehearsal') RETURNING id
)
INSERT INTO jairoads_next.audit_notification_recipients
(audit_log_id, recipient_user_id, notification_message)
SELECT event.id, audience.id, 'Synthetic addressed business notification'
FROM event CROSS JOIN (VALUES (1::bigint), (2::bigint), (3::bigint)) AS audience(id);
DO $verify$
DECLARE matching_events integer; recipient_count integer; distinct_count integer;
BEGIN
 SELECT count(*) INTO matching_events FROM jairoads_next.audit_logs
  WHERE description='Synthetic committed one-event rehearsal';
 SELECT count(*), count(DISTINCT r.recipient_user_id)
   INTO recipient_count, distinct_count
 FROM jairoads_next.audit_notification_recipients r
 JOIN jairoads_next.audit_logs a ON a.id=r.audit_log_id
 WHERE a.description='Synthetic committed one-event rehearsal';
 IF (SELECT count(*) FROM jairoads_security.account_provisioning
     WHERE user_account_id=2 AND provisioned_role='Admin') <> 1 THEN
   RAISE EXCEPTION 'Provenance missing inside atomic synthetic transaction';
 END IF;
 IF matching_events <> 1 OR recipient_count <> 3 OR distinct_count <> 3 THEN
   RAISE EXCEPTION 'Expected one canonical business event and exactly 3 unique deliveries; got %, %, %',
      matching_events, recipient_count, distinct_count;
 END IF;
END;
$verify$;
COMMIT;

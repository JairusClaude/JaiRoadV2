-- Deliberate failure, EXPECTED to exit nonzero and rollback the whole transaction.
-- Synthetic accounts and disposable PostgreSQL only.
BEGIN;
SET LOCAL ROLE jairoads_app_runtime;
INSERT INTO jairoads_next.audit_logs
(user_id, actor_identifier, action, entity_type, entity_id, description)
VALUES (3, 'Synthetic writer', 'CREATE', 'MaintenanceRecord', 777,
        'Synthetic rollback rehearsal event') RETURNING id
\gset
INSERT INTO jairoads_next.audit_notification_recipients
(audit_log_id, recipient_user_id, notification_message)
VALUES (:id, 1, 'Synthetic recipient delivery before rollback');
-- The same event/recipient cannot be delivered twice. A full transaction
-- rollback must remove both the event and its first delivery.
INSERT INTO jairoads_next.audit_notification_recipients
(audit_log_id, recipient_user_id, notification_message)
VALUES (:id, 1, 'Synthetic forbidden duplicate');
COMMIT;

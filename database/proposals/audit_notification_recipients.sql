-- REVIEW PROPOSAL ONLY. Schema owner must approve/adapt before deployment.
-- Rehearsed only in guarded disposable PostgreSQL 17. No historical cleanup.
CREATE TABLE jairoads_next.audit_notification_recipients (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    audit_log_id bigint NOT NULL REFERENCES jairoads_next.audit_logs(id) ON DELETE RESTRICT,
    recipient_user_id bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    notification_message varchar(200) NOT NULL CHECK (length(btrim(notification_message)) > 0),
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT audit_notification_recipients_event_recipient_unique UNIQUE (audit_log_id, recipient_user_id)
);
CREATE INDEX audit_notification_recipients_feed_idx
    ON jairoads_next.audit_notification_recipients (recipient_user_id, created_at DESC, audit_log_id DESC);
ALTER TABLE jairoads_next.audit_notification_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jairoads_next.audit_notification_recipients FROM PUBLIC;
REVOKE ALL ON SEQUENCE jairoads_next.audit_notification_recipients_id_seq FROM PUBLIC;
DO $$
DECLARE api_role text;
BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON jairoads_next.audit_notification_recipients FROM %I', api_role);
            EXECUTE format('REVOKE ALL ON SEQUENCE jairoads_next.audit_notification_recipients_id_seq FROM %I', api_role);
        END IF;
    END LOOP;
END;
$$;

CREATE FUNCTION jairoads_next.reject_audit_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    RAISE EXCEPTION 'Audit history and notification deliveries are append-only' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION jairoads_next.reject_audit_history_mutation() FROM PUBLIC;
CREATE TRIGGER audit_notification_recipients_immutable
    BEFORE UPDATE OR DELETE ON jairoads_next.audit_notification_recipients
    FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_audit_history_mutation();
CREATE TRIGGER audit_notification_recipients_no_truncate
    BEFORE TRUNCATE ON jairoads_next.audit_notification_recipients
    FOR EACH STATEMENT EXECUTE FUNCTION jairoads_next.reject_audit_history_mutation();
-- Owner must reconcile these names with any existing append-only protections.
CREATE TRIGGER canonical_audit_history_immutable
    BEFORE UPDATE OR DELETE ON jairoads_next.audit_logs
    FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_audit_history_mutation();
CREATE TRIGGER canonical_audit_history_no_truncate
    BEFORE TRUNCATE ON jairoads_next.audit_logs
    FOR EACH STATEMENT EXECUTE FUNCTION jairoads_next.reject_audit_history_mutation();

-- No Data API grants. Use a dedicated Laravel DB role, SELECT/INSERT + sequence
-- USAGE and targeted RLS; never UPDATE/DELETE/TRUNCATE/ownership or public policy.
-- See the owner-review grant/RLS template in docs/audit/notification-policy.md.

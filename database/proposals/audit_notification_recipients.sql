-- REVIEW PROPOSAL ONLY. Schema owner must approve/adapt before deployment.
-- Live Supabase verification: project aeaaxwyytsagbacysvvx, PostgreSQL 17.6,
-- audit_logs already has immutable row and TRUNCATE triggers. Do not auto-apply.
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
-- The official database already protects audit_logs with
-- jairoads_dd_auditlog_reject_changes / jairoads_dd_auditlog_reject_truncate.
-- Preserve them without installing duplicate audit_log triggers. The guarded
-- fallback is needed for genuinely empty disposable PostgreSQL fixtures.
-- Schema owner must inspect trigger functions and adapt for other deployments.
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'jairoads_next.audit_logs'::regclass
          AND tgname IN ('jairoads_dd_auditlog_reject_changes', 'canonical_audit_history_immutable')
          AND tgenabled <> 'D'
          AND (tgtype::int & 1) <> 0   -- row trigger
          AND (tgtype::int & 2) <> 0   -- BEFORE
          AND (tgtype::int & 8) <> 0   -- DELETE
          AND (tgtype::int & 16) <> 0  -- UPDATE
    ) THEN
        CREATE TRIGGER canonical_audit_history_immutable
            BEFORE UPDATE OR DELETE ON jairoads_next.audit_logs
            FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_audit_history_mutation();
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'jairoads_next.audit_logs'::regclass
          AND tgname IN ('jairoads_dd_auditlog_reject_truncate', 'canonical_audit_history_no_truncate')
          AND tgenabled <> 'D'
          AND (tgtype::int & 32) <> 0  -- TRUNCATE
    ) THEN
        CREATE TRIGGER canonical_audit_history_no_truncate
            BEFORE TRUNCATE ON jairoads_next.audit_logs
            FOR EACH STATEMENT EXECUTE FUNCTION jairoads_next.reject_audit_history_mutation();
    END IF;
END;
$;

-- No Data API grants. Use a dedicated Laravel DB role, SELECT/INSERT + sequence
-- USAGE and targeted RLS; never UPDATE/DELETE/TRUNCATE/ownership or public policy.
-- See the owner-review grant/RLS template in docs/audit/notification-policy.md.

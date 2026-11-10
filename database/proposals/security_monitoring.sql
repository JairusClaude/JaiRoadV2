-- REVIEW PROPOSAL ONLY. Never auto-apply to shared Supabase.
-- Requires the existing private jairoads_security schema and canonical accounts.
-- Does not touch canonical AuditLog, its triggers, or historical events.
CREATE TABLE jairoads_security.authentication_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_account_id bigint REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    actor_identifier varchar(160),
    account_type varchar(20) CHECK (account_type IN ('SuperAdmin','Admin','Engineer','Viewer')),
    attempted_identifier varchar(120),
    attempt_reference char(64),
    event varchar(20) NOT NULL CHECK (event IN ('LOGIN','LOGOUT','FAILED_LOGIN')),
    outcome varchar(20) NOT NULL,
    method varchar(20) NOT NULL CHECK (method IN ('password','mfa','passkey','remember','session')),
    client_description varchar(64) NOT NULL,
    session_reference char(64),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((event='LOGIN' AND outcome='Successful' AND user_account_id IS NOT NULL)
        OR (event='LOGOUT' AND outcome='Completed')
        OR (event='FAILED_LOGIN' AND outcome='Rejected' AND user_account_id IS NULL
            AND actor_identifier IS NULL AND account_type IS NULL)),
    CHECK ((user_account_id IS NULL) = (actor_identifier IS NULL)),
    CHECK ((user_account_id IS NULL) = (account_type IS NULL))
);
CREATE INDEX authentication_events_time_idx ON jairoads_security.authentication_events(created_at DESC,id DESC);
CREATE INDEX authentication_events_kind_time_idx ON jairoads_security.authentication_events(event,created_at DESC,id DESC);
CREATE INDEX authentication_events_attempt_idx ON jairoads_security.authentication_events(attempt_reference,created_at DESC);
CREATE TABLE jairoads_security.active_sessions (
    session_reference char(64) PRIMARY KEY,
    user_account_id bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    credential_reference char(64) NOT NULL,
    login_at timestamptz,
    last_activity timestamptz NOT NULL,
    client_description varchar(64) NOT NULL
);
CREATE INDEX active_sessions_recent_idx ON jairoads_security.active_sessions(last_activity DESC,user_account_id);
CREATE FUNCTION jairoads_security.reject_authentication_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
    RAISE EXCEPTION 'Authentication history is append-only' USING ERRCODE='42501';
END;
$$;
REVOKE ALL ON FUNCTION jairoads_security.reject_authentication_history_mutation() FROM PUBLIC;
CREATE TRIGGER authentication_events_immutable BEFORE UPDATE OR DELETE ON jairoads_security.authentication_events
    FOR EACH ROW EXECUTE FUNCTION jairoads_security.reject_authentication_history_mutation();
CREATE TRIGGER authentication_events_no_truncate BEFORE TRUNCATE ON jairoads_security.authentication_events
    FOR EACH STATEMENT EXECUTE FUNCTION jairoads_security.reject_authentication_history_mutation();
ALTER TABLE jairoads_security.authentication_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE jairoads_security.active_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jairoads_security.authentication_events,jairoads_security.active_sessions FROM PUBLIC;
REVOKE ALL ON SEQUENCE jairoads_security.authentication_events_id_seq FROM PUBLIC;
DO $$ DECLARE api_role text;
BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
            EXECUTE format('REVOKE ALL ON jairoads_security.authentication_events,jairoads_security.active_sessions FROM %I',api_role);
            EXECUTE format('REVOKE ALL ON SEQUENCE jairoads_security.authentication_events_id_seq FROM %I',api_role);
        END IF;
    END LOOP;
END;
$$;
-- No API grants or automatic runtime grants/policies. Schema-owner handoff in
-- docs/audit/security-monitoring.md specifies SELECT/INSERT-only history access
-- and SELECT/INSERT/UPDATE/DELETE presence access with targeted runtime RLS.

-- Forward-only proposal. Not an applied Laravel migration.
-- Review deployed DDL and table ownership before approved shared execution.
-- No existing rows, notification delivery, or business entities are changed.
BEGIN;
CREATE FUNCTION jairoads_next.reject_audit_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Audit history is append-only' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON jairoads_next.audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION jairoads_next.reject_audit_log_mutation();
COMMIT;

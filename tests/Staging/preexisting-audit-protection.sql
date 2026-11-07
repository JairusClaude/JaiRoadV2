-- Simulate the already-installed canonical AuditLog protection on the
-- official database, without copying any real records or credentials.
CREATE FUNCTION jairoads_next.jairoads_dd_auditlog_deny_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $guard$
BEGIN
    RAISE EXCEPTION 'Immutable canonical history' USING ERRCODE='42501';
END;
$guard$;
CREATE TRIGGER jairoads_dd_auditlog_reject_changes
BEFORE UPDATE OR DELETE ON jairoads_next.audit_logs
FOR EACH ROW EXECUTE FUNCTION jairoads_next.jairoads_dd_auditlog_deny_mutation();
CREATE TRIGGER jairoads_dd_auditlog_reject_truncate
BEFORE TRUNCATE ON jairoads_next.audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION jairoads_next.jairoads_dd_auditlog_deny_mutation();

-- REVIEW TEMPLATE ONLY. NOT a runnable production migration as-is.
-- This intentionally names a non-existent candidate role and FAILS if it has
-- not been created/reviewed. Do NOT grant these privileges to anon,
-- authenticated, service_role, PUBLIC, a browser JWT role, or the current
-- Supabase dashboard connection.
--
-- Required owner workflow:
-- 1. Create a dedicated LOGIN role using approved credential management,
--    or replace the role name below with the actual restricted Laravel role.
--    Never put passwords in repository, SQL, CI logs, or chat.
-- 2. Map ALL existing Laravel DML, tables, sequences, stored procedures and
--    RLS needs (public.users/Fortify and jairoads_next business data). The
--    grants below cover ONLY the two NEW auxiliary tables, not the application.
-- 3. Rehearse on disposable PostgreSQL 17 as that exact non-owner role.
-- 4. Review API exposure before applying and require schema-owner signoff.
--
-- The two new table creation proposals must have been applied FIRST.
BEGIN;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='jairoads_app_runtime') THEN
        RAISE EXCEPTION 'Create/approve a restricted application role first; do not use postgres.';
    END IF;
    IF to_regclass('jairoads_security.account_provisioning') IS NULL
        OR to_regclass('jairoads_next.audit_notification_recipients') IS NULL THEN
        RAISE EXCEPTION 'Create both reviewed auxiliary tables first.';
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA jairoads_security TO jairoads_app_runtime;
GRANT SELECT, INSERT ON jairoads_security.account_provisioning TO jairoads_app_runtime;
CREATE POLICY runtime_provenance_read
    ON jairoads_security.account_provisioning
    FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY runtime_provenance_insert
    ON jairoads_security.account_provisioning
    FOR INSERT TO jairoads_app_runtime
    WITH CHECK (method='administrator');

GRANT USAGE ON SCHEMA jairoads_next TO jairoads_app_runtime;
GRANT SELECT, INSERT ON jairoads_next.audit_notification_recipients TO jairoads_app_runtime;
GRANT USAGE ON SEQUENCE jairoads_next.audit_notification_recipients_id_seq TO jairoads_app_runtime;
CREATE POLICY runtime_delivery_read
    ON jairoads_next.audit_notification_recipients
    FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY runtime_delivery_insert
    ON jairoads_next.audit_notification_recipients
    FOR INSERT TO jairoads_app_runtime WITH CHECK (true);
COMMIT;

-- Never grant UPDATE, DELETE, TRUNCATE or table ownership for either new
-- table. On production, the owner must also inspect membership/inherited
-- privileges, function EXECUTE, existing-table/sequence grants, backups and
-- whether role login uses a dedicated connection/pooler configuration.
--
-- No automatic role creation, historical-account transition, existing-table
-- policy broadening, password management or public-RPC changes are performed.

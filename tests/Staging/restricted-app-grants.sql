-- DISPOSABLE STAGING ONLY. Never execute against a shared/hosted database.
-- Assumes an empty guarded PostgreSQL 17 scratch database already populated
-- with the synthetic Laravel/Quarterly fixture and review-only proposals.
-- Do NOT copy these permissive backend-only RLS policies to production.
-- One backend PostgreSQL role serves many Laravel identities; authorization
-- by person/role/assignment MUST stay in the Laravel canonical identity layer.

DO $guard$
BEGIN
  IF current_database() <> 'jairoads_scratch_staging_app'
     OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
     OR current_user <> 'postgres'
     OR NOT EXISTS (
       SELECT 1 FROM pg_roles
       WHERE rolname='jairoads_app_runtime' AND rolcanlogin
         AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole
     )
     OR to_regclass('jairoads_next.audit_notification_recipients') IS NULL
     OR to_regclass('jairoads_security.account_provisioning') IS NULL THEN
    RAISE EXCEPTION 'Refusing setup outside the disposable non-owner runtime rehearsal';
  END IF;
END;
$guard$;

GRANT CONNECT ON DATABASE jairoads_scratch_staging_app TO jairoads_app_runtime;
GRANT USAGE ON SCHEMA public, jairoads_next, jairoads_security TO jairoads_app_runtime;

-- Explicit staging business-table allowlist. Ordinary tables use DML,
-- never schema ownership, TRUNCATE, TRIGGER, or REFERENCES privileges.
DO $business$
DECLARE tbl text;
BEGIN
 FOREACH tbl IN ARRAY ARRAY[
   'lgus','engineers','engineer_lgus','user_accounts','road_coverages',
   'maintenance_projects','maintenance_records','monthly_updates',
   'maintenance_documents','media'
 ] LOOP
   EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON jairoads_next.%I TO jairoads_app_runtime',tbl);
   EXECUTE format('ALTER TABLE jairoads_next.%I ENABLE ROW LEVEL SECURITY',tbl);
   EXECUTE format('CREATE POLICY staging_backend_dml ON jairoads_next.%I FOR ALL TO jairoads_app_runtime USING (true) WITH CHECK (true)',tbl);
 END LOOP;
END;
$business$;

-- File-deletion intents are optional support infrastructure with narrower grants.
-- This disposable fixture is expected to create file_deletions before this step.
GRANT SELECT, INSERT, UPDATE ON jairoads_next.file_deletions TO jairoads_app_runtime;
CREATE POLICY staging_backend_file_intents ON jairoads_next.file_deletions
  FOR ALL TO jairoads_app_runtime USING (true) WITH CHECK (true);
-- Final DD prohibits project detachment and nullable maintenance-record links.
-- maintenance_record_contexts is intentionally absent; never grant/policy it.

-- Canonical events are append-only. No UPDATE/DELETE/TRUNCATE privilege.
GRANT SELECT, INSERT ON jairoads_next.audit_logs TO jairoads_app_runtime;
ALTER TABLE jairoads_next.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY staging_backend_audit_read ON jairoads_next.audit_logs
  FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY staging_backend_audit_write ON jairoads_next.audit_logs
  FOR INSERT TO jairoads_app_runtime WITH CHECK (true);

-- Fortify infrastructure is independent of canonical account role mapping.
-- No legacy public business-table grants are introduced.
GRANT SELECT, INSERT, UPDATE ON public.users TO jairoads_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passkeys, public.password_reset_tokens TO jairoads_app_runtime;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY staging_backend_users ON public.users
  FOR ALL TO jairoads_app_runtime USING (true) WITH CHECK (true);
CREATE POLICY staging_backend_passkeys ON public.passkeys
  FOR ALL TO jairoads_app_runtime USING (true) WITH CHECK (true);
CREATE POLICY staging_backend_password_resets ON public.password_reset_tokens
  FOR ALL TO jairoads_app_runtime USING (true) WITH CHECK (true);

-- Explicitly restricted to identities and support tables inside the temporary
-- PostgreSQL service. A production migration requires per-sequence inventory.
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public, jairoads_next TO jairoads_app_runtime;

-- The two auxiliary table grants/policies are created separately from:
-- database/proposals/restricted_runtime_grants_REVIEW_ONLY.sql
-- No anon/authenticated/service_role grant or policy is authorized here.

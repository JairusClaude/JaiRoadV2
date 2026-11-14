-- STAGING FIXTURE ONLY. Never call against the official Supabase database.
-- Simulates the official public.rls_auto_enable()/ensure_rls pairing and
-- checks that restricting public EXECUTE does not break its DDL callback.
DO $identity$
BEGIN
 IF current_database() <> 'jairoads_scratch_staging_host'
    OR current_user <> 'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')
 THEN
   RAISE EXCEPTION 'Refusing non-disposable automatic-RLS rehearsal';
 END IF;
END;
$identity$;

-- This function is copied only as a simplified behaviorally equivalent
-- disposable callback; it does NOT install/alter any live function.
CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE cmd record;
BEGIN
 FOR cmd IN
   SELECT * FROM pg_event_trigger_ddl_commands()
   WHERE command_tag IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
     AND object_type IN ('table','partitioned table')
 LOOP
   IF cmd.schema_name = 'public' THEN
     EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY',cmd.object_identity);
   END IF;
 END LOOP;
END;
$$;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
EXECUTE FUNCTION public.rls_auto_enable();

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
DO $deny$
BEGIN
 IF has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
    OR has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE')
    OR has_function_privilege('service_role','public.rls_auto_enable()','EXECUTE')
 THEN
  RAISE EXCEPTION 'Public API role can still execute automatic-RLS callback';
 END IF;
END;
$deny$;

CREATE ROLE staging_rls_ddl NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT USAGE, CREATE ON SCHEMA public TO staging_rls_ddl;
-- A non-owner deliberately creates a throwaway table. The callback is invoked
-- via event trigger, not an explicit RPC/function EXECUTE grant.
BEGIN;
SET LOCAL ROLE staging_rls_ddl;
CREATE TABLE public.staging_auto_rls_permission_probe (id bigint PRIMARY KEY);
COMMIT;

DO $verify$
BEGIN
 IF NOT (SELECT c.relrowsecurity FROM pg_class c
         WHERE c.oid='public.staging_auto_rls_permission_probe'::regclass)
    OR (SELECT evtenabled FROM pg_event_trigger WHERE evtname='ensure_rls') <> 'O'
    OR has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
 THEN
   RAISE EXCEPTION 'Automatic RLS failed after public EXECUTE restriction';
 END IF;
END;
$verify$;

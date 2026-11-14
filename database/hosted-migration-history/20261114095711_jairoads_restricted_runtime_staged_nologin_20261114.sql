
SET LOCAL lock_timeout='3s';
DO $guard$
DECLARE missing_count integer;
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION 'Wrong PostgreSQL target'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='jairoads_app_runtime') THEN RAISE EXCEPTION 'Runtime role already exists'; END IF;
 IF EXISTS(SELECT 1 FROM pg_policy WHERE polname IN ('jairoads_runtime_read','jairoads_runtime_insert','jairoads_runtime_update','jairoads_runtime_delete')) THEN RAISE EXCEPTION 'Existing runtime policies require reconciliation'; END IF;
 SELECT count(*) INTO missing_count FROM (VALUES ('jairoads_next','audit_logs'),('jairoads_next','audit_notification_recipients'),('jairoads_next','engineer_lgus'),('jairoads_next','engineers'),('jairoads_next','file_deletions'),('jairoads_next','lgus'),('jairoads_next','maintenance_documents'),('jairoads_next','maintenance_projects'),('jairoads_next','maintenance_records'),('jairoads_next','media'),('jairoads_next','monthly_updates'),('jairoads_next','road_coverages'),('jairoads_next','user_accounts'),('jairoads_security','account_provisioning'),('jairoads_security','authentication_events'),('jairoads_security','active_sessions'),('public','users'),('public','sessions'),('public','password_reset_tokens'),('public','passkeys'),('public','cache'),('public','cache_locks'),('public','jobs'),('public','failed_jobs'),('public','job_batches')) AS deps(s,t) WHERE to_regclass(format('%I.%I',s,t)) IS NULL;
 IF missing_count <> 0 THEN RAISE EXCEPTION 'Required application schema objects missing: %',missing_count; END IF;
 IF EXISTS (SELECT 1 FROM pg_class c WHERE c.oid IN (SELECT to_regclass(format('%I.%I',deps.s,deps.t)) FROM (VALUES ('jairoads_next','audit_logs'),('jairoads_next','audit_notification_recipients'),('jairoads_next','engineer_lgus'),('jairoads_next','engineers'),('jairoads_next','file_deletions'),('jairoads_next','lgus'),('jairoads_next','maintenance_documents'),('jairoads_next','maintenance_projects'),('jairoads_next','maintenance_records'),('jairoads_next','media'),('jairoads_next','monthly_updates'),('jairoads_next','road_coverages'),('jairoads_next','user_accounts'),('jairoads_security','account_provisioning'),('jairoads_security','authentication_events'),('jairoads_security','active_sessions'),('public','users'),('public','sessions'),('public','password_reset_tokens'),('public','passkeys'),('public','cache'),('public','cache_locks'),('public','jobs'),('public','failed_jobs'),('public','job_batches')) AS deps(s,t)) AND c.relkind='r' AND NOT c.relrowsecurity)
 THEN RAISE EXCEPTION 'Target table unexpectedly lacks row security'; END IF;
END
$guard$;
CREATE ROLE jairoads_app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT;
GRANT CONNECT ON DATABASE postgres TO jairoads_app_runtime;
GRANT USAGE ON SCHEMA public,jairoads_next,jairoads_security TO jairoads_app_runtime;
DO $grants$
DECLARE sch text; t text; can_update boolean; can_delete boolean;
BEGIN
 FOREACH sch IN ARRAY ARRAY['jairoads_next','jairoads_security','public'] LOOP
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname=sch
  LOOP
   IF (sch='jairoads_next' AND t=ANY(ARRAY['audit_logs','audit_notification_recipients','engineer_lgus','engineers','file_deletions','lgus','maintenance_documents','maintenance_projects','maintenance_records','media','monthly_updates','road_coverages','user_accounts']))
    OR (sch='jairoads_security' AND t=ANY(ARRAY['account_provisioning','authentication_events','active_sessions']))
    OR (sch='public' AND t=ANY(ARRAY['users','sessions','password_reset_tokens','passkeys','cache','cache_locks','jobs','failed_jobs','job_batches'])) THEN
    EXECUTE format('GRANT SELECT,INSERT ON TABLE %I.%I TO jairoads_app_runtime',sch,t);
    EXECUTE format('CREATE POLICY jairoads_runtime_read ON %I.%I FOR SELECT TO jairoads_app_runtime USING (true)',sch,t);
    EXECUTE format('CREATE POLICY jairoads_runtime_insert ON %I.%I FOR INSERT TO jairoads_app_runtime WITH CHECK (true)',sch,t);
    can_update :=
     (sch='jairoads_next' AND t=ANY(ARRAY['engineer_lgus','engineers','file_deletions','lgus','maintenance_documents','maintenance_projects','maintenance_records','media','monthly_updates','road_coverages','user_accounts']))
      OR (sch='jairoads_security' AND t=ANY(ARRAY['active_sessions']))
      OR (sch='public' AND t=ANY(ARRAY['users','sessions','password_reset_tokens','passkeys','cache','cache_locks','jobs','failed_jobs','job_batches']));
    can_delete :=
     (sch='jairoads_next' AND t=ANY(ARRAY['lgus','maintenance_documents','maintenance_projects','maintenance_records','media','monthly_updates','road_coverages']))
      OR (sch='jairoads_security' AND t=ANY(ARRAY['active_sessions']))
      OR (sch='public' AND t=ANY(ARRAY['sessions','password_reset_tokens','passkeys','cache','cache_locks','jobs','failed_jobs','job_batches']));
    IF can_update THEN
     EXECUTE format('GRANT UPDATE ON TABLE %I.%I TO jairoads_app_runtime',sch,t);
     EXECUTE format('CREATE POLICY jairoads_runtime_update ON %I.%I FOR UPDATE TO jairoads_app_runtime USING (true) WITH CHECK (true)',sch,t);
    END IF;
    IF can_delete THEN
     EXECUTE format('GRANT DELETE ON TABLE %I.%I TO jairoads_app_runtime',sch,t);
     EXECUTE format('CREATE POLICY jairoads_runtime_delete ON %I.%I FOR DELETE TO jairoads_app_runtime USING (true)',sch,t);
    END IF;
   END IF;
  END LOOP;
 END LOOP;
END
$grants$;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA jairoads_next TO jairoads_app_runtime;
GRANT USAGE,SELECT ON SEQUENCE jairoads_security.authentication_events_id_seq TO jairoads_app_runtime;
GRANT USAGE,SELECT ON SEQUENCE public.users_id_seq, public.passkeys_id_seq,public.jobs_id_seq,public.failed_jobs_id_seq TO jairoads_app_runtime;

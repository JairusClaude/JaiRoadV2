SET LOCAL lock_timeout = '3s';
DO $guard$
BEGIN
 IF current_database() <> 'postgres'
  OR to_regclass('jairoads_next.user_accounts') IS NULL
  OR to_regclass('jairoads_next.maintenance_documents') IS NULL
  OR to_regclass('jairoads_next.media') IS NULL
  OR to_regclass('jairoads_next.file_deletions') IS NOT NULL
 THEN RAISE EXCEPTION 'Canonical file-deletion readiness preflight failed'; END IF;
END
$guard$;
CREATE TABLE jairoads_next.file_deletions (
  id bigserial PRIMARY KEY,
  kind varchar(20) NOT NULL,
  entity_id bigint NOT NULL,
  requested_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
  initiated_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
  actor_role varchar(20) NOT NULL,
  actor_identifier varchar(255) NOT NULL,
  maintenance_id bigint NOT NULL,
  monthly_update_id bigint,
  file_name varchar(255) NOT NULL,
  object_path text,
  storage_origin text,
  bucket varchar(255),
  state varchar(20) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error_code varchar(40),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamptz,
  CONSTRAINT file_deletions_kind_entity_id_unique UNIQUE(kind,entity_id),
  CONSTRAINT file_deletions_state_ck CHECK(state IN ('pending','completed')),
  CONSTRAINT file_deletions_kind_ck CHECK(kind IN ('document','media')),
  CONSTRAINT file_deletions_actor_ck CHECK(actor_role IN ('Admin','SuperAdmin')),
  CONSTRAINT file_deletions_target_ck CHECK(state = 'completed' OR (object_path IS NOT NULL AND storage_origin IS NOT NULL AND bucket IS NOT NULL))
);
CREATE INDEX file_deletions_state_attempts_id_index ON jairoads_next.file_deletions(state,attempts,id);
ALTER TABLE jairoads_next.file_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jairoads_next.file_deletions FROM PUBLIC;
REVOKE ALL ON SEQUENCE jairoads_next.file_deletions_id_seq FROM PUBLIC;
DO $private_api_acl$
DECLARE api_role text;
BEGIN
 FOREACH api_role IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
   EXECUTE format('REVOKE ALL ON jairoads_next.file_deletions FROM %I',api_role);
   EXECUTE format('REVOKE ALL ON SEQUENCE jairoads_next.file_deletions_id_seq FROM %I',api_role);
  END IF;
 END LOOP;
END
$private_api_acl$;

-- REVIEW ONLY: install with schema-owner approval before enabling JAIROADS_UPLOAD_JOURNAL_ENABLED.
-- No existing data or permissions changed. Runtime role needs its explicit RLS policy and narrow grants.
CREATE TABLE jairoads_next.upload_journal (
    id bigserial PRIMARY KEY,
    kind varchar(20) NOT NULL CHECK (kind IN ('document','media')),
    parent_id bigint NOT NULL CHECK (parent_id > 0),
    object_path text NOT NULL,
    storage_origin text NOT NULL,
    bucket text NOT NULL,
    state varchar(20) NOT NULL CHECK (state IN ('pending','committed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    UNIQUE (storage_origin,bucket,object_path),
    CHECK ((state='pending' AND completed_at IS NULL) OR (state='committed' AND completed_at IS NOT NULL)),
    CHECK ((kind='document' AND object_path ~ '^maintenance-records/[0-9]+/[0-9a-f-]+\.(pdf|docx|xlsx|pptx)$') OR (kind='media' AND object_path ~ '^monthly-updates/[0-9]+/[0-9a-f-]+\.(jpg|png|webp|mp4|webm)$'))
);
CREATE INDEX upload_journal_pending_idx ON jairoads_next.upload_journal (created_at,id) WHERE state='pending';
ALTER TABLE jairoads_next.upload_journal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jairoads_next.upload_journal FROM PUBLIC;
REVOKE ALL ON SEQUENCE jairoads_next.upload_journal_id_seq FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON jairoads_next.upload_journal FROM anon;
    REVOKE ALL ON SEQUENCE jairoads_next.upload_journal_id_seq FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON jairoads_next.upload_journal FROM authenticated;
    REVOKE ALL ON SEQUENCE jairoads_next.upload_journal_id_seq FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='jairoads_app_runtime') THEN
    GRANT SELECT, INSERT ON jairoads_next.upload_journal TO jairoads_app_runtime;
    GRANT UPDATE (state,completed_at) ON jairoads_next.upload_journal TO jairoads_app_runtime;
    GRANT USAGE, SELECT ON SEQUENCE jairoads_next.upload_journal_id_seq TO jairoads_app_runtime;
    CREATE POLICY upload_journal_read ON jairoads_next.upload_journal FOR SELECT TO jairoads_app_runtime USING (true);
    CREATE POLICY upload_journal_insert ON jairoads_next.upload_journal FOR INSERT TO jairoads_app_runtime WITH CHECK (state='pending');
    CREATE POLICY upload_journal_complete ON jairoads_next.upload_journal FOR UPDATE TO jairoads_app_runtime USING (state='pending') WITH CHECK (state='committed');
  END IF;
END $$;

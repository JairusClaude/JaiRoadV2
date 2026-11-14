<?php

// REVIEW ONLY: schema-owner approval required. Not in automatic migrations.
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            DB::unprepared(<<<'SQL'
CREATE TABLE jairoads_next.maintenance_record_contexts (
 maintenance_id bigint PRIMARY KEY REFERENCES jairoads_next.maintenance_records(id) ON DELETE RESTRICT,
 previous_project_id bigint NOT NULL,
 snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
 detached_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
 detached_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE jairoads_next.maintenance_record_contexts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jairoads_next.maintenance_record_contexts FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON jairoads_next.maintenance_record_contexts FROM anon; END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON jairoads_next.maintenance_record_contexts FROM authenticated; END IF;
END $$;
CREATE FUNCTION jairoads_next.protect_maintenance_record_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Historical maintenance context is append-only'; END $$;
CREATE TRIGGER protect_maintenance_record_context BEFORE UPDATE OR DELETE ON jairoads_next.maintenance_record_contexts
 FOR EACH ROW EXECUTE FUNCTION jairoads_next.protect_maintenance_record_context();
CREATE TRIGGER protect_maintenance_record_context_truncate BEFORE TRUNCATE ON jairoads_next.maintenance_record_contexts
 FOR EACH STATEMENT EXECUTE FUNCTION jairoads_next.protect_maintenance_record_context();
REVOKE ALL ON FUNCTION jairoads_next.protect_maintenance_record_context() FROM PUBLIC;
ALTER TABLE jairoads_next.maintenance_records ALTER COLUMN project_id DROP NOT NULL, ALTER COLUMN managing_engineer_id DROP NOT NULL;
CREATE FUNCTION jairoads_next.require_maintenance_record_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM jairoads_next.maintenance_records r WHERE r.id=NEW.id AND r.project_id IS NULL)
 AND NOT EXISTS (SELECT 1 FROM jairoads_next.maintenance_record_contexts h WHERE h.maintenance_id=NEW.id) THEN
  RAISE EXCEPTION 'Detached maintenance requires historical context';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER require_maintenance_record_context AFTER INSERT OR UPDATE ON jairoads_next.maintenance_records
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION jairoads_next.require_maintenance_record_context();
REVOKE ALL ON FUNCTION jairoads_next.require_maintenance_record_context() FROM PUBLIC;
SQL);
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Historical context and nullable records require a separately reviewed forward recovery plan.');
    }
};

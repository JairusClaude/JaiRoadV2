-- Read-only inspection for the EXISTING development database, before migrations.
-- Run with psql as documented in docs/maintenance-projects-integration.md.
-- Does not print passwords, tokens, GeoJSON, names, emails, or record contents.
\set ON_ERROR_STOP on
\pset pager off
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

SELECT version(), current_schema();
SHOW transaction_read_only;
SHOW search_path;

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = current_schema()
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT table_name, column_name, data_type, udt_name, is_nullable,
       CASE WHEN column_name ~* 'password|secret|token|credential|recovery'
            THEN '[redacted]' ELSE column_default END AS column_default,
       character_maximum_length, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name IN ('users', 'user_accounts', 'engineers', 'engineer_lgus',
      'lgus', 'roads', 'road_coverages', 'maintenance_projects',
      'maintenance_records', 'monthly_updates', 'project_documents',
      'updates_media', 'media', 'maintenance_documents', 'audit_logs')
ORDER BY table_name, ordinal_position;

SELECT t.typname AS type_name, e.enumlabel, e.enumsortorder
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
JOIN pg_enum e ON e.enumtypid = t.oid
WHERE n.nspname = current_schema()
ORDER BY type_name, e.enumsortorder;

-- Includes incoming foreign keys, checks, and whether constraints are validated.
SELECT n.nspname AS table_schema, t.relname AS table_name, c.conname,
       c.contype, c.convalidated, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = current_schema()
ORDER BY t.relname, c.conname;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = current_schema()
ORDER BY tablename, indexname;

-- Generate SELECTs only for tables that exist. Identifiers are quoted by format.
SELECT format('SELECT %L AS table_name, count(*) AS row_count FROM %I.%I;',
    table_name, table_schema, table_name)
FROM information_schema.tables
WHERE table_schema = current_schema()
  AND table_type = 'BASE TABLE'
  AND table_name IN ('users', 'user_accounts', 'engineers', 'engineer_lgus',
      'lgus', 'roads', 'road_coverages', 'maintenance_projects',
      'maintenance_records', 'monthly_updates', 'project_documents',
      'updates_media', 'media', 'maintenance_documents', 'audit_logs')
ORDER BY table_name
\gexec

SELECT format('SELECT migration, batch FROM %I.migrations ORDER BY batch, migration;', current_schema())
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'migrations'
    AND column_name = 'migration'
) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'migrations'
    AND column_name = 'batch'
)
\gexec

SELECT format('SELECT count(*) AS unmapped_projects FROM %I.maintenance_projects WHERE road_coverage_id IS NULL;', current_schema())
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'maintenance_projects'
    AND column_name = 'road_coverage_id'
)
\gexec

SELECT format('SELECT count(*) AS duplicated_coverage_assignments FROM (SELECT road_coverage_id FROM %I.maintenance_projects WHERE road_coverage_id IS NOT NULL GROUP BY road_coverage_id HAVING count(*) > 1) duplicates;', current_schema())
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'maintenance_projects'
    AND column_name = 'road_coverage_id'
)
\gexec

SELECT format('SELECT "accountType", is_active, count(*) AS account_count FROM %I.user_accounts GROUP BY "accountType", is_active ORDER BY "accountType", is_active;', current_schema())
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'user_accounts'
    AND column_name = 'accountType'
) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'user_accounts'
    AND column_name = 'is_active'
)
\gexec

SELECT format('SELECT count(*) AS projects_with_history, coalesce(sum(history_count), 0) AS history_rows FROM (SELECT count(*) AS history_count FROM %I.maintenance_records GROUP BY maintenance_projects_id) history;', current_schema())
WHERE EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'maintenance_records'
    AND column_name = 'maintenance_projects_id'
)
\gexec

COMMIT;

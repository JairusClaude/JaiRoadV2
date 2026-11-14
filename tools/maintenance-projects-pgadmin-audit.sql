-- pgAdmin Query Tool version: ordinary SQL, with no psql backslash commands.
-- Run the WHOLE file in a new Query Tool tab connected to the DEVELOPMENT DB.
-- Output: schema_report and data_checks_sql (both text).
-- Save schema_report. Copy data_checks_sql to another new tab and run it whole;
-- save its data_report too. Both stages run in READ ONLY transactions.
-- No user records, passwords, tokens, geometry, or individual project IDs.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

WITH relevant_tables AS (
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
      AND table_name IN ('users', 'user_accounts', 'engineers', 'engineer_lgus',
          'lgus', 'roads', 'road_coverages', 'maintenance_projects',
          'maintenance_records', 'monthly_updates', 'project_documents',
          'updates_media', 'media', 'maintenance_documents', 'audit_logs')
), relevant_columns AS (
    SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable,
           CASE WHEN c.column_name ~* 'password|secret|token|credential|recovery'
                THEN '[redacted]' ELSE c.column_default END AS column_default,
           c.character_maximum_length, c.numeric_precision, c.numeric_scale,
           c.ordinal_position
    FROM information_schema.columns c
    JOIN relevant_tables t USING (table_schema, table_name)
), constraints_report AS (
    SELECT t.relname AS table_name, c.conname, c.contype, c.convalidated,
           pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = current_schema()
), indexes_report AS (
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = current_schema()
), enums_report AS (
    SELECT t.typname AS type_name, e.enumlabel, e.enumsortorder
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE n.nspname = current_schema()
), checks AS (
    SELECT 'row_count_' || table_name AS check_name,
           format('SELECT jsonb_build_object(''section'', ''row_count'', ''table'', %L, ''count'', count(*)) AS item FROM %I.%I',
               table_name, table_schema, table_name) AS sql
    FROM relevant_tables
    UNION ALL
    SELECT 'migrations', format('SELECT jsonb_build_object(''section'', ''migrations'', ''rows'', coalesce(jsonb_agg(jsonb_build_object(''migration'', migration, ''batch'', batch) ORDER BY batch, migration), ''[]''::jsonb)) AS item FROM %I.migrations', current_schema())
    WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'migrations' AND column_name = 'migration')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'migrations' AND column_name = 'batch')
    UNION ALL
    SELECT 'unmapped_projects', format('SELECT jsonb_build_object(''section'', ''unmapped_projects'', ''count'', count(*)) AS item FROM %I.maintenance_projects WHERE road_coverage_id IS NULL', current_schema())
    WHERE EXISTS (SELECT 1 FROM relevant_columns WHERE table_name = 'maintenance_projects' AND column_name = 'road_coverage_id')
    UNION ALL
    SELECT 'duplicate_coverages', format('SELECT jsonb_build_object(''section'', ''duplicate_coverages'', ''count'', count(*)) AS item FROM (SELECT road_coverage_id FROM %I.maintenance_projects WHERE road_coverage_id IS NOT NULL GROUP BY road_coverage_id HAVING count(*) > 1) duplicates', current_schema())
    WHERE EXISTS (SELECT 1 FROM relevant_columns WHERE table_name = 'maintenance_projects' AND column_name = 'road_coverage_id')
    UNION ALL
    SELECT 'roles', format('SELECT jsonb_build_object(''section'', ''roles'', ''rows'', coalesce(jsonb_agg(to_jsonb(roles)), ''[]''::jsonb)) AS item FROM (SELECT "accountType" AS role, is_active, count(*) AS account_count FROM %I.user_accounts GROUP BY "accountType", is_active ORDER BY "accountType", is_active) roles', current_schema())
    WHERE EXISTS (SELECT 1 FROM relevant_columns WHERE table_name = 'user_accounts' AND column_name = 'accountType')
      AND EXISTS (SELECT 1 FROM relevant_columns WHERE table_name = 'user_accounts' AND column_name = 'is_active')
    UNION ALL
    SELECT 'history', format('SELECT jsonb_build_object(''section'', ''history'', ''projects_with_history'', count(*), ''history_rows'', coalesce(sum(history_count), 0)) AS item FROM (SELECT count(*) AS history_count FROM %I.maintenance_records GROUP BY maintenance_projects_id) history', current_schema())
    WHERE EXISTS (SELECT 1 FROM relevant_columns WHERE table_name = 'maintenance_records' AND column_name = 'maintenance_projects_id')
)
SELECT jsonb_pretty(jsonb_build_object(
    'server_version', current_setting('server_version'),
    'schema', current_schema(),
    'search_path', current_setting('search_path'),
    'read_only', current_setting('transaction_read_only'),
    'tables', coalesce((SELECT jsonb_agg(table_name ORDER BY table_name) FROM relevant_tables), '[]'::jsonb),
    'columns', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name, ordinal_position) FROM relevant_columns c), '[]'::jsonb),
    'constraints', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY table_name, conname) FROM constraints_report c), '[]'::jsonb),
    'indexes', coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY tablename, indexname) FROM indexes_report i), '[]'::jsonb),
    'enum_values', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY type_name, enumsortorder) FROM enums_report e), '[]'::jsonb)
)) AS schema_report,
    CASE WHEN count(*) = 0 THEN '-- No expected tables found. Report schema_report; check database/schema selection.'
    ELSE E'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSET LOCAL statement_timeout = ''30s'';\nSET LOCAL lock_timeout = ''5s'';\nSELECT jsonb_pretty(jsonb_agg(item)) AS data_report FROM (\n'
        || string_agg(sql, E'\nUNION ALL\n' ORDER BY check_name)
        || E'\n) audit;\nCOMMIT;'
    END AS data_checks_sql
FROM checks;

COMMIT;

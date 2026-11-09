-- JaiROADS Task 13 — schema-owner READ-ONLY release inventory.
-- Run ONLY with an explicitly approved, restricted read-only operator session.
-- This is NOT migration SQL, a backup, a privilege change or deployment.
-- It returns aggregate booleans/counts: no account emails, names, hashes,
-- passwords, event payloads, Storage paths or personal data.
--
-- The result is an observation, NOT production authorization. Do not infer
-- privileged user recovery, legitimate identity review, or UAT from catalog
-- metadata. Never pass official connection strings to CI or GitHub.
BEGIN TRANSACTION READ ONLY;

WITH
audit_guard AS (
 SELECT
  COALESCE(bool_or(tgenabled <> 'D'
    AND tgname IN ('jairoads_dd_auditlog_reject_changes',
                   'canonical_audit_history_immutable')
    AND (tgtype::int & 1) <> 0
    AND (tgtype::int & 2) <> 0
    AND (tgtype::int & 8) <> 0
    AND (tgtype::int & 16) <> 0), false) AS has_update_delete,
  COALESCE(bool_or(tgenabled <> 'D'
    AND tgname IN ('jairoads_dd_auditlog_reject_truncate',
                   'canonical_audit_history_no_truncate')
    AND (tgtype::int & 32) <> 0), false) AS has_truncate
 FROM pg_trigger
 WHERE tgrelid = to_regclass('jairoads_next.audit_logs')
   AND NOT tgisinternal
),
runtime_role AS (
 SELECT EXISTS (
   SELECT 1 FROM pg_roles
    WHERE rolname='jairoads_app_runtime'
      AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls
      AND NOT rolcreatedb AND NOT rolcreaterole
 ) AS has_restricted_login
),
maintenance_required AS (
 SELECT count(*)=2 AND COALESCE(bool_and(a.attnotnull),false) AS are_required
 FROM pg_attribute a
 WHERE a.attrelid = to_regclass('jairoads_next.maintenance_records')
   AND a.attnum > 0 AND NOT a.attisdropped
   AND a.attname IN ('project_id','managing_engineer_id')
),
maintenance_restrict_fks AS (
 SELECT count(*)=2 AND count(DISTINCT source_column.attname)=2
    AND COALESCE(bool_and(fk.confdeltype = 'r'),false) AS are_restrict
 FROM pg_constraint fk
 JOIN pg_attribute source_column
   ON source_column.attrelid=fk.conrelid
   AND source_column.attnum = ANY(fk.conkey)
 WHERE fk.conrelid=to_regclass('jairoads_next.maintenance_records')
   AND fk.contype='f'
   AND cardinality(fk.conkey)=1
   AND (
      (source_column.attname='project_id'
        AND fk.confrelid=to_regclass('jairoads_next.maintenance_projects'))
      OR (source_column.attname='managing_engineer_id'
        AND fk.confrelid=to_regclass('jairoads_next.engineers'))
   )
),
period_index AS (
 SELECT EXISTS (
  SELECT 1 FROM pg_index i
  JOIN pg_class ix ON ix.oid=i.indexrelid
  WHERE i.indrelid=to_regclass('jairoads_next.maintenance_records')
    AND i.indisunique AND i.indpred IS NULL AND i.indexprs IS NULL
    AND i.indnkeyatts=3
    AND ix.relname='maintenance_records_project_year_quarter_unique'
    AND pg_get_indexdef(i.indexrelid) ILIKE '%(project_id, maintenance_year, quarter)%'
 ) AS has_unique_constraint
),
new_tables AS (
 SELECT
  to_regclass('jairoads_security.account_provisioning') IS NOT NULL AS has_provenance,
  to_regclass('jairoads_next.audit_notification_recipients') IS NOT NULL AS has_notifications,
  to_regclass('jairoads_next.file_deletions') IS NOT NULL AS has_file_intents,
  to_regclass('jairoads_next.maintenance_record_contexts') IS NOT NULL AS has_contexts
)
SELECT jsonb_build_object(
  'schema_version', 1,
  'source', 'read_only_postgresql_catalog',
  'checks', jsonb_build_object(
    'postgres17', current_setting('server_version_num')::int BETWEEN 170000 AND 179999,
    'audit_mutation_and_truncate_guards', audit_guard.has_update_delete AND audit_guard.has_truncate,
    'provenance_table_present', new_tables.has_provenance,
    'notification_recipients_present', new_tables.has_notifications,
    'file_deletion_intents_present', new_tables.has_file_intents,
    'maintenance_project_manager_not_null', maintenance_required.are_required,
    'maintenance_project_manager_restrict_fk', maintenance_restrict_fks.are_restrict,
    'no_maintenance_record_contexts', NOT new_tables.has_contexts,
    'quarterly_unique_constraint_present', period_index.has_unique_constraint,
    'restricted_runtime_login_present', runtime_role.has_restricted_login,
    'active_superadmin_exists', EXISTS (
        SELECT 1 FROM jairoads_next.user_accounts
        WHERE account_type='SuperAdmin' AND is_active
    ),
    'no_active_admin_missing_engineer', NOT EXISTS (
        SELECT 1 FROM jairoads_next.user_accounts
        WHERE account_type='Admin' AND is_active AND engineer_id IS NULL
    )
  ),
  'notes', jsonb_build_array(
    'Aggregate structural inventory only; no user or reviewer identity verified.',
    'This result does not verify RLS policy completeness, Storage object backup, UAT or approvals.',
    'Owner must inspect actual table grants, data API exposure and function execution separately.'
  )
) AS release_inventory
FROM audit_guard, runtime_role, maintenance_required, maintenance_restrict_fks, period_index, new_tables;

COMMIT;

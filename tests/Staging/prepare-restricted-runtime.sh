#!/usr/bin/env bash
# Temporary CI-only role; does not touch official Supabase.
set -Eeuo pipefail
if [[ "${JAIROADS_SCRATCH_APPROVAL:-}" != "DISPOSABLE_LOCAL_ONLY"
  || "${APP_ENV:-}" != "testing"
  || "${DB_CONNECTION:-}" != "pgsql"
  || "${DB_HOST:-}" != "127.0.0.1"
  || "${DB_PORT:-5432}" != "5432"
  || "${DB_DATABASE:-}" != "jairoads_scratch_staging_app"
  || "${DB_USERNAME:-}" != "postgres"
  || -z "${DB_PASSWORD:-}"
  || -n "${DB_URL:-}"
  || -n "${RENDER:-}"
  || -z "${GITHUB_ENV:-}" ]]; then
  echo "Refusing non-disposable/non-GitHub runtime role setup." >&2
  exit 2
fi
export PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USERNAME" PGPASSWORD="$DB_PASSWORD" PGSSLMODE=disable
identity="$(psql -X -v ON_ERROR_STOP=1 -d "$DB_DATABASE" -Atqc "SELECT current_database() || ':' || current_user || ':' || current_setting('server_version_num')")"
if [[ "$identity" != "jairoads_scratch_staging_app:postgres:"17* ]]; then
  echo "Refusing unexpected PostgreSQL identity/version." >&2
  exit 2
fi
# Use a one-time credential and keep it out of repository, stdout, and SQL files.
runtime_secret="$(openssl rand -hex 24)"
printf '::add-mask::%s\n' "$runtime_secret"
psql -X -v ON_ERROR_STOP=1 -v runtime_secret="$runtime_secret" -d "$DB_DATABASE" >/dev/null <<'ROLE'
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE jairoads_app_runtime
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
  PASSWORD :'runtime_secret';
ROLE
# This reviewed template only covers the TWO auxiliary tables.
psql -X -v ON_ERROR_STOP=1 -d "$DB_DATABASE" -f database/proposals/restricted_runtime_grants_REVIEW_ONLY.sql >/dev/null
# All other grants are disposable and documented as NOT production policy.
psql -X -v ON_ERROR_STOP=1 -d "$DB_DATABASE" -f tests/Staging/restricted-app-grants.sql >/dev/null

PGUSER=jairoads_app_runtime PGPASSWORD="$runtime_secret" \
  psql -X -v ON_ERROR_STOP=1 -d "$DB_DATABASE" >/dev/null <<'VERIFY'
DO $rehearsal$
BEGIN
 IF current_user <> 'jairoads_app_runtime'
  OR (SELECT rolbypassrls OR rolsuper OR rolcreaterole
      FROM pg_roles WHERE rolname=current_user)
  OR has_database_privilege(current_user,current_database(),'CREATE')
  OR has_schema_privilege(current_user,'jairoads_next','CREATE')
  OR has_schema_privilege(current_user,'jairoads_security','CREATE')
  OR has_table_privilege(current_user,'jairoads_next.audit_logs','UPDATE')
  OR has_table_privilege(current_user,'jairoads_next.audit_logs','DELETE')
  OR has_table_privilege(current_user,'jairoads_security.account_provisioning','UPDATE')
  OR has_table_privilege(current_user,'jairoads_next.audit_notification_recipients','DELETE')
  OR NOT row_security_active('jairoads_next.audit_logs'::regclass)
  OR NOT row_security_active('jairoads_security.account_provisioning'::regclass)
  OR NOT row_security_active('public.users'::regclass)
 THEN
   RAISE EXCEPTION 'Restricted runtime/role/RLS rehearsal failed';
 END IF;
END;
$rehearsal$;
VERIFY
printf 'JAIROADS_RUNTIME_TEST_PASSWORD=%s\n' "$runtime_secret" >> "$GITHUB_ENV"
echo "PASS: Laravel staging LOGIN role is non-owner, NOBYPASSRLS, no schema DDL, immutable event tables"

#!/usr/bin/env bash
# Disposable-only schema-owner rehearsal; NEVER points at official Supabase.
set -Eeuo pipefail
: "${JAIROADS_SCRATCH_APPROVAL:?Missing explicit disposable approval}"
: "${DB_HOST:?Missing local PostgreSQL host}"
: "${DB_DATABASE:?Missing test database name}"
: "${DB_USERNAME:?Missing local PostgreSQL user}"
: "${DB_PASSWORD:?Missing disposable PostgreSQL password}"
if [[ "$JAIROADS_SCRATCH_APPROVAL" != "DISPOSABLE_LOCAL_ONLY" ||
      "$DB_HOST" != "127.0.0.1" ||
      "${DB_PORT:-5432}" != "5432" ||
      "$DB_DATABASE" != "jairoads_scratch_staging_host" ||
      "$DB_USERNAME" != "postgres" ||
      -n "${DB_URL:-}" ||
      -n "${RENDER:-}" ]]; then
  echo "Refusing non-disposable / nonlocal PostgreSQL rehearsal." >&2
  exit 2
fi
export PGHOST="$DB_HOST" PGPORT="${DB_PORT:-5432}" PGUSER="$DB_USERNAME" PGPASSWORD="$DB_PASSWORD" PGSSLMODE=disable
version="$(psql -X -v ON_ERROR_STOP=1 -d "$DB_DATABASE" -Atqc 'SHOW server_version_num')"
if [[ "$version" -lt 170000 || "$version" -ge 180000 ]]; then
  echo "PostgreSQL 17 is required." >&2
  exit 2
fi
psql -X -v ON_ERROR_STOP=1 -d "$DB_DATABASE" <<'ROLES'
CREATE ROLE jairoads_app_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS;
ROLES

for mode in fallback existing; do
  db="jairoads_scratch_staging_${mode}"
  echo "Rehearsing synthetic ${mode} canonical-audit guard in ${db}"
  createdb "$db"
  psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/Quarterly/fixtures/canonical.sql >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/Staging/synthetic-base.sql >/dev/null
  if [[ "$mode" == "existing" ]]; then
    psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/Staging/preexisting-audit-protection.sql >/dev/null
  fi
  psql -X -v ON_ERROR_STOP=1 -d "$db" -f database/proposals/canonical_account_provisioning.sql >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$db" -f database/proposals/audit_notification_recipients.sql >/dev/null
  # This REVIEW ONLY template cannot produce a full Laravel role; it grants
  # ONLY the two new auxiliary tables. Add minimal synthetic source SELECT
  # permissions here to prove provenance trigger operation under RLS.
  psql -X -v ON_ERROR_STOP=1 -d "$db" -f database/proposals/restricted_runtime_grants_REVIEW_ONLY.sql >/dev/null
  psql -X -v ON_ERROR_STOP=1 -d "$db" <<'SOURCE_GRANTS'
GRANT SELECT ON jairoads_next.user_accounts, jairoads_next.engineers, public.users TO jairoads_app_runtime;
CREATE POLICY staging_only_accounts_read ON jairoads_next.user_accounts FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY staging_only_engineers_read ON jairoads_next.engineers FOR SELECT TO jairoads_app_runtime USING (true);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY staging_only_fortify_read ON public.users FOR SELECT TO jairoads_app_runtime USING (true);
SOURCE_GRANTS
  psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/Staging/assert-auxiliary.sql >/dev/null
  echo "PASS: ${db} private tables, immutable AuditLog, restricted RLS inserts, no API grants"
done

#!/usr/bin/env bash
# CI-only, local scratch PostgreSQL 17. Absolutely no shared Supabase access.
set -Eeuo pipefail
if [[ "$JAIROADS_SCRATCH_APPROVAL" != "DISPOSABLE_LOCAL_ONLY" ||
      "$APP_ENV" != "testing" || "$GITHUB_ACTIONS" != "true" ||
      "$DB_CONNECTION" != "pgsql" || "$DB_HOST" != "127.0.0.1" ||
      "$DB_PORT" != "5432" ||
      "$DB_DATABASE" != "jairoads_scratch_staging_host" ||
      "$DB_USERNAME" != "postgres" || -z "$DB_PASSWORD" ||
      -n "$DB_URL" ]] || [[ -v RENDER ]]; then
  echo "Refusing non-disposable/non-GitHub PostgreSQL rehearsal." >&2
  exit 2
fi
export PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USERNAME"
export PGPASSWORD="$DB_PASSWORD" PGSSLMODE=disable
identity="$(psql -X -v ON_ERROR_STOP=1 -d "$DB_DATABASE" -Atqc "SELECT current_database() || ':' || current_user || ':' || current_setting('server_version_num')")"
if [[ ! "$identity" =~ ^jairoads_scratch_staging_host:postgres:17[0-9]{4}$ ]]; then
  echo "Unexpected PostgreSQL identity/version." >&2
  exit 2
fi
db="jairoads_scratch_staging_atomic"
createdb "$db"
psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/Quarterly/fixtures/canonical.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/Staging/synthetic-base.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/Staging/preexisting-audit-protection.sql >/dev/null

# Inject a failure AFTER both new schemas are constructed in the same txn.
log="$(mktemp)"
trap 'rm -f "$log"' EXIT
if psql -X -1 -v ON_ERROR_STOP=1 -d "$db" \
  -f database/proposals/canonical_account_provisioning.sql \
  -f database/proposals/audit_notification_recipients.sql \
  -c 'SELECT 1/0;' >"$log" 2>&1; then
  echo "ERROR: deliberate SQL migration failure unexpectedly succeeded." >&2
  exit 1
fi
if ! grep -q 'division by zero' "$log"; then
  echo "ERROR: failed before intended injected migration error." >&2
  tail -n 20 "$log" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$db" >/dev/null <<'ROLLBACK_CHECK'
DO $check$
DECLARE intact_triggers integer;
BEGIN
 IF to_regnamespace('jairoads_security') IS NOT NULL
    OR to_regclass('jairoads_next.audit_notification_recipients') IS NOT NULL THEN
   RAISE EXCEPTION 'Failed migration created partial auxiliary objects';
 END IF;
 SELECT count(*) INTO intact_triggers FROM pg_trigger
 WHERE tgrelid='jairoads_next.audit_logs'::regclass
   AND NOT tgisinternal AND tgenabled <> 'D'
   AND tgname IN ('jairoads_dd_auditlog_reject_changes','jairoads_dd_auditlog_reject_truncate');
 IF intact_triggers <> 2
    OR (SELECT count(*) FROM jairoads_next.audit_logs) <> 1
    OR (SELECT count(*) FROM jairoads_next.user_accounts) <> 3 THEN
   RAISE EXCEPTION 'Failed migration modified existing immutable history/identities';
 END IF;
END;
$check$;
ROLLBACK_CHECK

# Repeat both proposals in one successful forward transaction.
psql -X -1 -v ON_ERROR_STOP=1 -d "$db" \
  -f database/proposals/canonical_account_provisioning.sql \
  -f database/proposals/audit_notification_recipients.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$db" \
  -f database/proposals/restricted_runtime_grants_REVIEW_ONLY.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$db" >/dev/null <<'PERMISSIONS'
GRANT SELECT ON jairoads_next.user_accounts,jairoads_next.engineers,public.users TO jairoads_app_runtime;
ALTER TABLE jairoads_next.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jairoads_next.engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY staging_atomic_accounts ON jairoads_next.user_accounts FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY staging_atomic_engineers ON jairoads_next.engineers FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY staging_atomic_fortify ON public.users FOR SELECT TO jairoads_app_runtime USING (true);
GRANT SELECT, INSERT ON jairoads_next.audit_logs TO jairoads_app_runtime;
GRANT USAGE ON SEQUENCE jairoads_next.audit_logs_id_seq TO jairoads_app_runtime;
ALTER TABLE jairoads_next.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY staging_atomic_audit_read ON jairoads_next.audit_logs FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY staging_atomic_audit_insert ON jairoads_next.audit_logs FOR INSERT TO jairoads_app_runtime WITH CHECK (true);
PERMISSIONS

# A duplicate event/recipient after the first delivery must rollback both.
if psql -X -v ON_ERROR_STOP=1 -d "$db" \
  -f tests/Staging/atomic-transaction-failure.sql >"$log" 2>&1; then
  echo "ERROR: duplicate synthetic delivery was accepted." >&2
  exit 1
fi
if ! grep -q 'duplicate key value violates unique constraint' "$log"; then
  echo "ERROR: failed before intended recipient uniqueness rejection." >&2
  tail -n 20 "$log" >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -d "$db" >/dev/null <<'EVENT_ROLLBACK'
DO $check$
BEGIN
 IF (SELECT count(*) FROM jairoads_next.audit_logs) <> 1
    OR (SELECT count(*) FROM jairoads_next.audit_notification_recipients) <> 0
    OR (SELECT count(*) FROM jairoads_security.account_provisioning) <> 0 THEN
   RAISE EXCEPTION 'Failed event/delivery transaction persisted partial rows';
 END IF;
END;
$check$;
EVENT_ROLLBACK

psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/Staging/atomic-transaction-success.sql >/dev/null
psql -X -v ON_ERROR_STOP=1 -d "$db" -f tests/Staging/atomic-postconditions.sql >/dev/null
echo "PASS: rollback of migration and business event; canonical history retained; one event, three unique deliveries, restricted provenance, immutable FK/unique constraints"

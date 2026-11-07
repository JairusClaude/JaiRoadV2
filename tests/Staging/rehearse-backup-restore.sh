#!/usr/bin/env bash
# Task 12: real pg_dump/pg_restore, synthetic PostgreSQL 17 only.
# NEVER connect this script to official Supabase or an operator's local files.
set -Eeuo pipefail
if [[ "$GITHUB_ACTIONS" != "true" ||
      "$JAIROADS_SCRATCH_APPROVAL" != "DISPOSABLE_LOCAL_ONLY" ||
      "$APP_ENV" != "testing" ||
      "$DB_CONNECTION" != "pgsql" ||
      "$DB_HOST" != "127.0.0.1" ||
      "$DB_PORT" != "5432" ||
      "$DB_USERNAME" != "postgres" ||
      "$DB_DATABASE" != "jairoads_scratch_staging_host" ||
      -z "$DB_PASSWORD" || -n "$DB_URL" ]] || [[ -v RENDER ]]; then
  echo "REFUSED: backup/restore allowed only on disposable GitHub PostgreSQL 17." >&2
  exit 2
fi
export PGHOST="$DB_HOST" PGPORT="$DB_PORT" PGUSER="$DB_USERNAME"
export PGPASSWORD="$DB_PASSWORD" PGSSLMODE=disable
actual="$(psql -X -qAt -v ON_ERROR_STOP=1 -d "$DB_DATABASE" \
  -c "SELECT current_database() || ':' || current_user || ':' || current_setting('server_version_num')")"
if [[ ! "$actual" =~ ^jairoads_scratch_staging_host:postgres:17[0-9]{4}$ ]]; then
  echo "REFUSED: unexpected PostgreSQL server/database identity." >&2
  exit 2
fi
source_db="jairoads_scratch_staging_existing"
restored_db="jairoads_scratch_staging_restored"
if [[ "$(psql -X -qAt -v ON_ERROR_STOP=1 -d "$DB_DATABASE" \
  -c "SELECT count(*) FROM pg_database WHERE datname IN ('$source_db','$restored_db')")" != "1" ]]; then
  echo "REFUSED: expected seeded source and nonexistent restore target." >&2
  exit 2
fi

# A reviewed-transition probe already ran on the disposable source database.
# Add other delivery recipients under the restricted backend role before dump.
psql -X -v ON_ERROR_STOP=1 -q -d "$source_db" >/dev/null <<'SEED'
DO $check$
BEGIN
 IF (SELECT count(*) FROM jairoads_next.user_accounts) <> 3
  OR (SELECT count(*) FROM public.users) <> 3
  OR (SELECT count(*) FROM jairoads_next.audit_logs) <> 1
  OR (SELECT count(*) FROM jairoads_security.account_provisioning) <> 2
  OR (SELECT count(*) FROM jairoads_next.audit_notification_recipients) <> 1
 THEN RAISE EXCEPTION 'Unexpected synthetic historical fixture'; END IF;
END;
$check$;
BEGIN;
SET LOCAL ROLE jairoads_app_runtime;
INSERT INTO jairoads_next.audit_notification_recipients
(audit_log_id,recipient_user_id,notification_message)
VALUES (1,1,'Synthetic restored SuperAdmin notice'),
       (1,3,'Synthetic restored Engineer notice');
COMMIT;
SEED

tmp="$(mktemp -d)"
created=0
cleanup() {
  if [[ "$created" == "1" ]]; then
    dropdb --if-exists "$restored_db" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$tmp"
}
trap cleanup EXIT

# No genuine accounts/keys/objects exist in this synthetic database.
pg_dump --format=custom --file="$tmp/synthetic.backup" "$source_db"
if [[ ! -s "$tmp/synthetic.backup" ]]; then
  echo "FAIL: empty backup archive." >&2
  exit 1
fi
sha256sum "$tmp/synthetic.backup" > "$tmp/archive.sha256"
(cd "$tmp" && sha256sum --check --status archive.sha256)
pg_restore --list "$tmp/synthetic.backup" > "$tmp/archive.list"
for required in account_provisioning audit_notification_recipients audit_logs user_accounts; do
  if ! grep -q -- "$required" "$tmp/archive.list"; then
    echo "FAIL: required retained entity absent from backup: $required" >&2
    exit 1
  fi
done

# Ordered row hashes compare source and independent restore, without
# exposing even synthetic email or password-hash values in GitHub logs.
digest_sql="$(cat <<'DIGEST'
SELECT name || ':' || hash
FROM (
 SELECT 'audit_logs' AS name,
   md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text) AS hash
 FROM jairoads_next.audit_logs t
 UNION ALL
 SELECT 'notification_recipients', md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text)
 FROM jairoads_next.audit_notification_recipients t
 UNION ALL
 SELECT 'account_provisioning', md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.user_account_id), '[]'::jsonb)::text)
 FROM jairoads_security.account_provisioning t
 UNION ALL
 SELECT 'canonical_accounts', md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text)
 FROM jairoads_next.user_accounts t
 UNION ALL
 SELECT 'fortify_bridge', md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]'::jsonb)::text)
 FROM public.users t
) AS digests ORDER BY name;
DIGEST
)"
before="$(psql -X -qAt -v ON_ERROR_STOP=1 -d "$source_db" -c "$digest_sql")"

createdb "$restored_db"
created=1
pg_restore --exit-on-error --single-transaction --dbname="$restored_db" "$tmp/synthetic.backup" >/dev/null

after="$(psql -X -qAt -v ON_ERROR_STOP=1 -d "$restored_db" -c "$digest_sql")"
if [[ "$before" != "$after" ]]; then
  echo "FAIL: restored audit/notification/provenance or account rows differ." >&2
  exit 1
fi
psql -X -v ON_ERROR_STOP=1 -q -d "$restored_db" \
  -f tests/Staging/assert-restored-history.sql >/dev/null
source_after="$(psql -X -qAt -v ON_ERROR_STOP=1 -d "$source_db" -c "$digest_sql")"
if [[ "$before" != "$source_after" ]]; then
  echo "FAIL: original synthetic fixture changed during backup/restore." >&2
  exit 1
fi
echo "PASS: PG17 custom archive restored identically; private history, RLS, grants and immutable triggers retained; source untouched."

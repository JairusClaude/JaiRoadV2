#!/usr/bin/env bash
# Only your own Docker Engine, loopback ports and synthetic PG17 data.
# No Supabase API/project/branch calls. No GitHub Actions or paid infrastructure.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
cd "$ROOT"
SECRETS="$ROOT/.free-staging/secrets.env"
FIXTURE="$ROOT/.free-staging/fixture.json"
SEEDED="$ROOT/.free-staging/seeded"
COMPOSE="$ROOT/compose.free-staging.yml"
DB_NAME=jairoads_scratch_staging_app
APP_URL=http://127.0.0.1:10015
MODE="${1:-}"

refuse() { printf 'REFUSED: %s\n' "$*" >&2; exit 2; }

local_docker_only() {
  command -v docker >/dev/null || refuse 'Docker Engine and Compose v2 required locally'
  command -v openssl >/dev/null || refuse 'openssl required for local synthetic secrets'
  [[ -z "${DOCKER_HOST:-}" || "${DOCKER_HOST}" == unix://* || "${DOCKER_HOST}" == npipe://* ]] ||
    refuse 'Remote Docker daemon not allowed'
  local endpoint
  endpoint="$(docker context inspect --format '{{(index .Endpoints "docker").Host}}' 2>/dev/null)" ||
    refuse 'Cannot validate the Docker context'
  [[ "$endpoint" == unix://* || "$endpoint" == npipe://* ]] ||
    refuse 'Docker context is not local; refusing staging on remote/paid hosts'
}

init_secrets() {
  if [[ -L "$ROOT/.free-staging" || -L "$SECRETS" ]]; then
    refuse 'Staging secret directory/file must not be a symlink'
  fi
  mkdir -p "$ROOT/.free-staging"
  chmod 700 "$ROOT/.free-staging"
  if [[ -f "$SECRETS" ]]; then
    [[ "$(stat -c %a "$SECRETS" 2>/dev/null || stat -f %Lp "$SECRETS")" == "600" ]] ||
      refuse 'Existing secret file must be chmod 600'
    return
  fi
  umask 077
  local tmp
  tmp="$(mktemp "$ROOT/.free-staging/.secrets.XXXXXXXX")"
  printf 'JAIROADS_FREE_DB_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$tmp"
  printf 'JAIROADS_FREE_RUNTIME_PASSWORD=%s\n' "$(openssl rand -hex 24)" >> "$tmp"
  local app_key_b64
  app_key_b64="$(openssl rand -base64 32 | tr -d '\\n')" ||
    refuse 'Could not generate a valid random Laravel application key'
  [[ "${#app_key_b64}" == "44" ]] ||
    refuse 'Expected 32 bytes of secure key material encoded as base64'
  printf 'JAIROADS_FREE_APP_KEY=base64:%s\n' "$app_key_b64" >> "$tmp"
  chmod 600 "$tmp"
  mv -n "$tmp" "$SECRETS"
  if [[ -f "$tmp" ]]; then rm -f "$tmp"; fi
}

secret() {
  [[ -f "$SECRETS" ]] || refuse 'Run up once to generate local secrets'
  awk -v k="$1" 'index($0,k"=")==1 {print substr($0,length(k)+2);found=1;exit} END {if(!found)exit 2}' "$SECRETS"
}

compose() {
  [[ -f "$SECRETS" ]] || refuse 'Missing local secret file'
  docker compose --project-name jairoads-free-local --env-file "$SECRETS" -f "$COMPOSE" "$@"
}

db_ready() {
  local identity
  identity="$(compose exec -T db psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d "$DB_NAME"     -c "SELECT current_database()||':'||current_user||':'||current_setting('server_version_num')")" ||
    refuse 'Synthetic local PG17 database not reachable'
  [[ "$identity" =~ ^jairoads_scratch_staging_app:postgres:17[0-9]{4}$ ]] ||
    refuse 'Unexpected database identity/version'
}

seed_once() {
  if [[ -f "$SEEDED" ]]; then
    printf 'Synthetic fixture already seeded; retaining persistent local volume.\n'
    return
  fi
  command -v php >/dev/null || refuse 'PHP 8.4 with pdo_pgsql required on the host to seed fixtures'
  [[ -f "$ROOT/vendor/autoload.php" ]] ||
    refuse 'Install local development dependencies with composer install first'
  [[ -z "${RENDER:-}" ]] || refuse 'Hosted deployment environment must not seed local fixtures'
  db_ready

  local db_pw app_key runtime_pw
  db_pw="$(secret JAIROADS_FREE_DB_PASSWORD)"
  app_key="$(secret JAIROADS_FREE_APP_KEY)"
  runtime_pw="$(secret JAIROADS_FREE_RUNTIME_PASSWORD)"
  umask 077
  local fixture_tmp="$ROOT/.free-staging/.fixture.tmp"
  # Explicit, positively guarded local connection overrides any existing .env.
  # PostgresTestSchema::prepare() also refuses nonempty/nonlocal/non-PG17 DBs.
  APP_ENV=testing APP_DEBUG=false APP_KEY="$app_key" APP_URL="$APP_URL" \
    JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY \
    DB_CONNECTION=pgsql DB_URL='' DB_HOST=127.0.0.1 DB_PORT=55432 \
    DB_DATABASE="$DB_NAME" DB_USERNAME=postgres DB_PASSWORD="$db_pw" DB_SSLMODE=disable \
    SESSION_DRIVER=array CACHE_STORE=array QUEUE_CONNECTION=sync MAIL_MAILER=array \
    SUPABASE_URL='' SUPABASE_SECRET_KEY='' SUPABASE_SERVICE_ROLE_KEY='' \
    PAO_DISABLE=1 php tests/Browser/prepare-system.php > "$fixture_tmp"
  python3 -m json.tool "$fixture_tmp" >/dev/null ||
    refuse 'Synthetic fixture output was not valid JSON'
  mv "$fixture_tmp" "$FIXTURE"
  chmod 600 "$FIXTURE"

  # These grants/policies are deliberately FOR SYNTHETIC STAGING ONLY,
  # and never applicable to the official Supabase project.
  compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -v runtime_secret="$runtime_pw" \
    -U postgres -d "$DB_NAME" >/dev/null <<'ROLES'
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE jairoads_app_runtime
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS
  PASSWORD :'runtime_secret';
ROLES
  compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$DB_NAME" \
    < database/proposals/quarterly_record_uniqueness.sql >/dev/null
  compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$DB_NAME" \
    < database/proposals/restricted_runtime_grants_REVIEW_ONLY.sql >/dev/null
  compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d "$DB_NAME" \
    < tests/Staging/restricted-app-grants.sql >/dev/null
  compose exec -T db psql -X -qAt -v ON_ERROR_STOP=1 -U postgres -d "$DB_NAME" \
    -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='jairoads_app_runtime' AND rolcanlogin AND NOT rolbypassrls AND NOT rolsuper) AND to_regclass('jairoads_security.account_provisioning') IS NOT NULL AND to_regclass('jairoads_next.file_deletions') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END" \
    | grep -qx PASS || refuse 'Synthetic restricted role/schema failed verification'
  touch "$SEEDED"
  chmod 600 "$SEEDED"
  printf 'PASS: generated synthetic account fixtures and restricted backend role in LOCAL PostgreSQL 17.\n'
}

smoke() {
  db_ready
  [[ -f "$SEEDED" ]] || refuse 'Synthetic fixture not seeded yet'
  command -v curl >/dev/null || refuse 'curl required for localhost HTTP smoke'
  curl --silent --show-error --fail --max-time 10 "$APP_URL/up" >/dev/null ||
    refuse 'Local Laravel health endpoint unavailable'
  curl --silent --show-error --fail --max-time 10 "$APP_URL/login" >/dev/null ||
    refuse 'Local Fortify login endpoint unavailable'
  local path code
  for path in /dd-phase3/dashboard /dd-phase3/users /dd-phase3/audit-logs \
    /dd-phase3/ui/road-coverages /jairoads/notifications; do
    code="$(curl --silent --show-error --max-time 10 --output /dev/null \
      -H 'Accept: application/json' --write-out '%{http_code}' "$APP_URL$path")"
    [[ "$code" == "401" ]] ||
      refuse "Guest route did not fail closed: $path (HTTP $code)"
  done
  printf 'PASS: local app health/login and five protected guest endpoints; no official Supabase calls.\n'
}

case "$MODE" in
  up)
    local_docker_only
    init_secrets
    compose up --detach --wait db
    seed_once
    compose up --detach --build app
    for _ in $(seq 1 45); do
      if curl -fsS --max-time 2 "$APP_URL/up" >/dev/null 2>&1; then break; fi
      sleep 2
    done
    smoke
    printf 'FREE LOCAL STAGING: %s  (only localhost; demo accounts in .free-staging/fixture.json)\n' "$APP_URL"
    ;;
  smoke)
    local_docker_only
    smoke
    ;;
  status)
    local_docker_only
    compose ps
    ;;
  stop)
    local_docker_only
    compose stop
    printf 'Stopped LOCAL containers; synthetic PostgreSQL volume retained.\n'
    ;;
  destroy)
    [[ "${2:-}" == 'CONFIRM_LOCAL_SYNTHETIC_DESTROY' ]] ||
      refuse 'To delete only the isolated local fixture volume, pass CONFIRM_LOCAL_SYNTHETIC_DESTROY'
    local_docker_only
    compose down --volumes --remove-orphans
    rm -f "$FIXTURE" "$SEEDED" "$SECRETS"
    rmdir "$ROOT/.free-staging" 2>/dev/null || true
    printf 'Destroyed only the named LOCAL synthetic staging project/volume.\n'
    ;;
  *)
    printf 'Usage: bash scripts/staging/free-local.sh {up|smoke|status|stop|destroy CONFIRM_LOCAL_SYNTHETIC_DESTROY}\n' >&2
    exit 2
    ;;
esac

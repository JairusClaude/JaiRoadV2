#!/bin/sh
set -eu
# Validate required configuration only. Never generate keys, migrate, seed or initialize a database.
if [ -z "${APP_KEY:-}" ]; then
    echo 'JaiROADS startup refused: APP_KEY is required.' >&2
    exit 64
fi
php -r '$key = getenv("APP_KEY"); if (str_starts_with($key, "base64:")) { $key = base64_decode(substr($key, 7), true); } if (!is_string($key) || strlen($key) !== 32) { fwrite(STDERR, "JaiROADS startup refused: configure a valid 32-byte application key.\n"); exit(64); }'
export DB_CONNECTION="${DB_CONNECTION:-pgsql}"
if [ "$DB_CONNECTION" != pgsql ]; then
    echo 'JaiROADS startup refused: canonical workflows require PostgreSQL.' >&2
    exit 64
fi
if [ -z "${DB_URL:-}" ] && { [ -z "${DB_HOST:-}" ] || [ -z "${DB_DATABASE:-}" ] || [ -z "${DB_USERNAME:-}" ]; }; then
    echo 'JaiROADS startup refused: configure DB_URL or DB_HOST/DB_DATABASE/DB_USERNAME.' >&2
    exit 64
fi
exec "$@"

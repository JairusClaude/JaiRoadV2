#!/bin/sh
set -eu

# This command is configured only on the new Android pilot service.
export DB_SSLMODE=prefer
export APP_KEY="base64:$(php -r 'echo base64_encode(hash("sha256", getenv("PILOT_APP_SECRET"), true));')"
php deploy/android-pilot/seed.php
export DB_URL="$(php -r '
$url = parse_url(getenv("DB_URL"));
printf("pgsql://jairoads_pilot_app:%s@%s:%d%s", rawurlencode(getenv("PILOT_RUNTIME_PASSWORD")), $url["host"], $url["port"] ?? 5432, $url["path"]);
')"
unset PILOT_APP_SECRET PILOT_RUNTIME_PASSWORD PILOT_TEST_PASSWORD
php-fpm -D
exec nginx -g 'daemon off;'

#!/usr/bin/env bash
set -euo pipefail
# Preserve the locked dependency versions and fail if installation cannot complete.
for attempt in 1 2 3; do
    if composer install --no-interaction --prefer-dist; then
        exit 0
    else
        status=$?
    fi
    if [[ "$status" != 100 || "$attempt" == 3 ]]; then
        exit "$status"
    fi
    sleep "$((attempt * 10))"
done

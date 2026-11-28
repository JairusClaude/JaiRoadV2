#!/usr/bin/env bash
set -euo pipefail

# Hosted Ubuntu runners have unrelated Microsoft package feeds preconfigured.
# A forbidden InRelease from that feed must not block Chromium's Ubuntu deps.
# Move only dedicated files for this exact vendor feed, restore on exit, and
# leave apt signature checking and the Ubuntu package sources untouched.
if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_OS:-}" != Linux ]]; then
    echo "This installer is restricted to disposable Linux CI runners." >&2
    exit 1
fi
playwright="$1"
backup="$(mktemp -d)"
restore_sources() {
    for source in "$backup"/*; do
        [[ -f "$source" ]] || continue
        sudo mv -- "$source" "/etc/apt/sources.list.d/$(basename "$source")"
    done
    rmdir "$backup"
}
trap restore_sources EXIT
for source in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
    [[ -f "$source" ]] || continue
    if grep -q 'https://packages.microsoft.com/ubuntu/24.04/prod' "$source" &&
        ! grep -Eo 'https?://[^[:space:]]+' "$source" | grep -qv '^https://packages\.microsoft\.com/ubuntu/24\.04/prod'; then
        sudo mv -- "$source" "$backup/"
    fi
done

for attempt in 1 2 3; do
    if "$playwright" install --with-deps chromium; then
        exit 0
    fi
    if [[ "$attempt" == 3 ]]; then
        exit 1
    fi
    sleep "$((attempt * 5))"
done

#!/usr/bin/env python3
"""Read-only JaiROADS cutover smoke against disposable CI Laravel ONLY.

No production URLs, credentials, database writes, Storage calls or authenticated
sessions. Never remove localhost/test-environment guards to hit live services.
"""
from __future__ import annotations

import os
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8015"
assert os.environ.get("GITHUB_ACTIONS") == "true"
assert os.environ.get("APP_ENV") == "testing"
assert os.environ.get("DB_HOST") == "127.0.0.1"
assert os.environ.get("DB_DATABASE") == "jairoads_scratch_staging_app"
assert os.environ.get("DB_USERNAME") == "jairoads_app_runtime"
assert os.environ.get("JAIROADS_SCRATCH_APPROVAL") == "DISPOSABLE_LOCAL_ONLY"
assert os.environ.get("APP_URL") == BASE


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        return None


client = urllib.request.build_opener(NoRedirect())


def status(path: str, accept: str = "application/json") -> int:
    assert path.startswith("/") and not path.startswith("//")
    request = urllib.request.Request(
        BASE + path, method="GET", headers={"Accept": accept}
    )
    try:
        with client.open(request, timeout=15) as result:
            result.read(8192)
            return result.status
    except urllib.error.HTTPError as err:
        err.read(8192)
        return err.code


assert status("/up") == 200, "Health check failed before cutover"
assert status("/login", "text/html,application/xhtml+xml") == 200, (
    "Fortify sign-in page unavailable"
)

# A healthy app must still prevent unauthenticated access to canonical data.
for protected in [
    "/dd-phase3/dashboard",
    "/dd-phase3/users",
    "/dd-phase3/audit-logs",
    "/dd-phase3/ui/road-coverages",
    "/jairoads/notifications",
]:
    response = status(protected)
    assert response == 401, (
        f"Protected guest endpoint returned HTTP {response}: {protected}"
    )

print("PASS: scratch Laravel health/login are reachable; all five protected guest API reads return 401")

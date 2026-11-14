#!/usr/bin/env python3
"""Real HTTP smoke against a disposable Laravel + restricted PostgreSQL role.

No real account data. Does not accept arbitrary destinations/fixtures.
"""
import http.cookiejar
import json
import os
import pathlib
import urllib.error
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:8015"
assert os.environ.get("APP_ENV") == "testing"
assert os.environ.get("JAIROADS_SCRATCH_APPROVAL") == "DISPOSABLE_LOCAL_ONLY"
assert os.environ.get("APP_URL") == BASE
assert os.environ.get("DB_DATABASE") == "jairoads_scratch_staging_app"
assert os.environ.get("DB_USERNAME") == "jairoads_app_runtime"
fixture = pathlib.Path(os.environ["QUARTERLY_BROWSER_FIXTURE"])
assert fixture.resolve() == pathlib.Path("/tmp/jairoads-staging-fixture.json")
data = json.loads(fixture.read_text())
email = data["superadmin_email"]
assert email.endswith("@example.test")

jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def open_page(path, values=None):
    csrf = next((urllib.parse.unquote(c.value) for c in jar if c.name == "XSRF-TOKEN"), None)
    headers = {"Accept": "text/html,application/xhtml+xml", "Referer": BASE + "/login"}
    if csrf:
        headers["X-XSRF-TOKEN"] = csrf
    body = None if values is None else urllib.parse.urlencode(values).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=body, headers=headers)
    try:
        with client.open(req, timeout=20) as response:
            response.read()
            return response.status, response.url
    except urllib.error.HTTPError as err:
        raise AssertionError(f"HTTP {err.code} at {path}; restricted role or CSRF/authorization failure") from err


status, target = open_page("/login")
assert status == 200 and urllib.parse.urlparse(target).path == "/login", (status, target)
assert any(c.name == "XSRF-TOKEN" for c in jar), "Expected Laravel CSRF cookie"
status, target = open_page("/login", {"email": email, "password": "Disposable-Test!123"})
assert status == 200 and urllib.parse.urlparse(target).path != "/login", (
    f"Canonical SuperAdmin login did not complete: {status} {target}"
)
status, target = open_page("/dd-phase3/users")
assert status == 200 and urllib.parse.urlparse(target).path != "/login", (
    f"Authenticated canonical directory inaccessible: {status} {target}"
)
status, target = open_page("/dd-phase3/lgus", {
    "municipality_name": "Staging Restricted Role LGU",
    "province": "Synthetic",
    "region": "Synthetic",
    "mayor_first_name": "Staging",
    "mayor_last_name": "Tester",
})
assert status == 200 and urllib.parse.urlparse(target).path != "/login", (
    f"Authorized mutation did not complete: {status} {target}"
)
print("PASS: real Fortify login, protected canonical page, and authorized LGU create under restricted DB role")

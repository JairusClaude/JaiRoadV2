#!/usr/bin/env python3
"""Offline, standard-library safety checks for the free local staging package.

These do NOT replace a real Docker startup test on the operator's computer.
"""
import base64
from pathlib import Path
import re
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[2]
COMPOSE = (ROOT / "compose.free-staging.yml").read_text(encoding="utf-8")
LAUNCHER = (ROOT / "scripts/staging/free-local.sh").read_text(encoding="utf-8")
DOCKERIGNORE = (ROOT / ".dockerignore").read_text(encoding="utf-8")
GITIGNORE = (ROOT / ".gitignore").read_text(encoding="utf-8")


class FreeLocalStagingSafetyTests(unittest.TestCase):
    def test_all_published_ports_are_explicitly_loopback_only(self):
        published = re.findall(r'^\s+-\s+"([^"]+)"\s*$', COMPOSE, re.MULTILINE)
        self.assertEqual(sorted(published), [
            "127.0.0.1:10015:10000",
            "127.0.0.1:55432:5432",
        ])

    def test_no_real_supabase_url_or_paid_cloud_stack(self):
        self.assertNotIn("aeaaxwyytsagbacysvvx", COMPOSE)
        self.assertNotIn("supabase.co", COMPOSE)
        self.assertNotIn("DATABASE_URL", COMPOSE)
        self.assertIn('SUPABASE_URL: ""', COMPOSE)
        self.assertIn('SUPABASE_SERVICE_ROLE_KEY: ""', COMPOSE)
        self.assertIn('SUPABASE_SECRET_KEY: ""', COMPOSE)
        self.assertIn("image: postgres:17", COMPOSE)
        self.assertIn("jairoads_scratch_staging_app", COMPOSE)

    def test_image_build_and_git_ignore_every_local_secret(self):
        self.assertIn(".free-staging/", DOCKERIGNORE)
        self.assertIn("/.free-staging/", GITIGNORE)
        self.assertIn(".free-staging/secrets.env", LAUNCHER)
        self.assertIn("chmod 600", LAUNCHER)
        self.assertIn("chmod 700", LAUNCHER)

    def test_local_only_guard_requires_disposable_pg17_and_no_db_url(self):
        for check in (
            "docker context inspect",
            "Remote Docker daemon not allowed",
            "Docker context is not local",
            "JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY",
            "DB_HOST=127.0.0.1 DB_PORT=55432",
            "DB_URL=''",
            "DB_SSLMODE=disable",
            "tests/Browser/prepare-system.php",
            "jairoads_scratch_staging_app:postgres:17",
        ):
            self.assertIn(check, LAUNCHER)

    def test_local_app_uses_restricted_role_and_no_external_secrets(self):
        self.assertIn("DB_USERNAME: jairoads_app_runtime", COMPOSE)
        self.assertIn("JAIROADS_FREE_RUNTIME_PASSWORD", COMPOSE)
        self.assertIn("APP_ENV: testing", COMPOSE)
        self.assertIn("APP_DEBUG: \"false\"", COMPOSE)
        self.assertIn("tests/Staging/restricted-app-grants.sql", LAUNCHER)
        self.assertIn("NOBYPASSRLS", LAUNCHER)
        self.assertIn("PG17", LAUNCHER + COMPOSE)

    def test_generated_laravel_app_key_has_exactly_32_bytes(self):
        # Regression: openssl rand -base64 -A 32 is not supported by OpenSSL 3.
        expected = r"openssl rand -base64 32 | tr -d '\n'"
        self.assertIn(expected, LAUNCHER)
        self.assertNotIn("openssl rand -base64 -A", LAUNCHER)
        result = subprocess.run(
            ["bash", "-c", "set -euo pipefail; " + expected],
            capture_output=True,
            text=True,
            check=True,
        )
        self.assertEqual(len(base64.b64decode(result.stdout, validate=True)), 32)
        self.assertEqual(len(result.stdout), 44)
        self.assertNotIn("\\n", result.stdout)

    def test_no_unprompted_volume_deletion_or_prod_deploy_command(self):
        self.assertIn("CONFIRM_LOCAL_SYNTHETIC_DESTROY", LAUNCHER)
        self.assertEqual(LAUNCHER.count("compose down --volumes"), 1)
        self.assertNotIn("supabase db push", LAUNCHER)
        self.assertNotIn("git push", LAUNCHER)
        self.assertNotIn("merge_branch", LAUNCHER)


if __name__ == "__main__":
    unittest.main()

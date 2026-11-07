#!/usr/bin/env python3
"""No-cost local JaiROADS staging preflight.

This script creates no data, starts no containers, calls no hosted service,
prints no secrets, and makes no network connection. Run on the operator PC.
"""
from __future__ import annotations

import base64
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
FAILURES: list[str] = []


def report(name: str, ok: bool, detail: str = "") -> None:
    prefix = "PASS" if ok else "BLOCKED"
    print(f"{prefix}: {name}" + (f" — {detail}" if detail else ""))
    if not ok:
        FAILURES.append(name)


def command(args: list[str]) -> tuple[bool, str]:
    try:
        run = subprocess.run(
            args, check=False, capture_output=True, text=True, timeout=12
        )
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return False, ""
    return run.returncode == 0, run.stdout.strip()


def main() -> int:
    print("JaiROADS: offline, localhost-only staging readiness")

    report("Python 3.10+",
           sys.version_info >= (3, 10))
    report("Not a hosted CI/deployment environment",
           not any(os.environ.get(k) for k in (
               "RENDER", "CI", "GITHUB_ACTIONS", "VERCEL", "RAILWAY_ENVIRONMENT"
           )))
    db_context = os.environ.get("DOCKER_HOST", "")
    report("No remote Docker override",
           not db_context or db_context.startswith(("unix://", "npipe://")))

    docker = shutil.which("docker")
    report("Local Docker executable", docker is not None)
    if docker:
        ready, docker_endpoint = command([
            docker, "context", "inspect",
            "--format", '{{(index .Endpoints "docker").Host}}'
        ])
        report("Docker context uses local socket",
               ready and docker_endpoint.startswith(("unix://", "npipe://")))
        compose_ok, _ = command([docker, "compose", "version"])
        report("Docker Compose v2", compose_ok)
        if ready and docker_endpoint.startswith(("unix://", "npipe://")):
            daemon_ok, _ = command([docker, "info", "--format", "{{.ServerVersion}}"])
            report("Local Docker daemon is running", daemon_ok)

    php = shutil.which("php")
    report("Host PHP available", php is not None)
    if php:
        php_ok, _ = command([
            php, "-r",
            'exit((PHP_VERSION_ID >= 80400 && PHP_VERSION_ID < 90000 '
            '&& extension_loaded("pdo_pgsql")) ? 0 : 1);',
        ])
        report("PHP 8.4+ with pdo_pgsql", php_ok)

    report("Composer development autoload available",
           (ROOT / "vendor" / "autoload.php").is_file())
    report("curl for localhost HTTP smoke available",
           shutil.which("curl") is not None)

    openssl = shutil.which("openssl")
    report("OpenSSL CLI available", openssl is not None)
    if openssl:
        ok, raw = command([openssl, "rand", "-base64", "32"])
        try:
            decoded = base64.b64decode(raw.replace("\n", ""), validate=True)
        except (ValueError, base64.binascii.Error):
            decoded = b""
        report("OpenSSL generates a valid 32-byte Laravel key",
               ok and len(decoded) == 32)

    for path in ("compose.free-staging.yml", "scripts/staging/free-local.sh",
                 "tests/Browser/prepare-system.php",
                 "database/proposals/restricted_runtime_grants_REVIEW_ONLY.sql"):
        report("Required local fixture: " + path, (ROOT / path).is_file())

    folder = ROOT / ".free-staging"
    report("Synthetic secrets directory is not a symbolic link",
           not folder.is_symlink())
    secret_file = folder / "secrets.env"
    report("Synthetic secret path is not a symbolic link",
           not secret_file.is_symlink())
    if secret_file.is_file():
        if os.name == "posix":
            report("Local secrets are mode 0600",
                   secret_file.stat().st_mode & 0o777 == 0o600)
        else:
            print("NOTICE: verify Windows ACLs on .free-staging/secrets.env")

    print("\n" + (
        "READY FOR LOCAL OPERATOR TO TRY: bash scripts/staging/free-local.sh up"
        if not FAILURES else
        f"BLOCKED: {len(FAILURES)} local prerequisites require attention."
    ))
    print("No Supabase project/branch, cloud API, CI or paid resource accessed.")
    return 0 if not FAILURES else 2


if __name__ == "__main__":
    sys.exit(main())

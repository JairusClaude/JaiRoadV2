#!/usr/bin/env python3
"""JaiROADS Task 13: structural release evidence inspection, NOT deployment.

No database connections, remote requests, writes, merges or deploy actions.
Even a passing structure requires independent human source verification and
explicit execution by the authorized operator in a separate change window.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Allow direct CLI and unittest invocation without modifying the product.
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from scripts.qa.check_uat_evidence import inspect as inspect_uat  # noqa: E402

PROJECT_REF = "aeaaxwyytsagbacysvvx"
SHA = re.compile(r"^[0-9a-f]{40}$")
IMAGE_DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
SCHEMA_CHECKS = frozenset({
    "postgres17",
    "audit_mutation_and_truncate_guards",
    "provenance_table_present",
    "notification_recipients_present",
    "file_deletion_intents_present",
    "maintenance_history_contexts_present",
    "project_and_manager_nullable",
    "quarterly_unique_constraint_present",
    "restricted_runtime_login_present",
    "active_superadmin_exists",
    "no_active_admin_missing_engineer",
})
REQUIRED_OWNER_REFERENCES = frozenset({
    "schema_owner_approval_reference",
    "data_dictionary_approval_reference",
    "production_migration_change_ticket",
    "production_release_authorization_reference",
    "backup_and_restore_evidence_reference",
    "private_storage_reconciliation_reference",
    "actual_superadmin_recovery_reference",
    "verified_admin_engineer_transition_reference",
    "isolated_staging_acceptance_reference",
    "oncall_and_monitoring_reference",
    "approved_change_window_reference",
})


def valid_reference(value: object) -> bool:
    return (
        isinstance(value, str) and bool(value.strip())
        and len(value.strip()) >= 8
        and value.strip().upper() not in {
            "PENDING", "NOT APPROVED", "TBD", "PLACEHOLDER", "NOT RUN"
        }
    )


def inspect_release(
    manifest: object, inventory: object, uat: object, exact_sha: str
) -> list[str]:
    """Only record field names and fixed blocker codes; NEVER echo field values."""
    failures: list[str] = []
    if not SHA.fullmatch(exact_sha):
        return ["invalid_exact_sha"]
    if not isinstance(manifest, dict):
        manifest = {}
        failures.append("invalid_release_manifest")
    if not isinstance(inventory, dict):
        inventory = {}
        failures.append("invalid_inventory")
    if manifest.get("schema_version") != 1:
        failures.append("release_manifest_version")
    if manifest.get("target_project_ref") != PROJECT_REF:
        failures.append("wrong_target_project_reference")
    if manifest.get("candidate_sha") != exact_sha:
        failures.append("candidate_sha_mismatch")
    digest = manifest.get("approved_image_digest")
    if not isinstance(digest, str) or not IMAGE_DIGEST.fullmatch(digest):
        failures.append("missing_pinned_image_digest")
    for name in sorted(REQUIRED_OWNER_REFERENCES):
        if not valid_reference(manifest.get(name)):
            failures.append("missing_" + name)
    if manifest.get("deploy_authorized") is not True:
        failures.append("production_deployment_not_authorized")

    if inventory.get("schema_version") != 1:
        failures.append("inventory_schema_version")
    if inventory.get("source") != "read_only_postgresql_catalog":
        failures.append("inventory_not_read_only_catalog")
    checks = inventory.get("checks")
    if not isinstance(checks, dict):
        checks = {}
        failures.append("inventory_checks_missing")
    for name in sorted(SCHEMA_CHECKS):
        if checks.get(name) is not True:
            failures.append("database_" + name)

    # UAT is a separate, operator-controlled evidence file. All prior 25+13
    # gates must be satisfied; the parser only checks structure, not identity.
    failures.extend("uat_" + code for code in inspect_uat(uat, exact_sha))
    return sorted(set(failures))


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Structural release blocker check; cannot authorize or deploy"
    )
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--uat", type=Path, required=True)
    parser.add_argument("--sha", required=True)
    args = parser.parse_args()
    try:
        manifest = read_json(args.manifest)
        inventory = read_json(args.inventory)
        uat = read_json(args.uat)
    except (OSError, UnicodeError, json.JSONDecodeError):
        print("NO GO: missing/invalid private evidence document")
        return 2
    failures = inspect_release(manifest, inventory, uat, args.sha)
    if failures:
        print(f"NO GO: {len(failures)} structural release blockers")
        print("Codes: " + ", ".join(failures[:42]))
        return 2

    print("STRUCTURE COMPLETE FOR INDEPENDENT OWNER REVIEW ONLY.")
    print("NOT PRODUCTION AUTHORIZATION: independently verify every evidence")
    print("source, actual owner identity, live database state, recovery and UAT.")
    print("This tool does not deploy, migrate, merge, or contact Supabase.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Task 12: structural UAT evidence check, never a release authorization.

Input is an OPERATOR-CONTROLLED, access-restricted JSON evidence summary.
Do not put real account details, secrets or screenshots in the repository.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

CASE_IDS = frozenset(f"QA-{n:02d}" for n in range(1, 26))
GATES = frozenset({
    "teammate_integration",
    "data_dictionary",
    "schema_runtime_rls_and_restore",
    "actual_superadmin_recovery",
    "real_account_transitions",
    "persistent_isolated_staging",
    "private_storage_recovery",
    "password_reset_mail",
    "real_device_passkeys_mfa",
    "map_provider_acceptance",
    "high_severity_defects_retested",
    "authorized_user_acceptance",
    "release_owner_review",
})
BLOCKING_SEVERITIES = frozenset({"Blocker", "Critical", "High"})
UNRESOLVED = frozenset({"OPEN", "IN_PROGRESS", "AWAITING_RETEST"})
SHA = re.compile(r"^[0-9a-f]{40}$")


def present(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip()) and value.strip().upper() not in {
        "PENDING", "NOT RUN", "TBD", "PLACEHOLDER"
    }


def inspect(evidence: object, exact_sha: str | None = None) -> list[str]:
    """Return sanitized blocker codes. Never echo reviewer names or notes."""
    errors: list[str] = []
    if not isinstance(evidence, dict):
        return ["invalid_document"]
    if evidence.get("schema_version") != 1:
        errors.append("unsupported_schema_version")
    sha = evidence.get("candidate_sha")
    if not isinstance(sha, str) or not SHA.fullmatch(sha):
        errors.append("missing_exact_candidate_sha")
    elif exact_sha is not None and sha != exact_sha:
        errors.append("candidate_sha_mismatch")
    if evidence.get("environment_type") != "isolated_staging":
        errors.append("not_isolated_staging")
    if not present(evidence.get("environment_reference")):
        errors.append("missing_environment_reference")

    cases = evidence.get("cases")
    if not isinstance(cases, list):
        cases = []
        errors.append("missing_case_register")
    observed: set[str] = set()
    for row in cases:
        if not isinstance(row, dict) or row.get("id") not in CASE_IDS:
            errors.append("invalid_qa_case")
            continue
        case_id = row["id"]
        if case_id in observed:
            errors.append(f"duplicate_{case_id}")
        observed.add(case_id)
        if row.get("result") != "PASS":
            errors.append(f"incomplete_{case_id}")
        if not present(row.get("tester_reference")) or not present(row.get("evidence_reference")):
            errors.append(f"missing_actual_evidence_{case_id}")
    if observed != CASE_IDS:
        errors.append("missing_or_extra_cases")

    approvals = evidence.get("approvals")
    if not isinstance(approvals, list):
        approvals = []
        errors.append("missing_approvals")
    approved: set[str] = set()
    for row in approvals:
        if not isinstance(row, dict) or row.get("gate") not in GATES:
            errors.append("invalid_approval")
            continue
        gate = row["gate"]
        if gate in approved:
            errors.append(f"duplicate_approval_{gate}")
        approved.add(gate)
        if row.get("decision") != "APPROVED":
            errors.append(f"unapproved_{gate}")
        if not present(row.get("approver_reference")) or not present(row.get("review_reference")):
            errors.append(f"unverified_approval_{gate}")
    if approved != GATES:
        errors.append("missing_or_extra_approvals")

    defects = evidence.get("defects")
    if not isinstance(defects, list):
        errors.append("missing_defect_register")
    else:
        for i, defect in enumerate(defects):
            if not isinstance(defect, dict) or not present(defect.get("issue_reference")):
                errors.append(f"invalid_defect_record_{i}")
                continue
            if defect.get("severity") in BLOCKING_SEVERITIES:
                if defect.get("status") in UNRESOLVED:
                    errors.append(f"unresolved_high_severity_{i}")
                elif defect.get("status") != "CLOSED" or not present(defect.get("retest_reference")):
                    errors.append(f"unverified_high_severity_fix_{i}")
    return sorted(set(errors))


def main() -> int:
    parser = argparse.ArgumentParser(description="Structural review, never production authorization")
    parser.add_argument("evidence", type=Path)
    parser.add_argument("--sha", help="Required exact reviewed code commit, 40 lowercase hex")
    args = parser.parse_args()
    if args.sha is not None and not SHA.fullmatch(args.sha):
        print("BLOCKED: invalid expected SHA")
        return 2
    try:
        report = json.loads(args.evidence.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        print("BLOCKED: evidence unavailable or invalid JSON")
        return 2
    failures = inspect(report, args.sha)
    if failures:
        print(f"BLOCKED: {len(failures)} outstanding structural UAT gates")
        print("Codes: " + ", ".join(failures[:35]))
        return 2
    print("FORMAT COMPLETE: independently verify actual human signatures, sources, and authenticity.")
    print("NOT RELEASE AUTHORIZATION: schema owner and deployment approvers must still authorize.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

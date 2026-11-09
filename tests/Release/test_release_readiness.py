"""Structural, synthetic-only Task 13 release gate tests."""
import copy
import json
import unittest
from pathlib import Path

from scripts.release.check_release_readiness import (
    IMAGE_DIGEST,
    PROJECT_REF,
    REQUIRED_OWNER_REFERENCES,
    SCHEMA_CHECKS,
    inspect_release,
)

ROOT = Path(__file__).resolve().parents[2]
SHA = "a" * 40


def load(name):
    return json.loads((ROOT / name).read_text())


def simulated_complete():
    """Fake-only evidence exercises a code path; never a human approval."""
    manifest = load("docs/release/release-manifest-template.json")
    inventory = load("docs/release/release-inventory-template.json")
    uat = load("docs/qa/uat-evidence-template.json")
    manifest["target_project_ref"] = PROJECT_REF
    manifest["candidate_sha"] = SHA
    manifest["approved_image_digest"] = "sha256:" + "b" * 64
    for field in REQUIRED_OWNER_REFERENCES:
        manifest[field] = "SYNTHETIC-ONLY-REVIEW-REFERENCE"
    manifest["deploy_authorized"] = True

    inventory["checks"] = dict.fromkeys(SCHEMA_CHECKS, True)
    uat["candidate_sha"] = SHA
    uat["environment_type"] = "isolated_staging"
    uat["environment_reference"] = "SYNTHETIC-ONLY-STAGING-ENV"
    for row in uat["cases"]:
        row["result"] = "PASS"
        row["tester_reference"] = "SYNTHETIC-ONLY-TESTER"
        row["evidence_reference"] = "SYNTHETIC-ONLY-EVIDENCE"
    for row in uat["approvals"]:
        row["decision"] = "APPROVED"
        row["approver_reference"] = "SYNTHETIC-ONLY-APPROVER"
        row["review_reference"] = "SYNTHETIC-ONLY-REVIEW"
    return manifest, inventory, uat


class ReleaseGateTests(unittest.TestCase):
    def test_checked_in_blank_templates_deny_release(self):
        m = load("docs/release/release-manifest-template.json")
        db = load("docs/release/release-inventory-template.json")
        uat = load("docs/qa/uat-evidence-template.json")
        failures = inspect_release(m, db, uat, SHA)
        self.assertIn("production_deployment_not_authorized", failures)
        self.assertIn("database_provenance_table_present", failures)
        self.assertIn("database_restricted_runtime_login_present", failures)
        self.assertIn("uat_unapproved_release_owner_review", failures)
        self.assertGreater(len(failures), 60)

    def test_only_structural_synthetic_example_can_satisfy_parser(self):
        # Not a real signoff, does not issue a deployment or create data.
        self.assertEqual(inspect_release(*simulated_complete(), SHA), [])

    def test_wrong_project_and_wrong_sha_block(self):
        m, db, uat = simulated_complete()
        m["target_project_ref"] = "unexpected-other-project"
        self.assertIn("wrong_target_project_reference", inspect_release(m, db, uat, SHA))
        m["target_project_ref"] = PROJECT_REF
        self.assertIn("candidate_sha_mismatch", inspect_release(m, db, uat, "c" * 40))

    def test_dangling_operator_signature_and_missing_docker_digest_block(self):
        m, db, uat = simulated_complete()
        m["schema_owner_approval_reference"] = "PENDING"
        m["approved_image_digest"] = "latest"
        errors = inspect_release(m, db, uat, SHA)
        self.assertIn("missing_schema_owner_approval_reference", errors)
        self.assertIn("missing_pinned_image_digest", errors)
        self.assertIsNone(IMAGE_DIGEST.fullmatch("latest"))

    def test_absent_schema_and_weak_runtime_role_block(self):
        m, db, uat = simulated_complete()
        db["checks"]["restricted_runtime_login_present"] = False
        db["checks"]["audit_mutation_and_truncate_guards"] = False
        db["checks"]["quarterly_unique_constraint_present"] = None
        errors = inspect_release(m, db, uat, SHA)
        self.assertIn("database_restricted_runtime_login_present", errors)
        self.assertIn("database_audit_mutation_and_truncate_guards", errors)
        self.assertIn("database_quarterly_unique_constraint_present", errors)

    def test_unresolved_high_severity_and_incomplete_human_case_block(self):
        m, db, uat = simulated_complete()
        uat["defects"] = [{
            "issue_reference": "SYNTHETIC-ISSUE",
            "severity": "Blocker",
            "status": "OPEN",
            "retest_reference": None,
        }]
        uat["cases"][0]["result"] = "NOT_RUN"
        errors = inspect_release(m, db, uat, SHA)
        self.assertIn("uat_unresolved_high_severity_0", errors)
        self.assertIn("uat_incomplete_QA-01", errors)

    def test_invalid_document_types_fail_closed(self):
        self.assertIn("invalid_exact_sha", inspect_release({}, {}, {}, "short"))
        self.assertIn("invalid_release_manifest", inspect_release([], {}, {}, SHA))
        self.assertIn("invalid_inventory", inspect_release({}, [], {}, SHA))

    def test_strict_final_dd_rejects_nullable_or_detached_history_schema(self):
        manifest, inventory, uat = simulated_complete()
        for key in (
            "maintenance_project_manager_not_null",
            "maintenance_project_manager_restrict_fk",
            "no_maintenance_record_contexts",
        ):
            inventory["checks"][key] = False
        failures = inspect_release(manifest, inventory, uat, SHA)
        for key in (
            "maintenance_project_manager_not_null",
            "maintenance_project_manager_restrict_fk",
            "no_maintenance_record_contexts",
        ):
            self.assertIn("database_" + key, failures)

    def test_readonly_sql_has_catalog_only_transaction_boundary(self):
        sql = (ROOT / "database/preflight/release_readonly.sql").read_text()
        self.assertIn("BEGIN TRANSACTION READ ONLY;", sql)
        self.assertTrue(sql.rstrip().endswith("COMMIT;"))
        self.assertIn("read_only_postgresql_catalog", sql)
        self.assertIn("bool_and(a.attnotnull)", sql)
        self.assertIn("fk.confdeltype = 'r'", sql)
        self.assertIn("'no_maintenance_record_contexts'", sql)
        self.assertNotIn("'project_and_manager_nullable'", sql)


if __name__ == "__main__":
    unittest.main()

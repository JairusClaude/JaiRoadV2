"""Test-only simulated review records; never actual human approvals."""
import copy
import json
import unittest
from pathlib import Path

from scripts.qa.check_uat_evidence import CASE_IDS, GATES, inspect

TEMPLATE = Path(__file__).resolve().parents[2] / "docs/qa/uat-evidence-template.json"


def fake_complete():
    """Fully synthetic in-memory data tests code paths, not any release."""
    report = copy.deepcopy(json.loads(TEMPLATE.read_text()))
    report["candidate_sha"] = "a" * 40
    report["environment_type"] = "isolated_staging"
    report["environment_reference"] = "SYNTHETIC-ONLY-ENVIRONMENT"
    for row in report["cases"]:
        row["result"] = "PASS"
        row["tester_reference"] = "SYNTHETIC-ONLY-TESTER"
        row["evidence_reference"] = "SYNTHETIC-ONLY-EVIDENCE"
    for row in report["approvals"]:
        row["decision"] = "APPROVED"
        row["approver_reference"] = "SYNTHETIC-ONLY-APPROVER"
        row["review_reference"] = "SYNTHETIC-ONLY-REVIEW"
    return report


class UatEvidenceGateTests(unittest.TestCase):
    def test_repository_template_is_always_blocked(self):
        template = json.loads(TEMPLATE.read_text())
        issues = inspect(template)
        self.assertTrue(issues)
        self.assertEqual(len(template["cases"]), 25)
        self.assertEqual({x["id"] for x in template["cases"]}, CASE_IDS)
        self.assertEqual({x["gate"] for x in template["approvals"]}, GATES)
        self.assertTrue(any(x.startswith("incomplete_QA-") for x in issues))
        self.assertTrue(any(x.startswith("unapproved_") for x in issues))

    def test_synthetic_complete_format_is_only_structurally_valid(self):
        fake = fake_complete()
        self.assertEqual(inspect(fake, "a" * 40), [])

    def test_wrong_sha_or_missing_a_single_case_blocks(self):
        fake = fake_complete()
        self.assertIn("candidate_sha_mismatch", inspect(fake, "b" * 40))
        fake["cases"].pop()
        self.assertIn("missing_or_extra_cases", inspect(fake))

    def test_duplicate_case_or_unverified_approval_blocks(self):
        fake = fake_complete()
        fake["cases"].append(dict(fake["cases"][0]))
        fake["approvals"][0]["review_reference"] = "PENDING"
        issues = inspect(fake)
        self.assertIn("duplicate_QA-01", issues)
        self.assertIn("unverified_approval_teammate_integration", issues)

    def test_open_and_unretested_critical_defects_block(self):
        fake = fake_complete()
        fake["defects"] = [{
            "issue_reference": "SYNTHETIC-ISSUE",
            "severity": "Critical",
            "status": "OPEN",
            "retest_reference": None,
        }]
        self.assertIn("unresolved_high_severity_0", inspect(fake))
        fake["defects"][0]["status"] = "CLOSED"
        self.assertIn("unverified_high_severity_fix_0", inspect(fake))
        fake["defects"][0]["retest_reference"] = "SYNTHETIC-RETEST"
        self.assertEqual(inspect(fake), [])

    def test_no_human_evidence_and_invalid_document_fail_closed(self):
        self.assertEqual(inspect([]), ["invalid_document"])
        fake = fake_complete()
        fake["cases"][0]["tester_reference"] = None
        fake["approvals"][0]["decision"] = "NOT_APPROVED"
        issues = inspect(fake)
        self.assertIn("missing_actual_evidence_QA-01", issues)
        self.assertIn("unapproved_teammate_integration", issues)


if __name__ == "__main__":
    unittest.main()

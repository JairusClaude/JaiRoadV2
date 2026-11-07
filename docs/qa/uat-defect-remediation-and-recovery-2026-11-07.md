# JaiROADS Task 12 — defect triage, recovery rehearsal and honest UAT status

**Status: Code-level validation in progress; HUMAN UAT NOT CONDUCTED; production release NO GO.**  
Prepared 2026-11-07, stacked after [Task 11 PR #16](https://github.com/JairusClaude/JaiRoadV2/pull/16). No official Supabase database/Storage, live account, main branch or teammate branch changed.

## Baseline observed before this change

At `dbf87451740618af90b35c0f8a8cdcd44ccc53c6`, PR #16 passed **25/25** full-system/focused/CI/staging check runs, including actual Chromium four-role and guest HTTP acceptance. GitHub's open-issue list contained draft PRs but **no standalone issue reports** as of inspection. That is **not** evidence that the deployed product is defect-free. Earlier fixable CI lint issues on the Task 11 branch were corrected and retested before this Task 12 branch.

**Two unfinished capabilities required a stronger demonstration:**
1. A separate full-database `pg_dump` -> `pg_restore` rehearsal proving immutable AuditLog, recipient deliveries, reviewed account provenance, canonical accounts, Fortify bridge, RLS permissions and triggers survive loss/restore (the existing Task 6 test only exercised SQL transaction rollback).
2. A machine-checkable UAT evidence register that **refuses** incomplete tester results, open Critical/High defects, mismatched commit, or missing owner review; CI success must never be mistaken for a human signature.

Neither gap is described as a confirmed production outage; both are test/release-process safeguards.

## New backup/restore evidence (disposable PostgreSQL 17 only)

`tests/Staging/rehearse-backup-restore.sh` is run **only** in the GitHub-hosted disposable `jairoads_scratch_staging_host` PostgreSQL 17 service, after the synthetic current-AuditLog and owner-reviewed account transition tests. It refuses any hosted DB URL, nonlocal address, unexpected database name, non-testing environment or absent `DISPOSABLE_LOCAL_ONLY` approval.

The script:
1. Confirms the synthetic `jairoads_scratch_staging_existing` database holds exactly three fake accounts and Fortify bridges, one retained AuditLog event, two immutable reviewed/provisioned records, and one recipient.
2. Adds two other fictional recipients as the **non-owner** `jairoads_app_runtime` role to produce three unique notifications.
3. Executes actual PostgreSQL `pg_dump --format=custom` into an ephemeral archive, validates its SHA-256 and table-of-contents, and restores with `pg_restore --single-transaction --exit-on-error` into a **new** `jairoads_scratch_staging_restored` database.
4. Compares deterministic ordered row-content hashes across five tables **without printing names or passwords**: AuditLog, deliveries, immutable provisioning, canonical accounts and Fortify bridge.
5. Runs `tests/Staging/assert-restored-history.sql` to verify all six real immutable triggers, active RLS on both new tables, forbidden public API access, permitted restricted-app select/insert, prohibited history mutations, and three distinct recipients.
6. Re-checks that the source database did not change, then destroys its temporary restored scratch DB and the archive on the ephemeral CI runner.

This **does not** test a real production backup/restore, point-in-time recovery, service continuity, actual Storage bucket objects, database pooler, live credentials, DNS, or disaster recovery times. Those are still human staging gates.

## Evidence validator (format check, NOT approval)

- `docs/qa/uat-evidence-template.json` intentionally contains **25 NOT_RUN** cases and **13 NOT_APPROVED** owner gates, and no claim of testing.
- `scripts/qa/check_uat_evidence.py` checks all 25 QA cases have `PASS`, non-placeholder tester/evidence references, an exact 40-character Git SHA, a named isolated staging environment, all 13 signed-review references, and no outstanding Blocker/Critical/High defects without an actual retest.
- `tests/QA/test_uat_evidence.py` tests incomplete/mismatched/duplicate evidence and defect cases, including completely fictional in-memory approval strings to exercise the parser. **Those fake strings are not checked in as signoffs and are not human evidence.**
- The new `qa / UAT evidence must block incomplete releases` CI job **expects the committed template to fail closed**. The job passes only if incomplete UAT continues to be refused.

Usage by an actual authorized operator (in a private evidence workspace):

```bash
python3 scripts/qa/check_uat_evidence.py /path/to/private-uat-evidence.json --sha <exact-40-character-reviewed-commit>
```

Output **BLOCKED** and status 2 means the structural UAT register is incomplete. Output **FORMAT COMPLETE** and status 0 means only that fields exist and are internally consistent; the owner must independently authenticate all source evidence and signoff. **The CLI is never a substitute for a human release approval** and must not automatically trigger deployment.

Do not push actual persons' identity checks, signed reviewer details, raw database exports, credentials, reset tokens, raw screenshots, passkey material, sensitive log payloads or audit old/new values to GitHub. Store evidence in the approved private records system and refer to approved ticket IDs only.

## Defect disposition and follow-up workflow

- **Observed automated defects:** Task 11's earlier two missing blank lines/import order were fixed; the latest integrated Task 11 commit is green. This package does not assert that real users have found or fixed defects.
- **New failures:** Any new automated regression must be linked to an actual test, GitHub job URL and reproducible synthetic fixture before being labeled an application defect. A failed CI-only test is logged truthfully as a test/fixture defect until product behavior is verified.
- **Human test issues:** Actual testers run each QA-01–QA-25 in the [system acceptance plan](system-role-acceptance-plan-2026-11-07.md) on persistent isolated staging, report steps and a sanitized issue ID, classify severity, assign an owner, patch on a new review branch and rerun the exact scenario plus broad regression.
- **Blockers:** Any open Blocker/Critical/High issue, unverified retest, absent real SuperAdmin recovery, unreviewed ordinary Admin/Engineer person-profile association, missing Data Dictionary/schema-owner signoff or unavailable persistent staging is **NO GO**. Never invent a historical provisioning approver or silently discard audit rows/Storage objects to make tests pass.

## Actual Task 12 release-state register

| Workstream | Current evidence | Live/manual status |
|---|---|---|
| Four-role/guest authorization, quarterly CRUD, retained history, private-file mock, signed virtual WebAuthn | PR #16 25/25 GitHub checks | Automated synthetic PASS; real acceptance pending |
| Full PostgreSQL custom backup/independent restore + RLS/immutability | New GitHub staging script | CI verification required; real PITR/restore pending |
| UAT test-case and owner-approval format enforcement | 25+13 blank template, unit tests, fail-closed gate | Human UAT **NOT RUN** |
| Production-severity defect register | No standalone open GitHub defect reports observed | Not enough evidence to certify zero defects |
| Private Storage, SMTP delivery, real device passkeys, real maps | Mocked/source checks only | Persistent staging/manual service verification pending |
| Data Dictionary, grants, real-account transitions and release approvals | Draft proposals/PRs only | **NOT APPROVED** |

**Next release step is NOT automatic production deployment.** Task 13 can only be prepared for review; actual official Supabase changes need explicit authorization after every human, service, identity, backup/recovery and schema gate is met.

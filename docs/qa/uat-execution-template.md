# JaiROADS — Task 11 / Task 12 UAT evidence and defect record

**Blank template — no test execution or approval is implied by this document.**  
Use one copy per candidate build and per isolated staging environment; keep sensitive data in approved private records, not in GitHub.

## Execution metadata

| Field | Enter at actual execution |
|---|---|
| Build / Git SHA | Pending |
| PR / branch | Pending |
| Date, time zone, session start/end | Pending |
| Staging environment / test database name | Pending |
| Supabase Storage staging bucket identities (nonsecret) | Pending |
| Tester and accountable user representative | Pending |
| Role (SuperAdmin/Admin/Engineer/Viewer/Guest) | Pending |
| Browser, device, viewport, assistive technology | Pending |
| Approval for use of synthetic test records | Pending |
| Runtime PostgreSQL role / RLS gate (redacted evidence) | Pending |
| Release approver / owner | Pending |

## Test case log

Copy this row for each ID from `system-role-acceptance-plan-2026-11-07.md`. Do not pre-fill PASS.

| Case ID | Expected | Actual (sanitized) | Result (PASS/FAIL/BLOCKED/NOT RUN) | Evidence / issue reference | Tester / timestamp |
|---|---|---|---|---|---|
| QA-01 | Guest cannot read authenticated resources | Not run | NOT RUN | Pending | Pending |

## Defect report (one record per defect)

| Attribute | Record |
|---|---|
| Defect ID / GitHub issue | Pending |
| QA case and affected role / module | Pending |
| Severity (Blocker / Critical / High / Medium / Low) | Pending |
| Reproduction on synthetic staging data | Pending |
| Expected vs. observed result | Pending |
| Affected SHA and environment | Pending |
| Sanitized evidence/log/request trace | Pending |
| Suspected source or owner | Unassigned until triage |
| Proposed fix PR / SHA | Pending |
| Re-test SHA / date / tester | Pending |
| Regression result | NOT RUN |
| Disposition | OPEN |

## Explicit gate signoffs

Do **not** mistake an automation success badge for an operator signature.

| Gate | Accountable person / evidence | Decision |
|---|---|---|
| Teammate integration and legacy-branch disposition | Pending | NOT APPROVED |
| Data Dictionary policy / historical schema alignment | Pending | NOT APPROVED |
| SQL, real runtime role/RLS, backup/recovery | Pending | NOT APPROVED |
| Actual SuperAdmin authentication/recovery | Pending | NOT APPROVED |
| Existing Admin/Engineer private profile verification | Pending | NOT APPROVED |
| Real private Storage and file recovery | Pending | NOT APPROVED |
| SMTP password-reset delivery | Pending | NOT APPROVED |
| HTTPS signed WebAuthn and MFA recovery on real devices | Pending | NOT APPROVED |
| Map provider connectivity / terms and fallback | Pending | NOT APPROVED |
| All Blocker/Critical/High defects resolved and retested | Pending | NOT APPROVED |
| Authorized user acceptance on exact signed build | Pending | NOT APPROVED |
| Official migration/deployment release authorization | Pending | NOT APPROVED |

## Stop/go rule

**NO GO** if there is any missing required signoff, a high-impact open defect, unverified account provenance, absent persistent isolated staging, untested restore procedure, missing genuine restricted Laravel DB role, disabled AuditLog protection, or incomplete retention/safe-file deletion. Preserve all immutable history during remediation.

This template stores no credentials and makes no claim of running manual UAT. Only the authorized operators and reviewers can fill in the evidence and approve the release.

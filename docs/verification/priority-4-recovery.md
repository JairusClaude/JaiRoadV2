# Priority 4 recovery and merge-readiness checkpoint

**Recommendation: not ready for a reviewed merge.** Verified fixes are preserved and published; global quality, dependency security and complete browser/container acceptance remain outstanding. No merge, PR or deployment was performed.

## Recovery and provenance

Recovery found local branch `integration/dd-system-completion` and remote HEAD both at `25526f70b02aa5d806ecb9062094f793814f61ed`, with no staged changes or local Priority 4 commits. There were 115 modified tracked files and 11 new source/harness files. All were preserved. Earlier quality fixes, tests, build output, browser logs and screenshot were inspected instead of restarting Priorities 1–3.

Existing ancestry remains intact. Base: `feature/premerge-policy-alignment` at `b0bad2ffd09906bef8640a7d8a6af6d1705b44b1`, incorporating quarterly/role/account work at `b2f041d4e2dd7d2f8273f15611f419f3b476aab7`. Password fixes were selectively integrated from `feature/jairoads-map-demo_PASSWORD_EDIT` at `225a63ae0bfa81ae850a3ca14585add99ac33b7f` during Task 1; this recovery merges no source branch and does not merge `auditLog_behavior`. Task 2 lifecycle/reassignment work and Task 3 reconciliation remain present.

Published implementation commits:

- `fb8e41cb13afe8f054558546fe27d07b97e1ce57` — compatible quality/type/React corrections and valid dashboard/entry-point regression tests.
- `20f57a5281930841ba5f6a05b81afff320c01a89` — upload authorization recheck, rollback tests, disposable setup guard, container configuration and verification harnesses.
- The subsequent recovery checkpoint contains this report, captured evidence and corrections to fresh-checkout CI prerequisites. Its exact SHA is supplied in the final completion message; it cannot be embedded in its own contents.

Only the integration ref was published, through the authenticated GitHub integration using non-force updates with an expected previous SHA. The exact commit objects were fetched into the local branch. No history was rebased, recreated or discarded. Original branch refs were compared before/after publication.

## Checks already performed before recovery

The saved evidence contained passing TypeScript, Vite build, resource-wide Prettier and repository-wide ESLint checks, a Laravel run with 93 passing tests/two existing skips, 12 setup-guard tests and nine focused upload/workflow tests. The initial canonical run had three failures caused by incomplete Storage mocks; the corrected focused tests passed. Browser attempts exercised real Fortify login for all four roles, dashboard rendering, seeded road display, location search, three-point tracing, road/project creation, then stopped at an incomplete quarterly form. A later attempt stopped on the transient search-loading assertion. No complete browser acceptance pass existed. Docker had not run locally; neither Docker nor Podman is installed.

## Bounded recovery verification

The business suite was rerun because the upload fix and new cross-module cases required verification together. Feature tests were rerun because their dashboard fixes and runner warning needed confirmation. The existing password suite was not manually restarted; the authorized branch publication triggered its existing CI.

| Check on combined source | Actual result | Evidence |
|---|---|---|
| Default `php artisan test`, isolated SQLite memory | **95 passed, 2 skipped, 483 assertions**, exit 0 | `priority-4-evidence/laravel-checkpoint.log` |
| PostgreSQL 17 canonical/business suite, `phpunit.quarterly.xml` | **118 passed, 1,088 assertions**, exit 0 | `canonical-final.log` |
| PostgreSQL 17 Feature suite, `phpunit.premerge-feature.xml` | **41 passed, 2 skipped, 173 assertions**, exit 0 | `postgres-feature-clean.log` |
| Focused new cross-module/upload suite (included in 118) | **9 passed, 117 assertions** | `workflow-focused.log` |
| Local setup guard (included in 95) | **14 passed, 21 assertions** | `setup-guard-final.log` |
| PHP syntax, app/config/routes/tests/tools | **196 files passed** | Executed `php -l` over each file |
| Route verification | **110 routes**, successful | `routes-final.log` |
| PHPStan global | **FAIL: 36 missing relationship generic annotations**, all canonical models | `phpstan.json` |
| Pint global | **FAIL: 9 protected files** | `pint-current.log` |
| ESLint global, `--max-warnings=0` | **PASS locally with generated routes present** | `eslint-current.log` |
| Prettier, `resources/` | **PASS** | `prettier-current.log` |
| TypeScript | **PASS locally with generated routes present** | `typescript.log` |
| Vite production build | **PASS**, manifest/assets produced | `build.log` |
| Composer manifest and entrypoint shell syntax | **PASS** | `composer validate --strict --no-check-publish`; `sh -n docker/entrypoint.sh` |

Counts overlap; do not add these rows into a unique-test total. Both default and PostgreSQL Feature runs include the same two pre-existing public-registration skips, because public registration is disabled. No new test was skipped or weakened. PostgreSQL fixtures restore only a guarded loopback `jairoads_scratch_*` database; no shared migrations execute.

## Actual workflow coverage

The 118-case PostgreSQL suite covers direct HTTP role restrictions, Engineer/Admin project creation, canonical creator attribution, linked Admin self-management, eligible manager selection, unauthorized reassignment rejection, free Q1–Q4 choices, concurrent duplicate prevention, year/quarter/start/duration/status validation, monthly uniqueness/progress limits, retirement/deactivation with existing sessions, lifecycle history retention and explicit authorized manager reassignment. IntegrationCompatibility tests verify synchronized DD settings/reset passwords and authentication afterward, and audit-failure rollback. New FullMaintenanceWorkflow tests exercise road creation/editing with three map points, inherited municipality, project/record/monthly creation, private document/media metadata and download authorization using Storage mocks.

Actual browser Fortify logins reached SuperAdmin, Admin, Engineer and Viewer dashboards. Full UI acceptance remains **INCOMPLETE**: the saved last run timed out waiting for `Searching…` in the road tracing editor. Earlier attempts reached road/project creation and stopped at record-form validation. These are harness/incomplete-form failures, not proof that production search or quarterly creation is broken. The record harness now selects required status, but has not passed end to end. External map tiles and Nominatim were stubbed; real geocoder/network availability is **NOT TESTED**. Final responsive/error/empty states, confirmation dialogs, account/lifecycle/reassignment browser acceptance, complete document/media browser upload/download and physical MFA/passkey ceremonies are **NOT TESTED** on the final checkpoint. Existing harnesses remain available; their older-branch results are not counted.

## Confirmed fixes versus inherited issues

1. **Security/integrity fix:** document/media uploads authorized only before remote I/O could commit after deactivation, LGU unassignment or manager reassignment. Metadata transactions now acquire the lifecycle advisory shared lock, then project/record locks in reassignment order, re-resolve the actor and check current scope. Media also locks/rechecks its MonthlyUpdate parent. Revoked requests abort, metadata/audit roll back and existing compensation removes only the newly uploaded object. Six revocation cases and two audit-insertion failures are covered. This adds no deletion-retention policy.
2. **Legacy runtime fix:** SQLite could not execute PostgreSQL-specific `btrim` in the valid legacy dashboard path; standard `trim` preserves the expression on both engines. Valid Viewer dashboard rendering is now exercised. Guest login redirection and unlinked-user denial remain asserted; the old expectations were inconsistent with approved authentication.
3. **Factory/type/React corrections:** restore the legacy MonthlyUpdate factory trait; specify actual legacy relation/collection types; fix callback dependencies, render-time ref writes and preference initialization. Existing permissions and authentication architecture are retained. The bulk formatting work was already performed before recovery and was preserved, not restarted.
4. **Startup/setup preparation:** convenience Composer setup refuses non-disposable targets before key generation/migration. It checks environment/approval, loopback/scratch names, DB_URL precedence and rejects connection query overrides; persistent SQLite is rejected. Direct privileged `artisan migrate` remains an operator capability, not a globally disabled Laravel command. Production entrypoint validates key/database configuration and performs no migration, seed or initialization. Container upload limits now accommodate the existing DD 20 MiB handler limit. The underlying DD/legacy size-policy discrepancy is still unresolved.
5. **Inherited protected quality debt:** PHPStan fell from 75 to 36 errors; remaining errors concern canonical relationships. Pint fell from 55 to nine files: seven canonical models, the scratch baseline and the historical document migration. These protected files are unchanged. No baseline, ignore comment, disabled rule or reduced analysis scope hides the debt.

Exact implementation paths are listed in `priority-4-evidence/implementation-files.txt` (126 source/config/test files across the first two commits). Main behavioral files: `DdOperationsController.php`, `RoleDashboardController.php`, legacy `MonthlyUpdate.php`, `LocalSetupGuard.php`, `tools/guard-local-setup.php`, container files and Composer setup scripts. Test additions: `FullMaintenanceWorkflowTest.php`, `LocalSetupGuardTest.php`, browser/system/private-storage fixtures and Docker smoke harness. Tests for dashboard/root contracts were corrected with positive and negative authorization coverage. Audit notification service changes are PHPDoc only; existing audit architecture is preserved.

## GitHub Actions and dependency security

Verified source checkpoint `20f57a5281930841ba5f6a05b81afff320c01a89`:

- [Focused regressions](https://github.com/JairusClaude/JaiRoadV2/actions/runs/40513539279): **all three jobs passed** — password PostgreSQL, quarterly PostgreSQL and frontend. This is new combined-branch evidence, not copied from Task 3.
- [Full system verification](https://github.com/JairusClaude/JaiRoadV2/actions/runs/40513541702): **not green**. Laravel, routes, Prettier and Vite passed. PHPStan/Pint failed on protected debt. Fresh-job ESLint/TypeScript lacked generated Wayfinder modules; PostgreSQL Feature rendering lacked the Vite manifest (11 failed/30 passed/two skipped). Recovery corrects job preparation by generating Wayfinder routes and building real assets before Feature tests, without disabling checks; the follow-up run must confirm it.
- Composer audit **failed: eight advisories affecting five packages**, including a critical Laravel framework advisory. npm audit **failed: seven vulnerabilities (five high, two critical)**. These are findings in unchanged lockfiles, not evidence of application exploitability. Prioritize reviewed dependency updates and regression testing before merge/deployment. No blind `audit fix`, lockfile replacement or advisory ignore was performed. Captured advisory IDs, affected ranges and links are in `composerAudit.log` and `npmAudit.log`.
- Local Composer audit was blocked by network policy to Packagist; local npm audit did not complete. CI performed both, so their results above are actual execution evidence.
- Docker CI **built the production image successfully** (`sha256:0ffec3ba94b38d71e42df4f500bd5608b4ed9e11247e484067023f3ed66e947b`). Missing APP_KEY and missing database configuration both correctly failed closed. The container served health/login, but the asset fetch smoke test **failed** with `ECONNREFUSED 127.0.0.1:80` while fetching an emitted asset URL; the tested app listens on port 10000. The underlying URL/configuration cause is unresolved. Subsequent role/private-file smoke, startup-log/limit inspection and unreachable-DB handling were **NOT TESTED** because that step failed. Local Docker is unavailable. See `docker-result.log`. No image was published or deployed.

## Remaining Data Dictionary and security decisions

Task 3 reconciliation remains authoritative for the last live read-only snapshot; no new live Supabase inspection or writes were performed during Priority 4. See `../reconciliation/` for all 11 entities, constraints and recommendations.

- Database teammate: add reviewed `UNIQUE(project_id, maintenance_year, quarter)` after a fresh duplicate scan. Application project locks protect cooperative writers; direct SQL/imports still lack the physical invariant.
- Coordinate missing canonical model generic annotations and nine protected formatting files with their owner; do not silently overwrite their changes.
- Custom audit implementation still has previously documented LOGIN, fan-out/self-notification/no-op and before/after consistency deviations. It is deliberately preserved pending the team's replacement decision. Supabase Auth logs/pgAudit alone do not replace verified business actors, snapshots and notification delivery. No audit history, writer or trigger was removed.
- File database deletion versus Storage retention remains unapproved; destructive file endpoints remain disabled. Parent project/road history and reassignment policies, earlier MonthlyUpdate edit windows, MIME/size limits, retirement handover and future notification behavior still require decisions recorded in Task 3.
- Remediate critical/high dependency advisories, confirm fresh CI prerequisites, finish browser acceptance and container checks before merge. RLS/bucket/application-role boundaries and live constraint changes remain teammate/operator responsibilities; no production claim is inferred from disposable fixtures.

Canonical models, both migration directories, shared Supabase records and live Storage were not modified. No real user credentials were changed. Rank remains independent of Account Type; arbitrary available Q1–Q4 selection remains enabled. This is a preservation and verification checkpoint, not a merge approval.

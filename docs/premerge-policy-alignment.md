# Pre-merge policy alignment

Source: `Quarterly/Role/Assignment_Update` at `b2f041d4e2dd7d2f8273f15611f419f3b476aab7`. Working/publication branch: `feature/premerge-policy-alignment`. The user-approved updated decisions supersede the earlier mandatory twice-yearly pairing and optional new-account linkage described in historical Task 1–4 documents. No branches are merged.

## Quarterly behavior

Before: first Q1/Q2 fixed a permanent Q1/Q3 or Q2/Q4 pair, second-half creation required a matching first-half record and mixed history blocked creation.

Now: authorized Engineers and administrators may choose any unoccupied Q1, Q2, Q3 or Q4. There is no fixed pairing, prerequisite first-half period, mandatory next quarter or hard two-per-year limit. All four distinct quarters in one year are allowed; the same quarter may recur in another year or project. Project Details shows all existing records and available quarter actions for the selected year. No future records are created automatically. Historical duplicate rows are flagged and preserved, and cannot be duplicated again; other available periods remain usable.

`TwiceYearlyMaintenance` retains its historical class name for compatibility but now derives availability and rejects duplicate project/year/quarter combinations. `DdOperationsController` retains its parent-project `FOR UPDATE` lock before reading complete history and inserting/auditing a record. Cooperating requests therefore serialize. The schema owner should separately consider **UNIQUE(project_id, maintenance_year, quarter)** after reviewing historical duplicates. No production constraint, index or migration is changed/applied.

StartDate must match both selected year and quarter; duration is a positive integer number of days. Status remains Ongoing/Completed with the existing completion-date rules. Ordinary edits preserve project, managing Engineer, year and quarter. Historical corrections and explicit reassignment still need their separate authorized workflows. MonthlyUpdate remains a separate progress entity, with its existing per-maintenance-record UpdateMonth uniqueness rule.

## New-account linkage

Before: Admin/Engineer creation permitted NULL EngineerID. Now: both account types require a real Active Engineer profile that no other canonical account uses, including inactive accounts. Existing profile row locking, provisioning serialization, canonical/public identity insertion, one-time password hashing and transactional audit behavior are preserved. The UI obtains eligible profiles through a backend anti-join against all accounts, not the limited directory listing. Linked Engineer is required for Admin/Engineer; missing-link validation and profile-first guidance are visible. Viewer remains unlinked and rejects a supplied profile. Ordinary requests cannot create SuperAdmin.

Linked Admin remains Account Type Admin and may self-manage only with valid profile/LGU eligibility. Existing unlinked Admin accounts remain unchanged, can authenticate and perform permitted administration, and have no invented self-manager identity. Existing unlinked Engineers gain no LGU/assignment editing rights. The resolver's compatibility logic is unchanged; its comment now distinguishes historical compatibility from new provisioning. No relationship is inferred from email/username/equal numeric IDs. Account Type, Rank, Fortify infrastructure, password reset/synchronization and authorization architecture remain intact.

## Tests without migrations

The existing `PostgresTestCase` now calls `PostgresTestSchema`, which checks explicit approval, testing environment, loopback host, no DB URL/Render, a `jairoads_scratch_*` database name, actual server/database identity and PostgreSQL major version 17 before writing. Initial setup refuses any existing canonical schema or public table. Frozen test-only canonical SQL is copied unchanged from the source baseline as text; no migration file is required, modified or executed. Minimal public Fortify fixtures support authentication tests. This fixture is not a deployment schema or replacement migration.

Canonical suite, only on an empty disposable local PostgreSQL 17 database:

```bash
JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY \
DB_DATABASE=jairoads_scratch_premerge DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD= \
php vendor/bin/pest --configuration=phpunit.quarterly.xml --display-warnings --fail-on-warning
```

The environment must include a local `.env` file (empty is sufficient for CI); settings come from the explicit test environment/XML. Do not copy production credentials. Existing browser fixture preparations use the same guarded fixture loader. Run the quarterly, assignments and account-terminology browser scripts against separate disposable databases/local applications, following the earlier documented browser environment variables.

`phpunit.premerge-feature.xml` runs the unchanged Feature tests on another empty disposable PostgreSQL 17 database. Its bootstrap restores guarded fixtures and marks RefreshDatabase initialized, so that trait only wraps tests in transactions and never invokes migrations. The fixture application's handlers are restored before PHPUnit tests begin. Use a local TLS-enabled PostgreSQL server for these tests because the existing application config requires TLS when subsequent Laravel applications boot.

```bash
JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY \
DB_DATABASE=jairoads_scratch_features DB_HOST=127.0.0.1 DB_CONNECTION=pgsql DB_URL= \
DB_PORT=5432 DB_USERNAME=postgres DB_PASSWORD= \
php artisan test --configuration=phpunit.premerge-feature.xml
```

The original default `phpunit.xml`, migrations and SQLite-specific legacy unit tests remain unchanged. Do not run the default migration-backed suite during this task. Four database-free unit files can be selected explicitly with the PostgreSQL configuration. The legacy `MaintenanceProjectCrudTest` hardcodes SQLite and is not executed under this task's PostgreSQL-only constraint.

## Assessment and integration blockers

[Supabase auditing feasibility](supabase-auditing-feasibility.md) is a separate decision assessment. No AuditLog writer, notification service, authentication listener, history table or protection is removed/rewritten; `auditLog_behavior` is not imported. A concrete replacement, verified actor context, history/notification contracts and a separately approved cutover remain unresolved.

Update the authoritative Data Dictionary with free quarter selection/duplicate-only occurrence uniqueness and mandatory links for newly provisioned Admin/Engineer accounts, explicitly grandfathering existing unlinked Admins. Physical nullability must continue supporting those accounts until the schema owner separately approves reconciliation. Preserve Admin self-management, canonical UserAccount creator attribution and independent Engineer Rank semantics.

Before password/feature integration, review their actual diffs/conflicts and canonical model/migration contracts without silently changing schema, routing DD users to legacy tables, or replacing the explicit Fortify account link. Re-run the combined authorization/password/reset/storage/audit regressions on the eventual integration result. Existing global lint/static-analysis debt and inherited dashboard/home test failures still block claiming a universally green repository. This branch does not perform or approve that merge.

## Actual verification results

PHP 8.4.26 and disposable PostgreSQL 17.11 were used. Every test cluster was stopped and removed. No migration class/command was executed; the frozen canonical fixture was checked against all 41 unchanged source SQL blocks. No shared database was contacted for test writes.

| Check                                                               | Actual result                                                                                                                                      |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical Laravel/Pest PostgreSQL suite                             | **77 passed, 687 assertions, zero test warnings**                                                                                                  |
| Real Chromium browser scripts                                       | **All three passed**: Engineer Q4-first/Q2 selection and next-year reuse; project/manager authorization; Account Type/Rank and required profile UI |
| Existing Feature suite via migration-free PostgreSQL fixture config | **38 passed, 2 failed, 2 skipped, 154 assertions**, no risky/warning results after fixture-bootstrap cleanup                                       |
| Four existing database-free unit files                              | **8 passed, 64 assertions**, zero test warnings                                                                                                    |
| PHP syntax                                                          | **225 files passed** across app/bootstrap/config/database/routes/tests, excluding generated caches                                                 |
| `composer lint:check`                                               | **Fails: 58 files**, same inherited scope as source                                                                                                |
| `composer types:check`                                              | **Fails: 75 errors**; comparison against source diagnostics finds **no new errors**                                                                |
| `npm run lint:check`                                                | **Fails: 924 errors, 7 warnings**, unchanged source totals                                                                                         |
| `npm run format:check`                                              | **Fails: 55 files**, unchanged source total                                                                                                        |
| Global TypeScript and Vite build                                    | **Passed**                                                                                                                                         |
| Route verification                                                  | **Passed**, 104 routes                                                                                                                             |
| Focused Pint/PHPStan for services, fixtures/tests                   | **Passed**                                                                                                                                         |
| Focused ESLint/Prettier for changed UI and browser scripts          | **Passed**                                                                                                                                         |
| Documentation formatting and Git whitespace checks                  | **Passed**                                                                                                                                         |

The Feature failures are inherited: DashboardTest expects 200 for an unlinked factory user but receives 403; ExampleTest expects home 200 but receives 302. Registration's two existing disabled-feature skips remain unchanged. No assertions were removed to hide a regression: only obsolete mandatory-pair tests were replaced as requested. A browser selector was corrected to include the displayed year, and a test-only bootstrap handler-stack issue was fixed before final results were collected. The selected year/form state is retained after save, including a verified 2027 save.

The full default suite was not invoked because it executes migrations and includes 32 legacy CRUD unit tests hardcoded to SQLite; those files/configuration are unchanged and were not counted as passes. All applicable canonical and Feature workflows were exercised through the guarded PostgreSQL configurations instead. External map-tile loading is blocked by the local network environment; existing map fallback displays, and RoadCoverage/storage handlers remain unchanged.

The focused non-deployment GitHub workflow now triggers on the new branch and runs the full canonical PostgreSQL suite with warnings treated as failures, scoped lint/static analysis, global TypeScript and Vite build. GitHub Actions has not run for this unpublished branch because publication was blocked by automatic approval review. No green run from an earlier branch is claimed as verification of this work. A green focused workflow does not resolve the inherited repository-wide failures listed above.

Changes are separated into quarterly selection, new-account linkage, tests/CI, and documentation commits. Terminal Git has no credentials (`fatal: could not read Username for 'https://github.com': terminal prompts disabled`). The GitHub integration reports repository write permission, but automatic approval review rejected creation of GitHub tree objects containing the changed local source. Its stated reason was that exporting substantial code to this new-branch workflow was not authorized. No alternate publishing route was attempted after that rejection.

The complete tested work is preserved as four local commits on `feature/premerge-policy-alignment`, retaining the exact source ancestry. Direct confirmation to publish those commits to `origin/feature/premerge-policy-alignment` is needed before retrying; terminal credential setup is a separate issue. A locally verified Git bundle provides recovery from an authenticated machine without recreating or changing commit SHAs. No force push, reset, rebase, merge, pull request or deployment was performed. Protected remote branches remain unchanged.

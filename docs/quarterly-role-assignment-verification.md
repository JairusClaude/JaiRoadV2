# Task 4: quarterly, role and assignment verification

Verified on 2026-10-21, continuing the published Task 3 commit `a660793c54e16aac6d1d4535d5ad2e8937f7d697`. The local branch remains `Quarterly/Role/Assignment_Update`; final publication targets only that remote branch. The remote did not exist at the start. Task 3's `PositionCleanup_Update` remote HEAD was fetched and independently verified through the GitHub integration.

The approved [Data Dictionary](https://docs.google.com/document/d/1WeaLeaOTvxMMsjce0Ec50VNMz0_2Psf5soC-dmbVcbA/edit) was reread. The user-approved twice-yearly pattern and linked Admin self-management requirements supplement its pending scheduling/assignment decisions.

## Integration outcome

No product-code regression introduced by Tasks 1–3 was found. No production source fix is needed for Task 4. The Task 4 commit adds `tests/Quarterly/IntegrationCompatibilityTest.php`, enables the existing non-deployment focused CI workflow on the final branch, and adds this report. Existing tests and checks were neither weakened nor skipped.

| Required workflow                                 | Evidence                                                                                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engineer creates project within an authorized LGU | PostgreSQL authorization regressions and real browser project creation; canonical account creator and RoadCoverage municipality verified                                   |
| Admin creates an unassigned project               | Admin/SuperAdmin regressions and browser flow; no MaintenanceRecord or invented project assignment created                                                                 |
| Admin chooses an eligible manager                 | Active account/profile/LGU assignment tests, invalid-choice rejection, and browser submission                                                                              |
| Linked Admin manages own activity                 | Profile/assignment eligibility, create/edit tests, and browser self-selection                                                                                              |
| Q1/Q3 and Q2/Q4 repeat across years               | Both pairs exercised through four periods with expected next year/quarter assertions                                                                                       |
| Duplicate/incompatible periods rejected           | Duplicate, mixed pair, third-period, conflicting history, and actual competing-process tests                                                                               |
| Date/duration/status validation                   | Wrong year/quarter, invalid calendar date, zero/negative/fractional duration, Completed/Ongoing completion rules                                                           |
| Next-period creation                              | Browser prepares preselected next record and saves it; preparing/canceling alone creates no future row                                                                     |
| Viewer remains read-only                          | Direct HTTP create/update/delete denials and absence of manager choices                                                                                                    |
| Account Type and Rank terminology                 | Canonical provisioning/association tests and real browser forms for all four account types; no Position input in active DD forms                                           |
| Password synchronization                          | DD settings and real Fortify reset/login integration tests verify identical canonical/Fortify hashes and valid resolved identity                                           |
| Existing audit integration                        | Canonical actors on CREATE/UPDATE; forced audit insert failures roll back project create, record create and record update                                                  |
| Historical records and attachments preserved      | Conflicting historical schedules remain unchanged; road, monthly update, document/media metadata and earlier audit rows remain byte-equivalent after period edits/creation |

The attachment regression uses synthetic metadata in a disposable database, without uploading, reading or changing a real storage object. Existing private storage/authorization implementations are unchanged. MFA challenge and passkey security-settings compatibility tests pass in the standard Laravel suite; a physical authenticator ceremony is not exercised.

## Actual local checks

PHP 8.4.26, PostgreSQL 17.11 and the installed Composer/npm lockfile dependencies were used. Every database-writing test ran against a newly initialized disposable loopback PostgreSQL 17 cluster, stopped and removed afterward. Canonical tests use the existing explicit local host/database-name/environment/version guards and unchanged scratch baseline. The standard Laravel suite uses its existing migration stream in a separate fresh disposable database. No automated write test used SQLite or shared Supabase during Task 4.

| Check                                                                                  | Result                                                                                                |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `php vendor/bin/pest --configuration=phpunit.quarterly.xml`                            | **62 passed, 581 assertions**, including all previous 56 tests and six new integration cases          |
| Three real Chromium/Playwright browser scripts                                         | **All passed**: quarterly, project assignments, Account Type/Rank; real local Fortify sessions        |
| `php artisan test` on disposable PostgreSQL 17                                         | **78 passed, 2 failed, 2 skipped, 443 assertions**                                                    |
| Same full Laravel suite on untouched source `73129e9f9fc357438015e7ccd9430dd8e8dafc51` | Identical **78 passed, 2 failed, 2 skipped, 443 assertions**                                          |
| PHP syntax                                                                             | **222 files passed**, covering app/bootstrap/config/database/routes/tests (generated caches excluded) |
| `composer lint:check`                                                                  | **Fails: 58 files**; same paths and fixer sets as original source                                     |
| `composer types:check`                                                                 | **Fails: 75 errors**, versus 78 on original source; diagnostic comparison finds **no new errors**     |
| `npm run lint:check`                                                                   | **Fails: 924 errors, 7 warnings**, versus original source's 1016 errors, 7 warnings                   |
| `npm run format:check`                                                                 | **Fails: 55 files**, versus original source's 60                                                      |
| `npm run types:check`                                                                  | **Passed**                                                                                            |
| `npm run build`                                                                        | **Passed**                                                                                            |
| `php artisan route:list --except-vendor`                                               | **Passed**                                                                                            |
| Focused Pint: both new services, Quarterly tests, browser fixture PHP                  | **Passed**                                                                                            |
| Focused PHPStan: both new services                                                     | **Passed**, zero errors                                                                               |
| Focused ESLint/Prettier: six changed DD UI components and three browser scripts        | **Passed**                                                                                            |
| `git diff --check`                                                                     | **Passed**                                                                                            |

The two standard Laravel failures are inherited expectations: `DashboardTest` expects 200 for an unlinked factory User but the authorization boundary returns 403; `ExampleTest` expects 200 on the home route but receives its configured 302 redirect. The two existing skips are disabled public registration tests. No tests were disabled to produce these results. An initial baseline run overlapped Vite replacing built assets and had two additional missing-font-file failures; repeating after the completed build reproduced exactly the same two functional failures as the current branch.

Repository-wide style/static-analysis debt is outside the requested integration scope. No suppressions, baselines, exclusions or unrelated formatting rewrites were added. This branch is **not globally green or ready for merge** merely because the focused CI passes. Docker is unavailable locally; no Docker build/deployment was attempted.

The existing `JaiROADS focused regressions` GitHub Actions workflow now also triggers on `Quarterly/Role/Assignment_Update`. It runs the full canonical PostgreSQL configuration, focused service/test formatting/static analysis, global TypeScript/build, and focused UI lint/format checks. It has read-only repository permissions and uses only an ephemeral PostgreSQL service with disposable credentials. It does not run shared migrations or deploy. The first published run succeeded but reported missing-`.env` warnings on every test. Reproducing with `--display-warnings` confirmed PHPDotenv was reading the absent file during test setup. A focused CI follow-up creates an empty ignored `.env` before tests, as the frontend job already does, and enables `--fail-on-warning`/`--display-warnings`. All database/application settings still come from the explicit disposable environment/configuration. No warning is suppressed. The final response records the final run URL/conclusion after publication.

## Scope and outstanding Data Dictionary decisions

Compared with the original source, canonical models, all migration/schema files, identity resolver, role-access service, authentication/password code, middleware, providers, AuditLog services and private storage services are unchanged. Within `DdOperationsController`, only `recordScope`, `show`, `saveProject` and `saveRecord` changed across Tasks 1–3. The existing audit helper, settings handler, RoadCoverage mutations, document/media handlers and deletion handling are byte-identical to source. Task 4 changes no production controller or UI.

1. Synchronize the approved Q1/Q3 or Q2/Q4 annual rule with the Data Dictionary. The schema owner should separately review a unique `(project_id, maintenance_year, quarter)` constraint after historical duplicate review. Application parent-row locking protects cooperating application requests; it is not a database uniqueness constraint.
2. Historical schedule correction and changing an established annual pair need a separately approved workflow. Existing conflicting history is flagged and preserved. No automatic repair or fake future activity exists.
3. There is no permanent project-level assignment column. Managers belong to actual MaintenanceRecords. Permanent assignment before activity requires a separate schema decision; explicit reassignment is not implemented here.
4. The Data Dictionary says Admin/Engineer accounts are linked, while the source still permits some unlinked account provisioning. Existing compatibility is preserved; new Engineer project creation and linked Admin self-selection enforce valid active profiles/assignments. Account reconciliation/link-provisioning policy needs team confirmation.
5. The source's existing AuditLog behavior still conflicts with the dictionary: notification fan-out creates additional rows/self-notifications, LOGIN events remain enabled, and ordinary unchanged saves can generate UPDATE events. These were not introduced by Tasks 1–3. The separately developed `auditLog_behavior` correction must be reviewed/integrated in its own scope. This verification proves transactional continuity and actor attribution, not compliance of the old notification policy. The proposed single-recipient matrix and database-enforced append-only protection still need their separate approvals. An Admin self-manager is not an Engineer-role recipient under that proposed matrix; confirm that intended audit-only outcome.
6. Legacy `public.engineers.position` and its legacy forms/controllers remain intact. Retiring or migrating them needs a separate plan. Active DD forms use Rank; no separate DD Rank/profile-edit endpoint or account-type filter was added.

No other branch is an authorized publication target. No merge, pull request, deployment, shared database change, historical data cleanup or real credential change is part of this task.

## Preserved implementation commits

Original source: `73129e9f9fc357438015e7ccd9430dd8e8dafc51`.

| Task | Commit                                     | Purpose                                             |
| ---- | ------------------------------------------ | --------------------------------------------------- |
| 1    | `a201230ac60158610571fe5c0819845c8e48b2ff` | Separate DD operations formatting                   |
| 1    | `c4eaecd2dfd17e1edd47086938ce531a422ea7f2` | Twice-yearly scheduling and next-period UI          |
| 1    | `b712655c14bac8e6ebafc58f319b3ce302dfd45c` | PostgreSQL/browser/concurrency tests and focused CI |
| 2    | `5b030bbfee90da7b3f9754ae2cc2a6671f24dfc2` | Separate project adapter formatting                 |
| 2    | `2f3ed38d8832f15b6e12ac2f60a86f61cd3ff6fb` | Scoped project creation and manager eligibility     |
| 2    | `c88e2815f4ad7dd774d87ea8b49475be40a0bbf7` | Authorization/browser regression tests              |
| 3    | `d42aecadde920b6a5d786e9f4c5f3f56ea8836fe` | Separate DD account-view formatting                 |
| 3    | `d99201a18fc468d3f017785b0105889d709800c3` | Account Type/Rank terminology                       |
| 3    | `a660793c54e16aac6d1d4535d5ad2e8937f7d697` | Terminology, association and legacy-boundary tests  |

Task 4 verification commit `d395996df3e6c90f6984173ddde3511c84b548e4` is the direct child of the last entry; its follow-up fixes the CI environment-file setup described above. Terminal Git cannot publish because no terminal credential helper/credential is configured (`fatal: could not read Username for 'https://github.com': terminal prompts disabled`). The authenticated GitHub integration has repository write access. New commit objects are created through that supported integration with the exact verified parent and staged tree, then fetched locally and fast-forwarded on the same local branch. All pre-existing commit SHAs are preserved; no history is reconstructed or rebased.

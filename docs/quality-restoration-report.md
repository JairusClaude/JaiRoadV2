# JaiROADS quality restoration and DD regression verification — 2026-10-20

Local implementation and verification are complete. All available local source checks pass. Docker image execution and hosted Actions are separate, unverified steps. This checkpoint is not a claim of full Data Dictionary compliance or readiness to merge; the inherited business conflicts below remain explicit.

## Git boundary and retained work

Repository: https://github.com/JairusClaude/JaiRoadV2

- Authorized working/push branch: `feature/jairoads-map-demo_PASSWORD_EDIT`.
- Starting HEAD: `a764354f96bafaee1b618502f3e7ba1432257521`.
- Preserved password implementation: `fa3f07dded89adbcf4b12093064295053ee2e8d0`.
- Original branch verified unchanged: `feature/jairoads-map-demo` at `2ee94145807a4ffca78a2d19e882980f4ebfb501`.
- Remote main observed unchanged: `16a0fe7679f06c31ad15939ed578b15dda52eaea`.
- Earlier integration work remains at `e7564a6`; no branch was reset, rebased, merged, or force-pushed.
- Intended branch URL: https://github.com/JairusClaude/JaiRoadV2/tree/feature/jairoads-map-demo_PASSWORD_EDIT
- Publication receipt and final tip are recorded in the delivery message. At report preparation the branch did not exist remotely; normal push authorization is limited to this branch.

The historical password checkpoint report is `docs/password-synchronization-fix.md`. Its no-push authorization wording describes the earlier checkpoint; the user's latest attachment separately authorizes this branch's publication.

## Corrections and actual results

| Check | Starting result | Cause and correction | Final local result |
| --- | --- | --- | --- |
| MapLibre installation | Declared/locked package absent from node_modules; 4 TypeScript errors | `npm ci` installed locked MapLibre 6.14.0 and bundled types. No manifest, lock, fake declarations or library substitution needed | PASS |
| PHPStan | 41 diagnostics | Actual DD identity shapes; concrete UserAccount/stdClass contracts; real Eloquent relationship generics; model attributes; HasFactory restoration; correct DTO shape order; boolean FK guard; redundant nullsafe/file checks | PASS: 0 errors at unchanged level 7 |
| Pint | 46 files | Existing configured formatting, separated from functional fixes | PASS |
| ESLint | 1,004 errors + 7 warnings | 961 automatic spacing/brace/import fixes; targeted React lifecycle, dependencies, stale map selection, pure SVG offsets, local draft IDs, unused declarations and side-effect import ordering | PASS: 0 errors, 0 warnings |
| Prettier | 60 resource files | Existing configuration applied; no UI redesign or check/config weakening | PASS |
| Existing Laravel tests | 78 passing, 2 failing, 2 skipped | Unlinked dashboard access correctly returns 403; home correctly redirects to login. Starter tests corrected, positive/negative linkage tests added. Disabled registration now tested rather than skipped | PASS: 86 tests, 458 assertions, 0 skips |
| Dedicated PostgreSQL suite | Original 27 tests / 152 assertions | Original test file retained unchanged. Added 22 DD HTTP/authorization/audit cases | PASS on native PostgreSQL 16.15 and 17.11: 49 tests / 292 assertions each |
| TypeScript | Missing module + implicit-any event handlers | Locked dependency restoration restored real event inference; hook fixes typechecked | PASS |
| Vite production build | Earlier checkpoint reported unresolved MapLibre import | Reproducible install, functioning PHP/Wayfinder, source corrections | PASS: complete client build; 106 manifest entries, all referenced files/imports present |
| CI setup | `composer setup` could migrate through inherited credentials | Explicit locked installs/checks; forced SQLite :memory:; guarded loopback PG17 fixture service; exact password-edit push trigger | Local composite PASS; hosted execution requires successful publication |
| Docker | No local runtime | Inspected existing PHP 8.4 FPM + Node 22 + Nginx build. Excluded compiled PHP config, SQLite databases and application storage from image context | Image build NOT RUN: Docker/Podman unavailable |

The full baseline inventory has **1,165 entries**, including exact initial messages, paths and lines, root causes, whether behavior changes, corrections and verified results: `docs/verification/diagnostics.json`. Initial lines refer to `a764354`, before formatting. Original-branch provenance follows the unchanged frontend and the earlier exact PHPStan baseline comparison. The previous build failure is labeled as previously reported; installation absence and TypeScript failures were reproduced in this pass before the clean install.

The exact added/modified file inventory and primary change categories are in `docs/verification/file-manifest.md`. No files were removed. `docs/verification/results.json` records machine-readable results. Dependency lockfiles and PHPStan/ESLint/Prettier configurations remain unchanged; no blanket ignores or reduced analysis levels were added. The only historical migration diff is mechanical Pint formatting.

## Authentication and role verification

Fortify remains backed by Laravel User and the explicit `dd_user_account_id` bridge to `jairoads_next.user_accounts`. No direct-UserAccount architecture replacement was attempted. The shared identity alias describes the persisted shape; it does not create permissions or infer links.

All original password tests remain unchanged and pass: one new secure hash for both columns; same-connection locks/transactions; second-write and enclosing-audit rollback; current-password versus token-verified recovery; rejection of missing/inactive/mismatched/ambiguous identities; remember-token/database-session revocation; automatic rehash; password confirmation; MFA recovery-code challenge; passkey credential retention/options; stale-session/principal rejection; legacy isolation.

| Role | Server-side regression evidence |
| --- | --- |
| SuperAdmin | Correct privileged landing and real Inertia response; project attribution; administrative record corrections |
| Admin | Correct dashboard and real response; SuperAdmin landing denied; project attribution; ordinary record edits cannot reassign manager |
| Engineer | Correct dashboard and real response; account management denied; record edits require both current ManagingEngineer and active EngineerLGU; out-of-LGU/other-manager edits and deletion denied |
| Viewer | Correct read-only dashboard and real response; direct POST/PUT/DELETE operational requests and account administration denied |
| All four | Deactivation after an existing authenticated session immediately denies dashboard and protected mutation requests |

The tests use actual HTTP endpoints and native PostgreSQL queries, not hidden-button checks. No complete browser interaction test, physical WebAuthn ceremony or concurrent-client stress run is claimed. Current deliberate unlinked Admin/Engineer behavior is preserved; an unlinked Engineer gains no assignment-based write permission. The pre-cutover public account enum only supports viewer/user/admin, so new legacy positive tests use physically supported roles; the native DD suite covers all four canonical roles.

## AuditLog and relationship review

Project CreatedBy and audit UserID are taken from the verified DD UserAccount; injected creator/status fields do not change them. The actor snapshot remains stable after an account rename/deactivation. Audit payloads in the tested mutations exclude credential material. Native rollback testing confirms a failed audit insert leaves neither the project nor a successful event. The existing password/audit rollback case also remains green.

An inherited gap was corrected: persisted `AuditLog` models now reject save, quiet save and delete. This is an application guard, **not proof that raw SQL or query-builder writes are blocked in a deployed database**. The additive PostgreSQL proposal below addresses that boundary only after separately approved execution. No shared trigger, data or schema was changed.

The staged public versus `jairoads_next` separation is intact. DD queries retain their qualified tables and exact DD column names. Typed legacy relationships still represent the legacy tables; no mass foreign-key renaming or migration-to-legacy shortcut was used. RoadCoverage remains mandatory/unique for DD projects, with no project status; MaintenanceRecord references a project and manager; MonthlyUpdate references a record; MaintenanceDocument references a record; Media references an update. Native fixtures exercise these relationships, required creator/uploader FKs and restrictive preservation. Tests do not assert that the team's deployed schema matches fixture DDL.

## Confirmed inherited conflicts and unresolved decisions

These were read from the official Data Dictionary and Page Specifications on 2026-10-20:
https://docs.google.com/document/d/1WeaLeaOTvxMMsjce0Ec50VNMz0_2Psf5soC-dmbVcbA/edit

1. **Architectural decision requiring confirmation — Engineer linkage:** the DD default requires Admin/Engineer linkage; current code explicitly permits unlinked accounts. Preserved as instructed; team confirmation is needed before changing provisioning or access behavior.
2. **Confirmed implementation defect — notification fan-out:** existing `DdActivityNotifications` writes extra recipient rows, including self-notifications. The DD describes one event with an optional recipient and suppression of self-notification. Only type annotations changed here; no new fan-out behavior was introduced. Choosing the final recipient policy and correcting existing delivery behavior requires a scoped decision.
3. **Confirmed implementation defect — login auditing:** existing AppServiceProvider logs LOGIN and notification copies; current DD defers authentication events. Preserved during this cleanup and requires a team decision. This report does not claim that behavior is compliant.
4. **Unresolved specification conflict — deletion:** Page Specifications MP-08 approve cascading project deletion, while DD/MP-09 retain restrictive FK/history language and unresolved storage cleanup. Current behavior is not silently rewritten. Individual-record dependency deletion is separately open.
5. **Unresolved application rule — previous MonthlyUpdate editing:** exact meaning of previous remains unresolved. No new timing rule was invented.
6. **Quarter uniqueness, storage retention/formats and notification vocabulary:** approval status remains as documented. No additional constraint or new Notification entity/read-state design was introduced.
7. **Legacy schema drift:** public role enum and older project-linked monthly updates remain staged legacy structures. Restoring factory support does not make these legacy tables the canonical DD schema. Full cutover/migration is outside this correction pass.

8. **Confirmed implementation defect — unchanged saves:** some existing DD update endpoints always insert an UPDATE audit event, including when submitted business values are unchanged. No-op event suppression needs a scoped audit correction alongside the event policy; it was not silently introduced through a type/format fix.

## Exact optional database proposal and rehearsal

**No application/schema migration execution is needed for the quality fixes. No shared migration execution is authorized or requested in this delivery.** The following proposal is separate from applied migrations:

`database/proposals/dd-audit-append-only.sql`

Its exact sequence is:

1. BEGIN.
2. CREATE FUNCTION `jairoads_next.reject_audit_log_mutation()` that raises SQLSTATE 55000.
3. CREATE statement trigger `audit_logs_append_only` before UPDATE, DELETE or TRUNCATE on `jairoads_next.audit_logs`.
4. COMMIT.

It creates no business tables and changes no existing row. It deliberately does not replace existing functions/triggers; inspect deployed table ownership, grants and pg_trigger/pg_proc definitions first. An existing same-named object makes the transaction fail without replacing it. Existing production guards and any legacy-public trigger need their own read-only assessment before execution approval.

Disposable rehearsal passed on native PostgreSQL 16 and 17. The fixture first inserts an existing audit actor, applies the **exact proposal file**, verifies that update/delete/truncate each raise 55000, then renames/deactivates the account and verifies retained actor text/history. All databases were loopback-only `jairoads_password_test`, with that exact user. The suite checks actual database/user and requires empty public/DD schemas before fixture DDL. A pre-migration TestCase guard rejects any default connection other than testing + SQLite :memory:, and phpunit forces the critical environment variables. No RefreshDatabase path can reach shared PostgreSQL through these tests.

The runtime here has only UID 0 mapped. A temporary UID/stat compatibility library was used only to launch unmodified native PostgreSQL binaries; SQL/PDO, locks, transactions, constraints and triggers were real. A run on the container overlay filesystem hit a PostgreSQL catalog EOF/kernel error after repeated DDL; a fresh disposable RAM filesystem cluster resolved it. Complete 49-case runs passed on both versions without weakening tests or enabling data-loss recovery settings. Each server was stopped and its temporary cluster removed.

## Exact verification commands

Commands ran from the repository with PHP 8.4.26 and the locked dependencies. The local Composer runtime needed `COMPOSER_ALLOW_SUPERUSER=1` for its known locked plugin because this container exposes only root; no platform requirement or rule was ignored. `PAO_DISABLE=1` controls the agent output formatter, not test/analyzer enforcement.

| Command | Actual result |
| --- | --- |
| `composer install --no-interaction --prefer-dist --no-progress` | PASS |
| `composer check-platform-reqs` | PASS |
| `npm ci` | PASS; unchanged lockfile |
| `php -l` for every PHP file in app/bootstrap/config/database/routes/tests/tools | PASS: 205 files |
| `composer lint:check` | PASS full Pint, including parallel mode |
| `composer types:check` | PASS full PHPStan |
| `npm run lint:check` | PASS, zero errors/warnings |
| `npm run format:check` | PASS |
| `npm run types:check` | PASS |
| `php artisan wayfinder:generate --with-form` | PASS |
| `npm run build` | PASS; existing >500 kB chunk warning remains |
| Manifest asset/import existence verification | PASS: 106 entries, zero missing references |
| `php artisan route:list --except-vendor --json` | PASS |
| `php artisan test` | PASS: 86 tests, 458 assertions, no skips |
| `JAIROADS_PASSWORD_TESTS=1 JAIROADS_PASSWORD_TEST_PORT=55432 php vendor/bin/pest --configuration=phpunit-passwords.xml` | PASS on native PG16 and PG17: 49 tests, 292 assertions |
| `composer ci:check` | PASS composite frontend, Pint, PHPStan and Laravel checks |
| `npx prettier --check .github/workflows/tests.yml` | PASS |
| Workflow YAML parse and isolated target inspection | PASS |
| `git diff --check` and changed-source credential-pattern review | PASS |
| Docker image build | NOT RUN: runtime unavailable |
| Hosted GitHub Actions | NOT RUN until branch publication is possible |

The workflow preserves PHP 8.4 and Node 22, installs both lockfiles explicitly, generates Wayfinder before TypeScript/build, runs all quality checks and ordinary tests on SQLite, and runs the full dedicated suite on an ephemeral PostgreSQL 17 service. No shared secrets, Supabase URLs or general setup/migration script are used. Docker keeps its existing Nginx/PHP-FPM serving path; no deployment configuration or live variables were changed.

## Remaining actions

- Publish only the authorized branch and inspect its actual Actions run if repository write access is available. A blocked push is not a passing CI result.
- Run a local/CI Docker image build in an environment with Docker before claiming image verification.
- Resolve the explicit DD decisions above in a separate scoped change, especially audit notification fan-out and LOGIN auditing.
- Perform any needed deployed-schema inspection and seek separate approval before applying the optional audit trigger or other forward migrations.
- No PR, merge, deployment, shared Supabase mutation or real account modification was performed.

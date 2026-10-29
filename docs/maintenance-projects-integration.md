# Maintenance Projects integration assessment

Follow-up: Google Drive access is now verified. See
[maintenance-projects-document-alignment.md](maintenance-projects-document-alignment.md)
for the complete document comparison and updated account-lifecycle proposal.
Earlier access failures and narrower linkage proposals below are historical.

Assessment date: 15 October 2026. This records local source integration, not a
successful connection to the team's PostgreSQL database.

## Checkpoint 1: repository integration

Fresh fetch found:

| Ref | Commit | Commits since common ancestor |
| --- | --- | --- |
| `origin/main` | `44acf1d2fd096cd1d01b6b3537b4466f6cfe96d5` | 2 |
| `origin/feature/maintenance-projects` | `2fc1fa6680627b04a0fe5dd4b615b1583181d854` | 1 |
| Common ancestor | `1d924717bab083ebbcbb7d8b1fd3dc87aa366341` | — |

Main-only commits are `6324242` (AuditLog updates) and `44acf1d` (maintenance
record and code quality fixes). The feature-only commit is `2fc1fa6`.
The branches merge automatically without text conflicts. The local branch is
`integration/maintenance-projects`, based on the fetched main. No remote branch,
pull request, or merge into main has been created.

Main's 13 changed files include AuditLog controller/model/policy/factory/seeder
and its historical migration, MaintenanceRecord controller/model/seeder,
MaintenanceProjectFactory, EngineerSeeder, LguSeeder, and package-lock.json.
These changes are retained. No AuditLog behavior was modified by integration.
The historical audit migration changed upstream; only an actual database audit
can establish whether an installed database matches it. Do not replay or rewrite
an already-applied migration to reconcile that difference.

The feature adds 34 changed files. See `git diff --name-status origin/main HEAD`
for the complete integration list after the local commits. The development-only
preview tool was already part of the feature and remains explicitly a fixture
server. It is not evidence of PostgreSQL persistence.

## Checkpoint 2: database and account assessment

### Observed environment and unavailable references

Node 24.19.0 and npm 11.9.0 are available. `npm ci --no-audit --no-fund`
succeeded with the existing lockfile. PHP, Composer, psql, and PostgreSQL server
executables are absent. There is no local `.env`, vendor directory, or supplied
development database connection. The checked-in example selects SQLite.
No database connection, database inspection, migrations, or seeders ran.

The lockfile contains Laravel 13.25.0. Although composer.json permits PHP 8.3,
the locked development tools require PHP **8.4.1 or newer** (PHPUnit 13.3.0;
Pest 5.1.1 requires 8.4). Use Herd PHP 8.4 with `pdo_pgsql` and `pdo_sqlite`;
SQLite is still needed by existing tests. CI currently selects PHP 8.4/Node 22.

Both supplied Google Docs links, including the Page Specifications tab, were
inaccessible during this assessment. The supplied instruction and current code
guided safe changes; they cannot establish Data Dictionary or visual-reference
compliance. Obtain exports of both references before approving architecture or
claiming design acceptance. No standalone approved prototype or screenshots were
provided with this request.

### Source findings, not live database findings

* `users` is the Fortify authentication model with settings, MFA, and passkeys.
* `user_accounts` is an Eloquent model, not the login provider. Source defines
  username/password, is_active, and `accountType` constrained to viewer/user/admin.
  It has an optional unique Engineer FK and a self-referencing creator FK.
* There is no explicit FK linking `users` and `user_accounts`.
* `VerifiedProjectAccount::resolve()` returns null. All project permissions
  therefore fail closed. `assignedTo()` also returns false: no approved Engineer
  assignment adapter exists. A working database alone does not enable CRUD.
* The project creator FK references `user_accounts`; RoadCoverage creator
  references `engineers`. These are different identities.
* Legacy Road remains separate. No source establishes a safe Road-to-RoadCoverage
  conversion, and no real coverage data or GeoJSON was supplied.
* Project history, legacy MonthlyUpdates and ProjectDocuments reference projects.
  Source FKs do not cascade on project deletion; the mutation service blocks
  deletion when these dependencies exist and wraps the entire batch in a
  transaction. Existing database FK actions still need inspection.
* The new nullable unique coverage FK permits multiple unmapped legacy projects.
  New project requests require coverage, while legacy unmapped projects with
  history cannot be mapped using the ordinary edit flow. Do not invent mappings;
  review an explicit data correction/backfill separately. Until then their
  title/description editing is also blocked by the form's coverage requirement.
* Main's project factory omits mandatory `created_by`; callers must supply a
  verified/test account explicitly. Existing seeders are not safe backfill tools.
* MaintenanceRecordController exists but `routes/web.php` has no
  `maintenance-records` resource routes; record pages/actions are outside this
  integration's authorized scope. Project Details reads actual records directly.

### Safe local setup and read-only evidence collection

Run on the development computer in this integration checkout. Use an existing
development `.env`, or copy `.env.example` only if none exists. Set local PostgreSQL
connection values privately. Do not share the `.env` or database passwords.
Do not run `composer setup`: it automatically executes migrations.

```powershell
php --version
php -m
composer install --no-interaction --prefer-dist
composer check-platform-reqs
npm ci
```

Generate an application key only for a new local environment, retaining any
existing key. Check `DB_URL` is unset or refers to the intended development
database, since it can override individual DB settings. Ensure APP_ENV is local.
Then `php artisan config:clear` and `php artisan migrate:status` are read-only
with respect to application data. Verify the connection's database/server name.

Run the supplied audit with psql, substituting the LOCAL development connection
values. `-W` prompts privately; passwords do not appear in command arguments:

```powershell
psql -X -W -h localhost -p 5432 -U YOUR_DEV_USER -d YOUR_DEV_DATABASE -f tools/maintenance-projects-database-audit.sql -o maintenance-projects-audit.txt
```

The script runs SELECT/catalog queries in a read-only transaction. It reports
version, schema, migrations, counts, constraints/indexes, role counts, and history
counts; missing optional tables/columns are skipped. It targets current_schema;
review search_path and adapt explicitly for a nonstandard application schema.
It has not been executed here. Inspect output locally before sharing; even
database names and counts may be confidential. Do not publish it in GitHub.

### Migration proposal: approval and database evidence required

1. Review audit results against the Data Dictionary and the three prepared
   migration files. Resolve differing types, enum checks/defaults, existing
   table names, legacy nullability, FK actions, and any pending upstream migrations.
2. Take a full custom-format development database backup with local `pg_dump`
   (`-Fc -f jairoads-before-integration.dump` and the same connection options).
   Verify it with `pg_restore --list` and a restore to a separate disposable
   database. Keep the backup outside git and record the recovery procedure.
3. Review `php artisan migrate --pretend` locally. It lists all pending
   migrations; do not approve unrelated pending work by accident. Pretend output
   does not prove existing data or PostgreSQL behavior is compatible.
4. Request approval for the exact database and verified SQL. Then apply only the
   three reviewed forward migrations in timestamp order: create road_coverages,
   add nullable unique project coverage FK, relax legacy project fields.
5. Re-audit schema and row counts. Keep old project values and legacy roads.
   Backfill only separately verified associations. Do not enforce NOT NULL yet.
6. If recovery is needed, stop writes and assess a corrective migration or restore
   the tested backup under explicit approval. These forward migrations' down()
   methods intentionally throw; `migrate:rollback` is not the recovery procedure.

No schema-change approval is requested yet because the actual database evidence
and authoritative dictionary are unavailable.

### Smallest identity-linkage proposal: approval required before implementation

Keep Fortify, config/auth.php, login/settings, MFA, passkeys, and password storage
behavior intact. Do not infer identities from IDs, names, usernames, or emails.

The following is a review proposal only, not installed source code:

| File | Proposed exact responsibility |
| --- | --- |
| New forward migration `add_user_link_to_user_accounts_table.php` | Add nullable unique `user_accounts.user_id` FK to `users.id`, `nullOnDelete()`. No automatic backfill. |
| `app/Models/User.php` | Add `userAccount(): HasOne` using `user_accounts.user_id`. Do not make linkage mass assignable. |
| `app/Models/UserAccount.php` | Add `user(): BelongsTo` on `user_id`; add `is_active => boolean` cast. Keep linkage out of fillable and account CRUD requests. |
| `app/Services/MaintenanceProjects/VerifiedProjectAccount.php` | Resolve through `$user->userAccount()->first()` after schema deployment; retain active-account checks and denial for unrecognized roles. |
| New focused identity tests | Explicit linkage; unrelated/equal IDs do not link; uniqueness both ways; inactive/unlinked denial; creator attribution; ordinary requests cannot set the FK. |

Proposed migration body:

```php
Schema::table('user_accounts', function (Blueprint $table): void {
    $table->foreignId('user_id')->nullable()->unique()
        ->constrained('users')->nullOnDelete();
});
```

Privately verify each real login/account pair with the account owner or designated
administrator; approve a mapping list and apply it in a reviewed transaction.
Do not create a public endpoint or use automatic matching. Record verification
evidence through the team's agreed identity/audit procedure. A login/account pair
is not approved merely by approving the schema change.

Follow-up review found that ProfileController::destroy deletes the Laravel User.
The proposal therefore now uses nullOnDelete instead of the earlier restrictive
FK: login deletion clears only the linkage and preserves UserAccount and its
operational history. It does not authorize cascading deletion of any projects or
history, or automatic relinking to a later login. This is an unimplemented
proposal and remains subject to the actual schema, dictionary and approval.

Initially `admin` maps to Admin and `viewer` to Viewer; legacy `user` remains
denied for this module. Full Engineer/SuperAdmin support requires an approved
forward change to the actual account role constraint and applicable requests,
plus an authoritative active Engineer–LGU assignment structure. Do not map
legacy user to Engineer or substitute engineers.lgus_id without group approval.
That separate choice remains blocked by the missing dictionary and database.
Do not change AuditLog structures as part of this proposal.

## Checkpoint 3: implementation and verification

Safe integration fixes add PHPDoc iterable/generic/callback types to project
controller/service/model code for the configured PHPStan level and disable the
unfinished Add Record/record-action buttons without changing the layout.
PHPStan acceptance is not claimed without running it.

| Evidence | Current result |
| --- | --- |
| Local source merge | No text conflicts; both fetched histories retained |
| Locked Node dependencies | npm ci passed |
| Resource formatting | npm run format:check passed again after local fixes |
| Focused module ESLint | Passed for project components/pages/layout/types and preview source |
| JavaScript syntax | node --check passed for the existing preview tool |
| Full ESLint | Failed: 13 shared import-order errors involving absent generated route/action files |
| TypeScript | Failed: 38 TS2307 diagnostics for absent Wayfinder-generated route/action modules |
| Production build | Failed immediately: Wayfinder invokes PHP, which is absent |
| PHP lint/Pint/PHPStan/Laravel tests | Not run: PHP/Composer/vendor unavailable |
| Browser verification | Not performed; real Laravel application cannot start here |
| Actual schema and PostgreSQL CRUD | Not connected, not inspected, not verified |

Missing generated routes can affect ESLint's import resolution/order. Generate
them before reordering unrelated shared imports. Do not replace them with stubs
or bypass Wayfinder to claim a successful build.

On Herd, after dependency setup, generate routes with
`php artisan wayfinder:generate --with-form`, then run `npm run build`,
`npm run types:check`, `npm run lint:check`, `npm run format:check`,
`composer lint:check`, `composer types:check`, and `php artisan test` against
the intended isolated SQLite test configuration. Do not point RefreshDatabase
tests at an existing populated PostgreSQL database. The existing project CRUD
tests build their own simplified in-memory SQLite schema and use a test-only
identity adapter; they do not prove production migrations/account integration.

After approved migrations/linkage, use a separate PostgreSQL test database and
real login to verify directory/search/filter/sort/pagination, create/refresh,
edit/creator preservation, duplicate coverage rejection, every role, inactive
accounts, history-locked coverage, single deletion, atomic bulk deletion and
rollback, and preservation of all child data. Include competing connections for
coverage assignment and new-history/delete races. Run through a browser at
desktop/mobile sizes and compare the supplied approved screenshots; sidebar
hover/collapse and the three metadata fields must retain their layout. Verify
existing login/settings/MFA/passkeys and groupmates' working modules as well.

## Checkpoint 4: readiness and review

This branch is suitable for **local source review**, not a claim of operational
integration, full build success, or merge readiness. Do not push it until the
user reviews it. No PR is opened because the instructions require keeping the
integration branch local through review. A PR can be prepared after that review;
database/authentication prerequisites and verification must be clearly stated
as blockers. Never merge main without separate approval and group review.

Before eventual publication, fetch again, reconcile any new main/feature work,
inspect `git diff --check`, confirm no secrets/audit output/backups/build outputs
are tracked, rerun available checks, and include a final file-by-file summary.

For the follow-up audit instructions, pgAdmin companion, attempted environment
setup, and precise files/results to return, see
[maintenance-projects-next-checkpoint.md](maintenance-projects-next-checkpoint.md).

## File-by-file changes relative to fetched main

| File | Change |
| --- | --- |
| `app/Http/Controllers/MaintenanceProjectController.php` | Real-data Inertia directory/details/forms, permissions and schema readiness; typed query/choice helpers. |
| `app/Http/Requests/BulkDeleteMaintenanceProjectsRequest.php` | Backend bulk ID validation and delete permission; iterable return type. |
| `app/Http/Requests/StoreMaintenanceProjectRequest.php` | Required unique coverage and title; server-owned creator/timestamp protection. |
| `app/Http/Requests/UpdateMaintenanceProjectRequest.php` | Update validation, uniqueness excluding self, and history-based coverage restriction. |
| `app/Models/MaintenanceProject.php` | Coverage/history relationships, retaining legacy fields and relationships. |
| `app/Models/RoadCoverage.php` | Separate complete-coverage model and relationships; typed casts. |
| `app/Policies/MaintenanceProjectPolicy.php` | Role and assignment boundary; deny unlinked or unsupported accounts. |
| `app/Services/MaintenanceProjects/ProjectMutations.php` | Transactional create/update/delete, locks, history protection and atomic bulk handling; typed arrays/callback. |
| `app/Services/MaintenanceProjects/VerifiedProjectAccount.php` | Existing fail-closed module adapter retained pending approved identity linkage. |
| `database/migrations/2026_10_15_000001_create_road_coverages_table.php` | Prepared forward coverage schema; not executed. |
| `database/migrations/2026_10_15_000002_add_road_coverage_to_maintenance_projects.php` | Prepared nullable unique coverage FK; not executed. |
| `database/migrations/2026_10_15_000003_relax_legacy_maintenance_project_fields.php` | Prepared legacy-field nullability changes; not executed. |
| `package.json` | Retain explicit development fixture preview command. |
| `resources/css/maintenance-projects.css` | Retain existing module styling, sidebar transitions and responsive layout. |
| `resources/fonts/maintenance-projects/OFL.txt` | Retain bundled font license. |
| `resources/fonts/maintenance-projects/inter-latin-400-normal.woff2` | Retain bundled Inter font asset from the feature branch. |
| `resources/fonts/maintenance-projects/inter-latin-500-normal.woff2` | Retain bundled Inter font asset from the feature branch. |
| `resources/fonts/maintenance-projects/inter-latin-600-normal.woff2` | Retain bundled Inter font asset from the feature branch. |
| `resources/fonts/maintenance-projects/inter-latin-700-normal.woff2` | Retain bundled Inter font asset from the feature branch. |
| `resources/js/app.tsx` | Use the dedicated module layout for Maintenance Projects pages. |
| `resources/js/components/maintenance-projects/project-deletion.tsx` | Single/bulk confirmation, protected history messaging and failure display. |
| `resources/js/components/maintenance-projects/project-directory.tsx` | Directory, selection, search/filter/sort/pagination and contextual actions. |
| `resources/js/components/maintenance-projects/project-form.tsx` | Coverage chooser, suggested editable title, optional description and validation. |
| `resources/js/components/maintenance-projects/project-workspace.tsx` | Reusable workspace, integration-unavailable notice and project actions. |
| `resources/js/layouts/maintenance-project-layout.tsx` | Retain feature sidebar, navigation, profile and fixture indicator. |
| `resources/js/pages/MaintenanceProjects/Create.tsx` | Inertia create form submission. |
| `resources/js/pages/MaintenanceProjects/Edit.tsx` | Inertia update form and history-based coverage lock. |
| `resources/js/pages/MaintenanceProjects/Index.tsx` | Directory page with server-provided data and capabilities. |
| `resources/js/pages/MaintenanceProjects/Show.tsx` | Real project metadata/history and map placeholder; unfinished record buttons now disabled. |
| `resources/js/types/maintenance-projects.ts` | Project, coverage, pagination and integration prop types. |
| `routes/web.php` | Bulk DELETE route before the resource route to avoid binding bulk as a project. |
| `tests/Unit/MaintenanceProjectAccessTest.php` | Existing no-database tests for unlinked-account denial. |
| `tests/Unit/MaintenanceProjectCrudTest.php` | Existing isolated SQLite CRUD/transaction/permission tests; not run here. |
| `tools/maintenance-project-preview/server.mjs` | Existing explicitly isolated fixture harness; not used as persistence verification. |
| `docs/maintenance-projects-integration.md` | Assessment, approval proposals, setup, verification gaps and file-by-file review. |
| `tools/maintenance-projects-database-audit.sql` | New read-only PostgreSQL catalog/count audit for the development computer. |

## Proposed PR description after local review

Title: Integrate Maintenance Projects with current shared application

Combines the existing Maintenance Projects feature with current main while retaining the upstream AuditLog and MaintenanceRecord changes. Projects use a separate RoadCoverage relationship and transactional, history-preserving individual/bulk deletion. The interface remains the existing feature implementation; unfinished record controls are disabled.

Current review blockers: account linkage and Engineer assignments require approved integration; PostgreSQL schema/migrations/CRUD have not been verified; the full build, PHP checks, and browser acceptance remain blocked. Module ESLint and resource formatting pass. Do not open this as merge-ready or merge it until these blockers are resolved.

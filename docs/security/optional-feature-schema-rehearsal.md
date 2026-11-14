# JaiROADS Task 8 — optional-feature database schema readiness

> **PHASE 11L SUPERSESSION NOTICE (2026-11-09):** This document records an earlier *proposed* nullable-project/nullable-manager design and is retained for historical traceability, **not** as a current release instruction. The user's Final Data Dictionary requires `maintenance_records.project_id` and `managing_engineer_id` to stay NOT NULL with RESTRICT foreign keys. Do not detach MaintenanceRecords, unassign their ManagingEngineer, or activate `database/proposals/preserve_project_history.php`. Only an empty MaintenanceProject may be deleted after administrative confirmation. Refer to `docs/release/phase11l-strict-dd-integrity-2026-11-09.md`. No live schema change is authorized.


**Status:** Review-only proposals and disposable PostgreSQL 17 test coverage. **No official Supabase schema, accounts, Storage, historical records or production role/grants changed.**

Stacked on [PR #12](https://github.com/JairusClaude/JaiRoadV2/pull/12). Official project: `aeaaxwyytsagbacysvvx`, target schema `jairoads_next`.

## Live schema preflight (read-only, 2026-11-07)

At inspection:
- `jairoads_next.file_deletions`: **absent**.
- `jairoads_next.maintenance_record_contexts`: **absent**.
- `maintenance_records.project_id` and `managing_engineer_id`: **NOT NULL**.
- No project/year/quarter UNIQUE constraint or index.
- **0 maintenance_records**; therefore **0 existing active-project quarter conflicts** currently requiring a data-owner decision. Recheck immediately before any approved migration because live state can change.

The original UserAccount and Engineer transition/provenance review, SuperAdmin recovery, restricted app-role deployment, backups and schema-owner signoff from PRs #6–#12 remain prerequisites. Nothing in Task 8 bypasses them.

## Required database changes (separate reviews)

1. **Durable permanent-file deletion intent:** `database/proposals/create_file_deletions.php` — creates private `jairoads_next.file_deletions` for exactly-once/repair tracking of individual document/media deletion; RLS on, no public grants. Records may advance from pending to completed under a carefully controlled backend role. Never delete a Storage object as a side effect of applying a schema migration.
2. **Preserved project deletion:** `database/proposals/preserve_project_history.php` — creates append-only `maintenance_record_contexts` with original project snapshots, a deferred orphan-context guard, and makes `maintenance_records.project_id` and `managing_engineer_id` nullable. Project deletion must preserve maintenance records, monthly updates, documents, media, author attribution, and immutable AuditLog events.
3. **Managing Engineer unassignment:** uses the nullable `managing_engineer_id` from (2), but only an authorized application operation may intentionally unassign; do not turn this into a permissive direct backend API policy.
4. **Quarterly uniqueness:** new `database/proposals/quarterly_record_uniqueness.sql` adds a **nonpartial** `UNIQUE(project_id, maintenance_year, quarter)` constraint. PostgreSQL 17 treats NULL project IDs as distinct by default, allowing archived detached records; every active project can have only one row per year/quarter. This matches the exact catalog structure `DuplicateMaintenancePeriod::matchesDatabaseConstraint` checks and must not silently rewrite or delete existing records.

The SQL and PHP proposals stay **outside** Laravel's automatic migrations. Owner must independently inspect constraints, existing triggers/FKs/indexes and live privilege/RLS state. The prior two security auxiliary tables must be approved separately; no automatic application of those proposals is authorized.

## New disposable tests

`tests/Quarterly/OptionalSchemaActivationTest.php` uses the guarded `PostgresTestCase` (local PostgreSQL 17, empty `jairoads_scratch_*`, `APP_ENV=testing`, explicit `DISPOSABLE_LOCAL_ONLY`), then loads both existing optional Laravel-style proposal files and the new SQL proposal **only inside the test transaction**.

The focused tests verify:
- Both new tables have RLS enabled, no PUBLIC DML grants; project and Managing Engineer link columns are nullable; nonpartial three-key UNIQUE index is catalog-visible.
- A direct duplicate record for the same active project/year/quarter fails with PostgreSQL 23505, and the existing conflict classifier recognizes the **actual** generated key; historical records with NULL project links do not prevent another active record.
- A record cannot be detached without a preserved historical context, and the context table rejects UPDATE/DELETE/TRUNCATE.
- File deletion intents require allowed kind/actor, correct pending Storage target and exactly one record per (kind, entity ID).

The GitHub Actions `optional-schema` job starts its **own** `postgres:17` service and uses no official database credentials, API keys, files or objects. It runs only `php artisan test tests/Quarterly/OptionalSchemaActivationTest.php --stop-on-failure`.

Existing extensive behavioral coverage remains in:
- `tests/Quarterly/PermanentFileDeletionTest.php` (Storage response and recovery, idempotence, concurrency, authorization).
- `tests/Quarterly/PreservedRelationshipsTest.php` (preserved project history, manager unassignment and reassignment, scoped access and concurrency).
- `tests/Quarterly/DuplicatePeriodWarningTest.php` and `ConcurrentPeriodTest.php` (duplicate warning, scope and competing writers).

These tests are valuable but do not establish a live private Storage bucket or hosted staging availability.

## Go/no-go before any official schema rollout

- [ ] Independent Data Dictionary owner approves preservation semantics, distinct Manager unassignment, duplicate-quarter policy and Storage delete behavior.
- [ ] Re-run a **read-only live preflight** for duplicate project periods, nullable columns, object names, FKs, trigger handlers and RLS/grants immediately before deployment.
- [ ] Author/approve a genuinely restricted **production Laravel role**, covering the new table SELECT/INSERT/UPDATE/sequence needs, without granting browser roles access to deletion intents or historical contexts.
- [ ] Run migration rehearsal on an **isolated persistent** staging copy with synthetic attachments and a private bucket; verify object-accurate deletion/retry and backup/forward recovery.
- [ ] Test that records with null project/manager remain safe to view, but cannot give an Engineer a wider LGU scope.
- [ ] Obtain explicit owner signoff and a scheduled, backed-up migration window; stage application changes only after schema preparation.
- [ ] Retain immutable audit, history contexts, file intents and provenance. **Never** use a rollback that drops historical evidence or unconditionally deletes objects.

No approval or real records are fabricated by this review. A successful CI run means proposal/test compatibility on disposable PostgreSQL, not permission to migrate the official project.

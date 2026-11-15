# JaiROADS — Canonical Road Maintenance Information System

This repository contains a **Laravel 13 / PHP 8.4 / Inertia React** application with PostgreSQL 17, private file services, and role-scoped JaiROADS workflows. The authoritative business schema is `jairoads_next`; the old `public` business tables are legacy and **must not** be substituted for canonical records. `public.users` remains Fortify authentication infrastructure.

> **Release status: NOT APPROVED.** The branch `review/final-dd-alignment-2026-11-14` and draft [PR #26](https://github.com/JairusClaude/JaiRoadV2/pull/26) contain canonical implementation work. A successful Docker build or GitHub Actions run is not proof that accounts, SMTP, passkeys, Storage, RLS writes, maps, backups or human acceptance are ready for production. Do not merge/deploy solely on a green CI result.

## Architecture and Data Dictionary

- Canonical entities: `LGU`, `Engineer`, `EngineerLGU`, `UserAccount`, `RoadCoverage`, `MaintenanceProject`, `MaintenanceRecord`, `MonthlyUpdate`, `MaintenanceDocument`, `Media`, and append-only `AuditLog`.
- Canonical CRUD and access require active linked identities, valid EngineerLGU scope and record-specific ManagingEngineer checks. Viewer is read-only.
- `MaintenanceProject.road_coverage_id` is required and unique. MaintenanceRecord has required project and managing-engineer links; monthly updates and documents belong to MaintenanceRecords, and media belongs to MonthlyUpdates.
- All canonical business foreign keys use `ON DELETE RESTRICT`; never solve a relationship error by detaching history or enabling cascade.
- The project uses an immutable evidence record for authorized non-SuperAdmin account provisioning. **Do not fabricate historical account ownership or provisioning evidence.**

The controlling [Final DD](https://docs.google.com/document/d/1WeaLeaOTvxMMsjce0Ec50VNMz0_2Psf5soC-dmbVcbA/edit) contains unresolved cross-tab decisions. Keep those decisions explicit; see [Final DD conformance](docs/readiness/final-dd-conformance-2026-11-14.md).

## What runs in this repository

- `routes/web.php`: Fortify routes, legacy compatibility and guarded redirects.
- `routes/operations.php`: canonical `/dd-phase3` endpoints. Read and write permissions are enforced on the server, not just by disabled UI actions.
- `app/Services/AccountIdentityResolver.php`: strict canonical account eligibility. Missing ordinary provisioning evidence causes denial, not an invented default role.
- `app/Services/OperationAudit.php`: append-only, transaction-scoped canonical audit events. Optional notifications address at most one eligible recipient.
- `app/Services/Files/PermanentFileDeletion.php`: durable object-removal intents; private object deletion remains **disabled by default** until independent recovery acceptance.
- `Dockerfile` and `docker/entrypoint.sh`: PHP-FPM/Nginx image. The entrypoint validates configuration and intentionally does **not** migrate, seed or create real accounts.

## Secure configuration

Use environment-specific secrets provided by an authorized deployment operator. Never commit `.env`, production database credentials, `APP_KEY`, Supabase service keys or private object paths. The sample `.env.example` is a *development scaffold*, not production configuration.

For canonical PostgreSQL runtime, configure `DB_CONNECTION=pgsql`, a properly restricted server-only database role, HTTPS `APP_URL` and appropriate session/queue/cache settings. Use distinct `APP_KEY` and database credentials. Document and media Storage need private buckets and server-only credentials; a configured URL alone does not verify recovery or permission.

No sample login, hardcoded demo password, synthetic user or browser-only session is a valid production identity. Historic `tools/maintenance-project-preview` is a separate local demonstration utility, **not** the Laravel production application.

## Validation and release

The exact branch is checked by GitHub Actions for Laravel, PostgreSQL, browser, static analysis, dependency audit and Docker build. Tests use isolated fixtures; they do not touch the official Supabase data.

Before any production change, review:

- [Hosted database evidence and identity blockers](docs/readiness/live-remote-audit-2026-11-14.md)
- [Final-DD conformance and unresolved product decisions](docs/readiness/final-dd-conformance-2026-11-14.md)
- [External acceptance and recovery gates](docs/readiness/pending-acceptance-and-hosted-handoff-2026-11-14.md)
- [Controlled rollout and rollback runbook](docs/release/controlled-rollout-runbook-2026-11-07.md)
- [Human UAT evidence template](docs/qa/uat-evidence-template.json)

Do not replay `database/hosted-migration-history` against Supabase. Those SQL files record **already applied** hosted changes; they are not migration candidates. Do not run any legacy `public` schema reset against the official database.

## Legacy preview status

Some historical files and screenshots document a frontend-only sample-data preview. They are kept for compatibility and design provenance, not as descriptions of the current canonical application. The real Laravel app, authentication and database permissions must be verified separately.

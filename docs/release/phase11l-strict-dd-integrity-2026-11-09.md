# JaiROADS Phase 11L â€” Final Data Dictionary relationship integrity

**Status: local regression verification passed; production release is NOT approved.** 2026-11-09 (Asia/Manila).

## Current controlling decision

- `jairoads_next.maintenance_records.project_id`: required (NOT NULL), FK to `maintenance_projects` with ON DELETE RESTRICT.
- `jairoads_next.maintenance_records.managing_engineer_id`: required (NOT NULL), FK to `engineers`; manager may be explicitly reassigned to an eligible Engineer using authorized, audited workflow but may not be unassigned to NULL.
- A project with MaintenanceRecords must not be deleted or detached. Only an empty MaintenanceProject may be deleted by Admin/SuperAdmin after server-verified confirmation, current authorization checks and a restrictive database delete.
- Existing records, monthly updates, documents, media, private Storage objects, creators/uploaders and append-only AuditLog history stay intact if a parent deletion is refused.
- `database/proposals/preserve_project_history.php` is an unapproved historical proposal that would relax required relationships. It must not be activated, migrated or used as a deployment prerequisite. A guarded disposable test may attempt activation to prove that the application rejects it.

## Evidence and limitations

- On disposable local PostgreSQL 17: final full quarterly suite 443 tests passed, 4,644 assertions; focused review suite 18 tests passed, 98 assertions. The first full-suite retry failed authentication before test bootstrap, followed by a successful rerun.
- PHP structural check: 329 PHP files parsed and verified; TypeScript and Git whitespace checks passed. The frontend production build passed on the preceding code version, and subsequent edits were PHP-only.
- These results do not establish production Supabase data/schema compliance, RLS/grants, real account eligibility, Storage recovery, UAT, or Render deployment readiness.

## Release no-go gates

1. Verify real `jairoads_next` schema **read-only** immediately before any release: required NOT NULL columns, all RESTRICT FKs and immutable AuditLog triggers; do not run PHPUnit or migrations against shared Supabase.
2. Obtain separate formal owner approval of all compatible supporting schemas, runtime roles and RLS policy. Explicitly exclude historical nullable detachment proposal.
3. Verify database and private Storage recoverability, staging role-based acceptance, exact source SHA/image digest, and written deployment authority.
4. Review local documentation and source code diffs before any local commit. Commit does not authorize push, merge, migration, official account repair, or deployment.

Historical documents remain in source control for traceability with supersession notices, but are not current migration instructions.

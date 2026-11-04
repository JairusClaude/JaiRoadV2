# Repair B verification and source inventory

4 November 2026. Initial remote SHA `c5ad04f6edfd84558f6b2bb86d5d015fbe5cdb44`; local preservation merge `e77254ce77edf230928c0e50ed88588c1d42549c`, clean working tree. Repair A was already published and both workflows verified before this task. Earlier local-only audit documents and preservation commits were retained and excluded from this repair's publication.

## Actual local results

| Check | Result |
| --- | --- |
| Repair B plus existing manager-reassignment focused suite | 39 passed / 497 assertions |
| Entire canonical PostgreSQL 17 suite | 316 passed / 3,821 assertions |
| Password PostgreSQL suite | 56 passed / 331 assertions |
| PostgreSQL Feature suite | 45 passed / 205 assertions; 2 existing registration skips |
| Standard Laravel/SQLite Feature/unit suite | 101 passed / 532 assertions; 2 existing registration skips |
| PHP syntax / Pint / PHPStan | Passed; 209 application files, no PHPStan errors |
| TypeScript / ESLint / Prettier / Vite build / routes | Passed |
| Canonical/preview field-contract Node tests | Passed |
| Real Laravel/Fortify browser acceptance | Passed: all four roles and prior repair workflows, plus project preview/Cancel/stale token, manager NULL/reassignment, retained file bytes, Admin-only history and unauthorized HTTP denials |
| Composer audit --locked | No security vulnerability advisories found |
| npm audit --audit-level=high | Threshold passes; 15 moderate advisories, no high/critical advisories |
| Docker production-image acceptance | Not available locally; extended existing GitHub Docker job must execute on the final published SHA |

The focused count includes 30 new Repair B cases and nine existing reassignment cases; it is a subset of the full canonical total. Existing disabled Fortify registration tests remain skips, not passes. No test or assertion was removed, weakened or newly skipped.

## CI harness correction after initial publication

The first published Repair B run passed the full canonical/password/Feature/quality/audit and real browser checks. Docker built and returned a correct retained-history Inertia payload, but the new HTTP-only smoke assertion incorrectly searched the unhydrated HTML shell for React's uppercase `NULL` label. The correction parses the embedded Inertia JSON and asserts actual null project/manager fields, former project ID/snapshot and all three preserved child counts. Existing byte-preservation and role-denial assertions remain in place. The real browser separately verifies the visible NULL labels. Both complete workflows must pass on the subsequent correction SHA; an earlier failed Docker run is not treated as success.

## Requested coverage

- Admin/SuperAdmin project deletion preserves every dependent row and creator/uploader field; only actual project_id becomes NULL. Other projects/records, road GeoJSON, historical AuditLog snapshots and private file bytes remain intact. The deletion itself makes zero Storage requests.
- Engineer/Viewer deletion/unassignment and orphan-history/download access are rejected directly over HTTP. Dashboard totals cannot leak detached history to Viewer/Engineer scope.
- Expected-current-manager NULL is explicit; missing/invalid fields fail. Old managers lose editing rights, arbitrary Engineers cannot edit unassigned records, and valid replacement managers gain only the existing scoped rights. Direct reassignment regressions still pass. Normal create requires valid project/manager; ordinary edit cannot implicitly detach either.
- Eight stale-preview variations, SQL/audit rollback, unassignment audit failure, no-op/stale assignment requests, private/RLS context gating, immutable context UPDATE/DELETE/TRUNCATE rejection and deferred orphan-context constraints execute against PostgreSQL 17.
- Four real two-connection cases cover manager changes and actor deactivation while deletion waits, plus reassignment/document edits waiting while project deletion commits. No stale relationship change is committed afterward.
- The canonical suite includes existing Engineer/account lifecycle, municipality confirmation, concurrent duplicate-period, private upload/download, password linkage and authorization regressions. An additional NULL-manager municipality test preserves GeoJSON and confirms the approved transition safely.
- Repair A individual file deletion still works for explicitly selected attachments of Admin-authorized detached records, independently of project deletion.

All write tests use new guarded disposable PostgreSQL 17 clusters, SQLite memory databases and local/private Storage mocks. The only shared database access was the read-only 18-FK metadata SELECT saved in this directory. No live DDL/data/Storage mutation occurred. No canonical model or existing migration was edited. See [the approved policy/schema-owner handoff](approved-null-relationships.md) and [dependency matrix](dependency-matrix.md). Shared activation remains gated; no deployment is authorized by passing tests.

## Source files changed

- `app/Http/Controllers/DataDictionary/DdFrontendController.php`
- `app/Http/Controllers/DataDictionary/DdOperationsController.php`
- `app/Http/Controllers/DataDictionary/DdPhase3Controller.php`
- `app/Http/Controllers/DataDictionary/DdPreservedHistoryController.php`
- `app/Http/Controllers/DataDictionary/DdRoleDashboardController.php`
- `app/Services/DataDictionary/DdDashboardAnalytics.php`
- `app/Services/DataDictionary/PreservedProjectDeletion.php`
- `app/Services/DataDictionary/RoadMunicipalityChange.php`
- `app/Services/Files/PermanentFileDeletion.php`
- `database/proposals/preserve_project_history.php`
- `docs/relationships/approved-null-relationships.md`
- `docs/relationships/dependency-matrix.md`
- `docs/relationships/live-foreign-keys-2026-11-04.json`
- `resources/js/components/maintenance-projects/deletion-dialog.tsx`
- `resources/js/components/maintenance-projects/maintenance-history.tsx`
- `resources/js/components/maintenance-projects/maintenance-record-form.tsx`
- `resources/js/components/maintenance-projects/project-deletion.tsx`
- `resources/js/components/maintenance-projects/record-editor.tsx`
- `resources/js/components/maintenance-records/record-directory.tsx`
- `resources/js/lib/maintenance-records.ts`
- `resources/js/pages/MaintenanceProjects/Records/Show.tsx`
- `resources/js/pages/MaintenanceRecords/Index.tsx`
- `resources/js/pages/MaintenanceRecords/PreservedHistory.tsx`
- `resources/js/pages/dd-phase3/DdManagingEngineerReassignment.tsx`
- `resources/js/pages/dd-phase3/DdQuarterlyMaintenance.tsx`
- `resources/js/pages/dd-phase3/DdRoadMunicipalityChange.tsx`
- `resources/js/pages/dd-phase3/Operations.tsx`
- `resources/js/pages/dd-phase3/Workspace.tsx`
- `resources/js/types/maintenance-record-directory.ts`
- `resources/js/types/maintenance-records.ts`
- `routes/dd-frontend.php`
- `routes/dd-phase3.php`
- `tests/Browser/docker-smoke.mjs`
- `tests/Browser/prepare-system.php`
- `tests/Browser/prepare-unified.php`
- `tests/Browser/preserved-relationships.mjs`
- `tests/Browser/unified.mjs`
- `tests/Quarterly/PreservedRelationshipsTest.php`
- `tests/Quarterly/preserved-history-worker.php`

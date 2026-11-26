# Canonical workspace source layout

This reference maps the workspace files relocated on `merged-system_refactor2`. Earlier verification reports retain the paths used when they were written.

## HTTP routes and Inertia pages

The public `/dd-phase3` paths, `jairoads.dd-phase3.*` route names and `/dd-superadmin-landing` remain active. Laravel registers canonical operations through [operations.php](../../routes/operations.php) and the Inertia UI routes through [operations-pages.php](../../routes/operations-pages.php).

| Page | Inertia component | Controller |
| --- | --- | --- |
| Audit history | `AuditLogs/History` | [AuditHistoryController](../../app/Http/Controllers/AuditHistoryController.php) |
| Workspace operations | `Workspace/Operations` | [OperationsController](../../app/Http/Controllers/OperationsController.php) |
| Workspace directory | `Workspace/Directory` | [DirectoryController](../../app/Http/Controllers/DirectoryController.php) |
| Engineer and Viewer dashboards | `RoleDashboard/Canonical` | [RoleLandingController](../../app/Http/Controllers/RoleLandingController.php) |
| SuperAdmin command center | `SuperAdminDashboard/CommandCenter` | [SuperAdminLandingController](../../app/Http/Controllers/Dashboard/SuperAdminLandingController.php) |

The [Inertia entry](../../resources/js/app.tsx) assigns these pages to [MaintenanceProjectLayout](../../resources/js/layouts/maintenance-project-layout.tsx). The shared UI adapters live in [OperationsFrontendController](../../app/Http/Controllers/OperationsFrontendController.php).

## Relocated files

| Previous source path | Current source path |
| --- | --- |
| `resources/js/pages/dd-phase3/AuditHistory.tsx` | [`resources/js/pages/AuditLogs/History.tsx`](../../resources/js/pages/AuditLogs/History.tsx) |
| `resources/js/pages/dd-phase3/Operations.tsx` | [`resources/js/pages/Workspace/Operations.tsx`](../../resources/js/pages/Workspace/Operations.tsx) |
| `resources/js/pages/dd-phase3/Workspace.tsx` | [`resources/js/pages/Workspace/Directory.tsx`](../../resources/js/pages/Workspace/Directory.tsx) |
| `resources/js/pages/dd-phase3/RoleDashboard.tsx` | [`resources/js/pages/RoleDashboard/Canonical.tsx`](../../resources/js/pages/RoleDashboard/Canonical.tsx) |
| `resources/js/pages/dd-phase3/DdAccountLifecycle.tsx` | [`resources/js/components/user-management/account-lifecycle.tsx`](../../resources/js/components/user-management/account-lifecycle.tsx) |
| `resources/js/pages/dd-phase3/DdEngineerLifecycle.tsx` | [`resources/js/components/user-management/engineer-lifecycle.tsx`](../../resources/js/components/user-management/engineer-lifecycle.tsx) |
| `resources/js/pages/dd-phase3/DdLguDirectory.tsx` | [`resources/js/components/lgus/workspace-directory.tsx`](../../resources/js/components/lgus/workspace-directory.tsx) |
| `resources/js/pages/dd-phase3/DdMaintenanceProjects.tsx` | [`resources/js/components/maintenance-projects/workspace-projects.tsx`](../../resources/js/components/maintenance-projects/workspace-projects.tsx) |
| `resources/js/pages/dd-phase3/DdProjectDirectory.tsx` | [`resources/js/components/maintenance-projects/workspace-project-directory.tsx`](../../resources/js/components/maintenance-projects/workspace-project-directory.tsx) |
| `resources/js/pages/dd-phase3/DdQuarterlyMaintenance.tsx` | [`resources/js/components/maintenance-records/workspace-records.tsx`](../../resources/js/components/maintenance-records/workspace-records.tsx) |
| `resources/js/pages/dd-phase3/DdManagingEngineerReassignment.tsx` | [`resources/js/components/maintenance-records/managing-engineer-reassignment.tsx`](../../resources/js/components/maintenance-records/managing-engineer-reassignment.tsx) |
| `resources/js/pages/dd-phase3/DdMonthlyUpdates.tsx` | [`resources/js/components/monthly-updates/workspace-updates.tsx`](../../resources/js/components/monthly-updates/workspace-updates.tsx) |
| `resources/js/pages/dd-phase3/DdDocuments.tsx` | [`resources/js/components/maintenance-documents/workspace-documents.tsx`](../../resources/js/components/maintenance-documents/workspace-documents.tsx) |
| `resources/js/pages/dd-phase3/DdFileRemovalReview.tsx` | [`resources/js/components/files/file-removal-review.tsx`](../../resources/js/components/files/file-removal-review.tsx) |
| `resources/js/pages/dd-phase3/DdRoadSections.tsx` | [`resources/js/components/road-coverages/workspace-road-sections.tsx`](../../resources/js/components/road-coverages/workspace-road-sections.tsx) |
| `resources/js/pages/dd-phase3/DdRoadMunicipalityChange.tsx` | [`resources/js/components/road-coverages/road-municipality-change.tsx`](../../resources/js/components/road-coverages/road-municipality-change.tsx) |
| `resources/js/pages/dd-phase3/RoadTraceMap.tsx` | [`resources/js/components/road-coverages/road-trace-map.tsx`](../../resources/js/components/road-coverages/road-trace-map.tsx) |
| `resources/js/pages/dd-phase3/requests.ts` | [`resources/js/lib/operation-request.ts`](../../resources/js/lib/operation-request.ts) |
| `resources/js/components/dd-dashboard-analytics.tsx` | [`resources/js/components/dashboard/dashboard-analytics.tsx`](../../resources/js/components/dashboard/dashboard-analytics.tsx) |
| `resources/js/components/dd-notification-bell.tsx` | [`resources/js/components/notifications/notification-bell.tsx`](../../resources/js/components/notifications/notification-bell.tsx) |
| `resources/js/pages/dd-superadmin-command-center/Index.tsx` | [`resources/js/pages/SuperAdminDashboard/CommandCenter.tsx`](../../resources/js/pages/SuperAdminDashboard/CommandCenter.tsx) |
| `tests/DdOperationsTestCase.php` | [`tests/CanonicalOperationsTestCase.php`](../../tests/CanonicalOperationsTestCase.php) |
| `tests/PasswordSync/DdAuthorizationTest.php` | [`tests/PasswordSync/CanonicalAuthorizationTest.php`](../../tests/PasswordSync/CanonicalAuthorizationTest.php) |
| `tests/Fixtures/dd-operations.sql` | [`tests/Fixtures/canonical-operations.sql`](../../tests/Fixtures/canonical-operations.sql) |

The Engineer dashboard and RoadCoverages page use the [road-coverages map module](../../resources/js/components/road-coverages/simplified-coverage-map.tsx) directly. The [monthly update detail page](../../resources/js/pages/MonthlyUpdates/Show.tsx) handles the active evidence upload with [MonthlyUpdatePageController](../../app/Http/Controllers/MonthlyUpdatePageController.php).

## Historical records

- [Task 2 workflows](../dd-workflows-task2.md)
- [Audit and notification verification](../audit/verification.md)
- [Relationship repair verification](../relationships/verification.md)
- [Canonical account security verification](../security/canonical-only-verification.md)
- [Permanent file-deletion verification](../verification/permanent-file-deletion/verification.md)
- [Supabase auditing feasibility](../supabase-auditing-feasibility.md)
- [Field contract](../contracts/dd-frontend-field-contract.md)
- [Frontend/backend integration](../verification/unified-frontend-backend.md)
- [Backend structure review](backend-standard-layout.md)

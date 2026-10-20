# Canonical AuditLog behavior correction

## Scope and branch provenance

Source: `feature/jairoads-map-demo_PASSWORD_EDIT` at verified remote commit
`225a63ae0bfa81ae850a3ca14585add99ac33b7f`. Its GitHub Actions run
[39381495749](https://github.com/JairusClaude/JaiRoadV2/actions/runs/39381495749)
completed successfully. This is source verification, not verification of this change.

The working tree was clean; `git fetch origin` and `git ls-remote --heads origin`
confirmed that `auditLog_behavior` did not exist. The new branch was created and
checked out from the remote source before any edits. Its temporary tracking of the
source branch was removed to prevent accidental upstream pushes.

The password synchronization checkpoint `fa3f07d` and all source history are retained.
No original branch, model, migration, schema definition, constraint, index, RLS policy,
Storage bucket, or shared Supabase record was changed. No PR, merge, or deployment.

Primary reference: [approved JaiROADS Data Dictionary](https://docs.google.com/document/d/1WeaLeaOTvxMMsjce0Ec50VNMz0_2Psf5soC-dmbVcbA/edit).
Reviewed Entity Overview, field constraints, Current Data Dictionary, authorization,
Workflows, notification matrix, enumerations, and pending client confirmations.

## Focused inventory and original defects

| Path | Schema and behavior before correction | Disposition |
| --- | --- | --- |
| `DdOperationsController` | Canonical road/project/record/monthly update/settings/document/media writers. Audit helper inserted a business row, then notification copies. Most snapshots absent; UPDATE emitted even unchanged. | Every writer uses `DdAuditLog`; authorization and transaction boundaries retained. |
| `DdPhase3Controller` | Canonical LGU create/update/delete, Engineer creation, account provisioning, EngineerLGU assignment. Same duplicate helper, missing before-values and unconditional updates. | Centralized events, safe snapshots, no-op handling, one named assignment lifecycle action. |
| `DdActivityNotifications` | Inserted a row for the actor and every eligible higher-role account. | Pure single-recipient resolver; no INSERT capability. |
| `AppServiceProvider` Login listener | Canonical LOGIN plus notification fan-out. | Removed only business-audit listener. Historical entries retained. |
| `DataDictionaryIdentityResolver` | Explicit `public.users.dd_user_account_id` bridge, active account/profile and matching credential checks. | Inspected and unchanged; service reuses it, never infers identity by email or equal IDs. |
| `DdSuperAdminLandingController`, `DdDashboardAnalytics` | Canonical reads excluded all events carrying recipients. | Include single-row notified events; historical duplicates are not rewritten or deduplicated. |
| `DdRoleDashboardController`, `JaiRoadsNotificationsController` | Canonical recipient-scoped, safe three-field notification reads, newest timestamp/ID ordering. | Preserved and regression tested. Shared header retains explicit separate legacy path. |
| `DdAuditLogController` | No canonical full-history endpoint existed; dashboards exposed summaries. | New read-only, paginated GET `/dd-phase3/audit`, active verified Admin/SuperAdmin only. |
| `App\Models\AuditLog`, `AuditLogPolicy`, `AuditLogController`, audit FormRequests | Legacy public model, save/delete protections and deny policies; controller has no registered audit CRUD routes. | Inspected, unchanged. Not repointed to canonical tables. |
| `RoadCoverageController`, `MaintenanceRecordQuickCreateController`, `MonthlyUpdateSubmissionController`, `MaintenanceDocumentUploadController`, `AccountProvisioningController`, `UserManagement/EngineerAdministrationController` | Legacy `public.audit_logs` writer paths. | Unchanged; never redirected into canonical history. |
| `MaintenanceRecordController` | Legacy audit writer code, but regular mutation routes are not enabled on this source. | Unchanged. |
| `Services/MaintenanceProjects/ProjectMutations` | Legacy public project mutations with their own permissions and transactions; no AuditLog writer on this source branch. | Existing legacy audit gap documented, not silently combined with DD behavior. Canonical projects are handled by `DdOperationsController`. |
| Legacy dashboard and `AuditLogController` notification reads | Public schema only. | Unchanged. |

The only remaining production INSERT into `jairoads_next.audit_logs` is in the
private `DdAuditLog::insert` method. No canonical audit UPDATE, DELETE, clear,
dismissal, mark-as-read, or manual-create endpoint exists.

## Implementation

`DdAuditLog` resolves the authenticated Laravel principal through the existing
canonical identity resolver. Callers cannot provide actor IDs, recipients, arbitrary
actions, or audit descriptions. The service rejects calls outside the business
transaction and invalid/inactive/non-writing identities. Endpoint-specific role,
LGU assignment, and ManagingEngineer authorization remains in the controllers.

Each configured mutation calls the service once. CREATE reads the persisted safe
snapshot; UPDATE locks and reads the previous record, compares normalized business
fields, writes a meaningful change, reads back the stored result, and records only
changed fields; DELETE captures the former state and recipient before the restrictive
FK-protected deletion. CREATE OldValue and DELETE NewValue are NULL. EngineerLGU
uses its composite pair in snapshots and a NULL EntityID, avoiding a false single
record ID. Existing assignment activation/deactivation uses ACTIVATE/DEACTIVATE,
not an additional UPDATE event.

The human-readable actor identifier remains `DD-UserAccount#<canonical ID>`, an
immutable identifier snapshot independent of a mutable username. UserID is the
verified canonical account ID, never the Laravel login ID or Engineer ID.

`DdAuditValues` explicitly allowlists fields for each entity. Passwords, hashes,
reset tokens, MFA and passkey material, cookies, headers, API keys, emails, private
file names/paths and file contents are not selected into snapshots. GeoJSON uses
a canonical SHA-256 content fingerprint so structural edits are traceable without
logging arbitrary properties. Text fields are ordinary validated business text;
they are not populated from raw request or model serialization. Settings logs only
changed username and, for a real password change, a `credentials_changed` boolean.

No-op comparison normalizes booleans, null/empty optional values, IDs/integers,
exact decimals (using the already installed Brick Math dependency), dates, and
structured JSON key ordering. Automatic timestamps are excluded. Equivalent
submissions return normally without another event and normally without a write.
Values rounded by the existing database to their previous value produce no event
when read back. Password submission equal to the current password is a no-op.
No new dependency or lockfile change was needed.

Business writes and events share one connection and transaction; audit failures
propagate and roll back the mutation. Existing retries rerun the entire transaction,
so aborted attempts leave no event. Row locks protect before/after snapshots.
Activity authorization is rechecked inside upload/report transactions. Settings
retains the password updater's login-before-account lock order, synchronized hashes,
session revocation, and after-commit principal refresh. File-upload compensation
still removes the newly uploaded private object when metadata/audit insertion fails;
cleanup failures retain the existing reporting behavior. Storage calls were mocked
in tests, not executed against Supabase.

## Provisional notifications

The requested working policy is enabled and isolated in `DdActivityNotifications`.
It remains provisional pending final team/client validation:

- MaintenanceRecord creation: eligible assigned Engineer, excluding the actor.
- Administrative MaintenanceRecord update: eligible current ManagingEngineer.
- Administrative MonthlyUpdate/document/media create or update: eligible parent manager.
- Administrative MonthlyUpdate deletion: eligible parent manager, resolved before deletion.
- Other reference, account, assignment, coverage, project, and record-deletion changes: audit only.
- Engineer activity changes: audit only; no self-notification or administrator fan-out.

Eligibility requires exactly one active canonical Engineer account linked to the
active managing Engineer, with an active EngineerLGU assignment to the record's LGU.
Missing, invalid, inactive, retired, ambiguous, unassigned, or self recipients produce
an audit-only row. RecipientUserID and the nonblank safe NotificationMessage are
always both populated or both NULL. Messages contain only action, entity type and
record ID. Full snapshots never enter notification responses.

The policy recognizes the documented reassignment and file-deletion scenarios,
but this branch adds no reassignment, document/media delete, or media edit endpoint.
Those workflows are not implemented on the verified source and require separate
business/storage decisions. No former-assignee delivery, fallback administrator,
broadcast, subscription, reminder, read/unread state or dismissal was added.

## Authentication and permanent history

Only the canonical Login audit listener was removed. Fortify, password reset,
password synchronization, MFA, passkeys, session middleware and authorization gates
are unchanged. Historical LOGIN rows remain readable to authorized administrators;
the analytics note now explicitly identifies authentication auditing as deferred.

Application immutability means there is no ordinary route or writable canonical
model for editing history; the service has only a private event INSERT. The legacy
model's append-only save/delete protections remain unchanged. This does not block
privileged SQL or arbitrary query-builder code from editing database rows.
`database/proposals/dd-audit-append-only.sql` remains unchanged and unapplied to
shared Supabase. Its existing regression test executes only in the guarded disposable
fixture. Database enforcement belongs to the teammate's schema review.

## Validation evidence

Executed locally with PHP 8.4.26, Node 24.19.0 and native PostgreSQL 17.11:

| Check | Actual result |
| --- | --- |
| PHP syntax | 209 files, zero failures |
| `composer lint:check` | PASS |
| `composer types:check` | PASS, PHPStan zero errors |
| `composer check-platform-reqs` | PASS |
| `composer ci:check` | PASS |
| `npm run lint:check` | PASS |
| `npm run format:check` | PASS |
| `npm run types:check` | PASS |
| `npm run build` | PASS; existing large-chunk and plugin timing warnings remain |
| `php artisan route:list --except-vendor` | PASS |
| `php artisan test` | 86 passed, 592 assertions, zero failures/errors/skips |
| Guarded disposable PostgreSQL 17 suite | 91 passed, 508 assertions, zero failures/errors/skips |
| Docker build | Not run: Docker is unavailable |

The 91 PostgreSQL cases comprise the unchanged 27 password tests (152 assertions),
unchanged 22 DD authorization tests (140 assertions), and 42 new AuditLog cases
(216 assertions). `tests/PasswordSync/AuditLogBehaviorTest.php` covers single CREATE,
UPDATE and DELETE; normalized and repeated no-ops; denied/invalid/FK-failed requests;
audit-insert rollback; failure after insertion; Laravel transaction retry; canonical
actor attribution and stable history; credential exclusion; recipient eligibility,
self suppression and no fan-out; safe feeds and direct HTTP access controls; deferred
LOGIN across all roles; settings synchronization; account and LGU changes;
assignments; projects/roads/records/monthly updates; document/media uploads,
metadata updates and storage compensation. The existing password suite retains reset,
MFA/passkey compatibility, session and credential rollback checks. Physical browser
WebAuthn ceremonies and production-scale concurrency stress were not performed.

The obsolete unit test that required administrator fan-out was replaced with stricter
assertions for the approved provisional matrix; no original PostgreSQL test was
removed, weakened, or skipped. Test fixtures, database guards, and the append-only
proposal are unchanged.

The existing non-deployment `tests.yml` workflow now also triggers on
`auditLog_behavior`. It uses guarded in-memory SQLite and a disposable PostgreSQL 17
service, with no shared Supabase credentials or deployment step. Hosted verification
of the new commits requires successful publication and a green run; source CI success
must not be represented as new-branch CI success.

## Remaining team/client decisions

1. Final notification matrix and Action vocabulary validation. The matrix is isolated
   for a focused change if the client selects different triggers.
2. Future multiple-recipient design: requires a deliberate schema/workflow decision;
   duplicating audit events is not a supported delivery mechanism.
3. Database-level append-only enforcement, nullable paired notification constraints,
   canonical FK/unique constraints and retention are owned by the teammate.
4. Historical duplicate notification rows remain permanent. Cleanup needs separate approval.
5. Existing unlinked Admin/Engineer provisioning differs from the DD linkage rule.
   This prior explicit exception and its authorization restrictions are unchanged.
6. Reassignment, document/media deletion and storage retention are not newly implemented.
   Previous-MonthlyUpdate editing cutoff and quarter uniqueness remain pending.
7. Legacy public-schema audit gaps, notably `ProjectMutations`, remain separate from this
   canonical correction. No architecture or schema crossover was introduced.

## Exact changed-file inventory

- `.github/workflows/tests.yml`
- `app/Http/Controllers/Dashboard/DdSuperAdminLandingController.php`
- `app/Http/Controllers/DataDictionary/DdAuditLogController.php`
- `app/Http/Controllers/DataDictionary/DdOperationsController.php`
- `app/Http/Controllers/DataDictionary/DdPhase3Controller.php`
- `app/Providers/AppServiceProvider.php`
- `app/Services/DataDictionary/DdActivityNotifications.php`
- `app/Services/DataDictionary/DdAuditLog.php`
- `app/Services/DataDictionary/DdAuditValues.php`
- `app/Services/DataDictionary/DdDashboardAnalytics.php`
- `docs/audit-log-behavior.md`
- `routes/dd-phase3.php`
- `tests/PasswordSync/AuditLogBehaviorTest.php`
- `tests/Unit/DdNotificationAudienceTest.php`

# Canonical AuditLog writer/reader inventory

Inspected baseline: `239af5db1d864fedbd58a55a2a9ca7779aaf69ce`.
All names below are actual current methods, not proposed replacement modules.
No old AuditLog branch was merged; the implementation was derived from current
strict-account, deletion-recovery and retained-history code.

| Writer / method | Before | Corrected path |
| --- | --- | --- |
| `DdOperationAudit::record` | Event plus optional per-recipient event copies; empty snapshots permitted | Sole canonical INSERT; verified actor, safe snapshots, no-op guard; linked deliveries atomically |
| `DdActivityNotifications::record` / `recipientsFor` | Separate AuditLog row per actor/supervisor; activity flag only; incomplete recipient eligibility | Replaced by `deliver`; all eligible Admin/SuperAdmin + Engineer actor; same auth SQL; unique auxiliary delivery |
| `DdOperationsController::audit` | Delegated with caller-controlled notify suppression | Delegates one event and mandatory approved deliveries; no suppression switch |
| `saveRoad` | Unchanged UPDATE still wrote; partial creation metadata | Persisted safe CREATE state; normalized no-op skip and changed UPDATE fields; geometry digest |
| `previewRoadMunicipality` / `confirmRoadMunicipality` and `RoadMunicipalityChange::confirm` | Read-only preview; transactional safe transition but notifications suppressed | Preview remains read-only; same locks/eligibility/stale checks; one transition event and audience; safe old/new municipality context |
| `saveProject` | CREATE/UPDATE no state; unchanged writes/events | Safe persisted CREATE; locked prior state, changed UPDATE only; timestamp-only save skipped |
| `saveRecord` | CREATE/UPDATE no state; unchanged events | Same project lock/uniqueness/period/manager permissions; accurate state and no-op skip |
| `reassignRecord` / `unassignRecord` | Reassignment snapshots; unassignment notifications suppressed | Existing explicit workflow/locks/no-op rules unchanged; both use approved audience |
| `saveUpdate` | Missing snapshots; no-op UPDATE | Same post-lock authorization/month uniqueness; persisted CREATE and changed UPDATE snapshots; no-op write skipped |
| `saveSettings` | Always vague credential UPDATE | Safe username before/after only on real change; no secrets or password-only business snapshot |
| `updateDocument` | Metadata UPDATE without snapshots/no-op handling | Same upload/parent/pending-deletion authorization; safe changed fields; no-op skip |
| `uploadDocument` / `uploadMedia` | CREATE without snapshot plus copies | Persisted safe file metadata CREATE plus linked deliveries; original Storage compensation retained |
| `deleteEntity` | DELETE lacked former state | Captures locked row before restrictive delete; DELETE old state / NULL new; existing restrictive business rules |
| `DdPhase3Controller::audit` | Direct canonical insert and copies; old state NULL | Delegates central service; no bypass |
| `createLgu` / `createEngineer` / `createAccount` | Sparse IDs only on CREATE | Safe committed state; provisioning canonical/Fortify/provenance/event/deliveries in one transaction |
| `updateLgu` / `deleteLgu` | ID-only snapshot; no-op UPDATE | Locked before image, accurate state, no-op skip, restrictive FK retained |
| `setAssignment` | Repeated same boolean still wrote event; no old state | Real CREATE or UPDATE with both EngineerLGU keys; unchanged membership skipped |
| `DdPeopleLifecycleController::audit` | Direct insert and recipient copies | Central service |
| `updateEngineer` / `retireEngineer` / `accountStatus` | Already handled field/no-op transitions; separate-row notifications | Existing lifecycle locks/last-root/self-lockout/history rules; distinct actual profile/account/membership events, eligible recipients only |
| `PreservedProjectDeletion::confirm` | One DELETE message describing all detachment; notifications suppressed | One UPDATE per actual record project_id-to-NULL change + project DELETE old snapshot; retained context/files unchanged |
| `PermanentFileDeletion::process` | Durable one success event, notifications suppressed | Same intent state/authorization/Storage/removal/retry mechanics; success snapshots + deliveries in SQL finalization; delivery failure stays pending |
| `AppServiceProvider::boot` Login listener | LOGIN event and copies, errors swallowed | No business writes; clearHistory preserved for login and logout |

## Readers

| Reader / method | Before | Corrected path |
| --- | --- | --- |
| `JaiRoadsNotificationsController::__invoke` | Own canonical recipient columns (legacy public branch separate) | New/old canonical safe projection via shared `feed`; current identity only; public branch unredirected |
| `DdRoleDashboardController::show` | Separate old recipient query | Same shared safe feed with 8-item limit; no privileged payloads |
| `DdDashboardAnalytics::summary` | Supervisor actor hierarchy plus LOGIN tab data | Admin/SuperAdmin business activity, stable actor snapshot; historical LOGIN excluded from current statistics |
| `DdSuperAdminLandingController::__invoke` | Count/recent rows included LOGIN | Business count/recent activity excludes LOGIN/LOGOUT; full history separately accessible |
| `DdAuditHistoryController::__invoke` (new) | No full canonical paginated privileged view | Active eligible Admin/SuperAdmin gate; all retained events/copies/auth entries; safe payload projection; no mutations |
| `useJaiRoadsNotificationFeed`, `JaiRoadsNotifications`, `DdNotificationBell`, role dashboard notification components | Numeric own-recipient safe items | Contract retained; IDs refer to AuditLog, so no delivery-sequence collisions; no read/unread/dismissal state added |
| `DdDashboardAnalytics` React component | Audit/Sign-ins tabs implied current sign-in auditing | Business activity; explicit no-sign-in-telemetry note and privileged history link |

## Out-of-band operator and authentication infrastructure (unchanged)

`TrustedSuperAdminBootstrap::create` is the privileged initial operator procedure,
not an authenticated ordinary business endpoint. It has no pre-existing canonical
actor, so this repair does not invent self-attribution for the new SuperAdmin.
Operator/bootstrap security telemetry, if required, needs a separately approved
operator-identity design. This exception remains visible rather than claiming
that raw database/operator changes can be attributed by Laravel automatically.
`LinkedPasswordUpdater`, Fortify reset/MFA/passkey/session infrastructure do not
emit business events or disclose credentials. The read-only preflight emits none.

## Separate legacy/public paths (unchanged)

`MaintenanceRecordQuickCreateController`, `MonthlyUpdateSubmissionController`,
`MaintenanceDocumentUploadController`, `AccountProvisioningController`,
`UserManagement/EngineerAdministrationController`, and legacy maintenance services
use `public.audit_logs` using their existing public business contracts.
Legacy `RoleDashboardController`, `SuperAdminDashboardController`, `AuditLog`
model/controller/factory/seeder are not silently redirected to the canonical schema.
Strict web identity policy remains the production boundary. Domain-only legacy
tests retain their existing explicit identity stub; they do not authorize public
legacy authentication.

The canonical AuditLog model remains teammate-owned and unchanged. Canonical
INSERT searches now resolve to the one service. There are no canonical audit
UPDATE/DELETE application operations. Database-level protection is an owner-reviewed
proposal, separately rehearsed; no shared trigger or table was changed.

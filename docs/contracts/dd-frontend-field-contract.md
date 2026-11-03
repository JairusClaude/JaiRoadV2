# Integrated Data Dictionary field contract

Reviewed 2026-11-03 against the [official Data Dictionary](https://docs.google.com/document/d/1WeaLeaOTvxMMsjce0Ec50VNMz0_2Psf5soC-dmbVcbA/edit), main Current Data Dictionary attribute tables and the approved CreatedBy/UploadedBy workflow. The fetched document revision matches the revision recorded in [the logical/physical comparison](../reconciliation/dictionary-field-comparison.json). Historical proposal tabs are not authority to change current business rules.

Scope: `Oct10_Front&BackEnd_Merge_Integration`, after Repair 3 (`f06a36668a5f3569304caf22bb327d2e28fef470`). No database, migration, relationship, permission or authentication change is required. Physical names below are checked against canonical model/schema interfaces and the repository's read-only reconciliation snapshot; Repair 4 does not query or write the shared database.

## Boundaries and naming rules

- `/dd-phase3/ui` is the authenticated Laravel/Inertia integration adapter. Its existing typed presentation aliases remain supported.
- `/dd-phase3/ops` uses canonical request names. Prefer those names for new contracts. `DdOperationsController` and its eligibility/storage services retain validation and authorization authority.
- `DdFrontendController` is the single server mapping location: `roadData`, `recordData`, `projectData`, `updateData`, `documentData`, `mediaData`, request adapters and `write` error projection. `inputAlias` explicitly maps the two historical form ID aliases.
- If both an ID alias and its canonical field occur on a UI request, they must be the same integer/identical decimal string. Contradictory, null or structured duplicates fail under the visible form field before mutation. Canonical-only requests do not substitute for the UI's required alias. Existing equivalent duplicate payloads remain compatible; canonical operations have no alias adapter.
- Read-projection names are not write permissions. Unknown creator/uploader/path/MIME fields are excluded by existing server write allowlists. Client identity never overrides the authenticated, verified account.
- Logical Data Dictionary names such as `MaintenanceYear` map to the existing snake_case columns, e.g. `maintenance_year`. This is documentation, not a proposal to rename columns.

In the matrices, “UI API” means the submitted field at `/dd-phase3/ui`, followed by the canonical operation field when it differs. “Server” means generated or resolved after authorization, not an accepted ownership input. A dash means no independent stored column.

## RoadCoverage — `jairoads_next.road_coverages`

Types: `resources/js/types/road-coverages.ts`. Form: `coverage-form.tsx`. Server: `saveRoad`, `roadData`, `DdOperationsController::saveRoad`, `RoadCoverageGeometry`, and the separate municipality-change workflow.

| Frontend field                    | UI API → canonical operation                                | Database field                      | Business meaning                                                               |
| --------------------------------- | ----------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------ |
| `id`                              | Route ID for edits                                          | `id`                                | RoadCoverageID; server-generated on create                                     |
| `road_name`                       | `road_name`                                                 | `road_name`                         | Road name; existing UI naming restrictions retained                            |
| `lgus_id`                         | `lgus_id` → `lgu_id`                                        | `lgu_id`                            | Municipality association, not an LGU directory rename                          |
| `kilometers`                      | `kilometers`                                                | `kilometers`                        | Recorded road length in km; form decimal strings are validated server-side     |
| `pavement_type`                   | `pavement_type`                                             | `pavement_type`                     | Concrete, Asphalt, Gravel or Earth                                             |
| `state_category`                  | `state_category`                                            | `state_category`                    | Good, Fair or Bad                                                              |
| `geojson`                         | GeoJSON object → validated JSON                             | `geojson`                           | Saved geometry, including accepted line collections and dimensions             |
| `created_by`                      | Server; arbitrary request value ignored                     | `created_by`                        | **Engineer ID**, the approved RoadCoverage exception                           |
| `created_by_engineer_id`          | Request-only eligible selection for Admin/SuperAdmin create | `created_by`                        | Active, LGU-assigned mapping Engineer; Engineers cannot choose another creator |
| `created_at`, `updated_at`        | Server                                                      | Same names                          | Creation/update timestamps                                                     |
| `lgu.id`, `lgu.municipality_name` | Response-only join                                          | `lgus.id`, `lgus.municipality_name` | Municipality display context; not stored again on the road                     |

Unchanged geometry is omitted by the form and retained by Laravel; identical submitted geometry is not rewritten under the row lock. Unsupported editor formats remain read-only (Repair 2). `correction_reason`, `geometry_changed`, `geometry_token`, `length_override` and map control state are request/presentation metadata, not new canonical columns or ownership authority. Ordinary save cannot change municipality: the impact-preview/final-confirmation endpoints accept canonical `lgu_id` and preserve geometry and historical records (Repair 3 did not alter that workflow).

## MaintenanceProject — `jairoads_next.maintenance_projects`

Types: `maintenance-projects.ts`. Forms: `project-form.tsx` and Create/Edit pages. Server: `saveProject`, `projectData`, `DdOperationsController::saveProject`.

| Frontend field                                        | UI API → canonical operation | Database field                    | Business meaning                                                                |
| ----------------------------------------------------- | ---------------------------- | --------------------------------- | ------------------------------------------------------------------------------- |
| `id`                                                  | Route ID for edits           | `id`                              | ProjectID                                                                       |
| `project_title`                                       | `project_title`              | `project_title`                   | Long-term project title                                                         |
| `road_coverage_id`                                    | `road_coverage_id`           | `road_coverage_id`                | Required existing authorized RoadCoverage; uniqueness/history rules retained    |
| `description`                                         | `description`                | `description`                     | Optional project description                                                    |
| `created_by` (display username)                       | Server; request ID ignored   | `created_by` → `user_accounts.id` | Verified canonical UserAccount creator; response joins `user_accounts.username` |
| `created_at`, `updated_at`                            | Server                       | Same names                        | Timestamps                                                                      |
| `municipality`, `road_name`, `geojson`                | Response-only join           | Through `road_coverage_id`        | Project inherits RoadCoverage municipality and map                              |
| `maintenance_records_count`, `can_edit`, `can_delete` | Response-only calculation    | —                                 | Count and server permission projections                                         |

There is no project `lgu_id`, `assigned_engineer_id`, year, status or timeline column. Posting those values cannot create a project assignment or override inherited municipality.

## MaintenanceRecord — `jairoads_next.maintenance_records`

Types: `maintenance-records.ts`, `maintenance-record-directory.ts`. Form: `record-editor.tsx` / `maintenance-record-form.tsx`. Typed payload helper: `resources/js/lib/maintenance-records.ts::recordPayload`. Server: `saveRecord`, `recordData`, `DdOperationsController::saveRecord`, `ManagingEngineerEligibility`, `TwiceYearlyMaintenance`.

| Frontend field                              | UI API → canonical operation                                                    | Database field                    | Business meaning                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| `id`                                        | Route ID for edits                                                              | `id`                              | MaintenanceID                                                            |
| Selected project                            | Canonical-mode payload `project_id`; authoritative project route → `project_id` | `project_id`                      | Parent long-term project; body cannot override the route                 |
| Summary `year`; form `maintenance_year`     | `maintenance_year`                                                              | `maintenance_year`                | Quarterly occurrence's year; `year` is response/display only             |
| `quarter`                                   | `quarter`                                                                       | `quarter`                         | Independently selected Q1–Q4; project/year/quarter duplicates prohibited |
| `engineers_id`                              | `engineers_id` → `managing_engineer_id`                                         | `managing_engineer_id`            | Active eligible ManagingEngineer, distinct from creator                  |
| `managing_engineer.id/first_name/last_name` | Response-only join                                                              | Through `managing_engineer_id`    | Current manager display context                                          |
| `start_date`                                | `start_date`                                                                    | `start_date`                      | Actual start within the selected year/quarter                            |
| `estimated_duration_days`                   | `estimated_duration_days`                                                       | `estimated_duration_days`         | Positive whole number of days                                            |
| `status`                                    | `status`                                                                        | `status`                          | Ongoing or Completed                                                     |
| `complete_date`                             | `complete_date` or omitted when Ongoing                                         | `complete_date`                   | Required for Completed, on/after start; null for Ongoing                 |
| `description`                               | `description`                                                                   | `description`                     | Optional occurrence description                                          |
| `created_by` (display username)             | Server; request ID ignored                                                      | `created_by` → `user_accounts.id` | Original creator, not ManagingEngineer; join supplies response username  |
| `created_at`, `updated_at`                  | Server                                                                          | Same names                        | Timestamps                                                               |

Routine edits do not change manager, project, year or quarter. Explicit Admin/SuperAdmin reassignment uses canonical `managing_engineer_id` and `expected_current_manager_id`; the latter is a concurrency guard, not a column. Existing assignment and authorization rules are unchanged.

## MonthlyUpdate — `jairoads_next.monthly_updates`

Types: `monthly-updates.ts`. Form: `MonthlyUpdates/Create.tsx` / `monthly-update-form.tsx`. Server: `saveUpdate`, `updateData`, `updateIndex`, `DdOperationsController::saveUpdate`.

| Frontend field                          | UI API → canonical operation | Database field                       | Business meaning                                                          |
| --------------------------------------- | ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| `id`                                    | Route ID for edits           | `id`                                 | MonthlyUpdateID                                                           |
| `maintenance_id`                        | `maintenance_id`             | `maintenance_id`                     | Authorized parent MaintenanceRecord, not a project ID                     |
| Picker `project_id`                     | Selection context only       | —                                    | Helps choose a record; server derives real project/LGU through the record |
| `update_month`                          | `update_month`               | `update_month`                       | Reporting Month, `YYYY-MM`, independent of quarterly year                 |
| `progress_percentage`                   | `progress_percentage`        | `progress_percentage`                | Server-validated 0–100; response float, stored decimal                    |
| `summary_of_text_reports`               | `summary_of_text_reports`    | `summary_of_text_reports`            | Optional textual report                                                   |
| `created_by` (display username)         | Server; request ID ignored   | `created_by` → `user_accounts.id`    | Verified report creator; response joins username                          |
| `created_at`, `updated_at`              | Server                       | Same names                           | Timestamps; `updated_at` drives Recently Modified                         |
| `record.year`, `record.quarter`         | Response-only join           | Parent `maintenance_year`, `quarter` | Quarterly context, not report date                                        |
| Directory filter `year`                 | Query only                   | Bounds on `update_month`             | **Reporting Year**, choices derived from authorized reports               |
| `media_count`, photo/video/other counts | Response-only calculation    | —                                    | Counts from related Media rows                                            |

December 2027 belongs in Reporting Year 2027 even under a 2026 MaintenanceRecord. The existing Repair 1 sort/filter implementation remains intact. Canonical mode omits preview `attachments` / `removed_media_ids`; Laravel prohibits those batch/removal fields. Media uploads are separate authorized operations, not an implicit batch report save.

## MaintenanceDocument — `jairoads_next.maintenance_documents`

Types: `maintenance-documents.ts`. Form: `MaintenanceDocuments/Form.tsx`. Server: `saveDocument`, `documentData`, `uploadDocument` / `updateDocument`, `PrivateSupabaseStorage`.

| Frontend field                                      | UI API → canonical operation                           | Database field                     | Business meaning                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `id`                                                | Route ID for metadata edits                            | `id`                               | DocumentID                                                                                                   |
| `maintenance_id`                                    | `maintenance_id` on create; persisted parent on update | `maintenance_id`                   | Authorized parent MaintenanceRecord; metadata edit cannot reparent it                                        |
| Picker `project_id`                                 | Selection context only                                 | —                                  | Not a stored document project or authorization source                                                        |
| `document_title`, `description`                     | Same names                                             | Same names                         | Title and optional description                                                                               |
| `attachment`                                        | Multipart `attachment` → `file`                        | —                                  | Required uploaded bytes; absence/type checked before FileBag conversion, then canonical MIME/size validation |
| `file_name`                                         | Server-derived from uploaded filename                  | `file_name`                        | Basename of the actual upload, not arbitrary body metadata                                                   |
| No private path input                               | Server-generated                                       | `file_path`                        | Private object path, absent from canonical frontend props                                                    |
| `uploaded_by` (display username)                    | Server; request ID ignored                             | `uploaded_by` → `user_accounts.id` | Verified uploader; response joins username                                                                   |
| `uploaded_at`, `updated_at`                         | Server                                                 | Same names                         | Upload and metadata-update timestamps                                                                        |
| `available`, `download_url`, related project/record | Response-only projection                               | —                                  | Configuration/authorized download/context, not public Storage URLs                                           |

Create accepts the UI `attachment` transport name; `/dd-phase3/ops/documents` uses `file`. Edit prohibits replacement `attachment` and validates only approved metadata. Canonical MIME/size policy and private storage compensation remain unchanged. `write` translates canonical `file` validation errors back to `attachment`.

## Media — `jairoads_next.media`

Type: `MonthlyMedia` in `monthly-updates.ts`. Form: `MonthlyUpdates/Show.tsx` separate evidence upload. Server: `uploadMedia`, `mediaData`, `DdOperationsController::uploadMedia`, `PrivateMonthlyMediaStorage`.

| Frontend field               | UI API → canonical operation                 | Database field                     | Business meaning                                                                           |
| ---------------------------- | -------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `id`                         | Response-only server ID                      | `id`                               | MediaID                                                                                    |
| Current report               | Route MonthlyUpdate ID → `monthly_update_id` | `monthly_update_id`                | Route controls parent; a conflicting body ID is overwritten before canonical authorization |
| `file`                       | Multipart `file`                             | —                                  | Authorized single evidence upload                                                          |
| `file_name`                  | Server-derived                               | `file_name`                        | Basename of actual uploaded filename                                                       |
| No private path input        | Server-generated                             | `file_path`                        | Private storage path, never exposed in canonical props                                     |
| `mime_type`                  | Response-only alias of server-detected MIME  | `file_type`                        | Image/video MIME type; client `file_type` cannot select it                                 |
| No uploader input/projection | Server                                       | `uploaded_by` → `user_accounts.id` | Verified uploader; not returned in safe media projection                                   |
| No editable creation time    | Server                                       | `created_at`                       | Event creation time; no invented `updated_at` field                                        |
| `size`                       | Response-only null                           | —                                  | Unknown size, not zero and not a stored canonical attribute                                |
| `available`, `preview_url`   | Response-only projection                     | —                                  | Configuration and authorized Laravel download URL                                          |

## Preview and legacy separation

`recordPayload` now has explicit `canonical`, `preview`, and `legacy` modes. Canonical mode submits `project_id`; historical modes retain `maintenance_projects_id`. All keep the existing `engineers_id` form alias and canonical `maintenance_year`. The editor chooses the mode from server-provided `canonicalFrontend` / `previewOnly`; historical callers retain the legacy default. Those flags select presentation/payload compatibility only; Laravel always independently verifies identity and route ownership.

The standalone Node preview stays process-local. Its fixture `year`, `engineers_id`, `lgus_id`, demo creator strings, attachment batches and simulated sessions are design data, not database identities or the production API. It is not connected to Supabase. Its wider historical validation ranges do not override canonical Laravel validation. No preview or legacy controller behavior is renamed here.

## Validation and ownership checks

| Workflow                              | Canonical error field  | Visible form field |
| ------------------------------------- | ---------------------- | ------------------ |
| Road association                      | `lgu_id`               | `lgus_id`          |
| ManagingEngineer selection            | `managing_engineer_id` | `engineers_id`     |
| Formal document upload                | `file`                 | `attachment`       |
| Year/quarter/reporting month/progress | Same canonical field   | Same field         |

Engineer Rank belongs to Engineer, while UserAccount Account Type controls permissions. Neither display values nor creator/uploader names grant access. Existing inactive-account, EngineerLGU, ManagingEngineer and Viewer restrictions remain in force.

Regression evidence: `FrontendFieldContractTest.php` covers real PostgreSQL mutations/projections, safe alias errors, missing uploads, conflicting inputs, route authority and attempted ownership/path/MIME injection. Existing assignment, reporting-year, geometry, lifecycle, password and unified browser tests remain enabled. `tests/Browser/field-contracts.mjs` tests the typed payload modes and isolated preview contracts without its HTTP server, fake sessions, live database or Storage; it runs in the full-system browser job before Laravel browser acceptance.

No unresolved Data Dictionary deletion, file retention, notification or auditing policy is decided by this cleanup. The existing reconciliation decision log remains authoritative for those questions.

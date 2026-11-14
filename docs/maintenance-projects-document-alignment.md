# Maintenance Projects: verified document alignment

Continues `integration/maintenance-projects` from `46786f0`, retaining `1f31ad3`
and the original integration merge. No remerge, upstream fetch, push, main edit,
Google document edit, database connection, migration or seeding is performed.

## 1. What was actually retrieved

Connected Google Drive successfully read native document
[`JaiROADS_DataDictionary`](https://docs.google.com/document/d/1WeaLeaOTvxMMsjce0Ec50VNMz0_2Psf5soC-dmbVcbA).
The complete returned text, not search snippets, was inspected in bounded chunks.
The document's read revision begins `AHj4eMQeTuf55TSr`.

| Tab | Verified tab ID | Read result |
| --- | --- | --- |
| Data Dictionary | t.0 | 1,276 paragraphs; 42,849 text characters |
| System Pages Overview | t.9e23dcl46c8w | 61 paragraphs; 2,487 characters |
| Page Specifications | t.hzks7rammcpb | 135 paragraphs; 73,860 characters |
| Quick Schema Reference | t.3jki3e7hvaqw | 631 paragraphs |
| Field Rules & Constraints | t.fhor7lvsrksp | 186 paragraphs |
| Relationships & Foreign Keys | t.ojy9q453k87r | 104 paragraphs |
| Enumerations / Allowed Values | t.rcal5x51hlkf | 30 paragraphs |
| CRUD & Permission Matrix | t.mmkhx5r0gkba | 91 paragraphs |
| Workflows | t.xds4rxz6hx2m | 64 paragraphs |
| Page Access & Actions | t.rk0dvuzbjil7 | Accessible, empty text |
| Forms & Validation | t.9fyzrcw4701x | Accessible, empty text |

Data Dictionary review covers entity overviews 1.1, technical fields 1.2,
authorization 1.3, application/database distinctions, retention, and outstanding
confirmation items. All three requested tabs were read completely. ERD/image
rendering and separate uploaded prototype files were not visually verified.
The Google document was not changed. Prior reports' access-failure statements
remain historical; this checkpoint supersedes that limitation.

## 2. Which decisions govern

| Documentation entry | Current interpretation |
| --- | --- |
| MP-08, MP-12, MP-21, PD-05B and OPEN-02 describe/suggest cascading project deletion | Superseded by the user's current instructions. Any MaintenanceRecord blocks project deletion. No dependent deletion or storage cleanup is part of this operation. |
| DD relationship rules say dependencies must be explicitly handled | Retain restrictive FKs. Do not interpret this broader wording as permission to delete history through the project workflow. |
| IMPL-04/05 and early MR notes limit work to frontend | Historical scope, superseded for the currently authorized Maintenance Projects integration only. |
| FS-01/12 still defer Edit/Delete/bulk deletion | Historical implementation snapshot. Current user instructions explicitly preserve the later implemented project CRUD and bulk deletion. |
| FS-06 describes old controller/policy gaps at commit 1d92471 | Current project controller/requests/service invoke authorization. The unresolved identity adapter is the present blocker. |
| FS-11/13 report PHP 8.5/build/browser checks in an earlier workspace | Historical evidence only. Current workspace has no PHP/Composer/psql; do not reuse these claims as this checkout's executed tests. |
| FS-07 proposes users.user_account_id with a restrictive FK | An unapproved alternative, not a mandated FK direction. Both proposed directions can implement a unique one-to-one relationship; lifecycle handling must be approved. |
| DD leaves GeoJSON physical storage TBD; FS-04 prepares JSONB | JSONB is a prepared implementation choice, not final general mapping approval. Confirm before executing the new table migration. |
| DD title convention differs from AP-02's Project Maintenance suggestion | Both are working/provisional naming conventions. Keep editable implemented suggestions; do not enforce a new naming rule. |
| SH-27 discusses an earlier no-morph sidebar preference | Current explicit user instruction requires the hover logo/expand swap. Preserve existing React/CSS. |

The confirmed layout remains the unified directory workspace, title/ID,
coverage-derived municipality, contextual actions/selection, dedicated create/edit
pages, and Project Details with fields/map above year-grouped existing quarters.
Do not force missing quarters, add project status/engineer/date fields, redesign
the sidebar, or substitute fixtures. Record/map workflows remain outside scope.

## 3. Logical design versus current source

These findings compare the document to source code, not the development database.
Laravel names such as `id`, `lgus_id`, `maintenance_projects_id`, and `engineers_id`
can represent logical LguID/ProjectID/ManagingEngineerID. Renaming alone is not a
structural repair. The relationship target and actual constraints determine fit.

| Entity/area | Alignment | Remaining difference/dependency |
| --- | --- | --- |
| LGU | Existing reference model; coverage points to it | Personnel assignment must not be inferred from coverage LGU or vice versa. |
| RoadCoverage | Separate model/migration, LGU FK, Engineer creator, decimal kilometers, controlled pavement/state values, JSONB | Prepared only. Real coverages/geometry absent from this workspace; storage choice still needs confirmation. Legacy roads remain separate, with their old creator/section structure. |
| MaintenanceProject | Title, optional description, coverage relationship and immutable creator in mutation service; directory derives municipality through coverage | Nullable legacy transition is intentionally not the final NOT NULL schema. Legacy columns/relationships remain for compatibility but are not used as new project-level status/ownership. |
| Create/Edit | Server validation, unique coverage, backend creator; coverage changes blocked with history and rechecked under locks | Resolver returns null; no live persistence verified. Legacy projects without coverage and with history require an approved mapping/correction workflow; ordinary form editing currently requires coverage. |
| Delete/Bulk | One transactional service; locks projects; rejects any history and whole mixed batch; retains coverage/children | PostgreSQL FK/concurrency/rollback behavior remains untested. Existing restrictive FKs must be verified, not assumed from migrations. |
| MaintenanceRecord | Parent project, year/quarter, engineer responsibility, dates and creator relationships exist | Source request allows Pending/Suspended in addition to documented Ongoing/Completed, requires description, accepts client created_by and lacks Completed conditional requirement. Policy permits any persisted User. Flag for its owner; do not rewrite this module. Quarter uniqueness is still proposed, so a nonunique source index is not automatically a confirmed defect. |
| MonthlyUpdate | Existing module/table retained | Source points directly to MaintenanceProject, whereas dictionary points to MaintenanceRecord, with monthly uniqueness and decimal progress. This is a real relationship/type difference, not just naming. |
| MaintenanceDocument/Media | Legacy project_documents/updates_media retained | project_documents belongs directly to project instead of record. Media FK/field/nullability must be mapped explicitly before any later migration; no uploads/storage behavior is implemented here. |
| Engineer | Existing professional identity and optional unique account FK | No EngineerStatus; legacy email and single LGU FK differ from intended retained/retired profiles and many-to-many EngineerLGU. Do not fabricate assignment rows from the old FK. |
| EngineerLGU | Document specifies composite (EngineerID,LguID), active flag, retained assignments | No source migration/model implements it. Engineer assignment resolver correctly denies access until approved support exists. |
| UserAccount | Operational account identity is distinct from Laravel login; creator references target it | Source enum/requests allow viewer/user/admin, lack account email, activation default/cast and role-dependent Engineer validation. FK currently nulls Engineer reference on deletion, versus documented restriction/retirement. |
| AuditLog | Main's controller/model/factory/seeder preserved; structured before/after values supported | Dictionary requires actor UserAccount, optional notification message, nullable system EntityID and permanent append-only events. Source migration permits null user_id, requires notification_message/entity_id, and uses JSON rather than JSONB. Coordinate a verified forward correction with owner; never edit an applied historical migration. |
| Project auditing | Document Workflows classifies configured project changes as audit-only events | ProjectMutations currently writes no AuditLog event. A successful project change is not yet fully dictionary-compliant. Coordinate event schema/actor/action mapping before adding atomic audit writes; don't invent notification recipients or duplicate events. |

System Pages Overview places Maintenance Projects/Project Details across all roles
with role-dependent actions. User Management is Admin/SuperAdmin; Engineers are
read-only in the personnel directory. Record edits require the current managing
Engineer plus active LGU eligibility; project creator is not ownership. The
current project policy has the right intended role/assignment boundary but the
adapter is deliberately unimplemented. This does not fix other modules' policies.

## 4. The three prepared migrations

| Migration | Assessment against documentation | Before execution |
| --- | --- | --- |
| 000001 create_road_coverages | Matches FS-04 staged schema, Engineer attribution and restrictive parent FKs | Confirm table absent, actual LGU/Engineer key types, selected schema, JSONB decision, controlled values and required geometry. No road-section conversion. |
| 000002 add_road_coverage_to_maintenance_projects | Nullable UNIQUE FK with restrictive coverage deletion matches FS-02/04 transition | Confirm column/constraint absent or reconcile existing equivalent; detect duplicate/orphan mappings; retain nulls until verified backfill. |
| 000003 relax_legacy_maintenance_project_fields | Matches staged retention: make obsolete required fields/description nullable, retain values and creator requirement | Compare actual types, lengths, defaults, collation/checks/FKs with every change(). Source alone cannot prove modifiers are preserved for a drifted database. |

No migration file was changed or executed. Dictionary's final NOT NULL coverage
rule is a later goal, explicitly deferred by FS-02/04 and current instructions.
Default PostgreSQL NO ACTION and explicit RESTRICT both prevent the ordinary
parent deletion here, but their deferrability/timing can differ; inspect the
actual constraint and do not silently replace it. The forward-only down() methods
are intentional; use a reviewed corrective migration/approved recovery plan.

Timestamps are another audit item: dictionary describes non-null/system-managed
timestamps, whereas Laravel timestamps() declarations may be nullable and lack
server defaults. ORM timestamps and database CURRENT_TIMESTAMP defaults are
different guarantees. Confirm the actual DDL and required write paths; do not
change all shared timestamp columns as part of this module.

## 5. Revised account-linkage proposal: lifecycle matters

Retain Laravel User/Fortify as the authentication principal and existing credential,
MFA/passkey/session/reset machinery. Continue proposing nullable UNIQUE
`user_accounts.user_id -> users.id` as the additive compatibility link. No
automatic identity/role backfill or matching by ID/name/email is permitted.

The core candidate migration body remains REVIEW-ONLY, not installed code:

```php
Schema::table('user_accounts', function (Blueprint $table): void {
    $table->foreignId('user_id')->nullable()->unique()
        ->constrained('users')->nullOnDelete();
});
```

**SET NULL alone is insufficient lifecycle integration.** The dictionary requires
retaining operational accounts and deactivating revoked access. Profile settings
currently hard-delete User; UserAccountController also hard-deletes UserAccount.
Recommended compatibility behavior, subject to approval:

* Before deleting a linked Laravel login through existing settings, atomically
  deactivate its UserAccount and record the approved audit event. Delete only the
  login; FK clears the link; retain account, Engineer and all attribution/history.
* Alternatively retain User and the link and replace linked-user self-deletion
  with controlled deactivation. This changes existing settings semantics and
  needs an explicit group decision. Do not silently choose this alternative.
* Administrative account revocation uses deactivation, not hard deletion.
  A linked inactive account must fail password/MFA/passkey login completion and
  lose protected access from existing sessions. A project policy check alone
  does not implement the documented login rule.
* Keep registration/reset/settings mechanisms for active users. Unlinked starter
  users must not gain operational privileges; public registration must not infer
  a UserAccount or grant a role. Decide any global unlinked-login restriction
  explicitly to avoid breaking starter authentication.
* Activation/linking/role provisioning require an authorized administrator and
  private verified pairing. Do not allow client fields or mass assignment to set
  user_id. A later replacement login does not automatically reclaim an old link.

There is another compatibility decision: the dictionary stores unique Email and
credentials on UserAccount and permits username/email login; current Fortify uses
users.email/password and UserAccount lacks email. Retaining Fortify preserves the
existing system, but requires an agreed transitional credential/identity mapping.
Do not add dummy email/passwords, automatically copy/synchronize credentials, or
claim full username-login compliance. This remains a shared design decision.

### Proposed shared-file patch scope (not applied)

| Files | Required responsibility |
| --- | --- |
| New forward link migration; User.php; UserAccount.php | Explicit unique link, inverse relationships, boolean activation cast; keep linkage unfillable and password hashes hidden from account serialization |
| VerifiedProjectAccount.php | Resolve only verified link, enforce activation/recognized role and approved role-Engineer invariant; assignedTo checks active EngineerLGU when available |
| UserAccountController.php; UserAccountPolicy.php; Store/UpdateUserAccountRequest.php | Enforce administrative gates, canonical roles, cross-field Engineer requirement, no client linkage changes, controlled deactivation instead of hard deletion |
| ProfileController.php | Approved linked-login deletion/deactivation semantics with history retained |
| New account-activity middleware plus bootstrap/app.php; FortifyServiceProvider.php or appropriate verified Fortify hooks | Existing-session enforcement and all authentication completion paths, preserving MFA/passkeys/reset behavior; exact API patch requires installed locked Fortify inspection/tests |
| New assignment migration/model and Engineer/LGU relationships | Composite pair uniqueness, active flag, restrictive FKs, no invented assignments; separately coordinated shared data structure |
| Focused identity, deactivation, policy, profile and auth regression tests | Include equal-but-unlinked IDs, inactive current sessions, password/MFA/passkey paths, retained historical creators, and forbidden role/link mutation |

This is larger than a four-file resolver switch because existing UserAccount
controller actions do not invoke the deny-by-default policy and requests currently
authorize true. Exposing working roles without protecting account mutation is an
integration blocker. No shared file above is changed in this checkpoint. The
existing AuditLog owner must review deactivation/event compatibility first.

Role reconciliation: lowercase admin/viewer have explicit intended counterparts;
legacy user stays unresolved/denied, never auto-converted to Engineer. Expand the
actual database role check and request validation only through approved forward
changes. Admin/Engineer require an Engineer; SuperAdmin/Viewer have no Engineer
link under the current cross-field rule. Do not repair existing account records
automatically. Ordinary Engineer project create/update additionally needs an
active EngineerLGU assignment; Admin/SuperAdmin may override that assignment.

## 6. What the actual PostgreSQL audit must settle

Use the existing unchanged read-only scripts and the previous pgAdmin guide:

1. Open the intended DEVELOPMENT database in a fresh Query Tool tab.
2. Execute the whole `tools/maintenance-projects-pgadmin-audit.sql` file.
3. Save complete schema_report text as `schema-report.txt` (read_only = on).
4. Execute the whole generated data_checks_sql text in another fresh tab on the
   same database; save complete data_report as `data-report.txt`.
5. Return those two files or sanitized errors. No credentials, identity rows,
   passwords/tokens, geometry exports or database dumps are requested.

Check actual key types, nullability/defaults/indexes/enum checks, all FK targets,
actions and validation status, applied migration batches, table counts, existing
coverage mappings, roles/activation totals, and history/dependency structure.
Confirm whether source drift has already moved updates/documents under records,
whether an identity link or EngineerLGU table already exists, and whether the new
coverage migrations have already been applied in any equivalent form.

The current scripts are a first-stage audit, not proof of every row's integrity.
After reading the actual schema, prepare only necessary read-only AGGREGATE
follow-ups for invalid/null creators, orphan/unvalidated links, available coverage,
role/Engineer mismatches and assignment eligibility. Do not request private row
lists or guess column names. Different deployed schemas may need a bounded
follow-up because the scripts use the current schema and expected Laravel table
names. FK validation flags and counts do not prove proposed identity pairings.

Only after dictionary/source/actual-schema comparison: present exact migration
SQL, lock/data effects, backup/recovery plan and targets, then request execution
approval. No fabricated coverage, default Engineer, account or mapping is allowed.

## 7. Safe source correction made now

`ProjectMutations` previously tested only table existence before querying legacy
project_documents/monthly_updates relationships. A retained monthly_updates table
with a revised record FK would cause an undefined-column error even for eligible
projects. Legacy checks now require the actual direct-project FK column. Any
MaintenanceRecord still blocks deletion; restrictive FK exception handling and
the all-or-nothing transaction are unchanged. No new child workflow/model/schema
is implemented and no historical data is deleted.

Added two focused regression cases to the isolated SQLite test file: legacy
direct-project updates block deletion; record-scoped updates coexist with an
eligible-project deletion while protected history and a mixed bulk batch remain
intact. These tests create their own in-memory schemas, not a development DB.
They are added but NOT RUN because PHP/Composer are unavailable.

## 8. Environment and evidence boundary

Lockfile rechecked: Laravel 13.25.0, Fortify 1.38.0, Pest 5.1.1 (PHP ^8.4),
PHPUnit 13.3.0 (PHP >=8.4.1). The previous Herd PHP 8.4.1+ within 8.4 / Composer 2
instructions remain applicable. pdo_pgsql is needed for PostgreSQL and pdo_sqlite
for the current isolated tests. Do not run composer setup or use a production/
populated DB for RefreshDatabase tests. Do not bypass platform requirements.

Source review and whitespace checks can run here. New Laravel tests, Pint,
PHPStan, migrations, authenticated PostgreSQL CRUD, concurrency and browser
acceptance have not run. Earlier fixture/SQLite/build reports do not establish
this integration's real PostgreSQL persistence. The frontend is unchanged.

## 9. Required approvals and next action

* No approval is needed to return the read-only audit reports or review this local
  module correction. The authoritative document is now accessible; exports are
  no longer necessary for these tabs.
* Shared identity/activation/account-policy/assignment patches require approval
  after the actual schema and lifecycle/credential decisions are reviewed.
* Every database migration/backfill requires separate target-specific approval
  after compatibility and recovery review.
* AuditLog structural/event changes require coordination with its owner and
  approval; this review does not authorize changing the existing implementation.
* Push/PR/main merge remain gated. Before any push, state commits/files and remote
  destination and whether DB/auth integration is complete, then wait for approval.

The immediate missing evidence is `schema-report.txt` and `data-report.txt`.
The branch is locally reviewable but is not ready to merge or claim functioning
authenticated PostgreSQL operations.

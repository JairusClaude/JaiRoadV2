# Canonical dependency matrix — Repair B, 4 November 2026

Prepared before implementation. Remote baseline: `c5ad04f6edfd84558f6b2bb86d5d015fbe5cdb44`; clean local preservation merge: `e77254ce77edf230928c0e50ed88588c1d42549c`. Read-only pg_catalog inspection of the connected JaiROADS project on 4 November 2026 confirmed these **18 canonical foreign keys**. No shared records or constraints were changed. The scratch baseline agrees. Nullable means current live nullability, not the proposed contract. All current delete actions below are **RESTRICT**.

| Referencing table.column | Referenced table | Nullable now | Authorization / provenance purpose | NULL UI / affected consumers | Repair B decision |
| --- | --- | --- | --- | --- | --- |
| engineer_lgus.engineer_id | engineers | No | Active LGU permission scope | Not meaningful for an assignment; account scope/lifecycle | Keep mandatory/restrictive; deactivate assignment |
| engineer_lgus.lgu_id | lgus | No | Active LGU permission scope | Not meaningful; scope/eligibility | Keep mandatory/restrictive |
| user_accounts.engineer_id | engineers | Yes | Identity linkage and role eligibility | Existing unlinked Admin compatibility; accounts/lifecycle | Retain existing rule; new Admin/Engineer require active linkage |
| road_coverages.created_by | engineers | No | Historical mapper provenance | Must retain identity; road forms/map/details | Never detach; retirement retains profile |
| road_coverages.lgu_id | lgus | No | Live municipality and Engineer scope | Unsafe absent scope; all road/project readers | Keep mandatory; municipality change remains explicit two-stage operation |
| maintenance_projects.created_by | user_accounts | No | Historical creator | Must retain identity; project listings/audit | Keep mandatory; deactivate accounts |
| maintenance_projects.road_coverage_id | road_coverages | No | Municipality inheritance; one project per road | Unsafe absent scope; project/map readers | Keep mandatory/restrictive; road deletion blocked while linked |
| maintenance_records.created_by | user_accounts | No | Historical creator | Must retain identity; record/history views | Keep mandatory/restrictive |
| maintenance_records.project_id | maintenance_projects | No | Current project and derived LGU scope | Can show actual NULL only with protected historical context; record/dashboards/monthly/document/media readers | Propose nullable; explicit project deletion detaches; keep FK RESTRICT; Admin-only historical views |
| maintenance_records.managing_engineer_id | engineers | No | Current write ownership, distinct from creator | NULL means unassigned; record/history/assignment forms/eligibility/municipality preview | Propose nullable; separate Admin unassignment; keep FK RESTRICT; new records still require manager |
| monthly_updates.maintenance_id | maintenance_records | No | Parent scope and reporting context | No approved orphan reporting scope; monthly/media readers | Keep mandatory/restrictive; record deletion blocked with children |
| monthly_updates.created_by | user_accounts | No | Historical author | Must retain identity; monthly/audit/reporting | Keep mandatory/restrictive |
| maintenance_documents.maintenance_id | maintenance_records | No | Parent scope/private download access | No approved orphan file scope; document readers/storage | Keep mandatory/restrictive; parent record retained |
| maintenance_documents.uploaded_by | user_accounts | No | Historical uploader | Must retain identity; file/audit readers | Keep mandatory/restrictive |
| media.monthly_update_id | monthly_updates | No | Parent scope/private download access | No approved orphan media scope; media/storage readers | Keep mandatory/restrictive; update deletion blocked with media |
| media.uploaded_by | user_accounts | No | Historical uploader | Must retain identity; file/audit readers | Keep mandatory/restrictive |
| audit_logs.user_id | user_accounts | No | Permanent business actor identity | Anonymous history disallowed; restricted audit readers | Never null/rewrite/delete; accounts retained |
| audit_logs.recipient_user_id | user_accounts | Yes | Optional one-row notification destination | Existing optional NULL; notification feed | Preserve existing constraint/behavior; no new notification policy |

All 11 canonical entities are covered: LGU, Engineer, EngineerLGU, UserAccount, RoadCoverage, MaintenanceProject, MaintenanceRecord, MonthlyUpdate, MaintenanceDocument, Media and AuditLog. LGU/Engineer primary rows have no outbound foreign keys. EngineerLGU keeps its composite primary key, UserAccount retains unique EngineerID, and project-to-road uniqueness remains intact. AuditLog entity_id is polymorphic historical identification, not a live FK to delete or null.

## Design selected for verification

Only the two MaintenanceRecord columns above become nullable in a forward-only **proposal outside automatic migrations**. All 18 FKs remain restrictive. Explicit project deletion locks road -> project -> records -> updates/documents/media, verifies a server-signed impact preview against current state, inserts immutable per-record project/road/LGU snapshots into a private protected context table, sets only project_id to SQL NULL and deletes only the selected project. Snapshot, detachment, deletion and new audit commit atomically. No Storage request is part of project deletion.

Normal project-scoped directories/forms retain reviewed inner joins and exclude detached history deliberately. A separate Admin/SuperAdmin-only paginated historical directory/detail exposes actual current project_id NULL and a clearly labelled previous-project/LGU snapshot. Engineer/Viewer cannot access orphan history or its downloads; no left-join blanket scope expansion. Dashboard administrative total record counts already include retained history; link to the historical view distinguishes it from active project directories. Detached history is read-only; no implicit reattachment, placeholder project or new orphan activity.

ManagingEngineer unassignment is a separate Admin action with expected-current-manager concurrency checking. Subsequent eligible reassignment follows existing LGU/account/profile validation; direct old-to-new reassignment remains one transition. Current manager NULL never grants an Engineer edit rights. Manager-name joins become LEFT JOIN only where the mandatory project/LGU path remains intact. Canonical read-only Eloquent belongsTo relations already return null for absent foreign keys and need no field/relationship rewrite; regression tests will verify this.

Schema-owner review/application and backend private-context permissions are required before shared activation. Other parent deletions remain restrictive rather than detaching additional relationships without an approved scope/history design. Retiring Engineers/deactivating accounts preserve provenance. Existing individual file deletion policy from Repair A remains separate.

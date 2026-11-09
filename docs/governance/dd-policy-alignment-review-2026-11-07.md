# JaiROADS Data Dictionary change request — authentication, AuditLog and notifications

> **PHASE 11L SUPERSESSION NOTICE (2026-11-09):** Any earlier proposal in this document to detach MaintenanceRecords from projects or unassign ManagingEngineer through NULL conflicts with the user's Final Data Dictionary and is not approved. Preserve both required references, all RESTRICT FKs and existing history. Admin/SuperAdmin may delete only an empty project after confirmation. Other proposed account/audit changes still need their own approvals. See `docs/release/phase11l-strict-dd-integrity-2026-11-09.md`.


**Status:** Proposed amendment for Data Dictionary/schema-owner approval. **Not yet a formally approved replacement of the canonical Data Dictionary.**

Date: 2026-11-07 (Asia/Manila). Source: [JaiROADS_DataDictionary](https://docs.google.com/document/d/1WeaLeaOTvxMMsjce0Ec50VNMz0_2Psf5soC-dmbVcbA/edit), checked against PR #6. The existing document is unchanged; its terminology and eleven core business-entity boundaries are preserved. This change request records the user's later implementation decisions and documents where they supersede the earlier draft.

## 1. Superseded account-eligibility wording

The canonical Data Dictionary currently describes:
- new **Admin and Engineer** accounts requiring active, unclaimed Engineer profiles;
- temporary compatibility for existing unlinked **Admin** accounts;
- nullable **Viewer.EngineerID** and a unique Engineer link when populated.

**Proposed approved-system behavior:** every ordinary **Admin, Engineer and Viewer** account must (a) be created by an eligible administrator, or undergo separately reviewed existing-account transition; (b) have an active canonical UserAccount of its assigned role; (c) have exactly one explicit, consistent Fortify `public.users.dd_user_account_id` link; (d) reference a real **Active** Engineer profile not already referenced by another UserAccount, even an inactive account; and (e) have immutable administrator-provisioning evidence. An initial privileged database-operator **SuperAdmin** may have no Engineer profile and no ordinary provenance record, but still requires a valid active canonical identity and Fortify link. An already-linked SuperAdmin must retain an active Engineer profile. There is no public registration, legacy-only login, inactive-account access, or email-verification requirement.

**Cardinality stays the same:** `UserAccount.EngineerID` remains nullable at the physical database level for the SuperAdmin exception and is UNIQUE when non-null. Linking an Admin or Viewer to Engineer does not grant Engineer-role permissions or change LGU/ManagingEngineer access. Do not create a placeholder Engineer profile, reuse an existing Engineer link, infer who provisioned a historical account, or silently backfill old credentials.

**New supporting private infrastructure, not a twelfth canonical business entity:** `jairoads_security.account_provisioning`, with one immutable record per ordinary UserAccount, `provisioned_by`, role/profile snapshots and `provisioned_at`. New accounts use `method='administrator'`; existing accounts may use `method='reviewed_transition'` **only after actual administrator review with a recorded review reference**. No historical creation date is invented.

**Existing canonical history:** referenced UserAccounts remain retained/deactivated rather than hard-deleted, as the Dictionary already requires. No account correction takes place as part of this amendment.

## 2. Superseded AuditLog/notification wording

The Data Dictionary currently has an optional `AuditLog.RecipientUserID` and `NotificationMessage` for **one** recipient, and marks multi-recipient delivery deferred. It also explicitly defers authentication-event auditing decisions.

**Proposed approved-system behavior:** write exactly one append-only **business** AuditLog event for each meaningful successful logical entity CREATE/UPDATE/DELETE, using safe entity-specific OldValue and NewValue snapshots. Do not write a successful business event for a failed/rolled-back operation, no-op, read, login or logout. Separate security telemetry can be designed later without treating authentication as business changes. Preserve all pre-existing historical AuditLog entries and their existing recipients; never rewrite or collapse them.

For each new qualifying business event, deliver exactly one addressed notification to each **eligible active Admin and SuperAdmin**, plus the **acting Engineer** if and only if the actor's role is Engineer. The Engineer must receive their own notification. Admin and SuperAdmin actors receive their own notification through the administrator audience. Deduplicate by `(audit_log_id,recipient_user_id)`. Viewers and other non-acting Engineers do not receive routine deliveries; actor eligibility is verified server-side.

**New supporting delivery infrastructure, not a replacement for AuditLog:** `jairoads_next.audit_notification_recipients`, FK-linked to the permanent event and the retained UserAccount. Notification feeds expose only safe recipient-specific messages, not privileged OldValue/NewValue data. Full paginated business/history access remains Admin/SuperAdmin only. Delivery read/unread states remain deferred.

An event plus all eligible recipients must persist atomically with its database business mutation; an error rolls back the transaction. Already committed external Storage effects during durable file deletion retain their separate pending/reconciliation logic.

## 3. Other Data Dictionary decisions still requiring owner signoff

The following are **not silently changed** by this request and have different code/schema readiness:
- **Preserved-history project deletion:** the current proposal preserves MaintenanceRecords, media, documents and updates by detaching the project and saving record context. Review `database/proposals/preserve_project_history.php`; it needs `maintenance_record_contexts` and a nullable `maintenance_records.project_id`.
- **ManagingEngineer unassignment:** a deliberate administrative workflow requires nullable `maintenance_records.managing_engineer_id`. Preserve the existing Manager permissions and history rules.
- **Unique quarterly MaintenanceRecord identity:** reconcile the service's period checks and a proposed database uniqueness constraint for `(project_id,maintenance_year,quarter)`, including NULL project_id behavior after preserved deletion.
- **Individual-file durable deletion:** review the separate `file_deletions` proposal and exact-object Storage semantics. Bulk deletion stays outside this change request.

Do not automatically include these independent schema changes in the two security proposals. The schema owner must explicitly decide each of these before claiming the entire feature set ready.

## 4. Approval and traceability

- [x] Implementation policy recorded from the user's instructions for the account and notification behavior.
- [x] Code and CI verified on GitHub PR #6's combined branch.
- [ ] Canonical Data Dictionary owner explicitly approves this amendment.
- [ ] Schema owner approves the auxiliary tables, runtime database role and grants/RLS.
- [ ] A verified account-transition plan, usable SuperAdmin recovery, and staging rehearsal pass.
- [ ] The signed/approved amendment is incorporated into the canonical Google Doc (not performed automatically).

This is a change request for review, **not** an approval signature, live migration or permission to deploy.

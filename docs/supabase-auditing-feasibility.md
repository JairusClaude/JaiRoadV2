# Supabase auditing: decision assessment only

Assessed 21 October 2026 against the pre-merge branch and current official documentation. No Supabase project settings, extensions, triggers, tables, policies, historical events or application audit writers were changed. `auditLog_behavior` was neither imported nor merged. The team's phrase “Supabase auditing” does not yet identify a replacement mechanism.

## Mechanisms are different

| Candidate                                | Captures `jairoads_next` business INSERT/UPDATE/DELETE?                                                                                              | Actor and history limitations                                                                                                                                                                                                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth Audit Logs                 | No; these record Supabase Auth authentication events, not arbitrary business-table changes.                                                          | Their Auth user identity is not automatically the canonical JaiROADS account. Current Fortify sign-ins do not use Supabase Auth. This does not replace business history.                                                                                                              |
| PostgreSQL pgAudit                       | Can record database write statements when the relevant roles/objects and WRITE auditing are configured. Availability alone does not enable coverage. | Database-role/session attribution and SQL/optional parameters are not canonical business actors or guaranteed safe row-before/row-after snapshots. It is statement auditing, not the current recipient-aware business event contract.                                                 |
| An approved row-change trigger mechanism | Can capture OLD/NEW row data transactionally for configured tables.                                                                                  | Requires a reviewed audit destination, safe-field exclusions and trusted actor context; it remains custom database behavior. Triggers alone neither identify a Fortify account nor deliver business notifications. Another proposed mechanism must be named and evaluated explicitly. |

Sources: [Supabase Auth Audit Logs](https://supabase.com/docs/guides/auth/audit-logs), [Supabase pgAudit](https://supabase.com/docs/guides/database/extensions/pgaudit), [pgAudit format/settings](https://github.com/pgaudit/pgaudit/blob/main/README.md), [Postgres triggers](https://supabase.com/docs/guides/database/postgres/triggers).

## Why a platform switch is not ready

Source inspection shows verified actors come from `public.users.dd_user_account_id` through `DataDictionaryIdentityResolver`; PDO uses configured database credentials. **Inference:** PostgreSQL connection roles identify that connection, not the person in a Fortify session. Existing CreatedBy/UploadedBy columns cannot solve UPDATE/DELETE attribution: they identify earlier creators/uploaders. A replacement needs server-verified canonical account context scoped to each transaction, tested under pooling, rollback and retries, plus a stable actor snapshot. It must resist untrusted context injection and cross-request identity leakage.

pgAudit's documented fields include statement/object information and optionally SQL parameters, not the required OldValue/NewValue business contract. Capturing parameters can also expose credential material. A proof must distinguish committed successful changes from attempted/rolled-back statements, apply safe payload exclusions, establish event correlation and meet the approved permanent-history retention/access requirements. None is proven merely by enabling an extension.

## Current dependencies

| Active reader / page                                                                      | AuditLog dependency                                                                                                  |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DdDashboardAnalytics` → Admin Workspace and Engineer/Viewer role dashboards              | Recent activity and LOGIN-derived sign-in summaries read canonical AuditLog.                                         |
| `DdSuperAdminLandingController` → SuperAdmin command center                               | Audit event count and recent system activity read canonical AuditLog.                                                |
| `DdRoleDashboardController` → My notifications                                            | Reads recipient-scoped canonical messages.                                                                           |
| `JaiRoadsNotificationsController` → `dd-notification-bell.tsx`, `/jairoads/notifications` | Reads canonical or legacy history according to the explicitly verified identity; returns only safe recipient fields. |
| Legacy role/SuperAdmin dashboards                                                         | Separate `public.audit_logs` notification/activity readers. They must not be redirected to canonical data.           |

`AuditLogController` has legacy index/show/feed methods, but this source's active route list does not register its audit-history routes and its referenced AuditLogs React pages are absent. A complete administrative history page is an existing gap, not a replacement implemented here.

Disabling only writes would freeze these histories, counts and notifications while leaving old rows visible. Dropping/removing their store would break queries. Existing mutation transactions deliberately depend on audit insertion; removing that step changes their accountability guarantee. Supabase logs are not a compatible API/feed for these pages. Notifications have no independent table or delivery backend in the approved design.

## Exact Data Dictionary decisions needed

1. If AuditLog remains but is written by database triggers, retain the 11-entity ERD and redefine the writer, trusted UserID/ActorIdentifier source, safe field mappings, action/entity values and transaction guarantees. This changes implementation rather than eliminating the entity.
2. If AuditLog is removed from the logical design, revise the entity inventory/ERD from 11 to 10 only if no replacement business entity is introduced. Retire all AuditLog fields/relationships from the active contract: AuditLogID, UserID, ActorIdentifier, Action, EntityType, EntityID, Description, OldValue, NewValue, RecipientUserID, NotificationMessage and CreatedAt. Physical historical tables must be retained pending a separately approved archive/retention plan.
3. Rewrite audit logging, actor attribution, successful-change/rollback, append-only/permanence, Admin/SuperAdmin history access and deferred authentication-event rules to describe the chosen external mechanism and any accepted loss of guarantees.
4. Explicitly retain, replace or retire personal notifications, their one-recipient policy and safe-read contract. Removing AuditLog without a separate approved notification design removes current notifications; this task does not authorize another Notification entity.
5. Update Page Specifications and acceptance tests for all dependent readers above, including the existing missing full-history page. Approve retention, ordering, export/restore, access control and secret exclusions rather than assuming dashboard logs provide permanent application history.

## Required approval and proof before migration

Team/client must name the mechanism and approve the revised business/notification contract. The schema owner must review exact role/object coverage, permissions, extension/trigger configuration and storage destination. Verify actual project availability/settings, retention and costs; they were not inspected here. Rehearse actor attribution, safe before/after values, committed-only outcomes, rollback, retries, pooling isolation, read restrictions and history restoration on disposable infrastructure. Approve a staged cutover and rollback plan before disabling any existing writes.

Any future log-query adapter must use current APIs. Supabase's [July 2026 changelog](https://supabase.com/changelog/48235-migration-of-supabase-management-api-logs-all-analytics-endpoint-to-logs-endpoint) retires `logs.all` in favor of `logs` with ClickHouse SQL. No such adapter/configuration is implemented here.

**Decision:** feasibility is conditional; there is no verified Supabase replacement yet. Keep the current AuditLog store, history, protections and writes while the team decides. No further custom AuditLog feature development is included in this branch.

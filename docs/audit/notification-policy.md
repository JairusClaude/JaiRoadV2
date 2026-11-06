# Canonical audit events and multi-recipient notifications

Baseline: `fix/canonical-only-provisioned-auth` at verified remote
`239af5db1d864fedbd58a55a2a9ca7779aaf69ce` (6 November 2026, Asia/Manila).
Repair branch: `fix/audit-multirecipient-consistency`. No old `auditLog_behavior`
implementation was merged. This implements the newly approved audience and
supersedes older one-recipient/supervisor-only/self-suppression proposals.

## Audience decision matrix

| Successful meaningful actor mutation | Eligible Admins | Eligible SuperAdmins | Acting Engineer | Other Engineers / new manager solely by assignment | Viewers |
| --- | --- | --- | --- | --- | --- |
| Admin | Every one, including actor | Every one | No | No | No |
| SuperAdmin | Every one | Every one, including actor | No | No | No |
| Engineer | Every one | Every one | Yes, self-notification | No | No |
| Viewer / invalid actor | Mutation forbidden | None | None | None | None |
| Read, no-op, failed/rolled-back action, authentication | None | None | None | None | None |

Each audience member must satisfy the **same SQL eligibility predicate as
canonical authentication**: active recognized account, exactly one explicit
Fortify bridge, matching email/hash state, active linked Engineer and matching
immutable provisioning evidence for ordinary accounts. The existing SuperAdmin
bootstrap exceptions remain. Engineer linkage never confers Engineer permissions.
No LGU/manager rule or role permission was broadened. Eligible administrators are
system-wide notification recipients under the approved policy, not a newly
introduced business write scope.

Eligibility is evaluated in the delivery INSERT SELECT statement's database
snapshot after the business change. Later deactivation does not rewrite past
deliveries; strict session eligibility blocks that account's protected reads.
There is one SQL audience query, not a resolver/query per recipient.

## One event and linked deliveries

`DdOperationAudit::record` requires an enclosing transaction, validates the actor
again, enforces CREATE/UPDATE/DELETE vocabulary, applies `DdAuditValues` allowlists,
inserts one `jairoads_next.audit_logs` event and invokes
`DdActivityNotifications::deliver`. The latter writes auxiliary rows, never extra
AuditLog copies. `(audit_log_id, recipient_user_id)` is unique. Recipient IDs,
actor IDs, roles and timestamps are never accepted from the HTTP form.

CREATE stores NULL before and a safe persisted snapshot after. UPDATE stores
normalized changed fields on both sides. DELETE stores the captured prior state
and NULL after. EngineerLGU changes retain both composite-key identifiers.
Reassignment and municipality transitions retain relevant identifiers and safe
context. Retirement records each actually changed account, membership and profile.
Project deletion records each actual record detachment plus the deleted project;
these are distinct entity changes, not recipient duplicates.

No-op comparison ignores Laravel timestamps, handles boolean/nullable values,
normalizes the two numeric(...,2) fields to committed precision, and uses canonical
JSON object ordering for geometry digests while retaining list order, coordinate
precision and dimensions. Ordinary metadata edits do not rewrite stored geometry.
Geometry is represented in audit snapshots by SHA-256, not a growing coordinate
payload. No stored geometry is simplified, moved or converted.

Explicit allowlists omit password/hash/email credentials, MFA/reset/passkey data,
tokens, headers, cookies, private object paths and file contents. File names are
basenames. Password-only security changes remain outside business-state snapshots;
approved username changes retain safe before/after values. Notification messages
are constructed only from verified actor role, action, approved entity type and
entity ID, never descriptions or snapshots.

Audit or delivery SQL errors escape fully transactional business operations and
roll back the mutation/event/deliveries together. A top-level retry rolls back its
first event and deliveries; only the successful attempt remains. No ignore/skip
or best-effort notification exception swallowing was introduced.

Permanent-file deletion keeps its existing durable intent, exact-object removal,
serialization, authorization and compensation/recovery. If recipient insertion
fails after Storage deletion, metadata/event/deliveries/completion roll back; the
previously committed intent remains pending. A retry accepts the already-absent
object and commits one successful event with its deliveries. Pending is never
reported as completed. No folder/bucket/parent deletion semantics changed.

## Schema-owner handoff: REQUIRED before deployment

`database/proposals/audit_notification_recipients.sql` is a reviewed code proposal,
**not an applied canonical migration and not yet approved for shared execution**.
It adds an auxiliary delivery table, two restrictive FKs, event/recipient uniqueness,
a recipient/time/event lookup index, RLS and append-only UPDATE/DELETE/TRUNCATE
protections for deliveries and canonical history. It does not replace the eleven
business entities, add notification read/unread/dismissal state, or backfill any
historical row. Reconcile trigger names with existing protections before applying.
Database owners can still alter/drop objects; append-only triggers do not defend
against a privileged operator deliberately changing the schema.

The proposal revokes PUBLIC and any existing Supabase anon/authenticated/service_role
grants on the new table/sequence. Do not expose it through the Data API. Use the
reviewed dedicated Laravel database role, not a schema owner or a browser JWT role.
The following is an owner-review template only (not executed on shared Supabase):

```sql
GRANT USAGE ON SCHEMA jairoads_next TO jairoads_app_runtime;
GRANT SELECT, INSERT ON jairoads_next.audit_notification_recipients TO jairoads_app_runtime;
GRANT USAGE ON SEQUENCE jairoads_next.audit_notification_recipients_id_seq TO jairoads_app_runtime;
CREATE POLICY runtime_delivery_read ON jairoads_next.audit_notification_recipients
  FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY runtime_delivery_insert ON jairoads_next.audit_notification_recipients
  FOR INSERT TO jairoads_app_runtime WITH CHECK (true);
```

These policies trust **only the server database role**. They are not end-user
policies and must never be assigned to anon/authenticated/PUBLIC. Laravel remains
the canonical-user authorization boundary and filters feeds by the resolver's
recipient ID. Grant required existing-table/provenance reads and canonical audit
INSERT/sequence privileges through the established least-privilege review. Do not
grant UPDATE/DELETE/TRUNCATE/ownership on events or deliveries. RLS and grants are
separate requirements: see the official [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security).

Activation order:

1. Finish the strict-account/provenance transition prerequisites and retain a
   verified eligible SuperAdmin; this repair does not backfill or grandfather users.
2. Schema owner reviews naming, FKs, trigger coexistence, defaults, sequence grants,
   API exposure, RLS, backup and lock/execution plan; converts proposal to their
   approved forward migration. Rehearse in disposable PostgreSQL 17.
3. Apply schema/grants only with separate shared-database authorization. No proposal
   runs during startup, composer install or ordinary application requests.
4. Verify CI on the intended code revision. Separately authorize deployment. Do not
   deploy strict mutation writers before the required schema/grants are ready.
5. Privately verify authorized staging business writes, safe feeds/history and
   durable file reconciliation. Do not use production records/Storage for tests.

Missing delivery schema fails a business mutation closed with 503 and full SQL
rollback. Readers can still serve older addressed notifications when the new
relation is absent. Broken installed permissions surface an error; the application
never quietly commits a required business event without its deliveries.

## Historical compatibility and readers

No UPDATE, DELETE, consolidation or backfill of existing canonical AuditLog or
recipient copies is performed. `public.audit_logs` and its legacy controllers
remain separate; strict account middleware prevents legacy-only authentication.

The shared notification projection unions new recipient deliveries with old
addressed canonical rows. It exposes only `id`, `notification_message`, `created_at`,
filters by the verified account, orders newest timestamp then AuditLog ID, and
returns at most the existing 20 items (8 on role dashboards). The numeric `id`
is always a canonical **AuditLog ID**, never the independent delivery sequence:
this prevents old/new ID collisions without changing React contracts. If both
structures refer to the exact same event/recipient, the linked delivery wins;
otherwise historic copies remain distinct history. No heuristic matching of old
copies or descriptions is used. Viewer can still read an old addressed entry,
while receiving no new routine deliveries.

`GET /dd-phase3/audit-logs` is an explicitly checked Admin/SuperAdmin-only,
read-only, 25-row paginated view of **all** retained entries, including historical
notification copies and LOGIN entries with clear labels. Safe allowlists filter
legacy payload projections without changing stored bytes. Engineer/Viewer direct
requests are denied. No event/recipient update, delete, clear, mark-as-read or
dismiss endpoint exists.

New LOGIN/LOGOUT/failed-login events are not written. Both Laravel auth listeners
still call `Inertia::clearHistory()`. Dashboards show business activity only,
explicitly state that sign-in telemetry is not collected here, and link authorized
administrators to complete retained history. Historical LOGIN entries are not
presented as current sign-in statistics.

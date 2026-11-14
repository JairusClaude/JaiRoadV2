# Permanent individual file deletion — approved scope and operational handoff

4 November 2026. Supersedes the earlier undecided **individual** file-retention policy in [file-removal-policy-decision.md](file-removal-policy-decision.md). Parent-project, record, MonthlyUpdate and bulk/cascade deletion policies remain separate and unresolved. No shared database, bucket, Storage object or historical audit row was changed during implementation.

## User contract

Active canonical Admin/SuperAdmin accounts can remove one selected MaintenanceDocument or Media attachment. Engineers/Viewers cannot invoke the endpoint or review. Existing administrator global parent scope is preserved; this introduces no new role/LGU permissions. The parent MaintenanceRecord/project/road must exist when accepting a new request. Clients supply the canonical kind and ID only; paths, bucket, role and LGU overrides are prohibited and submitted actor IDs are ignored.

The first Delete control opens a server-refreshed review, without mutation. The accessible dialog shows the actual filename, entity type and parent IDs, the approved irreversible-action message, neutral Cancel and red Delete. Cancel initially has focus and performs no DELETE. The final action is CSRF-protected and disables repeated submission. Only a confirmed `completed` response produces success. Pending/errors remain visible. Closing a pane after an accepted deletion does not cancel that durable command.

The directory, document detail/edit footer, MonthlyUpdate media gallery and older DD review component use the same production Laravel/Inertia dialog. The standalone Node preview does not gain persistence or production sessions. Bulk controls remain disabled.

## Exact-object safety and Storage contract

The canonical database determines the filename, private path and parent; the existing service determines the configured origin/bucket. Path validation accepts only the existing UUID-style per-record/per-monthly-update object namespace and supported extensions, rejects traversal/newlines and checks the actual parent prefix. Multiple same-kind metadata rows referring to the same object block deletion. No folder, bucket, prefix, sibling or parent deletion is issued.

The server requires an opaque `sb_secret_*` key or a legacy service-role JWT (Storage verifies the credential). A fake non-JWT key is accepted only by guarded testing against loopback mock Storage. Credentials and raw provider errors never reach the browser/audit payload.

Before every removal attempt the server fetches the configured bucket metadata and verifies its exact ID, `public: false`, and `versioning_status: DISABLED` when that field exists. Older Storage versions omit the field because they have no versioning migration. ENABLED, SUSPENDED, unknown/malformed metadata and public buckets fail closed, without issuing an object DELETE. Versioned-bucket purging is deliberately unsupported: ordinary deletion may only create a delete marker while retaining bytes. The Storage owner must keep these approved private buckets unversioned and prevent concurrent administrative changes to their versioning/privacy configuration during deletion. All-version purging would need a separate policy and implementation.

A single exact-object REST DELETE must return the documented successful response, HTTP 204, or the precise `NoSuchKey`/404 missing-object response for idempotent recovery. NoSuchBucket, ambiguous 404, denial, malformed success, timeout and 5xx are not evidence of removal. This is a provider API confirmation, not an independent inspection of provider physical backup/media erasure. Out-of-band Storage administrators must not recreate previously deleted UUID keys.

Reference contracts inspected: [Storage deleteObject implementation](https://github.com/supabase/storage/blob/master/src/storage/object.ts), [bucket metadata route](https://github.com/supabase/storage/blob/master/src/http/routes/bucket/getBucket.ts), [Storage error codes](https://supabase.com/docs/guides/storage/debugging/error-codes). No live provider writes were used for verification.

## Durable consistency and idempotency

SQL and HTTP cannot commit atomically. Two transactions make uncertainty recoverable:

1. Authenticate the current canonical administrator; take the existing shared lifecycle advisory lock, lock the exact metadata row, recheck authority after any wait, validate the target and commit a private deletion intent **before** contacting Storage.
2. Lock that intent with `FOR UPDATE SKIP LOCKED`, lock metadata and the current actor account/profile, recheck the current active role, immutable target and configured Storage origin/bucket, then verify the bucket and delete the exact object. In the same SQL transaction delete the selected metadata, verify its absence, append one DELETE AuditLog, and mark the intent completed. Clear path/origin/bucket from the completed tombstone.

Metadata, audit insertion and completion are atomic with each other. Any SQL/FK/audit failure rolls them back; a prior committed intent survives. Storage may already be gone, so the UI returns HTTP 202 **pending**, never false success. Downloads and document metadata edits reject pending targets with 409. A process crash after remote removal also leaves the committed intent recoverable. Intent creation failure prevents any Storage request.

The unique `(kind, entity_id)` intent and row locks serialize retries. A concurrent worker receives pending rather than duplicating the external/final business event. Completed retries return success without another removal/audit, unless a metadata ID was unexpectedly reused, in which case they fail closed. Targets/configuration that changed are not silently redirected. IDs and UUID object paths must not be reused. Existing same-file title editing is blocked while pending; existing parent/file restrictive FKs remain in force.

Current account/profile locks and the existing lifecycle advisory lock serialize application deactivation/retirement while executing a confirmed operation. If revocation committed before the worker acquires those locks, recovery stops without external deletion. Another active Admin/SuperAdmin may explicitly reconfirm the same canonical target; the current actor is recorded in the final audit while immutable `initiated_by` preserves the first requester. A role change requires a fresh confirmation; recovery does not grant new authority.

The second transaction holds locks during bounded HTTP calls (up to 30 seconds each). This favors consistency over lock throughput; do not run unbounded recovery batches. Missing/corrupt intents, changed targets, unavailable credentials or persistent database dependencies require administrator investigation, not history rewriting.

## Audit and preserved data

Exactly one new successful DELETE business event is appended on final SQL completion, using the existing canonical operation format through the extracted `DdOperationAudit` writer. Other operation callers retain their existing notification behavior. File deletion passes `notify: false`: no additional notification recipients or delivery audit copies are invented.

The event records canonical actor, entity type/ID, safe description and safe old values (filename, original requester and parent IDs). NewValue is NULL. No credentials, signed URLs or private paths enter the payload. Earlier AuditLog rows are never updated/deleted. Sibling metadata/bytes, project, MaintenanceRecord and MonthlyUpdate stored values are retained; displayed attachment counts naturally decrease.

## Required schema-owner/deployment gate — not applied to shared infrastructure

`database/proposals/create_file_deletions.php` is an **operational table proposal**, outside Laravel's automatic migration directories. No existing canonical model or migration was modified. Application deletion is unavailable while the table is absent. Ordinary uploads/downloads remain compatible without it.

The schema owner must review and approve the proposal and coordinate execution separately. It creates only `jairoads_next.file_deletions`, two canonical actor FKs, a unique operation target, recovery index and constrained pending/completed state. No file FK is used because the tombstone must survive removal. DDL/permission changes execute transactionally. RLS is enabled with no public client policies; PUBLIC/anon/authenticated table and sequence privileges are revoked. Confirm the trusted Laravel backend role can access the table/sequence under the team's actual role/RLS setup. Do not expose these intent paths through PostgREST or frontend queries. `down()` intentionally refuses automatic destruction of recovery evidence.

The disposable PostgreSQL tests and guarded browser/Docker fixture builders explicitly rehearse this proposal on empty local test databases. No container startup, seeder or normal application request creates the table.

After approval, the operations owner must arrange periodic **trusted** reconciliation, using:

```bash
php artisan jairoads:resume-file-deletions --limit=50
```

The command only processes already accepted intents; it accepts neither paths nor new deletion targets, revalidates current authority and reports only operation IDs/states. Pending failures return a nonzero exit code. Monitor private `last_error_code` and pending age; logs contain only safe operation IDs/error categories. The code does not install a scheduler or run database setup automatically. Retain completed tombstones for idempotency; any retention/removal plan needs schema/operations review. Do not delete pending intents to hide unresolved object/database uncertainty.

## Verification coverage

`PermanentFileDeletionTest` and the prior non-mutating review tests cover both file kinds, exact HTTP target, canonical actor, inactive/forbidden roles, private/unversioned bucket checks, credential/path guards, sibling/parent/history snapshots, idempotency, Storage denial/timeout/malformed responses, missing-object recovery, audit failure, FK failure, silent metadata-delete refusal, intent insertion failure, changed target/configuration, actor revocation/reconfirmation, real two-connection lock waits, concurrent requests and SIGKILL between remote removal and SQL commit. The worker is guarded to disposable loopback PostgreSQL and uses fake Storage only.

`tests/Browser/permanent-file-deletion.mjs` runs through real Fortify/Inertia: Cancel causes no DELETE, exact selection is shown, Delete is red and disabled during processing, pending is honest, retry succeeds, only the selected document/media disappears, sibling bytes and parents remain, unauthorized roles and CSRF bypass fail. Docker acceptance adds real production-image DELETE requests with local Storage mocks. Full canonical, password, Feature, quality, audit and browser checks must remain green on the published commit; results are reported separately rather than inferred from an earlier SHA.

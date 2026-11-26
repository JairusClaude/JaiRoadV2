# Private upload recovery

The canonical upload journal is an additive, schema-owner-reviewed proposal. It records a server-generated exact private object location before any remote upload; metadata, audit and completion commit together. A pending row means the outcome is unknown, not that the object is necessarily orphaned. No secrets, credentials or file contents are journaled.

1. Rehearse the SQL in disposable PostgreSQL and verify RLS and restricted runtime grants. Apply the proposal only with owner approval; enable JAIROADS_UPLOAD_JOURNAL_ENABLED only after verification. When enabled and the table is missing, uploads fail closed. When disabled the legacy best-effort compensation remains available for compatibility and is not durable.
2. A pending row older than ten minutes is a review candidate. Stop concurrent upload writers before reconciliation. Privately verify exact origin, bucket and path, check both canonical and retained legacy metadata, and confirm the object is not required by a committed record or backup policy.
3. Only an independently authorized operator may remove an exact confirmed orphan using the approved Storage workflow. Never bulk-delete by prefix, use a browser-supplied path, or infer approval from a pending journal row. A committed journal row is not a deletion request. Preserve recovery evidence.
4. After a reviewed recovery, verify the Storage result and record the outcome in the private operator log. Do not rewrite audit history. A pending object may also be retained intentionally.

The separate permanent-deletion retry command can be scheduled using JAIROADS_FILE_DELETION_SCHEDULE_ENABLED only with the existing deletion approval switch, a shared atomic cache and a running Laravel scheduler. Neither setting enables a scheduler on the hosting provider by itself. 

# Proposed MaintenanceRecord occurrence constraint

**Review only — not an executed migration.** The schema teammate owns migration naming/files and physical changes. No existing migration file, table, constraint, trigger, policy or shared row is modified in Task 3. This proposal implements the approved no-duplicate rule without restoring mandatory quarter pairing or altering history.

Target: `jairoads_next.maintenance_records`, proposed constraint/index name **`maintenance_records_project_year_quarter_uq`**, keys **`(project_id, maintenance_year, quarter)`**, ordinary non-deferrable UNIQUE. All three columns are currently NOT NULL. Do not use partial uniqueness, a status filter or NULLS NOT DISTINCT to change the occurrence rule. Completed and Ongoing records occupy the same period key.

## 1. Observed preflight and required fresh recheck

On 27 October 2026, the live table had **0 rows, 0 duplicate groups, 0 excess duplicate rows**, and no equivalent unique constraint/index. This observation does not authorize execution. The teammate must re-read the current schema/data in the intended target and confirm writer coordination immediately before execution.

Read-only duplicate query (return row identifiers only to the authorized database owner if further investigation is necessary):

```sql
SELECT project_id, maintenance_year, quarter, count(*) AS occurrences
FROM jairoads_next.maintenance_records
GROUP BY project_id, maintenance_year, quarter
HAVING count(*) > 1;
```

Verify current nullability, key shape, existing names/validity and equivalent indexes before creating anything:

```sql
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'jairoads_next'
  AND table_name = 'maintenance_records'
  AND column_name IN ('project_id', 'maintenance_year', 'quarter');

SELECT conname, contype, convalidated,
       pg_get_constraintdef(oid, true) AS definition
FROM pg_constraint
WHERE conrelid = 'jairoads_next.maintenance_records'::regclass;

SELECT c.relname AS index_name, i.indisunique, i.indisvalid, i.indisready,
       pg_get_indexdef(i.indexrelid) AS definition
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE i.indrelid = 'jairoads_next.maintenance_records'::regclass;
```

If duplicate groups exist, **stop**. Do not delete, merge, renumber, re-quarter or rewrite those records/audit history automatically. Product/client and schema owner must approve record-by-record reconciliation, preserving dependent updates, files and accountable history. No cleanup SQL for shared records is supplied here. If an equivalent valid UNIQUE already exists, reconcile migration state instead of adding a duplicate index. A same-name invalid/unrelated index is a failure requiring inspection, not a reason to use IF NOT EXISTS blindly.

## 2. Recommended online forward-only sequence

Use two coordinated migrations/steps owned by the schema teammate. The first **must run outside a transaction**; in Laravel that requires an explicitly non-transactional migration (`$withinTransaction = false`) or the team's reviewed database deployment process. Do not place CREATE INDEX CONCURRENTLY inside DB::transaction or a transaction-wrapping migration runner.

Phase A — create the unique B-tree index; no filtering and no existing-index shortcut:

```sql
CREATE UNIQUE INDEX CONCURRENTLY maintenance_records_project_year_quarter_uq
ON jairoads_next.maintenance_records (project_id, maintenance_year, quarter);
```

Immediately verify that `indisunique`, `indisvalid` and `indisready` are true and the key columns/order match. This unique index already enforces the rule before attachment. Concurrent writes are checked by PostgreSQL; a competing duplicate can make the build fail and leave an invalid index. Stop, record the exact failure and inspect that object/data. A failed unique build can leave an invalid index that still affects writes. Only the teammate may approve removing a verified failed build artifact before a reviewed retry; never drop a pre-existing constraint/index by name assumption.

Phase B — short transactional attachment; the timeout is an operational proposal for owner review, not a universal production value:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE jairoads_next.maintenance_records
  ADD CONSTRAINT maintenance_records_project_year_quarter_uq
  UNIQUE USING INDEX maintenance_records_project_year_quarter_uq;
COMMIT;
```

If attachment times out, roll back that phase, inspect current state and retry only after coordination. The valid Phase A index remains and still enforces uniqueness. Do not rebuild it automatically. An attached UNIQUE cannot be added NOT VALID; that shortcut is not supported for this constraint type.

For the currently empty/small table, the owner may instead approve one short maintenance-window transaction with `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (project_id, maintenance_year, quarter)`. That simpler path blocks writers during index construction. Pick one plan after observing current size, load and lock tolerance; do not execute both. No table rewrite, historical data update, ID-sequence reset, FK cascade, status default change or audit-trigger replacement is part of either plan.

## 3. Coordination and compatibility checks

1. Schema teammate reviews the exact target/project, migration ledger/provenance, duplicates, dependencies, index definition and backup/restore procedure. Current authorization is documentation/read-only inspection; live execution needs separate approval.
2. Inventory every writer, including alternate branches, scripts and integrations. Keep the existing parent-project locking/availability validation; database uniqueness closes bypass/race paths, it does not replace authorization.
3. Consider a focused follow-up mapping this named constraint's SQLSTATE 23505 to the existing “quarter already occupied” validation response where relevant. Do not catch all SQL errors or commit business data without audit. No application change is included in this documentation task.
4. Rehearse both candidate SQL phases on an empty disposable PostgreSQL 17 instance and a separately authorized representative clone/load. Test duplicate INSERT/UPDATE, concurrent clients, quarter/year/project independence, transaction rollback and existing status/date/manager rules. The Task 3 local proof below covers semantics, not production-scale locks.
5. Apply only after the schema owner and deployment authority approve execution. Verify constraint/index validity, retained rows/creator references, audit guards and legitimate quarterly creation afterward.
6. Resolve failures forward: keep a valid index if attachment fails, or inspect a failed build artifact before retry. No automatic `down()` that drops tables, removes history or silently removes the new safeguard is proposed. Any later constraint removal needs a reviewed compatibility/rollback decision. Preserve existing applied migrations and every live audit guard.

## 4. Disposable rehearsal actually executed

A new loopback database `jairoads_scratch_reconciliation` ran PostgreSQL **17.11**. It refused non-loopback/non-scratch/non-PG17 or non-empty canonical targets. It loaded the existing frozen SQL fixture as text; no application migration class/command was executed. Only dummy rows were used, and the cluster was stopped/removed afterward. No real user, Supabase row, object or credential was copied.

[Machine-readable results](disposable-rehearsal-results.json): **15 checks passed**:

- Existing dummy duplicate makes concurrent index build fail with 23505; invalid index is detected. Recovery removes only that disposable failed index and dummy duplicate.
- Both online phases succeed and produce one validated UNIQUE constraint.
- Independent duplicate INSERT and colliding UPDATE fail with 23505.
- Four distinct quarters remain allowed; the same quarter is allowed in another year/project.
- A second connection waits on an in-flight duplicate key and hits the deliberate 100 ms test lock timeout (55P03); after the winner commits, its retry gets 23505. Exactly one occurrence commits.
- Copies of the live audit function/triggers reject UPDATE, DELETE and TRUNCATE with 42501; INSERT succeeds and the history row remains. **No live audit mutation was attempted.**

References: PostgreSQL 17 [CREATE INDEX](https://www.postgresql.org/docs/17/sql-createindex.html) (concurrent builds, invalid indexes and transaction restrictions) and [ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html) (UNIQUE USING INDEX and locking).

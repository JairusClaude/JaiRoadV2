# JaiROADS — Task 13 controlled release and post-deployment runbook

> **Phase 11L Final DD correction (2026-11-09; NO GO remains):** `maintenance_records.project_id` and `managing_engineer_id` must remain NOT NULL, with RESTRICT foreign keys. Historical suggestions to activate `preserve_project_history.php`, detach records, or unassign a ManagingEngineer are superseded and must not be followed. This runbook is a review artifact, not deployment approval. See `docs/release/phase11l-strict-dd-integrity-2026-11-09.md`.


**State: NO GO — review-only release package. 2026-11-07 (Asia/Manila).**

> **Phase 11N read-only delta (2026-11-09):** The live account inventory now shows **two active SuperAdmin records**, rather than the one in the historical snapshot below. Both require independent ownership/recovery review. The Admin still lacks an Engineer link; a dedicated non-BYPASSRLS JaiROADS runtime login and the two proposed security support tables are still absent. Do not alter or deactivate accounts based on these aggregate counts alone.
Official Supabase: `aeaaxwyytsagbacysvvx`. Baseline: [Task 12 PR #17](https://github.com/JairusClaude/JaiRoadV2/pull/17), commit `c909ae0f238a532c9c560de6d40a1237215527ac`. The 26/26 green checks on Task 12 establish **disposable CI compatibility**, not a real production recovery plan or user approval.

This runbook documents steps for a **future owner-authorized change**. It contains NO executable production migration, deployment token, production database URL, live account repair, automatic rollback of retained data, automatic merge, or permission to use the `postgres` owner as the runtime user. No release has been approved or executed.

## Current official schema — verified read-only 2026-11-07

| Release precondition | Observed |
|---|---|
| PostgreSQL 17 | Present |
| Existing immutable canonical AuditLog guards | Two active |
| Existing active canonical SuperAdmin record | One; actual operator login/recovery **unverified** |
| Active Admin with no Engineer profile | One — identity-safe review required |
| `jairoads_security.account_provisioning` | Missing |
| `jairoads_next.audit_notification_recipients` | Missing |
| `jairoads_next.file_deletions` | Missing |
| `jairoads_next.maintenance_record_contexts` | Missing |
| `maintenance_records` quarterly unique constraint | Missing |
| Actual restricted `jairoads_app_runtime` LOGIN | Missing |
| Real signed user-acceptance evidence | NOT RUN |
| Persistent isolated staging and owner-approved release | Not evidenced |

The official private document and monthly-media Storage buckets were previously verified as **nonpublic and unversioned**, but **object backup and exact-object live operations were not tested**. Do not infer live credentials, private storage object recovery, or correct RLS from metadata alone.

The current schema state is incompatible with automatically deploying the strict canonical code. **Stop before any merge, data transition, migration or application cutover.**

## Review-only artifacts / release controls

- `database/preflight/release_readonly.sql`: runs inside PostgreSQL `BEGIN TRANSACTION READ ONLY`, outputs an aggregate catalog JSON observation (no names, emails, hashes or file paths). It is not proof of correct identity, complete RLS grants, real recovery or stakeholder approval. Run privately with an owner-approved **read-only** session; never connect official credentials to CI.
- `scripts/release/check_release_readiness.py`: checks exact 40-digit candidate Git SHA, pinned image `sha256` digest, approved project identifier, 11 structural database checks, the **25** UAT case results and **13** original owner gates, plus **11 additional independent release/change/backup/service references** and an explicit authorization flag. It cannot inspect or authenticate human signatures or make any remote changes.
- `docs/release/release-manifest-template.json`, `release-inventory-template.json`, and `docs/qa/uat-evidence-template.json` deliberately contain no approvals. They **MUST fail closed** in CI.
- `tests/Release/test_release_readiness.py` uses fictional in-memory evidence only to check decision branches; no reviewer or fake approval is checked in as a real signature. CI and branch test code never handle official Supabase credentials.
- `tests/Staging/rehearse-backup-restore.sh` on Task 12 tests a full custom-format `pg_dump` + `pg_restore` with synthetic records, RLS, immutable history and grants on PostgreSQL 17. That does **not** constitute an authorized production backup or point-in-time restore.
- `tests/Release/readonly-http-cutover-smoke.py` checks a **localhost-only** Laravel health route, real Fortify login page, and five protected guest JSON endpoints for expected 401 under the restricted staging runtime role. It is invoked by the disposable application-smoke job. It **cannot** execute against official Supabase or count as a real postdeployment smoke.

To inspect structural prerequisites in a **private operator workspace**, not CI:

```bash
# Review-only commands. Obtain connection/credentials through an approved
# private channel; do NOT put them in shell history, GitHub, PR comments or logs.
# The first command should be run by the DBA with a read-only connection.
psql -X -qAt -v ON_ERROR_STOP=1 -f database/preflight/release_readonly.sql > PRIVATE_INVENTORY.json

python3 scripts/release/check_release_readiness.py \
  --manifest PRIVATE_RELEASE_MANIFEST.json \
  --inventory PRIVATE_INVENTORY.json \
  --uat PRIVATE_UAT_EVIDENCE.json \
  --sha EXACT_REVIEWED_40_CHARACTER_GIT_SHA
```

The first command is **never executed automatically**. It is only a SQL observation and is not proof that the selected DB is the real project; owner must independently verify connection identity and source provenance. The second command performs **no network calls or DDL**. Exit 2 (`NO GO`) means blocked; exit 0 (`STRUCTURE COMPLETE FOR INDEPENDENT OWNER REVIEW ONLY`) does **not** authorize a merge, migration or deployment.

## Controlled sequence — all steps require documented owners

1. **Freeze reviewed source and close dependency review.** Decide disposition of legacy divergent `main` / `integration/road-coverage-login` commits with teammate; finish review and explicit approvals for the dependency stack PR #6 → #7 → #8 → #9 → #10 → #11 → #12 → #13 → #14 → #15 → #16 → #17 and this release package. Pin the exact final Git SHA and immutable Docker image digest. A green cumulative descendant branch is not a substitute for reviewing older PRs, Data Dictionary conflicts or true merge order.
2. **Approve Final Data Dictionary semantics before schema changes.** Verify the account, role, audit and notification policies against the controlling Data Dictionary. Required `MaintenanceRecord.ProjectID` and `ManagingEngineerID` and their RESTRICT foreign keys cannot be relaxed. Projects with dependent records cannot be deleted; ManagingEngineer unassignment to NULL is prohibited. Distinct quarterly uniqueness and durable file deletion require separate authorization.
3. **Secure actual recovery separately for DB and Storage.** DBA inspects official Supabase backup/PITR availability and retention, records RPO/RTO, demonstrates restore into an independently authorized isolated destination and verifies credentials/function/trigger/role recovery. Supabase physical/daily backups **do not include Storage object bytes**, only database metadata; custom PostgreSQL role passwords may need reset after restoration. Prepare an independent private-object recovery/reconciliation plan. Reference: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [restore to a new project](https://supabase.com/docs/guides/platform/clone-project). A restoration to the existing project replaces current DB state and is not a safe casual rollback.
4. **Create verified persistent staging**, with PostgreSQL 17, production-like restricted backend LOGIN (not owner/BYPASSRLS), explicit per-table/sequence/function grants and RLS policies, private test-only Storage buckets, HTTPS RP origin, SMTP test sender and provider key isolation. Tests must include actual application HTTP requests under those restricted grants and public Data API denial. Never copy `staging_backend_*` permissive policies directly to production.
5. **Rehearse only the reviewed forward schema migrations.** Two security support proposals:
   `database/proposals/canonical_account_provisioning.sql` and `database/proposals/audit_notification_recipients.sql`, applied in owner-reviewed transactional order, without dropping official `jairoads_dd_auditlog_*` triggers or backfilling guessed account history. `restricted_runtime_grants_REVIEW_ONLY.sql` is **incomplete**, not a production role setup. The DBA must author/approve the complete role inventory and transaction boundary.
6. **Rehearse only separately approved Final-DD-compatible schema changes.** Review `database/proposals/create_file_deletions.php` and `database/proposals/quarterly_record_uniqueness.sql` independently against live data and schema-owner approval. **DO NOT activate `database/proposals/preserve_project_history.php`, introduce record-detachment contexts, or relax the NOT NULL requirements of `maintenance_records.project_id` and `managing_engineer_id`.** Keep RESTRICT FKs and immutable audit history. These proposals are outside default Laravel migrations; never run `php artisan migrate --force` blindly.
7. **Verify real existing canonical accounts privately.** An authorized reviewer confirms which real unclaimed active Engineer belongs to the existing Admin, and separately validates the Engineer account and LGU assignment. Attach only the verified profile; record an actual `reviewed_transition` with a new real review reference **at review time**. Do not fabricate an Engineer, historical administrator, past provisioning time or second SuperAdmin. Demonstrate actual SuperAdmin operator login/password reset/MFA/passkey recovery without disclosing secrets in GitHub.
8. **Repeat isolated end-to-end testing and real human UAT.** Include account permissions, private file deletion/recovery, backup, quarterly concurrency, rejection of project deletion with children, confirmed deletion of empty projects, direct eligible ManagingEngineer reassignment without NULL, audit/notifications, revoked sessions, mobile UI and map fallback. Verify all high-severity findings on the exact reviewed candidate SHA.
9. **Owner records formal deployment authorization.** Change ticket, DBA/schema owner, Data Dictionary owner, actual user representative, backup/restore reviewer, deployment/on-call team, approved maintenance window, rollback/forward recovery, exact build image digest, private SSL/pooler credentials, and a written no-go condition. The release gate's field validation is **not evidence of actual human signature verification**.
10. **Only then perform the approved official rollout.** Coordinate maintenance/write freeze as needed, reconfirm no new live duplicates/active account conflicts, independently verify production DB identity, take tested backup and Storage recovery checkpoints, run an owner-authored approved forward schema plan, verify private grants/RLS, transition only actually reviewed accounts, then deploy the exact accepted build with its approved runtime LOGIN. Never switch to strict login before the real identities and schema are ready. Avoid any undocumented interim permission broadening.
11. **Post-deployment smoke before reopening traffic.** As the REAL non-owner runtime/role and authorized synthetic test users (where permitted), verify HTTPS health, SuperAdmin recovery, Admin/Engineer/Viewer role matrix, rejected guest/Viewer/other-LGU writes, one authorized business mutation with exactly one immutable AuditLog event and N eligible deduplicated deliveries, quarterly insert collision, retained history, private exact-file upload/download/deletion retry, SMTP reset delivery, signed WebAuthn origin, map routing fallback, and no public exposure of private schemas/keys. Recheck existing AuditLog trigger identities/behavior; do not mutate historical events as a test.
12. **Observe, gate, and recover.** Assign on-call owner, log permitted request IDs without secrets, watch auth/403/500/503, DB privilege/RLS failures, file-deletion pending backlog, notification/duplicate events, mail errors, Storage reconciliation, and PG resource/lock behavior. If critical checks fail: halt writes/traffic and roll the application back to the compatible approved image **only if schema compatibility has been established**; use a separate owner-authored **forward repair** for append-only DB changes. A PITR restore to a new project can be used to inspect history, but a restore over the official DB can discard later legitimate mutations and Storage bytes are a separate matter. Never DROP audit/provenance/history, delete retained data or claim the DB schema can be automatically reversed.

## Explicit current NO GO / approval ledger

| Required approval/gate | Current status |
|---|---|
| Real Data Dictionary approval | NOT RECEIVED |
| Security/optional SQL, API/RLS and complete app role | NOT RECEIVED |
| Real Admin–Engineer person/profile match | NOT VERIFIED |
| Real SuperAdmin access/recovery | NOT VERIFIED |
| Isolated persistent staging (real services) | NOT VERIFIED |
| 25 actual human UAT cases | NOT RUN |
| 13 human review approvals | NOT APPROVED |
| Independent real DB + Storage backup/recovery | NOT VERIFIED |
| Actual approved Docker image digest / release SHA | NOT APPROVED |
| Authorized change window, deployment and on-call | NOT APPROVED |

**Result:** this runbook can be signed and executed later by actual owners after prerequisites pass. In this PR, NO application deployment, official schema modification, account transition, role/grant mutation, Storage operation, production restore, branch merge or release authorization is performed.

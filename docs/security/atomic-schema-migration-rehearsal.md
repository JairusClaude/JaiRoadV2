# Task 6 — atomic security-schema migration and rollback rehearsal

**Status:** disposable PostgreSQL 17 test implementation; **not** approval to migrate official Supabase. This branch is stacked on [PR #10](https://github.com/JairusClaude/JaiRoadV2/pull/10), which in turn stacks on the security and staging draft PRs.

## Confirmed official-state prerequisites (point-in-time, no writes)

The official JaiROADS project is `aeaaxwyytsagbacysvvx`, schema `jairoads_next`. The two security support tables—`jairoads_security.account_provisioning` and `jairoads_next.audit_notification_recipients`—were missing at the last live read-only inspection; the real database already protects `jairoads_next.audit_logs` with UPDATE/DELETE and TRUNCATE triggers. The example restricted PostgreSQL role in these proposals is **not a deployed runtime role**. The ordinary Admin account also needs identity-safe Engineer linkage and reviewed transition evidence.

This rehearsal **does not** migrate the official project, validate the actual SuperAdmin's recovery credentials, edit live accounts, create a real DB role, or access live Storage.

## New automated tests

`tests/Staging/rehearse-atomic-migrations.sh` runs only on a GitHub-hosted runner with strict `APP_ENV=testing`, local `127.0.0.1` PostgreSQL 17, exact disposable database name and `JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY`. The existing stage setup creates the dummy NOLOGIN, non-owner, NOBYPASSRLS `jairoads_app_runtime` role and fake `anon`, `authenticated` and `service_role`. An **additional fresh** database, `jairoads_scratch_staging_atomic`, contains frozen canonical-schema fixtures and synthetic identity records only.

The test exercises the original SQL proposals, without running them against a hosted service:

1. **DDL failover:** execute both reviewed auxiliary-table proposals inside one PostgreSQL transaction, then deliberately raise `division by zero` **after** both files have succeeded. The command must fail for that precise reason. Verify both new tables/schema are absent, all three fake accounts and the existing AuditLog event are intact, and the two simulated original AuditLog triggers remain active.
2. **Recovery/retry:** execute both proposals again in a new successful *single transaction*. Apply the separate review-only auxiliary grants and narrow synthetic source/audit policies for the non-owner backend role. These grants apply only to this one local scratch DB and are not a production RLS design.
3. **Business atomicity failure:** as the non-owner backend role, insert a new AuditLog event and its first delivery, then deliberately violate unique `(audit_log_id,recipient_user_id)`. The transaction must abort for the expected uniqueness error. Verify no event or recipient delivery persisted.
4. **Business atomicity success:** in one transaction, as the restricted backend role, insert one synthetic Admin provisioning evidence record, one canonical business AuditLog event and three distinct notification deliveries. Validate that RLS remains active on all three new/related tables, exactly one event is written and exactly three recipients appear.
5. **Data integrity:** as the disposable owner, independently verify duplicate-recipient and foreign-key constraints, append-only UPDATE/DELETE/TRUNCATE guards, unchanged canonical history and lack of new Data API read/write grants.

The `staging / auxiliary schema + restricted RLS` GitHub workflow runs this new scenario alongside its existing clean/audit-protected schema cases. The separate Laravel runtime, SuperAdmin recovery and standard composer CI jobs remain unchanged.

## Acceptance criteria

- [ ] All three staging jobs pass on the **exact new commit**, and `composer ci:check` passes when PR opens.
- [ ] The deliberate SQL failures are confirmed by the **expected** error messages, not by a missing fixture or missing permission.
- [ ] Existing canonical AuditLog triggers and historical rows survive abort and retry; no duplicate triggers.
- [ ] No event or delivery survives a failed transaction; exactly one event plus three unique notifications persists on successful restricted-role write.
- [ ] Database role has no owner/BYPASSRLS privileges; audit/provenance/delivery remain append-only.
- [ ] Owner reviews **actual** application role privileges, SSL/pooler credentials, RLS, schema/API exposure, backup and forward-only recovery before shared activation.
- [ ] Data Dictionary owner signs off on stricter ordinary account eligibility and multi-recipient notification design.
- [ ] Existing SuperAdmin authenticates under an operator-controlled procedure and ordinary account transition evidence is independently reviewed.
- [ ] Run a later **persistent isolated staging** rehearsal with private Storage and real application role credentials before approving a live change.

## Shared rollout restrictions

Do not use `migrate --force`, `composer setup`, this test fixture, the example `staging_*` RLS policies, or the PostgreSQL owner session to apply changes to official Supabase. The proposed security tables are still under `database/proposals/`, outside automatic Laravel migration discovery. The owner must choose and record the forward migration, backup/recovery, permission policy and controlled code rollout order. **Never fabricate historical provisioning, create a placeholder Engineer, disable the existing immutable AuditLog triggers, or delete historical audit entries as rollback.**

This exercise verifies *transactional behavior on disposable PostgreSQL*, not full operating-environment readiness or approval to merge/deploy.

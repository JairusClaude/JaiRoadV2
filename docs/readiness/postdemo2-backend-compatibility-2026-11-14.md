# JaiROADS — Backend/database compatibility and isolated-staging readiness

**Prepared:** 2026-11-14 (Asia/Manila)  
**Status:** REVIEW ONLY — **LIVE DEPLOYMENT NO GO**  
**GitHub source:** `PostDemo2Update--AuditLogModifications`, commit `830dac2576adc20a02e956723f278f54337e883f` (confirmed unchanged at review)  
**Official Supabase project:** `aeaaxwyytsagbacysvvx` (PostgreSQL 17.6, healthy at review)  
**Review method:** GitHub source inspection and read-only SQL catalog/aggregate queries against connected Supabase. **No live SQL writes, migrations, grants, account changes, Storage actions, Render deploys, or PR merges.**

## 1. Decision summary

The latest post-demo backend is extensively implemented and has previously passed synthetic/disposable CI, but the official database is **not compatible with a safe cutover today**. The canonical 11-table data model exists and required MaintenanceRecord relationships are intact. However, the support schema/tables used by strict identity, notification delivery, file deletion and monitoring are absent; a dedicated non-owner/non-BYPASSRLS Laravel runtime login is also absent. Do **not** point a new strict-auth application deployment at the current official database as a shortcut to a demonstration.

This document is an inspection and staging handoff, **not a migration plan approved for execution**. For browser demonstration, create an **independent Render staging service** backed by an **independent PostgreSQL 17 staging database** with synthetic accounts, approved compatibility schema and restricted credentials. Do not reuse official Supabase credentials, accounts, Storage objects or the existing live Render service.

## 2. Live read-only compatibility inventory

| Dependency / constraint | Verified 2026-11-14 observation | Consequence / next review |
|---|---|---|
| Canonical Final-DD business tables | All **11** exist in `jairoads_next`: `lgus`, `engineers`, `engineer_lgus`, `user_accounts`, `road_coverages`, `maintenance_projects`, `maintenance_records`, `monthly_updates`, `maintenance_documents`, `media`, `audit_logs` | Preserve names, exact DD relationships and data. |
| Fortify login bridge | `public.users` exists; RLS enabled | Presence alone does not validate all individual bridges or allow a non-owner application role. |
| MaintenanceRecord.ProjectID / ManagingEngineerID | Both `project_id` and `managing_engineer_id` are **NOT NULL**. FKs point to canonical parents with **ON DELETE RESTRICT**; `created_by` FK is also RESTRICT | **PASS. Do not detach records, NULL managers or use historical `preserve_project_history.php`.** |
| Canonical AuditLog immutability | Both `jairoads_dd_auditlog_reject_changes` and `jairoads_dd_auditlog_reject_truncate` triggers enabled | **PASS for trigger presence;** behavior/owner privileges still require isolated testing. Never replace/drop the official triggers casually. |
| Canonical RLS | RLS enabled on all 11 canonical tables; **zero policies** on those tables at inspection | No verified restricted runtime access. RLS-on is not proof the Laravel service will work; owner/bypass execution can conceal missing policies. |
| Standard Supabase API roles | `anon`, `authenticated`, and `service_role` have no `jairoads_next` schema usage and no direct SELECT/INSERT/UPDATE/DELETE table privileges across the 11 tables | Promising private surface; confirm actual exposed schema configuration and inherited grants separately. Never grant browser roles access to resolve Laravel failures. |
| Dedicated Laravel runtime | `jairoads_app_runtime` LOGIN absent | **BLOCKER.** Owner must design explicit table, sequence, function, schema grants and narrowly scoped RLS for the actual runtime (no owner, SUPERUSER, BYPASSRLS). |
| Private security schema | `jairoads_security` absent | **BLOCKER** for provenance and authentication monitoring; proposed bootstrap creates it only after review. |
| Immutable account evidence | `jairoads_security.account_provisioning` absent | **BLOCKER** for ordinary-account eligibility/provisioning under strict resolver; original SuperAdmin bootstrap is a distinct guarded path. |
| Notification deliveries | `jairoads_next.audit_notification_recipients` absent | **BLOCKER** for audit-backed business writes that must atomically deliver eligible notifications. |
| Authentication monitoring | `jairoads_security.authentication_events` and `jairoads_security.active_sessions` absent | Monitoring/presence UI cannot show genuine collected data; optional collection is best-effort and should report unavailable, not zero. |
| File deletion intents | `jairoads_next.file_deletions` absent | **BLOCKER** for durable permanent-file deletion; private Storage recovery must be proven separately. |
| Quarterly period database uniqueness | No unique index found covering `(project_id, maintenance_year, quarter)`; **zero duplicate groups** observed read-only at inspection | Review uniqueness as a separate schema-owner/DD decision; zero duplicates today does not approve the proposed DDL or ensure future concurrency safety. |
| Historical detachment support | `jairoads_next.maintenance_record_contexts` absent | **Correct** for strict Final DD; it must **not** be introduced as a release requirement. |
| Aggregated canonical accounts | 7 accounts: 2 SuperAdmin, 1 Admin, 2 Engineer, 2 Viewer; 1 active Admin currently lacks EngineerID | Ownership and identity **not verified**. Do not infer a person/profile match, deactivate either SuperAdmin, fabricate an Engineer, or backfill provenance based on counts. |

**Inspection limits:** Catalog privilege tests do not impersonate a working non-owner Laravel connection, prove policy behavior, validate private object recovery, verify Render environment variables, prove authentic human identities, or constitute legal/operational authorization. No personal identifiers, passwords, hashes, tokens or Storage paths were queried or published in this report.

## 3. Source-code dependency map

| Source | Expected dependency / risk |
|---|---|
| `app/Services/AccountIdentityResolver.php` | Strict ordinary-account eligibility requires matching Fortify/canonical identity, valid current role/status/profile and immutable provenance when available. Without the evidence table, only guarded SuperAdmin eligibility remains. Existing unlinked Admins require independently reviewed evidence; unlinked Viewers are allowed only with valid provenance. |
| `app/Http/Controllers/CanonicalAccountProvisioningController.php` | The post-demo branch creates a new Active Engineer profile atomically for **new Admin/Engineer** accounts, forbids client-supplied EngineerID and requires `AccountProvisioning::available()`. Viewer creation can have no Engineer profile. This differs from some older acceptance text and requires DD-owner confirmation of the revised provisioning UX/policy. |
| `database/proposals/canonical_account_provisioning.sql` | Review-only private provenance table, immutable evidence, restricted table/sequence/function access. Creates the private schema; **not** an automatic migration. No fake historical rows. |
| `database/proposals/audit_notification_recipients.sql` | Review-only append-only deduplicated delivery table; preserves current AuditLog triggers. Authorize after provenance/runtime planning. |
| `database/proposals/security_monitoring.sql`; `docs/audit/security-monitoring.md` | Review-only authentication history/presence tables and functions. Event history append-only; presence state mutable under restricted server-side controls. Monitoring must never leak credentials or become a login prerequisite. |
| `database/proposals/create_file_deletions.php` | Review-only durable intent table; requires approval, actual private-object deletion/reconciliation evidence and no automatic history destruction. |
| `database/proposals/quarterly_record_uniqueness.sql` | Proposes a unique period identity; preserve NOT NULL / RESTRICT and independently approve the business rule. |
| `docs/qa/system-role-acceptance-plan-2026-11-07.md` | **Needs correction before use:** QA-04 still claims every Viewer needs an Engineer link, QA-12 refers to nullable project history, and QA-15 describes a detached project history workflow. Align the acceptance document with strict Final DD and the reviewed post-demo account policy; do not edit data to fit superseded tests. |

## 4. Isolated PostgreSQL 17 + Render staging plan (no automatic execution)

1. **Authorize a separate non-production target.** Staging owner creates a brand-new PostgreSQL 17 project/database and private Storage buckets with **synthetic** data only. Confirm project reference, database identity, roles and region in a private inventory. Do not point it at official project `aeaaxwyytsagbacysvvx` or copy human account credentials. Keep existing Render production web service unchanged.
2. **Freeze the source.** Use reviewed SHA `830dac2576adc20a02e956723f278f54337e883f` for the first staging candidate, then record any approved follow-up SHA. Do not use a floating branch tip as evidence of the deployed revision. Verify Docker build against that SHA.
3. **Prepare exact canonical baseline.** Populate 11 Final-DD entities, the Fortify `public.users` bridge, RESTRICT foreign keys, NOT NULL record relationships and immutable canonical AuditLog triggers in the **independent staging database**. Treat this as a fresh controlled staging fixture, not a production clone. Use synthetic SuperAdmin/Admin/Engineer/Viewer and LGU assignments; never create a second fake root in the official DB.
4. **Owner-review each support proposal and activation order.** In isolated staging only, independently validate and apply the canonical provenance proposal (creates `jairoads_security`), audit notification recipients, security monitoring, file-deletion intent and separately approved quarterly uniqueness. Decide whether each is required for the specific demo. Do not introduce `maintenance_record_contexts` or enable nullable project/manager history. Record transaction boundaries, permissions, schema versions and failures.
5. **Create and test a true restricted server login.** DBA defines a non-owner, non-BYPASSRLS, non-superuser LOGIN with complete minimal privileges over actual canonical tables, Fortify infrastructure, sequences, private security tables and required functions; use RLS policies for server operations, with no broad client/Data API grants. Test both allowed and forbidden SQL and real Laravel HTTP operations using this exact role. Verify role membership/inheritance and API schema exposure.
6. **Set up a *separate* Render staging Web Service, Docker runtime.** Choose the approved source branch/SHA; configure a staging-only valid APP_KEY and APP_URL (HTTPS staging URL), DB_CONNECTION=pgsql, staging DB connection/SSL, APP_ENV appropriate for staging, APP_DEBUG=false and staging-only mail/Storage providers. Keep secrets in Render environment variables; never post them to PR or chat. The entrypoint validates config and **must not** auto-migrate/seed. Confirm session driver works across service instances (database/shared storage preferred when applicable).
7. **Smoke exact UI and backend workflows** using the four synthetic roles: login/recovery and last-root guard; ordinary account provisioning including Admin/Engineer generated profile and optional Viewer link; LGU/Engineer assignment scope; RoadCoverage map/geometry and road-to-project creation; quarterly uniqueness, ManagingEngineer assignment/reassignment, monthly updates, documents/media and exact-object Storage retrieval/deletion/retry; single append-only business audit and one eligible notification per recipient; authentication monitoring present/unavailable states; unauthorized direct requests.
8. **Validate real integration boundaries.** Exercise private Storage buckets, actual staging SMTP delivery, HTTPS WebAuthn/passkey RP ID and device-recovery, routing/geocoding and mobile usability. Never claim a mocked provider is real integration acceptance. Save sanitized evidence with source SHA and test environment reference.
9. **Rehearse failure and recovery in staging.** Revoked sessions, DB privilege denials, audit/delivery rollback, two concurrent period writes, storage deletion reconciliation and recoverable database/Storage backups. Do not rollback by deleting append-only evidence or canonical history.
10. **Decide whether presentation or production.** A successful isolated Render preview is **not** production authorization. Require DD-owner signoff, legitimate existing identity review, both real SuperAdmin recovery checks, restricted DB/Storage permissions, approved release window and complete human UAT before any main-site cutover.

## 5. Release blockers / approval register

- [x] Read-only current schema and aggregate compatibility review, 2026-11-14.
- [x] Confirm exact review source SHA.
- [x] Preserve strict-DD mandatory MaintenanceRecord relationships and existing AuditLog trigger protections.
- [ ] DD-owner approval: existing-unlinked-Admin policy, generated Engineer UX, Viewer optional link, quarterly identity, file lifecycle.
- [ ] DBA approval of support proposals, restricted runtime grants/RLS and private Data API exposure.
- [ ] Verified non-owner PostgreSQL 17 staging runtime with synthetic identities.
- [ ] Independent staging Render service built and exercised at exact code SHA.
- [ ] Actual staging private Storage, SMTP, map provider and real HTTPS passkey/device validation.
- [ ] Private account ownership/recovery evidence for both live SuperAdmins and the active unlinked Admin.
- [ ] Database/PITR plus private Storage object recovery proof.
- [ ] Corrected 25-case human acceptance plan and signed owner approvals.
- [ ] Formal production change ticket, approved runtime credentials, image digest, on-call/rollback and release authorization.

**Stop conditions:** Do not merge or deploy against official Supabase if the real runtime still depends on database-owner/BYPASSRLS access; strict authentication lacks provenance; account ownership/recovery is unverified; AuditLog protection could be weakened; missing notifications cause transaction rollbacks; file deletion has no durable recovery; or the controlling Final Data Dictionary is contradicted.

**Overall:** Source is **review/test-ready**; official database/security/runtime integration is **NO GO**. This branch only adds this report, not implementation code or schema changes.

# JaiROADS — remote GitHub + hosted Supabase read-only follow-up (2026-11-14)

> **Status: REVIEW ONLY / PRODUCTION NO GO.** This is evidence captured from the official **hosted** Supabase project and the exact GitHub review branch; it is **not** a production deployment approval or instruction to backfill historical identity data. The original implementation and handoff remain in [pending acceptance](pending-acceptance-and-hosted-handoff-2026-11-14.md) and [backend compatibility](postdemo2-backend-compatibility-2026-11-14.md).

## Scope and safeguards

- Repository: `JairusClaude/JaiRoadV2`; inspected branch `review/postdemo2-remaining-gates-2026-11-14`; source HEAD before this evidence commit: `b0d755603ae46b716e50ce2ff8ce19885c56fabd`.
- Official Supabase project: `aeaaxwyytsagbacysvvx`, PostgreSQL 17.6, `jairoads_next` canonical business schema; private support schema `jairoads_security`; Fortify infrastructure in `public`.
- Evidence method: connected GitHub metadata/file reads, Supabase project/schema/advisor reads and **`BEGIN READ ONLY` catalog/aggregate SQL**. No local file changes, live DML/DDL, credentials, private row contents, object paths, account repairs, or Render changes were used.
- This file preserves a point-in-time snapshot. Counts may change after inspection. Only designated human owners can attest identity/recovery and sign release gates.

## Independently observed hosted facts

| Check | Observed 2026-11-14 | Interpretation |
|---|---|---|
| Official project | `ACTIVE_HEALTHY`; PostgreSQL 17.6 | A healthy database is not an accepted Laravel deployment |
| Canonical business schema | All 11 Final-DD tables present, RLS on | Do not create duplicate tables or switch to `public` for canonical business data |
| Auxiliary support | `jairoads_security.account_provisioning`, `authentication_events`, `active_sessions`; `jairoads_next.audit_notification_recipients`, `file_deletions` present with RLS | Six hosted migrations already applied; archive under `database/hosted-migration-history` is **not replayable** |
| Relationships | 18 canonical foreign keys; project/manager mandatory, RESTRICT; monthly reports/documents attached to maintenance records; project road coverage UNIQUE | No nullable/detached records and no FK cascade workaround |
| Quarter uniqueness | `maintenance_records_project_year_quarter_unique` present; 0 duplicate groups | Uniqueness constraint is installed |
| Audit immutability | Both `jairoads_dd_auditlog_reject_changes` and `jairoads_dd_auditlog_reject_truncate` active | Do not replace AuditLog history with telemetry |
| Canonical AuditLog | **119 rows** at this inspection (prior snapshot documented 111) | Counts are dynamic; not evidence of a defect or a production write from this audit |
| Accounts | 7 active: 2 SuperAdmin, 1 Admin, 2 Engineer, 2 Viewer | Real ownership and login/recovery remain unverified |
| Unlinked Admin | 1 active Admin with `engineer_id IS NULL` | Review the real owner and permitted transition; never fabricate a profile |
| Fortify bridge | `public.users`: 6 linked rows; canonical anti-join finds **1 Viewer without a `public.users` bridge** | A login bridge is absent; investigate real owner before any authorized creation |
| Provisioning evidence | `jairoads_security.account_provisioning`: **0 rows** | No ordinary historical account has approved immutable evidence yet |
| Auxiliary operational rows | 0 notification deliveries, 0 authentication events, 0 active sessions, 0 file-deletion intents | Table presence does not prove capture, delivery, or deletion work |
| Restricted database role | `jairoads_app_runtime`: LOGIN=true, SUPERUSER=false, BYPASSRLS=false; schema USAGE and scoped table grants present | Previous owner-run direct TLS LOGIN/SELECT passed; **Laravel HTTP/business-write/RLS tests remain unverified** |
| Browser API roles | `anon` and `authenticated` lack `jairoads_next` and `jairoads_security` schema USAGE; `anon` lacks direct SELECT for inspected support tables | Do not grant browser access to resolve server-Laravel failures |
| Staging project | Only the official Supabase project appeared in connected project list | Persistent independent Supabase staging is not yet evidenced |
| Supabase security advisor | 14 INFO `rls_enabled_no_policy` findings in **legacy `public`** business tables | Triage intentionally unused legacy tables separately; do not indiscriminately create allow-all policies |
| Supabase performance advisor | 32 INFO unindexed-foreign-key findings project-wide; 11 unused-index findings | Review actual query plans/index cost first; do not create/drop indexes solely by count |

### Strict ordinary-account eligibility consequence

`app/Services/AccountIdentityResolver.php` uses `AccountProvisioning` evidence to authorize non-SuperAdmin canonical logins when the support table is available. Since that table has **zero evidence rows**, existing Admin/Engineer/Viewer identities are not eligible under this strict resolver if the reviewed branch is deployed against the current hosted database. The existing Admin with no Engineer link additionally requires real reviewed-transition evidence. A Viewer also lacks a Fortify bridge. These are operational/account-transition blockers, **not** permission to generate false provenance or infer ownership. Test only in independently authorized staging, with private owner review and retained immutable history.

### GitHub review and test status

- [PR #23](https://github.com/JairusClaude/JaiRoadV2/pull/23) and stacked [PR #24](https://github.com/JairusClaude/JaiRoadV2/pull/24) were **open drafts** when inspected. Review/approval order is #23 then #24. Do not merge automatically.
- [Full system verification run 43588649370](https://github.com/JairusClaude/JaiRoadV2/actions/runs/43588649370) reported 17 successful jobs at the inspected SHA, including browser, PostgreSQL, Laravel, lint/type/build, dependency audits, Docker and release fail-closed tests.
- [Disposable staging rehearsal 43588649325](https://github.com/JairusClaude/JaiRoadV2/actions/runs/43588649325) and [tests 43588649345](https://github.com/JairusClaude/JaiRoadV2/actions/runs/43588649345) were also successful. These are synthetic checks, **not** acceptance of live Render, real object recovery, owner account possession, or real human UAT.

## Prioritized remaining gates (no implied authorization)

1. **P0 — Identity provenance:** Verify real Admin, Engineer and Viewer owners and Fortify bridge mapping; resolve the unlinked Admin and missing Viewer bridge by *authorized*, auditable transitions only. Verify both real SuperAdmin recovery channels. Do **not** create historical evidence blindly.
2. **P0 — Independent staging:** Provision separate PostgreSQL 17/Supabase staging and private test Storage with synthetic four-role users. A connected production project is not a staging substitute. Configure separate Render staging with secure HTTPS env/role settings; never expose passwords/APP_KEY/service keys.
3. **P0 — End-to-end DB/RLS:** Against that staging target, test authenticated Laravel operations as actual `jairoads_app_runtime`, including denied Viewer/guest/other-LGU writes, schema-qualified canonical access, queue/session/sequence grants, failed transaction rollback, and notification delivery.
4. **P0 — Real restore and integrations:** Rehearse independent database and exact private Storage object recovery; real SMTP/password resets, HTTPS passkey/MFA recovery, map-provider terms/rate limits/fallback. Leave `JAIROADS_PERMANENT_FILE_DELETION_ENABLED=false` pending owner-reviewed recovery and isolated tests.
5. **P0 — Release governance:** Complete QA-01–QA-25 with genuine tester evidence and all 13 approvals, retest high-severity defects, review stacked PRs and exact final SHA; do not mark the blank template passed.
6. **P1 — Performance/security review:** Benchmark actual read paths and inspect `unindexed_foreign_keys` recommendations; triage historic `public` policy notices without widening access. Confirm Render points to restricted database credentials **only after** staging acceptance.
7. **P1 — Product decisions:** Obtain explicit decisions for historical RoadCoverage municipality transfers, edit cutoff/timezone for earlier MonthlyUpdates, upload MIME/size limits, Engineer handover/retirement/restoration, and newer profile/notification amendments. Preserve the Final DD; do not invent schema columns or permissions.

**No database, application code, account data, Storage object, Render setting, production branch, or PR state was changed by this audit.** This document is a GitHub-only evidence handoff and does not replace the independently required operator tests.

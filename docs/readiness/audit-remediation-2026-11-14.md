# JaiROADS — audit remediation branch and release blocker register

**Date:** 2026-11-14 (Asia/Manila). **Branch:** `fix/final-dd-audit-remediation-2026-11-14`. **Base SHA:** `3c7e74ae0613b41bca32b0d5d62298452746278c` (draft PR #26).
**Status:** SOURCE REMEDIATION IN REVIEW. **PRODUCTION RELEASE: NO GO.**

This is a new follow-on branch, not a claim that production Supabase, Render, email, private Storage, real human UAT or account ownership was changed.

## Source fixes delivered in this branch

1. **Canonical MonthlyUpdate/Media emergency stop switch:** `JAIROADS_DD_MONTHLY_WRITES_ENABLED=false` prevents POST/PUT operations at both `/dd-phase3/ops` and `/dd-phase3/ui`, denies edit/create forms, and hides write controls while preserving read pages. The old `JAIROADS_MONTHLY_UPDATES_WRITES_ENABLED` was limited to the separate legacy preview. New switch defaults OFF on hosted/non-testing environments and may be enabled explicitly only after staging isolation and authorization; disposable APP_ENV=testing fixtures remain enabled. A regression test verifies no report, media or audit writes with the switch off.
2. **Private upload validation:** require an allowed document filename extension and enforce a 255-byte original filename bound for both documents and monthly media before any Storage API call. This complements MIME validation and prevents upload-then-fail behavior.
3. **Strict integration configuration preflight:** `php artisan jairoads:integration-readiness --strict` returns a failing status for unconfigured mail/Storage/passkeys/maps; its default report remains informational.
4. **Restricted database login preflight:** `php artisan jairoads:runtime-db-preflight` runs only catalog/privilege reads within a read-only transaction. It fails for BYPASSRLS/superuser/create-role/create-db logins and missing canonical/Fortify/provisioning SELECT access. It returns only booleans; it does not grant permissions, change a role, inspect users or approve a release.
5. **Historical document reconciliation:** `database/preflight/legacy_document_reconciliation_readonly.sql` distinguishes canonical objects, legacy-only objects and genuine unreferenced objects; does not print private paths or mutate Storage/SQL.
6. **Release/documentation reconciliation:** distinguishes the new November 14 Render review deployment from the old conformance report written before the deployment.

## Remaining 19-audit-findings disposition

| Finding | State on this branch | Real resolution required |
|---|---|---|
| A01 shared official Supabase review DB | **UNRESOLVED (OPERATOR)** | Separate, cost/organization-approved Supabase staging project, synthetic records and private buckets; then reconfigure review Render |
| A02 elevated `postgres` role | **PREVENTION TOOL ADDED, NOT SWITCHED** | Issue restricted DB password privately, test grants and Laravel 4-role flows; change Render env only after staging verification |
| A03 previously disclosed credentials | **UNRESOLVED (OPERATOR)** | Rotate/revoke via Supabase and update both relevant services, without sharing values |
| A04 five ordinary accounts lack immutable provenance | **UNRESOLVED (IDENTITY REVIEW)** | Real ownership evidence, approved reviewed transitions; never fabricate evidence or bypass resolver |
| A05 missing Viewer Fortify bridge, Admin without Engineer, one dual link | **UNRESOLVED (IDENTITY REVIEW)** | Verified human ownership and approved non-destructive corrections |
| A06 APP_KEY/MFA/passkey compatibility | **UNRESOLVED (DEVICE UAT)** | Verify genuine recovery under correct key/origin; do not blindly replace app keys |
| A07 email transport `array` | **STRICT PREFLIGHT ADDED, SMTP STILL UNCONFIGURED** | Provider credentials, sender validation, live reset delivery/replay testing |
| A08 private file and database recovery | **UNRESOLVED (RECOVERY)** | Independent real backup/restore with exact bytes |
| A09 25 human tests and 13 release gates | **UNRESOLVED (HUMAN SIGNOFF)** | Execute scenarios and capture authentic private evidence |
| A10 `public`/canonical split | **GUARDED; HISTORIC CLEANUP UNAPPROVED** | Keep fail-closed legacy paths; inventory and approve row-by-row migration, never delete on sight |
| A11 inconsistent monthly write flags and legacy schema | **CANONICAL WRITE SWITCH FIXED; LEGACY PREVIEW STILL DISABLED** | Retire or reconcile legacy preview routes after owner acceptance |
| A12 old DOCX only in `public` metadata | **READ-ONLY RECONCILIATION ADDED** | Confirm ownership/retention; do not move or delete without evidence |
| A13 84 historical LOGIN action audit rows | **RETAINED INTENTIONALLY** | Adopt historical compatibility rule; never change immutable history |
| A14 no recipient on two PDF CREATE audits | **UNRESOLVED; INTENTIONAL FAIL-CLOSED** | Real account provenance first, then an eligible single-recipient notification UAT |
| A15 Engineer.ContactNo nullable | **PENDING DD OWNER DECISION** | Resolve conflicting source rules and stage `NOT NULL` only after approval |
| A16 legacy CRUD 503 | **INTENTIONALLY FAIL CLOSED** | Remove entrypoints after legacy navigation and role acceptance |
| A17 file sessions/cache/sync queue | **UNRESOLVED (OPERATIONS)** | Approved persistent provider and tested deployment/session semantics |
| A18 public OSRM/Photon default providers | **UNRESOLVED (PROVIDER/UX)** | Terms, load, privacy, fallback and real older-user mobile tests |
| A19 deployment status stale in earlier report | **DOCUMENTED HERE** | Keep previous report historically accurate; maintain this newer inventory |

## Release checks

On an **isolated staging environment only**, using approved secrets, execute:

```powershell
php artisan jairoads:integration-readiness --strict
php artisan jairoads:runtime-db-preflight
php artisan jairoads:canonical-access-preflight --summary
```

Do **not** treat a successful check as a substitute for 25 human UAT scenarios, 13 approvals, private backups, Storage recovery, MFA and mail delivery. Never run destructive migrations/seeders or modify existing identity evidence without explicit signed approval.

**Render review (created after the prior conformance report):** `jairoads-dd-review-20261114` at `https://jairoads-dd-review-20261114.onrender.com`; it points to official Supabase and should be treated as a *non-isolated review instance*, not accepted staging. The original JaiRoadV2 Render service was not changed by this remediation PR.


### 2026-11-14 additional code and acceptance gates

- New source-level regression tests exercise actual canonical document/media HTTP upload paths against **fake private Storage**, including canonical `maintenance_documents` versus `media` linkage, MIME, AuditLog and Viewer/Engineer denial. These tests never upload to official buckets; live UAT remains pending.
- The strict integration configuration checker now treats the shared public OSRM/Photon demonstration endpoints as *not accepted production provider choices*. Neither a custom HTTPS URL nor this boolean proves contractual availability or real routing acceptance.
- The release manifest/checker require nonempty, privately retained operator references for official-credential rotation, isolated runtime preflights, media UAT, historical DOCX reconciliation decision, Engineer.ContactNo source-rule decision, recipient-only notification acceptance, and persistent sessions/queues. Templates remain blank and production release remains NO GO.


### Production-safe MonthlyUpdate default (2026-11-14)

The canonical MonthlyUpdate/Media switch now **defaults OFF outside `APP_ENV=testing`**. Use `JAIROADS_DD_MONTHLY_WRITES_ENABLED=true` only after authorized isolation, credential and role acceptance. The production-mode disposable Docker CI explicitly opts into writes against its own synthetic PostgreSQL to preserve integration coverage. The official shared-DB Render review service has not been updated or authorized for write testing.

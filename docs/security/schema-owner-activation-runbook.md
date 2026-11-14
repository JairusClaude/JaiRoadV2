# JaiROADS — Schema-owner approval and isolated rehearsal

**Status: review-ready proposal, not an approved or executed database migration.**
Date: 2026-11-07 (Asia/Manila). Intended source: the latest combined security branch and a separate proposed amendment to the [JaiROADS_DataDictionary](https://docs.google.com/document/d/1WeaLeaOTvxMMsjce0Ec50VNMz0_2Psf5soC-dmbVcbA/edit).

## Verified official-project facts (read-only, point-in-time)

Project reference `aeaaxwyytsagbacysvvx` is PostgreSQL **17.6**.
The following canonical dependencies exist: `jairoads_next.user_accounts`, `engineers`, `audit_logs`, and Fortify `public.users`. Canonical `user_accounts.engineer_id` has a UNIQUE constraint and an Engineer FK. `audit_logs.user_id` and `audit_logs.recipient_user_id` have UserAccount FKs. `public.users.dd_user_account_id` is unique and FK-linked to the canonical UserAccount.

At inspection time:
- `jairoads_security` / `account_provisioning`: **absent**.
- `jairoads_next.audit_notification_recipients`: **absent**.
- Named candidate role `jairoads_app_runtime`: **absent**; it is a **placeholder for owner review**, not a connection that has been configured.
- `audit_logs` has active `jairoads_dd_auditlog_reject_changes` (row UPDATE/DELETE) and `jairoads_dd_auditlog_reject_truncate` (TRUNCATE) triggers already. Preserve them.
- Existing canonical ordinary accounts need deliberate eligibility/provisioning review. The live account inventory is kept out of this public repository; rerun `php artisan jairoads:canonical-access-preflight` privately with an approved operator. Do not publish login identifiers or secrets.
- `public.rls_auto_enable()` is a SECURITY DEFINER **event-trigger callback** for enabled `ensure_rls` and has `PUBLIC:EXECUTE`. It matches Supabase's documented automatic RLS template. Do not disable it to silence a lint alert. In staging, independently verify whether revoking external EXECUTE preserves event-trigger operation and SQL DDL behavior.

The connected SQL inspection used the `postgres` role, with BYPASSRLS. Its success is **not** proof that restricted Laravel runtime access works.

## Owner's two-proposal reconciliation

1. `database/proposals/canonical_account_provisioning.sql` creates the private immutable evidence table and trigger, prohibits anonymous/authenticated/service-role access, and never guesses historical provisioning. It is *not* a Laravel migration.
2. `database/proposals/audit_notification_recipients.sql` creates linked deduplicated notifications, append-only protection for deliveries, and a guarded fallback protecting canonical AuditLog only when known existing protections are absent. Verify existing trigger functions' actual behavior; never DROP or disable the official triggers. The guarded fallback remains for the isolated test fixture.
3. `database/proposals/restricted_runtime_grants_REVIEW_ONLY.sql` is an **owner template**, not a complete application-role migration. It assumes a separately created reviewed restricted database role, and covers ONLY the two auxiliary tables. Existing Laravel operations also use `public.users`, canonical business tables and sequences; every required privilege/RLS policy must be mapped before switching credentials.
4. The Data Dictionary change request `docs/governance/dd-policy-alignment-review-2026-11-07.md` records the user-requested differences from the current canonical document. Obtain the Data Dictionary owner's signoff before treating that text as authoritative.

**Avoid separate unreviewed DDL:** Do not apply optional `file_deletions`, `maintenance_record_contexts`, nullable MaintenanceRecord relationships, period uniqueness, or teammate migrations as an implicit part of this two-table change.

## Rehearsal order (never use shared data as fixtures)

1. Obtain an authorized owner, backup/recovery plan and an isolated **PostgreSQL 17** database, using synthetic accounts only. Confirm DB identity with `SELECT current_database(), current_user, version();`.
2. Rehearse schema proposals in a transaction-safe staging migration process, logging migration names, reversible object creation and pre-existing trigger state. New tables need no data backfill.
3. Create/identify an appropriately restricted **database** runtime role (not Admin/SuperAdmin AccountType, not `anon`, not `authenticated`, not `service_role` and not the `postgres` owner). Give it server-side credentials securely. Review the FULL list of existing application tables, functions and sequences before activating least-privilege access. Only then adapt and rehearse the grant template.
4. Run `SELECT current_user`, `has_schema_privilege`, `has_table_privilege`, `has_sequence_privilege` and actual Laravel query/insert scenarios **as the restricted runtime role**. Assert that direct API roles cannot select or write the new tables. Confirm `jairoads_security` is not exposed by the Data API.
5. Verify the real SuperAdmin can log in through Fortify and exercise password, passkey, MFA/remember-me recovery with the approved operator procedure. Do not issue a second initial bootstrap when a canonical SuperAdmin already exists.
6. Privately run the read-only canonical-access preflight. For ordinary accounts with no Engineer profile, independently verify a real unclaimed active profile belonging to that person. Do not fabricate or share one. A designated actual administrator and owner must approve each `reviewed_transition` evidence row and its review reference; it records the review time, not original provisioning.
7. Only after verified evidence exists: test one new admin-provisioned Viewer/Engineer/Admin account each, unique Engineer mapping, 403/401 for revoked/legacy accounts, and exactly one account-event and eligible notification per recipient.
8. Test event atomicity: no-op/failure/rollback creates no successful event or delivery; document/media permanent removal retains durable pending reconciliation; privileged history is paginated and immutable.
9. Test actual AuditLog trigger behavior on a throwaway event inside an isolated rollback: UPDATE, DELETE, TRUNCATE denied; original triggers remain exactly once, and notification delivery table is also append-only.
10. Rehearse a **permission-only** restriction of `EXECUTE` on `public.rls_auto_enable()` in staging. Verify `ensure_rls` still automatically enables RLS on a **new disposable public table** and that the function is not browser-invocable. If the event trigger fails, do not copy the restriction to the official project.
11. Run the repository's full and focused CI on the code/schema revision, plus a smoke deployment using the **actual staging runtime role**. Get written UAT/schema-owner signoff before live rollout.

## Activation and rollback gates

**Stop** if any of these holds:
- The reviewed SuperAdmin cannot authenticate, or operator recovery is untested.
- An approved ordinary account lacks a legitimate active Engineer link, unique Fortify identity or administrator-reviewed evidence.
- The application runtime still depends on schema-owner/BYPASSRLS privileges or lacks table/sequence/function permissions under RLS.
- `jairoads_security` is publicly exposed or the new private tables have API grants.
- Existing immutable AuditLog triggers are removed/disabled or replaced without documented equivalence.
- Required notification writes fail, resulting in 503/rollback.
- Project/file-deletion proposal prerequisites are mistaken for deployed canonical schema.

If a rehearsal fails, discard/recreate **staging only**, fix the proposal and rerun. On the official database, never rollback by deleting historical audits, accounts, attached files or append-only provenance; coordinate an owner-authored recovery plan and preserve all data.

**Approval record (complete before shared execution):**
- Data Dictionary owner/reviewer: **pending**
- Schema owner and SQL/RLS review: **pending**
- Existing-account transition approvals: **pending**
- Restricted-role staging evidence: **pending**
- Tested backup and emergency recovery: **pending**
- Approval to change official Supabase database: **not given**
- Approval to merge/deploy security PR: **not given**

This file, the two SQL proposals and the grant template are review artifacts. Nothing here runs automatically on app startup, migration discovery or CI.

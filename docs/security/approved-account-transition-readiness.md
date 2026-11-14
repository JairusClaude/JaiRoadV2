# JaiROADS Task 7 — existing-account transition readiness (review-only)

> **2026-11-14 hosted delta:** Seven canonical accounts currently exist (2 SuperAdmin, 1 Admin, 2 Engineer, 2 Viewer). The five supporting tables and restricted runtime role are now installed. The role was privately enabled for password-based LOGIN and directly read 7 canonical UserAccounts. **Account-provisioning evidence remains empty (0 rows)** and the active Admin still has no EngineerID. This does **not** authorize linking profiles, fabricating review references or enabling strict Laravel login for ordinary accounts. The earlier 2026-11-07 aggregate inventory below is retained as historical evidence.

**Status:** Proposed and tested with synthetic accounts. **No official account, Engineer linkage, provisioning evidence, migration, grant, or data has been changed.** This is stacked after [PR #11](https://github.com/JairusClaude/JaiRoadV2/pull/11).

## Official live-state snapshot (read-only, 2026-11-07)

> **Newer 2026-11-09 read-only observation:** two active SuperAdmin records now exist, not one. This section remains a historical snapshot; verify the current ownership, provisioning and recovery for both records independently before approval. No account change is authorized by this observation.

Supabase project `aeaaxwyytsagbacysvvx`, schema `jairoads_next`:
- **1 active SuperAdmin** — existing Fortify/canonical identity link matches; EngineerID NULL is allowed for a genuine initial root. Login/MFA possession still requires a private operator check.
- **1 active Admin** — existing Fortify link matches, but **EngineerID is NULL**. The new ordinary-account rule denies login until a real, owner-verified active Engineer profile is linked and legitimate provisioning review evidence exists.
- **1 active Engineer** — existing link matches and has an Engineer profile; its account still needs approved immutable review evidence before strict access is activated.
- No Viewer currently shown in the live aggregate.
- `jairoads_security.account_provisioning` and `jairoads_next.audit_notification_recipients` were absent at the last official schema inspection. **Strict access depends on applying and approving those proposals separately.**
- An earlier live inventory showed one unclaimed active Engineer profile. **That is an availability count only, not proof that the profile belongs to the Admin.** Never attach on count, name similarity or a coincidental ID alone.

Do not put real emails, names, addresses, passwords, hashes, passkey credentials, review signatures, or the identity verification notes into a public GitHub comment or CI log. Store the authorized operator's private evidence in the approved access-controlled records system.

## Review-first procedure (authorization required for any live change)

1. **Freeze operational state** and obtain the Data Dictionary/schema-owner change approvals, application-role/RLS permissions, a usable SuperAdmin recovery route, and a tested backup/forward recovery plan. Do not enable stricter code against live ordinary accounts first.
2. Privately run the existing read-only command `php artisan jairoads:canonical-access-preflight --summary` with an approved operator connection. The new `--summary` variant returns aggregate role counts only. It runs its queries in a PostgreSQL `SET TRANSACTION READ ONLY` transaction. Detailed account ID/reason output (command without `--summary`) is **operator-only**.
3. Verify the **Admin** against the original HR/staff/appointment records, actual identity, Engineer profile and LGU scope. Confirm that the proposed Engineer profile is Active, unique and *unclaimed by any UserAccount*, including inactive ones. If identity cannot be independently established, **STOP**. Do not create a dummy Engineer or change the Admin's role to bypass authorization.
4. Verify the **Engineer** account's existing active linked profile, unique Fortify `dd_user_account_id`, case-insensitive matching email, identical password hashes, active canonical status, and assigned role. Inspect conflicts or stale records without modifying them.
5. Obtain a named actual approving SuperAdmin/Admin with working, eligible identity, a new independent change-ticket/review reference (8–500 characters), appropriate evidence and change window. `reviewed_transition` means review occurred **now**, not that the approver historically created the account. Do not backdate `provisioned_at` or fabricate an administrator.
6. On isolated staging only, rehearse the approved schema, runtime role, Admin linkage and **one** immutable `jairoads_security.account_provisioning` evidence row per approved ordinary account. Test denied access before evidence, permitted access afterwards, rejected duplicate/forged review, and unchanged canonical record/credential history. Application runtime only writes `method='administrator'` for **new** accounts; reviewed historical transitions are an explicitly authorized **database-owner procedure** under separate controls.
7. Re-run the **private** preflight and role-specific login tests, including password reset, passkey/MFA, notification recipients, last-root guard, and negative legacy/inactive cases. Audit logs must remain append-only.
8. **Only after explicit owner authorization**, schedule shared DB migration and legitimate account transitions, then deploy the exact reviewed application build and monitor. If any gate fails, postpone activation; never run automatic backfills, guessed credentials or fabricated review records.

## What this PR implements

- `app/Console/Commands/CanonicalAccessPreflight.php`: **additive `--summary` mode** with role-level counts and issue categories only. The existing detailed operator command is preserved. Both variants use PostgreSQL read-only transaction guards.
- `tests/Quarterly/ReviewedAccountTransitionTest.php`: synthetic Admin denied before real Engineer linkage and immutable `reviewed_transition`, then accepted; owner evidence rejected when missing, short, forged or duplicated; read-only preflight summary contains no account identifiers and causes no writes.
- `tests/Staging/rehearse-reviewed-transitions.sql`: on synthetic `jairoads_scratch_staging_existing`, a non-owner app role attempts `reviewed_transition` and is rejected by RLS; schema owner can insert one legitimate synthetic reviewed record with a review reference; duplicates are denied; retained business AuditLog unchanged.
- CI stages run independently on PostgreSQL 17 scratch databases with the explicit `DISPOSABLE_LOCAL_ONLY` safety gate. These are **not** executable migration or identity-repair scripts for the official project.

## Owner signoff / gates not automated

- [ ] Exact Admin-to-Engineer person/profile association approved from genuine private records.
- [ ] Existing Engineer/profile/bridge verified privately and conflicts resolved legitimately.
- [ ] Real approving administrator, review reference and evidence retained in access-controlled workflow.
- [ ] Data Dictionary amendment approved.
- [ ] Both schema proposals and actual restricted runtime role/RLS approved.
- [ ] Real SuperAdmin recovery confirmed by the operator (no secret shared).
- [ ] Staging signoff and production backup/forward recovery completed.
- [ ] Explicit authorization to change official Supabase database and roll out code received.

**This document does not attest that any live account has been reviewed, that official schema has been migrated or that strict login can safely be activated.**

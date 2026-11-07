# Disposable staging rehearsal — JaiROADS

This branch adds a **GitHub Actions-only, short-lived staging rehearsal**, not a persistent web deployment or a new Supabase project. It cannot alter the official Supabase project or its Storage. The existing PR #7 proposals and PR #6 business/security implementation remain staged separately from teammate code.

## What runs

The `.github/workflows/disposable-staging-rehearsal.yml` workflow starts **two isolated PostgreSQL 17 service containers** on GitHub-hosted runners, containing *synthetic data only*. It never downloads, copies or restores production database records.

**Job A: auxiliary-schema / restricted RLS**
- Requires `JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY`, the strict local host `127.0.0.1`, exact scratch host name, no `DB_URL`, and PostgreSQL 17 before creating databases.
- Creates two fresh scratch databases, `jairoads_scratch_staging_fallback` and `jairoads_scratch_staging_existing`. These are inside the temporary CI container.
- Applies the frozen canonical schema test fixture, dummy Fortify bridge and synthetic accounts; no live account identifiers, passwords or LGU records.
- In the second scenario, simulates the exact **names and trigger operations** of the existing official AuditLog immutability triggers before loading the SQL proposals; confirms the migration recognizes the existing guards without duplicating them. The first scenario tests fallback creation of immutability triggers on a fresh database.
- Loads `database/proposals/canonical_account_provisioning.sql`, `audit_notification_recipients.sql`, and the **review-only** grants template.
- Uses a fresh **NOLOGIN, non-owner, NOBYPASSRLS** role named `jairoads_app_runtime` to test INSERT and SELECT against both auxiliary tables under narrow synthetic RLS policies. Verifies no direct API privileges were given to `anon`, `authenticated`, `service_role`.
- Verifies immutable AuditLog, provenance and notification deliveries using safe disposable rows.

**Job B: application-smoke**
- Builds the actual Laravel/Inertia assets and creates the repository's already-used guarded unified synthetic fixture against **a separate** scratch PostgreSQL 17 service.
- Starts Laravel briefly on `127.0.0.1:8015` inside the runner, then requires `/up` and Fortify `/login` to return successful HTTP responses.
- Uses local-only dummy Storage settings and an array/mail sink; it neither contacts official Supabase nor sends real email.

**All CI databases, roles, app instances, and files vanish when runner containers are deleted.** The prior full-system, passkey/browser, concurrent regression and `composer ci:check` runs remain the primary functional tests; this workflow adds migration/schema/RLS compatibility checks and a local HTTP smoke.

## Important limitations

- **Not a persistent staging URL.** A separately approved environment and credential strategy are required for hands-on/manual testing.
- **Not the final restricted Laravel database role.** The rehearsal creates a NOLOGIN role for auxiliary grants and trigger/RLS checks; production requires a full inventory of ordinary Laravel schema/sequence/function permissions, a managed LOGIN credential, pooler/SSL configuration, and verification that the actual app works with it. Do not copy the staging-only broad synthetic SELECT policies or disposable credentials to Supabase.
- **Not production schema authorization.** Proposed SQL remains in `database/proposals/`, never in automatic app migrations or startup.
- **Not official Data Dictionary approval.** `docs/governance/dd-policy-alignment-review-2026-11-07.md` remains a change request.
- **Not complete Storage/e2e validation.** Actual upload/download/deletion with a private Storage test bucket, WebAuthn real origins, password resets, backups/recovery, Admin transition, and teammate integration are separate tasks.

## Next release gates

1. Confirm PR #7 proposal CI passes; review staged migration/role tests here.
2. Obtain Data Dictionary/schema-owner approvals and reviewed account-transition procedure.
3. Commission separately isolated persistent staging (not the official Supabase database).
4. Test real app login, DB role privileges and storage with synthetic data and representative roles.
5. Only after signoff, consider merging, updating official schemas and deploying.

No official Supabase database mutation, production rollout, identity linking, or migration is authorized by this workflow.

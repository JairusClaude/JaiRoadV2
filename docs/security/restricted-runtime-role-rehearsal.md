# JaiROADS — restricted PostgreSQL runtime-role staging rehearsal

**Status:** Disposable CI-only test enhancement. Not a production grant policy, password procedure, or automatic migration. Date: 2026-11-07.

This work package extends [the staging rehearsal](disposable-staging-rehearsal.md) and is stacked after [PR #8](https://github.com/JairusClaude/JaiRoadV2/pull/8). It does not touch the official Supabase project `aeaaxwyytsagbacysvvx` or any non-disposable database.

## Threat model and proof boundary

Fortify and canonical Data Dictionary identity/role authorization is enforced in Laravel. The application database role is **shared by all application identities**, so backend RLS policies `USING (true)` scoped to that single backend role are **not** an end-user authorization system. The objective of this isolated rehearsal is to establish that:
- Laravel does not need a database-owner, Superuser, BYPASSRLS, CREATEROLE or schema-creation privilege to perform representative authenticated read/write operations.
- A dedicated non-owner PostgreSQL **LOGIN** can execute real Laravel/Fortify requests with RLS on and only explicit DML permissions for allowlisted tables.
- Business AuditLog/provisioning/deliveries remain append-only at both the privilege and trigger layers, with API roles receiving no new table access.
- The runtime creates **one** event and deduplicated recipient deliveries when a canonical SuperAdmin creates an LGU.

## Disposable workflow

The `application-smoke` CI job uses the existing guarded `tests/Browser/prepare-unified.php` fixture to create synthetic linked SuperAdmin, Admin, Engineer and Viewer identities. Then:

1. `tests/Staging/prepare-restricted-runtime.sh` validates an exact localhost scratch database name, `APP_ENV=testing`, the explicit safety acknowledgement and PostgreSQL 17. It refuses any `DB_URL`, hosted environment or non-GitHub runner. It creates `jairoads_app_runtime` as a **non-owner LOGIN, NOBYPASSRLS, NOSUPERUSER, NOCREATEROLE, NOINHERIT**, with a **one-use random secret masked in GitHub logs**, and disposable dummy API roles.
2. `database/proposals/restricted_runtime_grants_REVIEW_ONLY.sql` sets scoped SELECT/INSERT policies for the two new auxiliary tables. `tests/Staging/restricted-app-grants.sql` applies temporary explicit DML grants/RLS on a known set of canonical/Fortify/support tables.
3. The setup logs in **as** the restricted role over TCP and refuses to continue if it has schema/database CREATE, audit/provenance mutation rights, BYPASSRLS, or inactive RLS on sampled tables.
4. Laravel runs at `127.0.0.1:8015` with `DB_USERNAME=jairoads_app_runtime` and the short-lived test credential; `tests/Staging/restricted-auth-http-smoke.py` performs a real Fortify session + CSRF login, reads the privileged canonical user directory and creates an LGU through the actual authenticated endpoint.
5. A final **restricted-role** SQL query confirms precisely one LGU CREATE AuditLog event and deliveries to at least two distinct eligible canonical recipients. If any step fails, the workflow fails closed.

All PostgreSQL roles, secrets, user data, logs, and web server state exist only on the temporary GitHub-hosted runner. The project database URL, credentials and storage keys are never fetched or used. This test does not send mail or perform real private-object writes.

## Safeguards and limitations

- **No access-control broadening in the product.** The permissive `staging_backend_*` RLS predicates exist **only** in `tests/Staging/` and are never executed on official Supabase. Laravel's role-scoped endpoint authorization remains mandatory.
- **Not the final production least-privilege configuration.** The stage-only grants are broader than a separately audited operational role might need. The schema owner must inventory every actual query, sequence, extension, stored function, queue/cache/session configuration and maintenance operation, and decide production grants. An application deployment using the Supabase `postgres` or `service_role` connection is **not** validated as least-privilege.
- **No Supabase Auth substitution.** The app still uses Fortify plus canonical `public.users.dd_user_account_id`. The dummy `anon/authenticated/service_role` PostgreSQL roles are for an access-denial fixture only.
- **No persistent staging environment.** This workflow runs on GitHub-hosted ephemeral infrastructure; real manual UAT requires independently authorized staging hosting, DNS/origin, isolated secrets and private Storage.
- **No historical identity transition.** Official SuperAdmin login, existing unlinked Admin remediation, provenance evidence, manual UAT, backup/restore, teammate integration and deployment are separate review gates.
- **No production-function privilege change.** `public.rls_auto_enable()` `EXECUTE` revocation requires its own explicit isolated Supabase-like event-trigger rehearsal; it is not changed here.

## Signoff items before production adaptation

- [ ] Confirm CI passes on the exact head commit with the real authenticated business write.
- [ ] Get schema-owner approval for **actual** database runtime role, complete permission inventory and RLS design (not this staged broad policy).
- [ ] Validate application connection pooling, SSL, credential rotation and public API schema exposure.
- [ ] Test failed/no-op/revoked write rollback and file/storage reconciliation under a restricted role.
- [ ] Complete proper SuperAdmin and ordinary-account transition rehearsal.
- [ ] Obtain explicit shared-database migration and deploy authorization.

The staging fixture and grant policy cannot be used as authorization to create official Supabase users, roles, grants, policies or migrations.

# JaiROADS deployment-target isolation and least-privilege release preflight

**Read-only tool, not a migration or release approval.** This policy belongs to draft PR #27. It does not alter Supabase projects, Render credentials or existing account provenance.

Run the checks only on a separately approved, persistent staging or production environment. The existing Render review service **uses the official Supabase project** and MUST NOT be labeled isolated staging.

1. Set `JAIROADS_DEPLOYMENT_CLASS=isolated_staging` on a genuinely separate project, or `production` only on the official release. Other labels fail.
2. Set `JAIROADS_EXPECTED_SUPABASE_REF` to the project you intend the container to reach and `JAIROADS_OFFICIAL_SUPABASE_REF` to the independent production project identifier. Staging must differ; production must match. Do not commit passwords, connection URLs or API keys.
3. Configure the approved restricted login `jairoads_app_runtime` over SSL, and verified persistent session/cache services. The application key must be valid and stable. Do not replace an existing APP_KEY or passkey origin for an established user population without an authorized recovery plan.
4. Run `php artisan jairoads:deployment-target-preflight` to reject mismatched Supabase/PG project identifiers and unsafe config, then `php artisan jairoads:runtime-db-preflight` to check the *actual* PostgreSQL role/RLS/grants. Both return only boolean evidence, never credentials. A successful result does **not** attest private backups, real ability to write business rows, SMTP, passkeys or human UAT.
5. Run `php artisan jairoads:integration-readiness --strict` and `php artisan jairoads:canonical-access-preflight --summary`. All 25 real human UAT cases and 13 approvals must be captured separately in access-controlled evidence.

The direct PostgreSQL host `db.<project>.supabase.co` or a Supabase transaction/session pooler host with `<restricted-role>.<project>` is required for the configuration check to establish the destination. Unknown routing or transparent proxies must fail closed until explicitly reviewed.

A project creation may incur billing and requires a selected organization and cost approval. This code cannot rotate production secrets, attest private identity ownership, or manufacture SMTP/DNS/provider credentials.

# JaiROADS Task 9 — isolated integration readiness and acceptance gates

**Status:** Review-only configuration preflight and disposable PostgreSQL 17 / fake-HTTP tests. **No live Supabase object, account, schema, API key, user credential, mail, map-provider request, or deployed application was changed.**

This branch is stacked after [PR #13](https://github.com/JairusClaude/JaiRoadV2/pull/13). Its tests do not authorize an official migration, rollout, or a real private-object deletion.

## Official Storage metadata — read-only check (2026-11-07)

The official Supabase project `aeaaxwyytsagbacysvvx` contains:
- `jairoads-maintenance-documents`: `public=false`, `versioning_status=DISABLED`.
- `jairoads-monthly-media`: `public=false`, `versioning_status=DISABLED`, allowed MIME types image/jpeg, image/png, image/webp, video/mp4 and video/webm.

These are the existing defaults in `config/jairoads_documents.php` and `config/jairoads_monthly_updates.php`. The live check **did not** download any object, fetch secrets, change a bucket, issue an API request as the Laravel app, or confirm application credentials/permissions. Configured individual-object deletion remains gated by `file_deletions` schema and approved privilege design.

## New operator preflight

`php artisan jairoads:integration-readiness` returns only boolean readiness checks, `ready_for_live_probes`, `network_probes_performed=false`, and fixed manual-gate labels. It performs **no** SQL writes or network calls and does not print domain names, user/account identifiers, credentials, tokens, secrets or object paths.

The checks cover:
- Valid HTTPS deployment `APP_URL` (no embedded credentials/query tokens), proper passkey relying-party host and HTTPS allowed origins.
- Both private Storage project URLs use HTTPS, bucket IDs are valid and distinct, and each backend has a structurally server-only credential; monthly media may fall back to the document secret **only for the identical origin**.
- Email reset mailer is not Laravel's log/array sink, and the From address is not a placeholder; no SMTP/provider connectivity is claimed.
- Configured road-editor routing and geocoding base URLs use HTTPS without userinfo or query-embedded secrets.

**Passing preflight means only that configuration is structurally ready for subsequent live probes.** It cannot prove a key has working permissions, a bucket is private, SMTP delivery succeeds, WebAuthn works on HTTPS in a real browser, providers meet rate limits/CORS policies, or the service is deployed.

## Test coverage

New `tests/Quarterly/IntegrationDeploymentReadinessTest.php` runs with local-only Postgres 17 and Laravel's fake HTTP transport, checking:
1. Well-formed *synthetic* configuration produces a secret-free JSON report, marks `network_probes_performed=false`, and issues zero external requests.
2. Insecure origins, public/invalid Storage keys, mismatched project secrets, placeholder email, malformed buckets and unsafe map URLs fail closed.
3. Document and media GET calls use `/storage/v1/object/authenticated/`, use only the server's API-key header for `sb_secret_*`, and never place secrets into query URLs or browser-facing payloads.
4. A document Storage secret is never reused to access a **different** monthly-media project.
5. A reported **public** document bucket prevents permanent deletion before any object DELETE request is issued.

The new GitHub Actions `staging / private Storage, mail, passkey and map configuration` job also reruns the existing `IntegrationCompatibilityTest.php` and `PasskeyEligibilityTest.php` for real Fortify password-reset synchronization and passkey account revocation. Existing Playwright browser tests cover signed WebAuthn origin/RP enforcement and full file-deletion retries using a local private-Storage mock; they remain the primary cryptographic and user-interface tests.

## Manual gates before operational use

- [ ] Confirm real hosted Laravel backend and the **actual** restricted DB role connect correctly to a **separate persistent staging** database and private Storage test buckets.
- [ ] Confirm production/server-only credentials are stored in the deployment secret manager, not `VITE_*`, logs, CI, GitHub, or the browser; rotate as required. Validate exact permissions via isolated manual upload/download/delete (no shared object deletion).
- [ ] Confirm both buckets remain private and unversioned at cutover; test exact-object deletion, retries, durable intent and recovery on synthetic test objects.
- [ ] Confirm real SMTP/provider sender ownership, password reset delivery, expiry, replay denial and canonical/Fortify hash synchronization without exposing reset tokens.
- [ ] Confirm the real HTTPS `APP_URL`, RP ID and allowed origins are correct; test registration, login, MFA, lost-device and rejected wrong-origin WebAuthn in a real browser.
- [ ] Confirm OSRM/Photon map providers' operational availability, terms, CORS/rate limits, geocoding accuracy and fallback to manual road drawing. `RoadTraceMap` also makes direct public Nominatim requests; review its provider terms and throttling separately.
- [ ] Record owner approvals, access/data migration plan, backups, monitoring, and teammate integration before merging, migrating or deploying.

## Boundaries

No credential is checked into this branch. No real email, Storage call, map provider call, passkey registration or public deployment occurs in CI. The official Supabase database, buckets and existing accounts remain unchanged. Test-only mocked URLs and keys are never valid official credentials.

This package closes **code-level integration readiness preparation** only; final staging/service acceptance and operational approval are outstanding.

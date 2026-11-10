# Post-demo 2: Security and Activity Monitoring

Source: `PostDemo2Update--UserManagementModifications` at `8532c315449cfaf720f00abadbbf2f70dc536832`.
Local repair branch: `PostDemo2Update--AuditLogModifications`.
Publication requires the owner's separate approval. No shared database activation is included.

## Page and authorization

`GET /dd-phase3/audit-logs` remains the single read endpoint. Every request resolves current canonical eligibility and requires Admin/SuperAdmin. Query parameters do not select an actor or override permissions. Engineer, Viewer, guest and revoked accounts cannot read any of the three tables. Only verified administrative layouts receive the Audit Log sidebar link. There are no exports, session-takeover controls, remote logout operations or historical mutation routes.

System Activity History retains every canonical row, including historical LOGIN/LOGOUT and notification copies. It supports database-side search, allowlisted action/entity, Manila calendar ranges, newest/oldest ordering with same-direction ID ties, and 25-row pagination. Old/new values pass through the existing AuditValues allowlists on every read. Details never reconstruct values that were not recorded. Existing OperationAudit and ActivityNotifications writers/policy remain unchanged; authentication creates no canonical event or delivery.

**Historical actor-role limitation:** canonical audit rows do not store a role snapshot. The column explicitly identifies the account's **current** role, not its role at the event time. Stable ActorIdentifier and canonical UserID remain visible. A future immutable actor-role snapshot would require separate schema-owner review; no historical roles are invented or backfilled. New authentication events do snapshot the verified role.

Authentication History has independent event/search/date filters and `auth_page` pagination. The business paginator retains `page` for compatibility. All timestamp projections are ISO UTC; calendar boundaries and displayed dates use Asia/Manila. Metrics count actual retained business entries, recorded successful/rejected authentication within its selected dates, and distinct verified online accounts. Missing monitoring infrastructure is shown as unavailable, not zero successful authentications.

## Collection and failure semantics

The existing Login/Logout listeners still clear Inertia history. They now capture only request-local signals and safe server session context. A Failed listener captures a rejection flag without reading its credential array. There are no competing business-audit authentication listeners.

`RecordSecurityMonitoring` is outer web middleware. Its post-response code runs **after** Laravel StartSession has saved the session and after canonical enforcement. An initial password accepted for MFA is not a completed LOGIN. Completed password, MFA, passkey and remember-me establishment can produce LOGIN; only an explicit real logout produces LOGOUT. Expiry/revocation is not fabricated as an explicit logout. An unavailable canonical account on explicit logout is not attributed as a verified current identity.

For file/database login, collection independently reads back the saved Laravel session and checks its Fortify identity and credential reference. Failed session persistence cannot create a false LOGIN. Laravel's own JSON/PHP serialization and optional encrypted Store are used. Laravel 13 session credential HMACs and its supported older raw-hash session format are checked through the current SessionGuard hashing method, without changing authentication. Timezone-aware telemetry writes/bounds use explicit UTC ISO values even when PostgreSQL is configured for Asia/Manila. Session references and credential-state references use domain-separated HMAC-SHA256 with the existing APP_KEY; no reusable session IDs, cookies, password hashes or reset/MFA/passkey materials enter monitoring records.

Security events and their presence update share one dedicated PostgreSQL transaction on a separate PDO connection. A required insertion failure rolls back both. Collection uses 250 ms SQL lock and 750 ms statement timeouts, and a two-second PDO connection timeout. It does not join, commit or roll back a business transaction. A logging/SQL outage preserves the original authentication response; missing telemetry is **not** represented as a successful collected event. Monitoring uses its own configurable cache store/path, independent of Fortify throttling. Disposable browser runs use separate temporary paths so their failure budgets cannot contaminate each other. A safe warning is rate-bounded, and a ten-minute recent-failure flag is shown to administrators when available. The diagnostic/cache sink can itself fail; it must never change authentication. This is best-effort security telemetry, not a guarantee of exhaustive collection or a substitute for infrastructure incident monitoring.

Failed identifiers are never associated with a UserAccount, even when the submitted email exists. Only a minimal mask is stored alongside a keyed digest used for exact administrative search. No raw IP or User-Agent is persisted. Client information consists only of an allowlisted browser/device category. No submitted password, OTP, recovery code, WebAuthn credential or arbitrary request body is serialized.

Failed collection is bounded by a per-network cache budget (20/hour by default), a local global budget and a PostgreSQL nonblocking advisory-lock-protected global budget (100/hour). Rotating identifiers/networks cannot bypass the SQL-wide limit. Cache budgets are conservative and may suppress more than the SQL ceiling. Rejected attempts above the limit are not individually stored; the UI says counts are **recorded, rate-bounded events**, not exhaustive attempts. Existing Fortify throttles/messages are untouched. These limits should be reviewed operationally; there is no automatic deletion or retention purge of immutable history.

## Presence contract and limits

Default recent activity window: 300 seconds (`SECURITY_ONLINE_SECONDS`, clamped to 30–900 for display/query). Presence touches at most every 30 seconds unless credential state changes. A new login records its real start timestamp; sessions predating collection show unknown login time. Multiple devices count once per canonical account, with the number of verified sessions and latest session information displayed. No browser-closing event is assumed. Manual refresh is available; there is no automatic polling loop.

Every read checks the same authoritative SQL eligibility as authentication (including canonical link, matching credentials/email, role/profile/activity and provisioning evidence), credential-state references, the underlying session's actual identity and password-state context, session-store expiry and recent activity. Logout deletes only that session's presence state; stale presence cannot revive a deleted/expired session. Account deactivation, retirement, invalid linkage or password-related revocation excludes the account/session immediately on a monitoring read. In-flight changes are observations at query time, not a lock on accounts after the response.

Supported presence drivers: **file** and **database**, including Laravel JSON/PHP serialization and encrypted sessions. Cookie/Redis/Memcached/DynamoDB/array/custom drivers are explicitly reported as unsupported for presence; authentication event collection still follows Fortify completion. File mode assumes one application instance or a genuinely shared session directory; separate per-node files cannot provide a reliable global online count. Database sessions support shared deployments when all nodes use the same session store, APP_KEY and time synchronization.

Presence verification is bounded to 1,000 recent candidate sessions and 10,000 backend session files/IDs. Exceeding a bound or a backend error produces an unavailable state and no unverified account count. It does not claim a partial count is complete. Session files must be readable by the Laravel runtime. Existing session files are read only; raw identifiers never leave this server-side verification. Expired **presence state** may be removed in batches of 100; immutable event history is never purged.

## Schema-owner handoff — not executed on Supabase

Review `database/proposals/security_monitoring.sql` against the actual project before activation. It requires the existing private `jairoads_security` schema and adds only:

| Object | Purpose | Mutation contract |
| --- | --- | --- |
| `jairoads_security.authentication_events` | Append-only LOGIN/LOGOUT/FAILED_LOGIN with verified identity or masked unverified attempt | Application SELECT/INSERT only; no UPDATE/DELETE/TRUNCATE |
| `jairoads_security.active_sessions` | Current session estimates with non-reversible references | Restricted server SELECT/INSERT/UPDATE/DELETE |
| Auxiliary indexes, checks, identity sequence and immutability trigger/function | Bound queries and protect new authentication history | No changes to canonical audit triggers or tables |

Both tables enable RLS and revoke PUBLIC and standard Supabase API-role grants. They must not be added to exposed Data API schemas. No SECURITY DEFINER function is introduced. The proposal creates no runtime role or broad policies automatically.

The schema owner must separately approve and adapt grants for the existing restricted Laravel runtime role (for example `jairoads_app_runtime`). Review-only outline:

```sql
-- DO NOT RUN without the schema owner's activation approval and deployment plan.
GRANT USAGE ON SCHEMA jairoads_security TO jairoads_app_runtime;
GRANT SELECT, INSERT ON jairoads_security.authentication_events TO jairoads_app_runtime;
GRANT USAGE ON SEQUENCE jairoads_security.authentication_events_id_seq TO jairoads_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON jairoads_security.active_sessions TO jairoads_app_runtime;
CREATE POLICY monitoring_history_read ON jairoads_security.authentication_events
  FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY monitoring_history_append ON jairoads_security.authentication_events
  FOR INSERT TO jairoads_app_runtime WITH CHECK (true);
CREATE POLICY monitoring_presence_read ON jairoads_security.active_sessions
  FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY monitoring_presence_insert ON jairoads_security.active_sessions
  FOR INSERT TO jairoads_app_runtime WITH CHECK (true);
CREATE POLICY monitoring_presence_update ON jairoads_security.active_sessions
  FOR UPDATE TO jairoads_app_runtime USING (true) WITH CHECK (true);
CREATE POLICY monitoring_presence_expire ON jairoads_security.active_sessions
  FOR DELETE TO jairoads_app_runtime USING (true);
```

These policies deliberately target the trusted server DB role, never anon/authenticated/service_role. Laravel must still enforce the currently authenticated administrator for reads. Do not grant ownership, BYPASSRLS, schema CREATE, history mutation or the application's DB credentials to clients. The runtime role also needs its existing canonical identity reads and actual session-store access; no broader business grants are proposed here. Inspect inherited/default privileges as well as direct grants before approving.

Activation order: approve schema/grants → rehearse backup and restricted-role tests on disposable PG17 → apply through the schema owner's controlled process → verify application read/write permissions, RLS and session driver → enable/observe collection. `SECURITY_MONITORING_ENABLED=false` disables collection without erasing history; a schema/table outage otherwise degrades explicitly. Rollback may disable collection or revert code; it must **retain** already collected immutable history. No drop, reset, backfill, shared-data migration or deployment is authorized by this implementation.

## Files and reasons

| Files | Reason |
| --- | --- |
| `app/Http/Controllers/AuditHistoryController.php` | Single privileged read endpoint, independent server filters/pagination, safe projections, current-role caveat, real summary queries |
| `app/Services/SecurityMonitoring/AuthenticationTelemetry.php` | Bounded optional collector, isolation, atomic event/presence writes, privacy and outage reporting |
| `app/Services/SecurityMonitoring/SessionCatalog.php` | Verify actual file/database sessions without persisting reusable credentials |
| `app/Services/SecurityMonitoring/OnlinePresence.php` | Batched canonical eligibility, credential/session checks and unique-account grouping |
| `app/Http/Middleware/RecordSecurityMonitoring.php`, `bootstrap/app.php` | Post-session-save collection boundary |
| `app/Providers/AppServiceProvider.php` | Extend existing authentication listeners while retaining Inertia clearing; never read credential arrays |
| `app/Services/AccountIdentityResolver.php` | Expose its existing eligibility query for batched monitoring reads; no predicate or permission changes |
| `config/security-monitoring.php`, `config/cache.php` | Feature/window/budget/capacity configuration and a dedicated monitoring cache (disposable tests use separate paths) |
| `database/proposals/security_monitoring.sql` | Review-only auxiliary schema; never an automatic canonical migration |
| `resources/js/pages/dd-phase3/AuditHistory.tsx` | Integrated responsive three-table page, details, filters, state/metrics and refresh |
| `resources/js/layouts/polished-workspace-layout.tsx`, `resources/js/layouts/dd-superadmin-command-layout.tsx` | Verified Admin/SuperAdmin sidebar entry |
| `tests/Quarterly/SecurityMonitoringTest.php` | Isolated role, transaction, MFA, privacy, rate/lock, session, history and restricted-RLS regressions |
| `tests/Browser/security-monitoring.mjs`, `tests/Browser/unified.mjs` | Real Fortify browser coverage, four viewports, safe projections, failure/logout/presence and integration with existing acceptance |
| `tests/Browser/audit-notifications.mjs` | Update the renamed page heading; existing immutable-history assertions preserved |
| `tests/Browser/passkey-lifecycle.mjs` | Verify all four roles' real WebAuthn success records in separate history |
| `tests/Browser/prepare-unified.php`, `tests/Browser/prepare-passkey-lifecycle.php` | Apply the proposal only to positively guarded disposable browser fixtures |
| Four `.github/workflows/*.yml` | Prepare existing verification triggers for this isolated branch; no publication/run claimed until approved |
| This document and screenshots | Reviewable implementation, schema prerequisites and actual local acceptance evidence |

No Reset History button, password challenge, random-string challenge, destructive history route, audit-update/delete writer, export or history backfill is introduced. Canonical models/migrations, maintenance semantics, account provisioning, authentication providers/password synchronization and notification audience remain unchanged.


## Recovered checkpoint and executed verification

The interrupted working tree was recovered intact on the isolated branch. HEAD was still the verified source commit; all enhancement changes were uncommitted, none were staged, and the repair branch did not exist on GitHub. No test process remained running. The last queued commands had completed: the full canonical suite, focused Audit Log browser check and quality checks all passed. Earlier failed iterations were preserved as diagnostics, not counted as passing evidence.

| Executed check | Actual result |
| --- | --- |
| Complete canonical PostgreSQL 17 suite | 497 passed, 5,119 assertions; no failures or skips |
| New monitoring cases included above | 30 passing cases; not additional to the 497 |
| Original password regressions | 56 passed, 330 assertions |
| Standard Laravel tests | 120 passed, 901 assertions; 2 existing disabled-public-registration skips |
| PostgreSQL Feature tests | 49 passed, 344 assertions; the same 2 feature-gated registration skips |
| Unified real Laravel/Fortify browser suite | Passed, including Audit Log, old notifications/history, private files, maintenance workflows, logout/history and all six account-provisioning combinations |
| Focused final Audit Log browser check | Passed at 320, 390, 768 and 1440 pixels for both Admin and SuperAdmin; measured document width, safe props, filters, masked failure and per-session logout |
| Real WebAuthn browser suite | Passed; completed passkey logins for all four roles appear in separate history; existing rejection/reset/remember-me and Viewer provisioning checks preserved |
| Pint, PHPStan, ESLint, Prettier, TypeScript and routes | Passed |
| Composer strict validation and audit | Passed; no reported advisories |
| npm audit | Passed; zero vulnerabilities |
| Vite production build | Passed; existing optional-font/chunk-size notices remain |
| GitHub Actions for this enhancement | NOT RUN: publication has not been authorized |
| Local Docker build/runtime | NOT TESTED: Docker is unavailable in this workspace |

Suite counts overlap and must not be added together. Public registration was not enabled to make the two existing feature-gated tests execute; separate executed authorization tests deny public provisioning. No tests were removed, skipped or weakened for the enhancement.

The final activity/authentication filters test verifies independent pagination, stable ID ties, Manila date boundaries and UTC projections. The new fixtures explicitly set PostgreSQL to Asia/Manila, so timezone correctness is exercised even on a UTC CI runner. Laravel 13 credential HMACs and older supported session hash state are both tested, including rejection after password changes. Presence capacity exhaustion does not suppress otherwise verifiable LOGIN history: current-session read-back is direct rather than a full presence scan.

The initial browser privacy assertion was corrected to reject secret **property names**, rather than mistaking the harmless authentication method value `password` for a stored credential. Browser test cache paths are disposable and isolated; production rate limits remain unchanged. These corrections do not disable assertions or application protections.

### Actual local browser captures

All captures contain synthetic disposable-fixture data, not official users or Supabase records:

- [Admin desktop, 1440px](screenshots/audit-admin-desktop.png)
- [Admin tablet, 768px](screenshots/audit-admin-tablet.png)
- [Admin mobile, 390px](screenshots/audit-admin-mobile.png)
- [SuperAdmin desktop, 1440px](screenshots/audit-superadmin-desktop.png)

The 320px layout was additionally measured and exercised by the focused browser test. Wide tables scroll inside their own keyboard-focusable region; the document itself does not overflow.

### Remaining approvals

1. Owner approval to publish only `PostDemo2Update--AuditLogModifications`; then run the prepared GitHub workflows on its exact published SHA.
2. Schema-owner review and activation of the two auxiliary tables, targeted grants/RLS and new authentication-history protections. Nothing has been applied to official Supabase.
3. Operational review of failure budgets, file/database session deployment topology and capacity. Unsupported presence configurations are reported explicitly.
4. A separate future decision if immutable business actor-role snapshots are required. Current-role presentation is clearly labeled; historical roles are not fabricated.

This local implementation is not represented as production-ready or GitHub-CI-verified before those prerequisites are met. No reset/clear-history mechanism, live schema change, real account mutation, production Storage access, merge or deployment occurred.

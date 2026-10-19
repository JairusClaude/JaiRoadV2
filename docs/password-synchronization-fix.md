# Password synchronization — local checkpoint, 2026-10-19

The original branch `feature/jairoads-map-demo` was fetched and verified at `2ee94145807a4ffca78a2d19e882980f4ebfb501`. The new `feature/jairoads-map-demo_PASSWORD_EDIT` branch was created from that exact commit before editing. It has no upstream push target. Implementation commit: `fa3f07d`.

The original branch, main, and teammates' branches were not modified. The previous integration branch remains at `e7564a6`. Nothing was pushed, merged, deployed, or changed in shared Supabase. No real account credentials or activation states were modified. This fix preserves the current dual-account architecture.

## Cause and solution

`DataDictionaryIdentityResolver` joins only `public.users.dd_user_account_id` to `jairoads_next.user_accounts.id` and requires identical password hashes. The original Fortify reset updated only `public.users.password`. Laravel's automatic login rehash could also update that column alone. Separately salted hashes of the same password are different, so independent hashing does not repair the bridge.

The new `LinkedPasswordUpdater` locks the login and its explicit DD account on the same connection, validates persisted ownership, unchanged linkage/email, active status, recognized role/link rules and any linked Engineer profile, then generates one configured hash and writes it to both rows. It rejects ambiguous DD links and never associates accounts using email, coincidental IDs or legacy `user_account_id`.

Only the token-verified Fortify reset can repair previously mismatched hashes. Ordinary current-password changes and rehashes retain the strict old-credential consistency requirement. Invalid links/statuses and database failures receive generic account-unavailable errors; SQL exceptions containing credential bindings are not exposed or chained. Sensitive service parameters are marked. No role, assignment or activation change is made.

The resolver, User and read-only StagingUserAccount models, dashboards, frontend, historical migrations and dependency lockfiles are unchanged. No production schema migration is needed.

## Password entry points reviewed

| Entry point | Final behavior |
| --- | --- |
| Fortify ResetUserPassword | Uses updater.reset after the broker verifies the token; normal token consumption, remember-token completion and PasswordReset event remain |
| SecurityController password settings | Uses updater.change; preserves legacy current-password behavior |
| DDOperationsController settings | Uses updater.change inside its existing username/audit transaction; existing Admin/SuperAdmin-only permission remains |
| Eloquent/Fortify login rehash, including MFA pipeline and forced rehash | New provider overrides only rehashPasswordIfRequired; DD hashes upgrade together, legacy behavior delegates to Eloquent; rehashing stays enabled |
| Profile/account settings | No password-writing fields; existing DD quarantine remains |
| DD administrative provisioning | Already hashes once and creates both rows with the explicit DD link; retained |
| Legacy AccountProvisioningController | Creates legacy user_account_id accounts, not DD links; no invented DD mapping |
| Legacy UserAccount administrative edits | Already disabled with 409 responses; no new admin reset permission enabled |
| Other model/query-builder password writes | Inspected; active DD password-changing paths converge on the updater; no permissive model observer added |

## Transactions and sessions

A failure on the second credential write rolls back the first. Failure in the enclosing Settings audit also rolls back both credentials and username. The authenticated principal is refreshed only after the outer commit, preventing an incorrect in-memory/session hash on rollback.

Password changes rotate remember tokens and revoke only that account's database sessions when the store shares the connection. Laravel AuthenticateSession rejects stale password-bound sessions. Existing unbound sessions on a separate external store may require that deployment's session-expiry procedure; no shared cleanup was performed.

MFA secrets/recovery behavior, passkey ownership and credential material are retained. Tests exercise MFA recovery-code login, password confirmation and passkey options generation after reset. Signed WebAuthn ceremonies with a physical authenticator and browser acceptance were not performed. Existing live DD resolver checks continue to deny inactive accounts protected business access.

No additional AuditLog permission was granted. DD Settings keeps its existing secret-free audit event. The rollback and credential-exclusion cases passed.

## Exact files

| File | Change |
| --- | --- |
| app/Services/DataDictionary/LinkedPasswordUpdater.php | New atomic updater and validation |
| app/Auth/LinkedPasswordUserProvider.php | Synchronized DD rehash provider |
| app/Actions/Fortify/ResetUserPassword.php | Token-verified reset integration |
| app/Http/Controllers/Settings/SecurityController.php | Current-password change integration |
| app/Http/Controllers/DataDictionary/DdOperationsController.php | Existing manager-only Settings transaction integration |
| app/Providers/AppServiceProvider.php | Register provider; retain Login audit listener |
| config/auth.php | Select provider; retain User model, guard and broker |
| bootstrap/app.php | Laravel password-bound session middleware |
| tests/PasswordSyncTestCase.php | Guarded disposable PostgreSQL fixtures |
| tests/PasswordSync/LinkedPasswordTest.php | Regression coverage |
| phpunit-passwords.xml | Separate opt-in PostgreSQL suite |
| docs/password-synchronization-fix.md | This report |

## Executed checks

Locked Composer dependencies installed and platform checks passed under PHP 8.4.26 / Composer 2.10.3, without ignoring platform requirements. Native PostgreSQL 16.15 ran from temporary packages on loopback. The root-only container required a temporary UID/ownership compatibility shim for the server; PostgreSQL binaries, PDO queries and transaction behavior were not mocked. The native server was stopped after each run. No runtime tools or dependency-lock changes were added to the repository.

| Check actually executed | Result |
| --- | --- |
| composer install --no-interaction --prefer-dist --no-progress | PASS |
| composer check-platform-reqs | PASS |
| PHP -l across app/bootstrap/config/database/routes/tests/tools | PASS: 202 files, final edited service/test files rechecked |
| PostgreSQL password suite | PASS: 27 tests, 152 assertions |
| Focused PHPStan on updater/provider/reset/Security/provider-registration files | PASS: zero errors |
| Focused Pint on new core/test files and small changed configuration files | PASS |
| Full PHPStan | FAIL: 41 diagnostics; the untouched original produces exactly the same normalized diagnostics |
| Full Pint | FAIL: 46 files; untouched original has 48. Formatting outside the password change was retained, including the rest of DdOperationsController |
| Existing Laravel suite on isolated SQLite, with test key/generated assets | Structured result: 78 successful, 2 failed, 2 skipped; 443 assertions. Same two failures reproduced on untouched original; existing warnings remain |
| route:list --except-vendor --json | PASS |
| wayfinder:generate --with-form | PASS |
| npm run lint:check | FAIL: 1004 errors / 7 warnings in unchanged frontend sources |
| npm run format:check | FAIL: 60 unchanged resource files |
| npm run types:check | FAIL: missing maplibre-gl module/types and associated implicit-any handlers |
| npm run build | FAIL: unresolved maplibre-gl import in dd-phase3/RoadTraceMap.tsx; client manifest generated before failure, not a complete production build |
| git diff --check | PASS |

The two existing Laravel failures are DashboardTest expecting 200 for an unlinked account (actual 403), and ExampleTest expecting public home 200 (actual 302). No assertions were weakened or tests deleted. Baseline comparisons used an unmodified archive of the original commit, without checking out or editing its branch. Standard raw reports were collected with the agent output formatter disabled; no analyzer rule or test check was disabled. Hosted CI/deployment were not run.

The password suite covers: both hashes/new-password validation; old-password rejection; token success/failure/consumption; missing/inactive/retired/email-mismatched/ambiguous links; second-write rollback; recovery from desynchronization; legacy isolation; all four dashboard redirects; unchanged EngineerLGU scope; ignored privilege payloads; DD and legacy Settings; enclosing audit rollback; MFA recovery; passkey retention/options; password confirmation; stale sessions/principals; unsaved principals; database-session and remember-token revocation. It is sequential, without multi-client race stress or browser UI acceptance.

## Reproduce on Herd with disposable PostgreSQL

Use PHP 8.4.1+ with pdo_pgsql and the locked project dependencies. For example, start a temporary local server in one terminal:

```sh
docker run --rm --name jairoads-password-tests -e POSTGRES_USER=jairoads_password_test -e POSTGRES_DB=jairoads_password_test -e POSTGRES_HOST_AUTH_METHOD=trust -p 127.0.0.1:55432:5432 postgres:16
```

This trust configuration is only for the loopback-bound disposable fixture server. In a second terminal on the new branch:

```powershell
herd composer install --no-interaction --prefer-dist
herd composer check-platform-reqs
$env:JAIROADS_PASSWORD_TESTS = "1"
$env:JAIROADS_PASSWORD_TEST_PORT = "55432"
herd php vendor/bin/pest --configuration=phpunit-passwords.xml
```

Bash equivalent:

```sh
JAIROADS_PASSWORD_TESTS=1 JAIROADS_PASSWORD_TEST_PORT=55432 php vendor/bin/pest --configuration=phpunit-passwords.xml
```

The suite hardcodes loopback, database/user jairoads_password_test, no URL and no password. It verifies the actual database/user and refuses pre-existing tables before fixture DDL. No RefreshDatabase/shared migration path is used. Fixtures are removed after each case. Stop the disposable server afterward:

```sh
docker stop jairoads-password-tests
```

Do not run composer setup for this verification. No shared migration/provisioning approval is requested. GitHub push, PR creation, merge and deployment remain unauthorized.

# Post-demo 2: account-type-first provisioning

Source: `fix/phase11o-strict-dd-release-gate` at `30c3df61c63b6f29066af826121d43274cf6013f`.
Work branch: `PostDemo2Update--UserManagementModifications`.

## Approved workflow

Previously: create/select an existing Engineer, then create and link an account.
Now: select Account Type (initially blank), enter its fields, submit one request.

| Type | Ordinary creators | New Engineer | New EngineerLGU grant |
| --- | --- | --- | --- |
| Admin | Eligible Admin / SuperAdmin | New active profile, linked atomically | None |
| Engineer | Eligible Admin / SuperAdmin | New active profile, linked atomically | None |
| Viewer | Eligible Admin / SuperAdmin | None; `engineer_id = NULL` | None |
| SuperAdmin | Existing privileged bootstrap only | None | None |

The active real Laravel/Inertia workflow remains `/dd-phase3/users` → `POST /dd-phase3/accounts`. Legacy/public administration is not rewritten. Historical accounts, including linked Viewers, remain unchanged. Existing standalone Engineer and EngineerLGU administration remain available. A standalone existing profile is not automatically claimed or linked by this new form.

## Request and transaction contract

Common fields: `account_type`, `username`, `email`, `password`, `password_confirmation`.
Admin/Engineer fields: `first_name`, optional `middle_name`, `last_name`, `contact_no`, `rank`. Fortify display name is derived by the server. Viewer field: `name`; nonempty profile fields are prohibited. A nonempty submitted `engineer_id` is prohibited for all ordinary roles.

The form hides details until a role is selected. Changing type clears profile/display-name values and their errors, retains credentials, and submits only the selected role's applicable fields. Required fields and processing state disable submission. Success resets the form to the blank role and refreshes the directory; validation errors retain entered values.

Existing lifecycle/provisioning advisory-lock order and transaction retry count are retained. The actor is resolved again after lock acquisition. The transaction creates the profile when applicable, canonical UserAccount, explicitly linked Fortify login, immutable administrator provenance, canonical events and linked notification deliveries. One password hash is shared between canonical and Fortify rows. No password/hash is written to audit snapshots. Email verification remains optional.

For professional accounts, two distinct CREATE events describe two new entities (Engineer and UserAccount). Viewer creation writes only the UserAccount event. Existing audit sanitization, audience selection, immutability and recipient deduplication remain unchanged. Any required insertion failure rolls back the entire operation, including earlier profiles/events/deliveries.

No LGU assignment is invented. A new Engineer must receive an explicit authorized assignment through the existing workflow before LGU-protected work. Rank never grants a role. SuperAdmin creation is absent from both the ordinary form and server allowlist.

## Duplicate handling and limits

Existing case-insensitive username/email checks remain under the provisioning lock. Full normalized first/middle/last name **and a nonempty digit-normalized contact number** matching any existing Engineer (including retired/linked profiles) is rejected without claiming or reactivating that profile. Names alone are not assumed unique. Administrators must review such a conflict rather than creating an account against the existing profile implicitly.

This is conservative detection, not a global unique-person constraint: changed contact numbers, country-code variants and simultaneous standalone directory profile creation cannot all be identified reliably from these fields. No new schema constraint or fabricated identity is introduced. A future reviewed reconciliation workflow would be a separate task.

## Changed-file inventory

| Files | Reason |
| --- | --- |
| `app/Http/Controllers/CanonicalAccountProvisioningController.php` | Role-specific validation; new profile and account in the existing transaction; duplicate-person detection; distinct Engineer audit event |
| `resources/js/components/user-management/canonical-account-creation-form.tsx` | Typed conditional Inertia form, role-first selection, safe payloads and field errors |
| `resources/js/pages/dd-phase3/Workspace.tsx` | Install the new form and correct provisioning guidance; preserve standalone administration |
| `tests/Quarterly/PostDemoAccountCreationTest.php` | Role matrix, real password login, rollback at six required writes, malformed/duplicate inputs, historical preservation and verified PostgreSQL lock-wait concurrency |
| `tests/Quarterly/AccountLinkagePolicyTest.php` | Superseded existing-profile selection assertions replaced by new-profile creation and client-ID rejection |
| `tests/Quarterly/AccountTypeRankTest.php` | Verify automated profile linkage without changing Rank/Account Type separation |
| `tests/Quarterly/AdministratorProvisionedAccessTest.php` | New request fields; explicitly grant LGU through existing assignment endpoint before Engineer workflow tests |
| `tests/Quarterly/CanonicalOnlyAuthenticationTest.php` | Viewer provisioning helper no longer submits an existing profile ID |
| `tests/Quarterly/OrdinaryMutationRaceTest.php` | Provisioning-race Viewer payload follows the new NULL-link contract; race schedule and security assertions retained |
| `tests/Browser/postdemo-user-management.mjs` | Six actual Admin/SuperAdmin UI creations, conditional fields, processing/completeness, payloads and mobile/desktop bounds |
| `tests/Browser/unified.mjs` | Execute the new UI regression within existing full browser acceptance |
| `tests/Browser/account-terminology.mjs` | Account Type/Rank browser flow uses the new profile fields |
| `tests/Browser/passkey-lifecycle.mjs` | Actual Viewer provisioning without an Engineer; retain passkey/MFA/reset/session regressions |
| `.github/workflows/quarterly-maintenance.yml` | Enable this branch and correct references to already-relocated backend files |
| `.github/workflows/system-verification.yml`, `.github/workflows/tests.yml`, `.github/workflows/disposable-staging-rehearsal.yml` | Enable existing checks on this exact branch |
| `tests/Integration/assert-reviewed-history.sh` | Point the retained-contract assertions to current resolver/audit paths; preserve ancestry requirements |
| This document | Approved behavior, scope, validation evidence and limitations |

## Executed local verification

| Check | Result |
| --- | --- |
| New `PostDemoAccountCreationTest` | 24 passing cases; included in canonical total |
| Focused account/authentication selection | 79 passed, 724 assertions |
| Complete canonical PostgreSQL suite (`phpunit.quarterly.xml`) | 467 passed, 4,849 assertions; no failures/skips |
| Original password suite (`phpunit-passwords.xml`) | 56 passed, 330 assertions |
| PostgreSQL Feature suite | 49 passed, 344 assertions; 2 existing public-registration skips |
| Standard `php artisan test` | 120 passed, 901 assertions; 2 existing public-registration skips |
| Real unified Laravel/Fortify browser acceptance | Passed, including six new account creations, all four roles, private files, geometry, quarter/month reporting, audit/notifications and logout/history |
| Real WebAuthn browser acceptance | Passed; all four roles, revoked/invalid identity rejection, remember-me, and newly provisioned unlinked Viewer login/read-only access |
| Pint / PHPStan / ESLint / Prettier / TypeScript / routes / PHP syntax | Passed |
| Composer strict validation and security audit | Passed; no reported advisories (one initial Packagist timeout resolved on retry) |
| npm security audit | Passed; zero vulnerabilities |
| Vite production build | Passed; existing chunk-size and optional font-optimization notices remain |
| Local Docker | Not executed: Docker is unavailable; existing CI runtime job remains enabled |

The two registration skips are the existing Fortify feature-gated tests for an intentionally disabled public feature; they are not counted as passes. Separate executed regressions verify that public registration cannot provision accounts. Suite counts overlap and must not be added together.

New cases cover `role_specific_creation_and_real_password_login` (six role combinations), `every_required_write_failure_rolls_back_all_entities_and_history` (six write stages), `invalid_profile_fields_cannot_create_partial_records` (six malformed payloads), duplicate credentials/person conflict, normalized retired-profile conflict versus same-name-only acceptance, preservation of historical linked Viewers and events, Engineer/Viewer denial, and `real_concurrent_duplicate_submissions_create_one_profile_and_account`. The concurrency case verifies both requests waiting on a real PostgreSQL advisory lock through `pg_stat_activity` and `pg_blocking_pids`, then asserts one successful creation and one validation rejection.

## Verification and safety

All mutating local tests use newly initialized disposable PostgreSQL 17 clusters, guarded `jairoads_scratch_*` databases (or the guarded password-test database), synthetic credentials and local Storage mocks. Shared Supabase, production Storage and existing accounts were not contacted for writes. No canonical models, migrations, schema definitions, password implementation or permission services are changed.

The existing strict identity resolver already permits eligible unlinked Viewers, so no authentication-policy workaround was required. Required auxiliary provisioning/audit tables and restricted runtime privileges must already be activated through the team's existing schema-owner process; this change does not apply them.

The GitHub workflow results must be checked on the final published SHA. Enabling a trigger or passing a local build alone does not establish CI verification. See the completion report for the exact run links and results.

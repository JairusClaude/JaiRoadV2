# Canonical-only authentication verification

Date: 6 November 2026 (Asia/Manila).

Source: `fix/security-auth-revocation-passkey-dependencies` at
`5c3ab221d18594d2c1fa42e9dafd2871c3846b5f`, freshly verified before creating the
separate worktree/branch `fix/canonical-only-provisioned-auth`. Original source,
integration, main and teammate branches were not edited. Existing unpublished
security/integration worktrees and commits remain preserved.

## Implemented

- Central canonical eligibility for password, passkey, remember-me, sessions, MFA,
  credential management, recovery and relevant reactivation boundaries.
- No legacy-only or unlinked-Admin compatibility. Admin/Engineer/Viewer require an
  active unique Engineer and immutable administrative evidence; only SuperAdmin
  has the approved Engineer/provenance bootstrap exception.
- Existing Fortify bridge, password synchronization, roles/LGU/ManagingEngineer
  permissions, optional email verification, account/file/maintenance workflows
  remain. No direct-UserAccount auth rewrite or Supabase Auth switch.
- One-transaction administrative creation includes canonical account, Fortify
  identity, server-attributed evidence and the existing audit event. Required
  schema is absent -> ordinary identities denied, new provisioning 503; no bypass.
- Privileged interactive initial bootstrap, atomic failure behavior, no default
  secret, no public route, no second-root bootstrap, and last eligible root safety.
- Read-only preflight plus the point-in-time shared database inventory and an
  administrator-reviewed transition order. No automatic historical evidence,
  linkage, profile fabrication, credential reset or deactivation.
- Viewer provisioning form now requires an available active Engineer while
  retaining Account Type and read-only scope. Real browser form submission tested.

Full policy, schema review handoff, bootstrap procedure, runtime-role/RLS template,
generic remediation/deployment order are in
[canonical-only-access.md](canonical-only-access.md).

## Actual local results

| Check                                      | Result                                                                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full canonical PostgreSQL 17               | **369 passed / 4,210 assertions**                                                                                                                                                                                            |
| Original password/DD regressions           | **56 passed / 330 assertions**                                                                                                                                                                                               |
| PostgreSQL Feature                         | **49 passed / 344 assertions / 2 skipped**                                                                                                                                                                                   |
| Standard Laravel/Pest, now disposable PG17 | **105 passed / 649 assertions / 2 skipped**                                                                                                                                                                                  |
| New strict/provenance cases                | **36 new cases**, plus 2 additional Viewer provisioning matrix cases                                                                                                                                                         |
| Focused evidence/bootstrap/preflight       | **8 passed / 20 assertions**; included in canonical total                                                                                                                                                                    |
| Real WebAuthn/browser                      | **Passed**: four valid roles, legacy denial, lifecycle/link/email/hash/evidence denials, origin/RP/replay/foreign credential checks, actual reset then existing key, real remember cookie, real linked Viewer form           |
| Unified Laravel/Fortify browser            | **Passed**: four roles, scoped maintenance/uploads/private files, geometry, independent quarters/duplicates, sort/year, 24 viewport checks, existing held deletion/history behavior, municipality and logout/back/tab/expiry |
| Additional focused logout/history          | **3/3 passed**, unchanged mandatory cookie replay/redirect assertions                                                                                                                                                        |
| Pint / PHPStan                             | **Passed / zero errors**                                                                                                                                                                                                     |
| ESLint / Prettier / TypeScript / Vite      | **Passed**                                                                                                                                                                                                                   |
| Composer strict validation                 | **Passed**                                                                                                                                                                                                                   |
| Composer audit / npm audit                 | **Zero advisories / zero vulnerabilities**                                                                                                                                                                                   |
| PHP syntax                                 | **292 tracked/new PHP files, zero failures**                                                                                                                                                                                 |
| Routes                                     | **153 routes**; no bootstrap/provenance-edit HTTP endpoint                                                                                                                                                                   |
| Workflow configuration                     | YAML parsed; all original 5 full-workflow jobs (14 matrix-expanded checks) and 3 focused jobs retained                                                                                                                       |
| Local Docker image/runtime                 | **NOT RUN**: Docker/Podman/Buildah/nerdctl unavailable                                                                                                                                                                       |

Feature totals overlap with the standard suite; do not sum them as unique tests.
Two existing registration skips remain because public registration is disabled;
new direct GET/POST checks independently prove account creation is unavailable.
No test was deleted, audit ignored, analyzer excluded, check disabled or assertion
relaxed to accept authenticated legacy access.

Existing positive legacy-login/unlinked-Admin/Viewer-unlinked assertions were
updated to the newly approved policy. Unchanged domain/controller coverage remains
in its explicit identity-stub unit file, isolated from the new outer session
middleware only there; real-stack negative tests verify legacy HTTP access with
all middleware enabled. Those temporary legacy schemas also moved from SQLite to
positively guarded local PostgreSQL. Immutable evidence is recreated only during
privileged disposable fixture cleanup, never by ordinary application code.

All commands ran against local disposable databases or Storage mocks, not shared
Supabase. Quality results were recorded on implementation `d2ab17c`; subsequent
`b35c812` adds only safe failure diagnostics to the unchanged logout assertion.
The complete browser test and three focused history iterations executed that
instrumented test source. The accompanying documentation commit does not change
runtime behavior.

### Investigated verification problems

- An initial missing test environment file/APP_KEY and missing generated Wayfinder
  files were corrected locally. No production credential/environment was copied.
- The PG legacy fixture needed its actually queried GeoJSON column; no production
  model/controller/schema logic was changed for that fixture correction.
- Running Vite concurrently with a browser once removed the build manifest mid-page
  load; the server log identified that orchestration error. Browser reran only
  after the build completed.
- One later full-run old-cookie probe returned unexpected HTTP 200 before response
  content diagnostics existed. The complete instrumented rerun and three focused
  runs passed; no protected-data leak was established and no speculative auth
  rewrite was made. Safe component/status diagnostics remain and the original
  expected 302 is still mandatory. Keep this intermittent result visible during
  CI review rather than silently treating it as a proven vulnerability or suppressing it.

## Deployment prerequisites / remaining review

1. Schema owner approval and execution of their reviewed provenance migration and
   least-privilege runtime grants/RLS. The new SQL is a proposal, not an applied
   migration. No existing canonical migration/model or business constraint changed.
2. Privately review the actual account preflight with the project owner. Preserve
   an eligible SuperAdmin; remediate ordinary profile/evidence gaps only after
   explicit administrative and schema-owner approval. Identifying shared-database
   inventory is intentionally excluded from this public document/history.
3. Do not deploy strict code before the approved transition preflight succeeds.
   The application intentionally fails closed without evidence. No account has
   been auto-remediated or silently declared administrator-created.
4. Full GitHub CI/Docker acceptance must be assessed on the published branch HEAD,
   not copied from the source branch's historical results. Live run URLs and the
   final remote SHA are supplied in the publication handoff. Publication does not
   authorize merge, production deployment or shared SQL/Storage writes.

## Local implementation commits

- `289d11a70d83df6dba96cfa113f793ae8b922f72` — Require canonical eligibility and immutable administrative provisioning evidence
- `3dc22994870b0dfebbb3e378c7a1df709cf3c0f1` — Verify canonical-only login sessions bootstrap and provisioning on disposable PostgreSQL
- `d2ab17cb4f93323d28f8ffa537ee07efc65dfdcc` — Verify registered passkeys remember cookies and linked Viewer provisioning in browser
- `b35c8127275f3a2116f9272c1584b105925e856c` — Retain strict logout replay assertions with safe browser diagnostics

Connector publication may assign different commit metadata/SHAs. The publication
handoff maps each original local commit to its remote counterpart; each tree hash
must match before the new remote branch is created. The original local commits
are preserved, not reset/rebased. The final report's own commit is recorded by its
branch ref and handoff, avoiding a circular self-hash in this file.

## Exact changed-file inventory

- `.github/workflows/quarterly-maintenance.yml`
- `.github/workflows/system-verification.yml`
- `app/Auth/LinkedPasswordUserProvider.php`
- `app/Console/Commands/BootstrapCanonicalSuperAdmin.php`
- `app/Console/Commands/CanonicalAccessPreflight.php`
- `app/Http/Controllers/DataDictionary/DdPeopleLifecycleController.php`
- `app/Http/Controllers/DataDictionary/DdPhase3Controller.php`
- `app/Http/Middleware/AuthenticateEligibleAccount.php`
- `app/Http/Middleware/EnforceCanonicalSession.php`
- `app/Models/User.php`
- `app/Providers/FortifyServiceProvider.php`
- `app/Services/DataDictionary/AccountProvisioning.php`
- `app/Services/DataDictionary/DataDictionaryIdentityResolver.php`
- `app/Services/DataDictionary/LinkedPasswordUpdater.php`
- `app/Services/DataDictionary/TrustedSuperAdminBootstrap.php`
- `bootstrap/app.php`
- `database/proposals/canonical_account_provisioning.sql`
- `docs/security/canonical-only-access.md`
- `phpunit.xml`
- `resources/js/pages/dd-phase3/Workspace.tsx`
- `tests/Browser/authenticated-history.mjs`
- `tests/Browser/passkey-lifecycle.mjs`
- `tests/Browser/passkey-state.php`
- `tests/Browser/prepare-passkey-lifecycle.php`
- `tests/Feature/Auth/AuthenticationTest.php`
- `tests/Feature/Auth/EmailVerificationTest.php`
- `tests/Feature/Auth/HistoryNavigationTest.php`
- `tests/Feature/Auth/PasswordConfirmationTest.php`
- `tests/Feature/Auth/PasswordResetTest.php`
- `tests/Feature/Auth/TwoFactorChallengeTest.php`
- `tests/Feature/Auth/VerificationNotificationTest.php`
- `tests/Feature/DashboardTest.php`
- `tests/Feature/Settings/ProfileUpdateTest.php`
- `tests/Feature/Settings/SecurityTest.php`
- `tests/PasswordSync/DdAuthorizationTest.php`
- `tests/PasswordSync/LinkedPasswordTest.php`
- `tests/PasswordSyncTestCase.php`
- `tests/Quarterly/AccountLifecycleTest.php`
- `tests/Quarterly/AccountLinkagePolicyTest.php`
- `tests/Quarterly/AccountTypeRankTest.php`
- `tests/Quarterly/AdministratorProvisionedAccessTest.php`
- `tests/Quarterly/CanonicalOnlyAuthenticationTest.php`
- `tests/Quarterly/ConcurrentPeriodTest.php`
- `tests/Quarterly/EngineerLifecycleTest.php`
- `tests/Quarterly/MonthlyUpdateRevocationRaceTest.php`
- `tests/Quarterly/PasskeyEligibilityTest.php`
- `tests/Quarterly/PermanentFileDeletionTest.php`
- `tests/Quarterly/PostgresTestCase.php`
- `tests/Quarterly/PostgresTestSchema.php`
- `tests/Quarterly/PreservedRelationshipsTest.php`
- `tests/Quarterly/ProjectAssignmentAuthorizationTest.php`
- `tests/Quarterly/ProvisioningEvidenceTest.php`
- `tests/Quarterly/RoadMetadataRevocationRaceTest.php`
- `tests/Quarterly/RoadMunicipalityChangeTest.php`
- `tests/Quarterly/UnifiedFrontendTest.php`
- `tests/TestCase.php`
- `tests/Unit/MaintenanceProjectAccessTest.php`
- `tests/Unit/MaintenanceProjectCrudTest.php`
- `docs/security/canonical-only-verification.md`

No changes to teammate-owned canonical models/migrations, deletion/reassignment
services, historical-NULL implementation, geometry services, password schema or
AuditLog writers/notification design. Test fixture and stronger auth expectations
around those existing features were updated without changing their business logic.

## Publication privacy boundary

A publication review rejected an earlier document upload because it included
private connector-derived account inventory. Public publication uses sanitized
documentation in every mirrored commit, not only the final snapshot. The original
local history is preserved privately. Runtime code and tests are unchanged by this
document-only separation; the final published tree must match the sanitized local
HEAD. The account-specific preflight is delivered privately to the project owner.

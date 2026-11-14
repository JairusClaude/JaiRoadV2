# Security repair implementation and recovery report

Date: 5 November 2026 (Asia/Manila). Repository: JairusClaude/JaiRoadV2.

## Git baseline and recovery

- Working branch: `fix/security-auth-revocation-passkey-dependencies`.
- Implementation directory: `/workspace/scratch/ad3ceb95fd08/JaiRoadV2-security`.
- Verified source: `Oct10_Front&BackEnd_Merge_Integration` at `3e4a5c55d8b929d51b40f6c9983ba6c993315431`; GitHub's ref was checked again during recovery and remains unchanged.
- Recovered security HEAD: `9cb5af04d112433cf41adb74aa4c10e8a4c6c1aa`.
- Verified implementation/test HEAD after committing recovered work: `49bb7f8f5fd04f168939e40755081ac4a28702b4`.
- The final documentation-only commit containing this report is recorded by the branch ref, accompanying Git bundle and final handoff SHA. This report does not embed its own circular commit hash.
- Original worktree remains on the integration branch at `ece98d6ef3874c9a2480635ac1fe13328c0096e7`, clean; all original local-only history is preserved.
- Remote: `https://github.com/JairusClaude/JaiRoadV2.git`; no credentials embedded.
- No changes have been pushed. The GitHub security-branch ref returned 404 when checked during recovery. No PR, merge, deployment or workflow dispatch was performed.

### Recovered checkpoint

| Task | State found | Verified evidence already saved | Remaining work at recovery |
|---|---|---|---|
| SEC-001 / QA-001 | Tested and passing, committed | Real PostgreSQL lock wait, revoked and active controls; nonblocking busy lifecycle guard; full canonical suite | Final documentation |
| SEC-003 / QA-004 | Tested and passing; three final test-harness files uncommitted | Actual WebAuthn registration/login/revocation, session/security denial, origin/RP/ownership/replay and actual password recovery | Commit those exact tested files |
| SEC-002 | Tested and passing, committed | Administrative provisioning with NULL verification; authorized Engineer operations and Viewer denial | Final documentation |
| SEC-004 / QA-013 | Patched, audited and locally tested, committed | Zero Composer/npm findings; only five Symfony version changes and a scoped development npm override | Fresh audit snapshot and explicit Docker/CI limits |

Before interruption, the six commits through 9cb5af0 implemented the application corrections, dependency updates, tests and focused notes. Only `tests/Browser/passkey-lifecycle.mjs`, `passkey-state.php` and `prepare-passkey-lifecycle.php` were dirty; no staged or unrelated untracked source was found. Their saved passing browser log is newer than all three files and includes their final assertions. They were preserved and committed, not recreated.

After recovery: inspected complete diffs and saved evidence, rechecked GitHub refs, reran targeted PHP/JS syntax/Pint/ESLint/Prettier checks, refreshed both dependency audits, checked protected-file and controller-method boundaries, committed the recovered harness changes and wrote this report. Unchanged long suites were not unnecessarily repeated. No new runtime feature was added during recovery.

## A. Implemented fixes and security proof

### SEC-001 — RoadCoverage metadata authority

Only `DdOperationsController::saveRoad()` changed in that controller. A waiting edit obtains the road row first, then tries the existing shared lifecycle advisory key without waiting. Busy lifecycle work returns retryable HTTP 409 and rolls back, avoiding an inverse lock wait with lifecycle-first held workflows. Once authority is acquired, login/account/profile and relevant EngineerLGU rows are frozen in consistent order, the canonical actor/role and LGU permission are rechecked, and locks remain until business change plus current audit writes commit.

The original six-case regression on the vulnerable source produced **3 failures / 3 passes / 36 assertions**: Admin deactivation, Engineer deactivation and retirement still returned 302. After repair those cases reject without metadata/geometry/audit changes, and active controls commit. Revoked LGU scope is denied. A seventh case proves a request returns 409 while another connection still holds the exclusive lifecycle guard; it does not wait in reverse order. The focused road/geometry/municipality/assignment run passed **98 tests / 1,039 assertions**. The final canonical suite includes all seven cases.

The municipality double-confirmation path, existing coordinates, history and audit policy were not rewritten. Adjacent ordinary save methods that reuse captured actors remain a separate investigation, not claimed fixed here.

### SEC-003 — Passkey eligibility and management

Actual Chromium virtual-authenticator testing first confirmed the gap: valid signed WebAuthn proofs established Laravel sessions for inactive, retired, missing-linked, mismatched-linked, mismatched-email and mismatched-hash canonical accounts whose password logins failed. DD business controllers still denied invalid canonical identities; this was not a demonstrated DD data leak.

FortifyServiceProvider now registers the installed package's supported `Passkeys::authorizeLoginUsing` callback. It verifies the resolved Laravel User/credential owner and applies the existing canonical resolver to explicitly linked accounts. No duplicate role/linkage algorithm, email/ID fallback or vendor-source modification was introduced. Legacy-only authentication keeps its existing compatibility path.

`AuthenticateEligibleAccount` is Fortify's supported authenticated middleware and also protects Security Settings. It rejects invalid linked identities at credential-management endpoints while allowing revoked users to log out. A route-scoped handler maps the exact expected WebAuthn proof-verification exception to a generic credential 422; unrelated failures remain visible.

The actual browser test proves:

- Successful registered passkey authentication for all four canonical roles and a legacy-only control.
- NULL verification timestamps do not block valid users.
- The six invalid canonical states fail passkey and password login consistently; no new accepted session remains at dashboard, Security Settings or passkey options.
- Existing revoked sessions cannot manage credentials and can still log out.
- Consumed challenge replay, correctly signed wrong-origin and wrong-RP proofs, and another user's credential confirmation are rejected.
- After an actual Fortify password reset, the already-registered passkey still authenticates; old password fails, new password succeeds, and credential IDs/ownership remain unchanged.

Private virtual-authenticator material and reset tokens are held only in the isolated test process, not in reports. Counter/last-used metadata may legitimately change after cryptographic verification; the test does not confuse those counters with credential reassignment.

### SEC-002 — Explicit provisioning policy, optional email ownership

Public registration remains disabled; unknown login emails create no account. Properly activated administrator-created Admin/Engineer/Viewer accounts may access their permitted workflows with NULL `email_verified_at`. Application route groups no longer advertise mandatory `verified` enforcement. Fortify's signed email confirmation remains optional ownership confirmation; User intentionally does not implement mandatory MustVerifyEmail. No verification timestamp is mass-written and password recovery is unchanged.

Existing canonical role/LGU/ManagingEngineer restrictions remain authoritative. New tests provision through the real administrative endpoint, authenticate with NULL verification, create/edit authorized projects, reject another LGU, create eligible activity/monthly data, upload document/media through mocks and reject Viewer writes. CreatedBy remains attribution, not a newly invented creator-only project permission.

Legacy-only and bare unlinked public.users logins retain historical Eloquent compatibility, but cannot obtain canonical authority by email or numeric-ID coincidence. Retiring every bare legacy login or proving historical administrative provenance requires a separate product decision; no mass account change or new provisioning schema was invented.

### SEC-004 — Minimal compatible dependencies

| Package | Before | After | Scope |
|---|---|---|---|
| symfony/http-foundation | 8.1.9 | 8.1.11 | Transitive production |
| symfony/http-kernel | 8.1.4 | 8.1.11 | Transitive production |
| symfony/routing | 8.1.2 | 8.1.11 | Transitive production |
| symfony/serializer | 8.1.4 | 8.1.11 | Transitive production |
| symfony/yaml | 8.1.9 | 8.1.11 | Transitive development |
| minimatch under TypeScript-ESLint parser | 10.2.6 | 11.0.4 | Transitive development, parent-scoped override |
| @isaacs/nonrecursive-glob-match | Not installed | 1.0.3 | New development dependency required by minimatch |

Composer used an inspected patch-only partial update and minimal changes; **no other Composer package versions changed**, and composer.json is unchanged. Laravel/Fortify/passkey majors are preserved. npm uses a narrowly scoped actual patched dependency, not an advisory ignore. The current parser still requests vulnerable 10.x; its actual matching API was compared in six positive/negative/dot-path cases. Node22 CI and Node24 local are compatible; Node18 is no longer supported by this overridden development dependency.

Composer advisories: **10 → 0**. npm affected package entries: **7 moderate → 0 at every severity**. Fresh recovery audits also report zero. Package installation did not prove every advisory exploitable in JaiROADS; the exact inventory/ranges/exposure and override rationale are in `dependency-repair-2026-11-05.md`.

The isolated crafted base-path primitive returned an attacker-style authority under HttpFoundation 8.1.9 and an empty base URL under 8.1.11. Four Laravel Feature cases preserve legitimate port/TLS/trusted-forwarded-host asset URLs and reject that crafted base path. This is library/application HTTP evidence, not a claimed production-server penetration test.

## B. Exact changed files and reasons

Production changes:

- `app/Http/Controllers/DataDictionary/DdOperationsController.php`: saveRoad transaction authority only; other methods byte-equivalent to source.
- `app/Providers/FortifyServiceProvider.php`: supported passkey pre-login callback.
- `app/Http/Middleware/AuthenticateEligibleAccount.php`: current canonical eligibility for Fortify credential management, with logout preserved.
- `bootstrap/app.php`: narrow WebAuthn verification-error response.
- `config/fortify.php`: authenticated middleware selection and optional email-confirmation policy comment.
- `app/Models/User.php`: policy documentation only; authenticatable model, fields and architecture unchanged.
- Listed route files below: remove ineffective mandatory verification declarations; existing auth/role/controller scopes retained. Settings additionally uses eligible-account middleware for its Security page.
- `composer.lock`, `package.json`, `package-lock.json`: only reviewed dependency resolution/override.
- Two workflow files: recognize the security branch and add a guarded actual WebAuthn browser job; no existing check removed or weakened.

Added tests: RoadMetadataRevocationRaceTest (7 cases), PasskeyEligibilityTest (4 role cases), AdministratorProvisionedAccessTest (4 cases), AssetAuthorityTest (4 cases), and the actual WebAuthn browser harness/guarded fixtures. Existing passing tests were not deleted or weakened.

Complete baseline-relative inventory, including documentation:

- `.github/workflows/quarterly-maintenance.yml`
- `.github/workflows/system-verification.yml`
- `app/Http/Controllers/DataDictionary/DdOperationsController.php`
- `app/Http/Middleware/AuthenticateEligibleAccount.php`
- `app/Models/User.php`
- `app/Providers/FortifyServiceProvider.php`
- `bootstrap/app.php`
- `composer.lock`
- `config/fortify.php`
- `docs/security/administrator-provisioned-access.md`
- `docs/security/dependency-repair-2026-11-05.md`
- `docs/security/passkey-lifecycle.md`
- `docs/security/road-metadata-revocation.md`
- `docs/security/security-repair-verification.md`
- `package-lock.json`
- `package.json`
- `routes/admin-dashboard.php`
- `routes/dd-frontend.php`
- `routes/dd-phase3.php`
- `routes/lgus-preview.php`
- `routes/monthly-updates-actions.php`
- `routes/monthly-updates-preview.php`
- `routes/project-documents-actions.php`
- `routes/project-documents-preview.php`
- `routes/road-sections-preview.php`
- `routes/role-dashboard.php`
- `routes/settings-preview.php`
- `routes/settings.php`
- `routes/superadmin-dashboard.php`
- `routes/user-management.php`
- `routes/web.php`
- `tests/Browser/passkey-lifecycle.mjs`
- `tests/Browser/passkey-state.php`
- `tests/Browser/prepare-passkey-lifecycle.php`
- `tests/Feature/Auth/AssetAuthorityTest.php`
- `tests/Quarterly/AdministratorProvisionedAccessTest.php`
- `tests/Quarterly/PasskeyEligibilityTest.php`
- `tests/Quarterly/RoadMetadataRevocationRaceTest.php`

## C. Verification evidence and actual commands

| Check | Actual final local result | Evidence |
|---|---|---|
| Canonical PostgreSQL | **331 passed; 3,975 assertions** | full-quarterly.log |
| Password synchronization | **56 passed; 331 assertions** | full-password.log |
| PostgreSQL Feature | **49 passed; 351 assertions; 2 skipped** | full-pg-feature.log |
| Standard Laravel/Pest | **105 passed; 678 assertions; 2 skipped** | full-laravel.log |
| Actual WebAuthn lifecycle/recovery | **Passed** | passkey-fixed.log plus assertions in passkey-lifecycle.mjs |
| Full unified Laravel/Fortify browser | **Passed** | full-unified-browser.log |
| Composer strict validation/platform | **Passed** | composer-validate.log / platform-reqs.log |
| Current Composer/npm audits | **0 advisories / 0 vulnerabilities** | refreshed audit responses on recovery |
| Pint / PHPStan | **Passed / 0 errors** | full-pint.log / full-phpstan.log |
| ESLint / Prettier / TypeScript | **Passed** | full-eslint.log / full-prettier.log / full-typescript.log |
| Production Vite build | **Passed** | full-vite.log; large-chunk/performance notices retained, not suppressed |
| Route verification | **153 routes** | full-routes.log |
| Tracked PHP syntax | **285 files; 0 failures** | Refreshed recovery-full-syntax.json |
| Node geometry / field contracts | **Passed** | node-geometry.log / node-contracts.log |
| Native entrypoint guards | **5 passed** | entrypoint-guards.json; not Docker image acceptance |
| New-SHA GitHub Actions | **NOT RUN** | No publication authorized; no new-SHA green claim |
| Docker image build/runtime | **NOT RUN** | No Docker/Podman/Buildah/nerdctl executable in environment |

Do not sum these as unique tests: PostgreSQL Feature repeats the Feature portion of the standard suite. The two registration skips are intentional existing disabled-feature cases, not passing tests. The new direct HTTP test independently verifies GET/POST registration is unavailable. Baseline race failures are expected negative proof, not unresolved final failures. No final executed regression test remains failing.

Commands actually used include:

```bash
composer lint:check
composer types:check
composer validate --strict --no-check-publish
composer check-platform-reqs
composer audit --locked --no-interaction
npm ci
npm run lint:check
npm run format:check
npm run types:check
npm run build
npm audit --audit-level=high
php artisan route:list --except-vendor
php artisan test --compact --display-skipped
php vendor/bin/pest --configuration=phpunit.quarterly.xml --display-warnings --fail-on-warning
php vendor/bin/pest --configuration=phpunit-passwords.xml --display-warnings --fail-on-warning
php vendor/bin/pest --configuration=phpunit.premerge-feature.xml --fail-on-warning
node --experimental-strip-types tests/Browser/saved-geometry.mjs
node --experimental-strip-types tests/Browser/field-contracts.mjs
node tests/Browser/unified.mjs
node tests/Browser/passkey-lifecycle.mjs
```

Browser commands used the full guarded disposable configuration, loopback PHP server and synthetic fixture, not standalone Node preview sessions. PostgreSQL was version17, freshly initialized loopback-only, explicit testing environment/approval, empty DB_URL, correctly named databases, with guards inspected before fixture DDL. Storage was intercepted/faked or a local private-object mock. Standard tests used SQLite memory. The raw runtime evidence lives outside the repository in `/workspace/scratch/ad3ceb95fd08/security-repair-evidence`; synthetic token/fixture files and application logs are not bundled as public evidence.

The full browser run exercised four-role real Fortify navigation, safe saved geometry, duplicate-quarter warning/input retention, project/Q2/monthly/file persistence, all visible monthly sort/year filters, 24 directory/viewport measurements at six widths, file confirmation/retry/CSRF, municipality confirmation, cross-LGU and Viewer HTTP denial, and logout/Back/old-tab/session expiry. Existing held relationship tests ran unchanged against disposable proposal fixtures; passing them does not approve their business policies.

Recovery verified unchanged source state before reusing these results. The only dirty files at interruption were the three browser-harness files already covered by the later saved passing run. Targeted syntax/style checks and current audits were refreshed after recovery; no need to recreate or rerun the long unchanged business suites.

## D. Compatibility, teammate overlap and safety

- Architecture remains Fortify/public.users with explicit dd_user_account_id → canonical UserAccount. No direct UserAccount-authentication refactor.
- Password updater/provider, broker recovery, MFA/recovery codes, role values, EngineerLGU and manager checks remain intact; actual registered passkey after password recovery now has browser proof.
- No canonical model, migration, physical schema definition, frontend component, geometry representation, AuditLog service or held deletion service changed.
- No implementation of cascade/bulk/record deletion, manager reassignment/unassignment, nullable/detached history, or parent file deletion was attempted.
- Overlapping integration files: DdOperationsController saveRoad only; FortifyServiceProvider; config/fortify; bootstrap/app; route middleware declarations; dependency locks; workflow files. Review those hunks against any later teammate changes. Do not replace whole controller/route files or blindly overwrite newer work.
- Account lifecycle and explicit municipality transition code are not rewritten. Current audit/notification semantics (including pre-existing policy discrepancies) are preserved.
- No shared Supabase connection or write, real account/passkey mutation, Storage object operation, migration, seeder, permission change, history rewrite, merge or deployment occurred.

## E. Commits and local-only handoff

The focused implementation commits are:

- `06407460248ce91994c6607acbd9d354599131ea` — Protect RoadCoverage metadata commit authority after lock waits
- `8757c9d606f095d77727b503b905a93778dd87e5` — Enforce canonical lifecycle eligibility for real passkey authentication
- `4c6f8e64ade1a4df8ae7547427ed55daeea09349` — Apply repository lint conventions to WebAuthn regression harness
- `0905336d4eff5a907ee5ea345d9dec0b7a182134` — Make administrator provisioning the explicit account activation policy
- `26bf9937cfb845ec9bb776b642996e1f8b745c2b` — Avoid inverse lifecycle waits while holding RoadCoverage locks
- `9cb5af04d112433cf41adb74aa4c10e8a4c6c1aa` — Patch vulnerable Symfony packages and scoped minimatch tooling dependency
- `49bb7f8f5fd04f168939e40755081ac4a28702b4` — Verify registered passkeys across actual Fortify password recovery

A final documentation-only commit records this recovery report. All verified source and test changes are committed on the intended security branch; the final handoff separately records its exact SHA and checks a clean working tree. Original branch refs/history remain unchanged. Nothing was pushed.

For selective integration, treat `0640746` **and** `26bf993` as the complete
SEC-001 set; the latter is required for the nonblocking lifecycle-lock ordering.
SEC-003 comprises `8757c9d`, harness lint `4c6f8e6`, and recovered recovery proof
`49bb7f8`. SEC-002 is `0905336`; SEC-004 is `9cb5af0`. Do not cherry-pick the
initial race correction without its lock-order follow-up. No history was
squashed, reset or rebased during recovery.

## F. Remaining blockers and review recommendation

1. **Docker acceptance pending:** install/provide a Docker-capable disposable runner or run the unchanged Docker CI job after authorized publication. Native guard checks and Laravel asset tests do not replace image/Nginx/PHP-FPM validation.
2. **GitHub Actions pending on final SHA:** both workflows are configured for the security branch, including the new actual WebAuthn job. Publication is explicitly not authorized, so no push/dispatch was used to obtain green checks. Historical baseline runs are not claimed as new-commit evidence.
3. **Existing legacy-login policy:** bare legacy Eloquent authentication remains for compatibility and cannot grant canonical access. Retiring that compatibility requires a separate owner decision.
4. **Outside this repair:** adjacent ordinary-save revocation windows, audit event/notification/no-op policy and held deletion/NULL-history/assignment decisions remain separately owned. No scope expansion or unapproved schema workaround was made.
5. **Tooling support:** development minimatch override requires Node20 or >=22; configured CI Node22 is supported. Keep the override reviewed until the upstream parser naturally accepts the patched series.

The implementation is suitable for **local team review with the stated Docker/CI acceptance gaps**. It is not certified fully CI-green, approved for merge or approved for deployment. Stop at this handoff until separate publication/integration authorization.

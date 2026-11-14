# JaiROADS — Task 11 full-system and role acceptance plan

**Status: automated acceptance coverage + human execution plan. Human UAT NOT performed.**  
Prepared 2026-11-07 on review-only branch `fix/full-system-role-acceptance`, stacked after [PR #15](https://github.com/JairusClaude/JaiRoadV2/pull/15). All official Supabase and operational identity changes remain unapproved.

## Exact scope, test environments, and nonclaims

The current integrated system includes Fortify/React/Inertia, the canonical `jairoads_next` PostgreSQL model, strict Admin/Engineer/Viewer eligibility, privately bootstrapped SuperAdmin, append-only AuditLog, multi-recipient notifications, quarterly records, monthly updates, project preservation, private file access and login/passkeys. An existing **disposable** PostgreSQL 17 CI fixture, local private-Storage mock, artificial map providers and Chromium virtual WebAuthn already cover broad workflows.

**New Task 11 automation:** `tests/Browser/role-acceptance.mjs` is called during `tests/Browser/unified.mjs` using the *same four real Fortify browser sessions* and a separate unauthenticated browser context. It checks **5 unauthenticated routes, 6 role-matrix GET routes × 4 roles and 7 unauthorized POST attempts using actual CSRF cookies**. These are HTTP authorization tests, not merely checks that a button is hidden.

**There is still no approved persistent isolated staging app** with real production-style credentials/SMTP/HTTPS WebAuthn/private Storage. The original Task 11 branch made 0 official schema migrations and 0 live user-account corrections. **Later, on 2026-11-14, six hosted migrations were deliberately applied and runtime LOGIN verified outside that Task 11 branch; no real account corrections, human UAT, staging Render deployment or production cutover occurred.** A green CI result is evidence for the synthetic test scope, not evidence of real operator credentials, service delivery, client devices or actual users' acceptance.

The older branches `main` and `integration/road-coverage-login` diverged and remain unmerged pending the teammate's review. The combined integration candidate contains the actual teammate `integration/dd-system-completion` ancestor plus draft PRs #6–#14.

## Role-based acceptance matrix

| Role | Permitted behavior | Explicitly forbidden behavior | Evidence source |
|---|---|---|---|
| Guest | Public login page; no preview credentials | Protected dashboard, user directory, business/audit reads, notifications, business mutations | New browser matrix + existing Fortify/UI tests |
| SuperAdmin | Own canonical dashboard, account/Engineer/LGU administration, scoped business and complete AuditLog history, eligible notifications | Public signup; creating additional SuperAdmin through normal account provisioning; self-lockout/last root; audit edits | New browser matrix + SuperAdmin recovery + full canonical tests |
| Admin | Create/manage ordinary accounts, EngineerLGU/LGU, ordinary business CRUD, full retained AuditLog and notification feed | Privileged root bootstrap; inherited Engineer assignments beyond explicitly granted role; fabricated reviewed-transition evidence | New browser matrix + canonical eligibility, provenance and role tests |
| Engineer | Read current active LGU scope, road/map/project/quarterly/monthly/document work within assignment, self notification | Account and LGU governance, other LGU/private files, record unassignment not authorized, unassigned business changes, audit history | New browser matrix + unified browser + authorization/concurrency tests |
| Viewer | Read the permissible canonical dashboards, roads/projects/records and safe reporting | Every create/edit/delete endpoint and form, privileged audit history and other recipients' notifications | New browser matrix + unified/frontend/audit tests |

## Test execution register

Legend: **Automated** means there is repository/CI coverage to be checked at the exact code revision. **Human pending** means the authorized tester must still execute it in persistent isolated staging; neither a CI badge nor this document counts as a manual pass.

| ID | Scenario / expected result | CI or code evidence | Human status |
|---|---|---|---|
| QA-01 | Guest returns 401 for protected JSON resources and never gains a session | `role-acceptance.mjs` | Human pending |
| QA-02 | Four roles log in using actual Fortify, have role-appropriate dashboard and no sample credentials | `unified.mjs` / `role-acceptance.mjs` | Human pending |
| QA-03 | Manager-only user directory, full AuditLog and ordinary account/Engineer/LGU governance; unauthorized 403 | `role-acceptance.mjs`, `AccountLinkagePolicyTest` | Human pending |
| QA-04 | New Admin/Engineer provisioning creates a real new Active Engineer profile atomically with UserAccount, Fortify link, and immutable administrator provenance; Viewer may have no Engineer profile but still requires legitimate provenance; existing ordinary accounts require individually reviewed transition evidence | `PostDemoAccountCreationTest`, `AccountLinkagePolicyTest`, `ReviewedAccountTransitionTest` | Human pending |
| QA-05 | SuperAdmin survives password reset and MFA/passkey recovery; last eligible root cannot be disabled | `SuperAdminRecoveryReadinessTest`, `passkey-lifecycle.mjs` | **Real operator recovery pending** |
| QA-06 | Engineer cannot access records/roads/files in another LGU or create Admin accounts | `role-acceptance.mjs`, `UnifiedFrontendTest`, `unified.mjs` | Human pending |
| QA-07 | Viewer cannot access forms or issue create/update/delete, even with direct POST URLs | `role-acceptance.mjs`, `UnifiedFrontendTest` | Human pending |
| QA-08 | Draw multi-point road from map, save/return/edit metadata; stored geometry unchanged unless intentionally edited | `unified.mjs`, `RoadGeometryEditingTest` | Human pending |
| QA-09 | Legacy/complex road formats stay safe, unrecognized geometry not silently replaced | `unified.mjs`, `RoadReferenceLoadingTest` | Human pending |
| QA-10 | Authorized road municipality change requires review/confirm; cancel and stale preview have no write | `unified.mjs`, `RoadMunicipalityChangeTest` | Human pending |
| QA-11 | Create project attached to authorized road; project/record identities and author snapshots persist | `unified.mjs`, `FullMaintenanceWorkflowTest` | Human pending |
| QA-12 | Quarterly MaintenanceRecord is unique per project/year/quarter; duplicate insert denied; ProjectID and ManagingEngineerID remain NOT NULL with ON DELETE RESTRICT and no detached/null project history | `OptionalSchemaActivationTest`, `DuplicatePeriodWarningTest`, `PreservedRelationshipsTest` | Human pending |
| QA-13 | Monthly update filters, chronological order, duplicate-month denial and bounded progress | `unified.mjs`, `MonthlyReportingFiltersTest` | Human pending |
| QA-14 | Real user upload/download/individual exact-object delete/retry and durable Storage intent | `unified.mjs` with Storage mock, `PermanentFileDeletionTest` | **Real private Storage pending** |
| QA-15 | Reject deletion of any project with dependent MaintenanceRecords; only an empty project may be deleted by authorized Admin/SuperAdmin with confirmation and audit; ManagingEngineer may be reassigned to an eligible real Engineer, never unassigned to NULL; retain existing history | `PreservedRelationshipsTest`, `unified.mjs` | Human pending |
| QA-16 | Single AuditLog per successful mutation, no event on no-op/error, unique eligible notifications incl. Engineer actor | `audit-notifications.mjs`, `AuditNotificationConsistencyTest` | Human pending |
| QA-17 | Immutable/paginated privileged audit snapshots, redacted notifications; historical LOGIN retained but new auth not in business audit | `audit-notifications.mjs`, `FinalSecurityReadTest` | Human pending |
| QA-18 | Revoked/deactivated/retired/invalid ordinary accounts denied on password, passkey, sessions and mutation races | `CanonicalOnlyAuthenticationTest`, `passkey-lifecycle.mjs`, `OrdinaryMutationRaceTest` | Human pending |
| QA-19 | Logout/Back/Forward/expired cookie cannot restore access | `authenticated-history.mjs` | Human pending |
| QA-20 | Mobile/tablet desktop breakpoints: navigation/forms/dialogs accessible, no horizontal overflow, keyboard and focus controls usable | `responsive-directories.mjs`, `unified.mjs` | **Device/assistive-tech pending** |
| QA-21 | Real SMTP reset delivery; token expiry and successful canonical/Fortify hash sync | `IntegrationCompatibilityTest` with mail sink | **Real SMTP pending** |
| QA-22 | Actual approved HTTPS RP ID, origin and signed WebAuthn register/login/lost-device recovery | `passkey-lifecycle.mjs` on virtual authenticator | **Real-device HTTPS pending** |
| QA-23 | Actual map routing/geocoding permissions, provider terms, rate limits/CORS, graceful manual draw fallback | `unified.mjs` with route/geocoding mocks | **Real providers pending** |
| QA-24 | Test restricted Laravel HTTP business reads/writes, forbidden operations, RLS, auxiliary tables and rollback under independent persistent staging credentials; official role's successful direct psql LOGIN/SELECT is useful preflight but does not substitute for this | `restricted-auth-http-smoke.py`, `rehearse-atomic-migrations.sh` | **Persistent staging and real Laravel HTTP pending** |
| QA-25 | Backup/restore, monitoring, slow requests and concurrency under realistic data volume; no secret/log leakage | Existing race and Docker fail-closed tests | **Operational rehearsal pending** |

## Manual execution and evidence requirements

Use the [UAT record template](uat-execution-template.md) separately for each tested build and environment. Use synthetic/authorized staging accounts assigned by an actual operator. Test from a real browser (desktop and narrow mobile), exercise both normal and malicious/denied paths, and collect: case ID, exact candidate SHA, staging URL **redacted if private**, role, tester, timestamp, expected/actual result, sanitized screenshot or request IDs, pass/fail/blocked, severity and defect issue. Do **not** paste real passwords, recovery codes, access tokens, raw audit old/new private fields, engineer personal data, attachment contents or hosted credentials.

A **QA automated pass** is meaningful only when the exact commit's full and focused CI and browser test suites report success. A **human PASS** requires an actual human reviewer and evidence; ChatGPT cannot sign it off or claim execution from GitHub CI alone.

### Release blocking gates (all must be explicit and complete)

- Original Data Dictionary owner approves policy differences and preservation semantics.
- Schema owner approves proposed security and optional tables, existing trigger protection, genuine restricted role, RLS/grants, approved rollback/recovery.
- Official Admin/Engineer linkages receive real identity checks and truthful `reviewed_transition` evidence after authorized review; actual SuperAdmin account recovery succeeds privately.
- Persistent isolated staging is configured with approved mail, Storage, HTTPS passkey and map providers; user workflows pass there.
- All critical/high issues are fixed and re-tested; authorized user representatives accept the actual version, real browser/device paths and legacy-branch disposition.
- Owner approves migration window, production backup, signed release commit, deployment/rollback monitoring. **Do not merge or deploy solely because Task 11 CI is green.**

**Task 11 may be called code-level test-ready after green CI; manual UAT is explicitly NOT complete until these human and service-level gates pass.**

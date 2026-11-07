# Audit/notification repair verification

Date: 6 November 2026 (Asia/Manila).
Source branch/head: `fix/canonical-only-provisioned-auth` /
`239af5db1d864fedbd58a55a2a9ca7779aaf69ce`.
Working branch: `fix/audit-multirecipient-consistency`.

## Implementation checkpoints

- `aa76f94dbc962b2d4b7b7ea33d9af823b201bcf7` — Centralize canonical business events and append-only recipient deliveries.
- `fd9e89b5b4c43d16fd513aaf537e472880f32cf6` — Verify audit snapshots, lifecycle recovery, normalized no-ops and real recipient-scoped browser feeds.

The final documentation commit is identified by the branch ref/publication handoff.
Connector publishing can change commit metadata/SHAs; each uploaded tree must be
verified against its local counterpart. The final code/file tree must be identical.
Original local commits are preserved. No other development branch is modified.

## Actual local results

| Check | Result |
| --- | --- |
| Canonical PostgreSQL 17 suite | **390 passed / 4,422 assertions** |
| New focused consistency cases (included above) | **19 passed / 159 assertions** |
| Additional document/media notification-failure recovery cases | **2 passed**, included in canonical total |
| Password/DD PostgreSQL regressions | **56 passed / 330 assertions** |
| PostgreSQL Feature suite | **49 passed / 344 assertions / 2 existing skips** |
| Standard Laravel/Pest suite (disposable PG17) | **105 passed / 649 assertions / 2 existing skips** |
| Actual Fortify/unified browser | **Passed**, including new feeds and privileged history pagination; all four roles, private files, retained history, municipality, quarters, sorting, logout/back/tab/expiry |
| Responsive browser | **24 directory/viewport checks**, included in unified run |
| Actual WebAuthn browser | **Passed**: four roles; valid registered assertions, legacy/inactive/retired/link/email/hash/evidence denials, replay/origin/foreign credential rejection, reset, remember-me and Viewer provisioning |
| Pint / PHPStan | **Passed / zero errors** |
| ESLint / Prettier / TypeScript / production Vite build | **Passed** |
| Composer strict validation / Composer audit | **Passed / zero advisories** |
| npm audit | **Zero vulnerabilities at all severities** |
| PHP syntax | **295 PHP files / zero failures** |
| Routes | **154 routes**, including one GET-only canonical audit view |
| Local Docker | **NOT RUN**: no Docker/Podman/Buildah/nerdctl executable |

Feature totals overlap with the standard suite; they are not additive unique-test
counts. The two pre-existing registration skips remain because public registration
is disabled; real-stack tests separately assert GET/POST registration is unavailable.
No new skip, test removal, analyzer exclusion, audit ignore or assertion relaxation.

New evidence covers multi-Admin/SuperAdmin audiences and Engineer self-delivery,
invalid recipient eligibility, exact normalized snapshots, byte-identical history,
actor rename/deactivation, booleans/nulls/decimals, key-order-insensitive JSON with
coordinate order/dimensions retained, no-op timestamps, audit/delivery/late-commit
rollback, top-level retry, restrictive FK failure, append-only triggers, unique
pairs, least-privilege/RLS reads, full-history HTTP role gates and no auth events.
Existing lifecycle tests now assert distinct membership composite keys and no new
delivery to the retired user. Durable file recovery tests inject recipient failure
after real mocked object deletion and verify exactly one reconciled success.

All mutating tests used positively guarded, empty disposable PostgreSQL 17 clusters
and private Storage mocks. No shared Supabase SQL, records, Storage or migrations
were changed. No canonical model or teammate migration was edited.

## Investigated failures during implementation

- The first synthetic deadlock test was nested in the fixture transaction. It was
  corrected to exercise Laravel's real top-level retry, with guarded committed
  fixture cleanup. Assertions still require one final record/event/delivery set.
- Existing tests' old ID-only actor format and aggregate DELETE payload expectations
  were updated to exact username snapshots, NULL DELETE after-values and separate
  actual record detachments. Historical rows still must remain byte-identical.
- Append-only rehearsal now uses TRUNCATE CASCADE so the new restrictive FK cannot
  short-circuit the original trigger assertion; it still requires SQLSTATE 55000.
- JSON normalization initially lost the established empty-object/array compatibility
  of unchanged complex-geometry resubmissions. The existing geometry-preservation
  suite caught this. The original compatibility comparison was retained alongside
  canonical digest equality; saved geometry is not rewritten.
- The RLS test needed RESET ROLE after a successful nested savepoint because SET
  LOCAL ROLE lasts for the enclosing transaction. The real permission/RLS assertions
  remain required and pass.
- The browser helper now sends actual Inertia headers for PUT redirects and fetches
  current Inertia props instead of the initial-page script after client navigation.
  No production redirect/assertion was weakened.
- One local parallel Vite build removed generated font CSS during HTTP tests. Logs
  identified the missing manifest asset. The full suite reran after the build and
  passed; CI jobs have isolated filesystems. Do not rebuild while browsers/HTTP
  suites are running in the same worktree.

## CI and activation boundary

Both existing focused and full workflows include this dedicated branch. All
original jobs and security audits remain enabled, including real browser and
production Docker acceptance against disposable PostgreSQL/Storage mocks.
[Live branch CI runs](https://github.com/JairusClaude/JaiRoadV2/actions?query=branch%3Afix%2Faudit-multirecipient-consistency).
The final publication handoff must give the actual run URLs/conclusions on the
same final SHA; earlier branch results must not be substituted.

This is **not deployment approval**. Schema owner must approve/rehearse/apply the
auxiliary delivery schema, reconcile canonical append-only triggers and restrict
runtime grants/RLS/API exposure. The reviewed strict-account/provenance transition
and existing file-intent/history schema prerequisites still apply. Missing delivery
schema blocks mutations and rolls them back; no best-effort notification loss.
Trusted initial database-operator bootstrap remains out-of-band: no false canonical
actor is invented. Operator/security telemetry, if wanted, needs separate design.

Policy/activation handoff: [notification-policy.md](notification-policy.md).
Exact before/after method inventory: [writer-reader-inventory.md](writer-reader-inventory.md).

## Exact changed files

- `.github/workflows/quarterly-maintenance.yml`
- `.github/workflows/system-verification.yml`
- `app/Http/Controllers/Dashboard/DdSuperAdminLandingController.php`
- `app/Http/Controllers/DataDictionary/DdAuditHistoryController.php`
- `app/Http/Controllers/DataDictionary/DdOperationsController.php`
- `app/Http/Controllers/DataDictionary/DdPeopleLifecycleController.php`
- `app/Http/Controllers/DataDictionary/DdPhase3Controller.php`
- `app/Http/Controllers/DataDictionary/DdRoleDashboardController.php`
- `app/Http/Controllers/JaiRoadsNotificationsController.php`
- `app/Providers/AppServiceProvider.php`
- `app/Services/DataDictionary/DataDictionaryIdentityResolver.php`
- `app/Services/DataDictionary/DdActivityNotifications.php`
- `app/Services/DataDictionary/DdAuditValues.php`
- `app/Services/DataDictionary/DdDashboardAnalytics.php`
- `app/Services/DataDictionary/DdOperationAudit.php`
- `app/Services/DataDictionary/PreservedProjectDeletion.php`
- `app/Services/Files/PermanentFileDeletion.php`
- `database/proposals/audit_notification_recipients.sql`
- `docs/audit/notification-policy.md`
- `docs/audit/verification.md`
- `docs/audit/writer-reader-inventory.md`
- `resources/js/components/dd-dashboard-analytics.tsx`
- `resources/js/pages/dd-phase3/AuditHistory.tsx`
- `routes/dd-phase3.php`
- `tests/Browser/audit-notifications.mjs`
- `tests/Browser/prepare-unified.php`
- `tests/Browser/unified.mjs`
- `tests/PasswordSync/DdAuthorizationTest.php`
- `tests/PasswordSyncTestCase.php`
- `tests/Quarterly/AuditNotificationConsistencyTest.php`
- `tests/Quarterly/EngineerLifecycleTest.php`
- `tests/Quarterly/IntegrationCompatibilityTest.php`
- `tests/Quarterly/PermanentFileDeletionTest.php`
- `tests/Quarterly/PostgresTestSchema.php`
- `tests/Quarterly/PreservedRelationshipsTest.php`
- `tests/Quarterly/RoadMunicipalityChangeTest.php`
- `tests/Unit/DdNotificationAudienceTest.php`

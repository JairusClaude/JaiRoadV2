# Final verification after post-merge repairs

Branch: `Oct10_Front&BackEnd_Merge_Integration`. Starting remote commit, freshly verified: `e7a4c609980808959780fdf61388f4c82365cddf`. The commit containing this report adds a narrowly reproduced MonthlyUpdate authorization correction and verification tests; it does not add a feature. GitHub Actions results for that exact commit are the final CI evidence, linked in the accompanying completion report.

## Merge integrity

Both original reviewed source commits remain ancestors: frontend `05033c752a8c7182fac9364dbb03c536b7dc682c` and backend `c9ee10a145effa517b03c5d643266e194c123d4b`. Merge `b35b8414bf239c4cc20d67f56ff849cb26c3bd81` has those two parents. No original merge was repeated. Canonical models and all database files still compare unchanged against the reviewed backend source. Local audit documentation/merge commits are retained separately and are not included in this focused publication.

The preserved implementation includes real Fortify authentication, the explicit `public.users.dd_user_account_id` bridge and synchronized password hashes (not a direct UserAccount cutover), all four roles, account/Engineer lifecycle, active EngineerLGU scopes, two-stage municipality impact confirmation, explicit manager reassignment, independent quarterly periods, monthly reports, private attachments, existing AuditLog writers and recipient-scoped notification reads. The standalone Node preview is not production authentication or storage.

## Repair status and executable evidence

| Issue | Status | Evidence / boundary |
| --- | --- | --- |
| Newest / oldest monthly ordering | FIXED | `MonthlyReportingFiltersTest`: reporting-month order with deterministic ID ties; real browser exercises both options. |
| Recently Modified | FIXED | Same suite changes an older report's timestamp independently of ID and report month; browser exercises the visible option. |
| Reporting Year | FIXED | Filters/year choices use actual authorized `update_month`, including a 2027 report whose parent maintenance year is 2026; combined filters and pagination covered. |
| Complex saved geometry safety | FIXED | `RoadGeometryEditingTest`, saved-geometry checks and real browser: unsupported editor formats are read-only; metadata/municipality/Cancel preserve exact stored GeoJSON. |
| Full MultiLineString/GeometryCollection/higher-dimensional editing | NOT COMPLETED, intentionally deferred | The repair supplies safe read-only geometry rather than a new editing engine. Accepted line collections still render. |
| Monthly directory tablet overflow | FIXED | Browser measures document width at 320, 390, 768, 820, 1024 and 1440 pixels across four directories; controls, contained tables and navigation exercised. |
| Logout / browser history | FIXED in exercised flows | Real Fortify logout, old-cookie replay, Back/Forward, reload, other tab and expired-cookie acceptance. Full hardware MFA/passkey ceremonies remain NOT TESTED. |
| Canonical field contracts | FIXED | `FrontendFieldContractTest`, explicit preview/canonical payload checks, typed adapters; server-controlled creator/uploader fields remain protected. |
| Road-editor reference payload | FIXED | `RoadReferenceLoadingTest`: authenticated LGU-scoped viewport/keyset pages, every page followed, exact geometry and safe response fields; browser waits for reference lines before mapping. |
| Other large choosers/history | PARTIALLY FIXED | `LeanFormChoicesTest`: lightweight/context-scoped projections, all 110 authorized choices and 300 history rows retained, batched eligibility bounded by query-count assertions. Global project coverage picker and metadata lists still grow eagerly/linearly. |
| Remote searchable project picker, paginated history years, spatial index | NOT COMPLETED, follow-ups | No arbitrary cap hides choices. No index/schema change is authorized. |
| Duplicate MaintenanceRecord warning | FIXED | Dedicated panel, occupied labels, authorized details link, input retention, stale-server conflict; PostgreSQL and real-browser tests. Direct HTTP and genuinely competing workers cannot create another same-project/year/quarter record. |
| Monthly save authority after lock wait | FIXED after reproduction | Eight new independent-connection cases verify project-lock waiting, six post-revocation denials with unchanged reports/audits, and two successful controls. |
| File deletion/retention, temporal editing, audit replacement | BLOCKED by unresolved policy | Existing restrictions/preparation remain; no destructive policy is inferred or enabled. |

Performance measurements remain in [road references](../../performance/road-references.md) and [form/history payloads](../../performance/frontend-payloads.md), with raw 1/100/500/1000 fixtures. At 500 roads the initial road form falls from 2,000,172 to 1,066 JSON bytes (five to four SQL queries). Deferred visible references add 916,354 bytes, six SQL queries and 302.862 ms aggregate server time. Initial browser interaction improves in that fixture, but all-reference completion is slower. These are warmed local synthetic observations, not production p95 or a fresh benchmark of this backend-only verification correction.

## Reproduced race and focused correction

Before changing application code, two independent Laravel/PostgreSQL connections exercised POST and PUT with account deactivation, LGU revocation, manager reassignment and unchanged controls. The blocker held the project's row then its record's row, matching explicit reassignment's order. `pg_stat_activity` proved that the original MonthlyUpdate worker waited on the **record**, not the project. Creation succeeded and committed a report/audit after each of the three revocations; editing also committed after deactivation. Existing edit checks already denied LGU revocation and reassignment. [Before evidence](monthly-race-before.json) records the base commit, controller hash and four unsafe committed outcomes. Eight pre-fix assertions failed: four authorization assertions and four required project-serialization assertions; this is not eight distinct exploits.

`DdOperationsController::saveUpdate` now locks project then record, verifies the parent still matches, re-resolves the canonical identity and rechecks current record/LGU/manager authority after those waits, before changing data. Existing validation, duplicate-month checks, creator attribution and transactional business/audit writes remain. Project-level serialization can increase contention among saves within one project; production throughput is not benchmarked here. The same method serves the canonical operations route and merged frontend adapter.

`MonthlyUpdateRevocationRaceTest` observes a real project-lock wait, not a timed guess. Six revoked create/edit requests return 403 with byte-identical report and audit snapshots; unchanged POST/PUT controls return 302 and commit one business event using the existing notification architecture. This establishes the tested parent-lock boundary, not a claim that every other operation or possible concurrent authorization change is serializable.

`FinalSecurityReadTest` additionally checks all four roles against the actual notification endpoint: exact safe fields, authenticated recipient scope despite a conflicting recipient parameter, no audit mutation route, unchanged historical rows, and refusal of the same session after account deactivation. The password suite separately rehearses update/delete/truncate audit guards on its disposable fixture; live guards were not modified or freshly inspected here.

## Verification and reproducibility

Use the existing guarded `PostgresTestCase`, empty loopback PostgreSQL 17 databases and `JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY`. Never point these suites at shared Supabase. `MonthlyUpdateRevocationRaceTest.php` invokes `monthly-concurrency-request.php`; the worker checks the local testing target, uses a real HTTP kernel on a separate connection and sets a bounded lock timeout. Cleanup affects only published disposable fixtures. No migration command is required.

The final CI commit must execute both existing workflows, without changing workflow coverage or thresholds: Composer audit; npm audit at the existing high-severity threshold; Pint; PHPStan; ESLint with zero allowed warnings; Prettier; TypeScript; Vite; standard Laravel tests; routes; PostgreSQL Feature, canonical and password suites; unified browser; Docker runtime acceptance. The two pre-existing registration tests are skipped in the standard and PostgreSQL Feature suites and must not be counted as passes. Full counts and run URLs belong to the exact commit's logs.

Local targeted execution: **12 tests / 72 assertions passed** (eight race cases plus four notification-role cases). Local canonical suite: **257 passed / 3,124 assertions**. Password regressions: **56 passed / 331 assertions**. PostgreSQL Feature: **45 passed / 205 assertions, two existing skips**. PHPStan and Pint passed before publication. Earlier failures caused by the deliberately uncorrected baseline are retained as reproduction evidence rather than suppressed or counted as passing tests.

Browser acceptance uses real Laravel/Fortify and canonical PostgreSQL. Tiles, geocoding/routing and private Storage providers are mocked. Live provider availability, production Storage, real-device MFA/passkey ceremonies, production concurrency/load and a complete shared-schema provisioning rehearsal remain **NOT TESTED**. Docker tests exercise a built production image, assets, real four-role PostgreSQL authentication, mock private downloads, bad configuration and an unreachable disposable database; no deployment or shared initialization occurs.

## Remaining defects, decisions and owner handoff

- npm currently reports **15 moderate affected dependency entries**, principally the minimatch advisory chain through tooling. The unchanged audit job passes at `--audit-level=high`; passing is not a claim of zero advisories. Review compatible fixes separately; no force upgrade, ignore list or weakened audit is introduced. The final run is authoritative for any newly published advisory.
- Global project coverage selection remains eager. Lean choice/history lists still grow linearly; unindexed viewport JSONB work and individual very large geometries can be expensive. These are documented performance limits, not hidden result caps.
- Existing AuditLog LOGIN events, recipient fan-out/self-notification, no-op auditing and incomplete snapshots remain inherited dictionary deviations. Existing writers/history/read contracts are preserved, and `auditLog_behavior` is not merged. Replacing them with Supabase Auth logs or pgAudit still requires an explicit design preserving business actor attribution, history, notifications and retention.
- Client/team decisions remain: parent/historical deletion; document/media object retention; older or completed-period MonthlyUpdate editing; exact MIME/size limits; retirement handover/restoration; contact-number nullability; final quarter/date semantics; audit/notification policy. Rank and Account Type are already distinct. The old D02 municipality note predates the approved impact-review/double-confirmation operation; that implemented municipality workflow is not newly blocked. Historical project-to-different-road reassignment remains separately restricted.
- **Schema owner:** freshly inspect duplicates and approve the existing [project/year/quarter UNIQUE proposal](../../reconciliation/maintenance-period-constraint-proposal.md); rehearse its actual constraint error path. Review dated live/baseline migration drift, identity/default/grant/trigger coverage, supporting indexes based on measurements, and future geometry indexing only as a separate proposal. Current fixtures are not a production migration plan.
- **Security/schema owner:** review the previously observed `public.rls_auto_enable` SECURITY DEFINER grants and RLS/bucket configuration in the intended deployment environment. Those dated warnings are not a newly demonstrated RPC exploit; no privileged invocation, live catalog refresh or grant change is performed here.

With final same-SHA checks green, the branch is suitable for continued **scoped, reviewed development**, retaining these boundaries and unresolved decisions. This is not deployment approval, proof of complete Data Dictionary conformance, approval for destructive file/history deletion, or permission to merge main.

## Published post-merge repair commits

| Scope | Commit |
| --- | --- |
| Canonical navigation baseline | `b10bcd69e79e2c7bb923eeb9f29ab1ac6af03652` |
| Monthly sort/reporting year | `ca6476c624186e377aefe977fa7271d918589fac` |
| Normalized filter URLs | `cdbea73455da581d82bbc1d89a3be3ece8f05be1` |
| Modified-versus-insertion test | `d1b76ec924af40b68fa3de6f45186ad8c34117f9` |
| Saved geometry safety | `0d1f45f8a9678ee62968b9c93fbaf06740325f98` |
| Tablet filters | `3d996e5a41a4e7f379630b0180b17d5ef6b180fe` |
| Authentication history | `f06a36668a5f3569304caf22bb327d2e28fef470` |
| Field contracts | `0c3786046b9838e58f1057384292200f9340bf4a` |
| Viewport road references | `746c0958a3fe8639b08a6544bba4472ac840a291` |
| Lean choices/history | `5c62bec97878ae03c8f9de89001a6fe03158af09` |
| Duplicate warning | `e7a4c609980808959780fdf61388f4c82365cddf` |

Relevant changed source: `DdFrontendController.php`, `DdOperationsController.php`, `ManagingEngineerEligibility.php`, `RoadReferenceBounds.php`, `DuplicateMaintenancePeriod.php`, `TwiceYearlyMaintenance.php`, `routes/dd-frontend.php`, `bootstrap/app.php`, monthly/record DTOs and adapters, road form/map/geometry helpers, record form/editor/warning components and `resources/css/maintenance-projects.css`. The report's own commit changes only the monthly-save boundary, its race worker/tests, the notification read tests and this evidence/report. All original source histories and prior repairs remain preserved.

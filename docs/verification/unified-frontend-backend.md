# Unified frontend and canonical backend

Working branch: `Oct10_Front&BackEnd_Merge_Integration`.

## Sources and conflict decisions

The branch starts at frontend `05033c752a8c7182fac9364dbb03c536b7dc682c` and merges backend `c9ee10a145effa517b03c5d643266e194c123d4b`. Merge base: `2fc1fa6680627b04a0fe5dd4b615b1583181d854`. Both source histories are retained; PR #5 was closed without merging and was not used as evidence of integration.

Fourteen actual conflicts were reviewed individually. Backend versions of the conflicting legacy PHP controllers, mutation service and bulk-delete request preserve verified attribution, authorization and history safeguards. Frontend project pages, record directory, form and shell retain their visual design and receive canonical projections. The backend login already has the same photographic design; its real Fortify form and passkey/MFA handling replace the frontend's sample-credential props. The application entry keeps backend role layouts while mounting the reviewed frontend for the integrated modules. The dependency merge retains backend patched versions and adds only Leaflet, its types, and the frontend popover dependency.

One additional compatible patch updates `symfony/mime` from 8.1.4 to 8.1.10 for PKSA-wtxr-p26d-nn42 / CVE-2026-45070, disclosed after the backend checkpoint. Composer's local post-update Boost hook requires `APP_ENV=local`; it executed successfully in that environment. Generated Boost guidance changes were not retained.

## Real application interfaces

`routes/dd-frontend.php` and `DdFrontendController` serve `/dd-phase3/ui` roads, projects, records, monthly updates and documents. These are canonical `jairoads_next` read projections, not translations of legacy public IDs or Node sessions. Writes delegate to the existing DD operations and therefore retain live identity checks, LGU/manager authorization, validation, transactional audit insertion and upload compensation. Canonical actor IDs and creator/uploader references are never accepted from preview form fields.

Existing `/dd-phase3` administration, dashboards, lifecycle, reassignment, audit, notification and settings interfaces remain available. Sidebar entry links open the integrated modules. Legacy-route quarantine stays in place. Engineer listing/choice queries are scoped through active EngineerLGU assignments. The UI's capability flags complement backend guards; direct HTTP requests remain protected.

The RoadCoverage editor keeps two/three-point mapping, manual tracing, location search and routing. Public provider endpoints are configurable in `config/jairoads_maps.php`; provider requests contain coordinates or search terms, not account credentials. External provider availability is not guaranteed. Ordinary information edits omit unchanged GeoJSON; the backend preserves the stored value. The read-only road/project maps display every vertex and preserve separate lines for all accepted line/collection GeoJSON shapes. They do not rewrite storage or recalculate recorded length. Municipality changes use the existing server-generated impact preview, signed confirmation token, locks, manager eligibility rechecks and one atomic transition event; the confirmed redirect is restricted to the exact canonical road-details URL.

Project/quarterly/monthly forms save real canonical rows. The new UI maps its historical presentation field names to the current controller contract without changing schema fields. Independent Q1–Q4 and duplicate validation remain authoritative on the server. Existing creator, manager and period fields stay locked on ordinary record edits; administrators use the separate approved reassignment action.

Monthly reports save separately from Media. Media uploads use the existing private, compensated one-file operation after the report is saved. Documents attach to MaintenanceRecord and use the existing private upload/download and metadata-update operations. File paths, service keys and upload credentials are not sent in page props. Private downloads still pass through authenticated Laravel authorization. Destructive document/media replacement, removal, bulk deletion and preview-only delete controls are unavailable in these canonical pages pending retention decisions.

The legacy MaintenanceProject relationship additionally recognizes the frontend's historical `maintenance_records_id` spelling, alongside backend `maintenance_id` and older project-level linkage. This is explicit schema inspection for legacy compatibility, without any schema alteration or canonical model changes. The preserved frontend regression test caught this merge conflict in behavior.

## Production versus preview

The photographic production login has no populated demo credentials or demo-account list. The Node preview server is an opt-in tool only; it is not started by Laravel, Docker or authentication. Production no longer initializes its demo-session guard. Archived review scripts and design-exploration pages remain historical prototypes, not alternative canonical endpoints. Their lint repairs retain assertions and add explicit Node imports; no exclusions or disabled checks were added.

The integrated shell uses real canonical notifications, role-aware navigation and Laravel logout. Inertia history encryption and login/logout history clearing prevent the UI logout/back path from restoring the previous authenticated page. Server authorization always rechecks the live session/account.

The shared workspace component uses the original frontend canvas on canonical pages. Retaining the older backend's nested canvas there had removed the directory gutter and caused mobile overflow; actual browser tests identified and verified the focused fix.

Tracked `public/build` and generated Wayfinder helpers from the frontend snapshot are removed from version control. Existing ignore rules already cover them. The supported Vite/Wayfinder build regenerates them for the final route contract; source images and review evidence are retained. Standard Laravel storage directory placeholders are restored so clean checkouts render views and write only their local runtime files.

## Verification scope

All database execution used fresh guarded PostgreSQL 17 databases on loopback, plus the standard SQLite in-memory tests. Storage used a local HTTP mock or HTTP fakes. No shared database, migrations, policies, live object or real account was changed. Canonical models and migration files remain identical to the backend source.

Executed on the combined working tree:

- Canonical/quarterly PostgreSQL: **173 tests, 2,166 assertions**, including 13 new adapter cases and all original 160 cases.
- Password PostgreSQL: **56 tests, 331 assertions**.
- PostgreSQL Feature: **41 passed, 173 assertions; 2 existing registration skips**.
- Standard Laravel: **97 passed, 500 assertions; 2 existing registration skips**. Self-registration is disabled by the existing approved Fortify configuration; these are not newly skipped failing assertions.
- Saved-geometry projection: **8 assertions**, including MultiLineString and nested Feature/Geometry collections, no mutation, no invented connection between separate lines.
- PHP syntax, Composer validation/audit, Pint, PHPStan, ESLint, Prettier, TypeScript, production build and route registration are checked against the combined source. Exact final CI run links and commit are recorded in the completion report.

`tests/Quarterly/UnifiedFrontendTest.php` covers canonical page contracts for all four roles, LGU scoping, persisted geometry/project creator, unchanged complex geometry, all four quarters and duplicates, monthly validation, Viewer HTTP denial, existing-session lifecycle revocation, private upload/path exclusion/access denial, explicit reassignment and audit-failure rollback.

`tests/Browser/unified.mjs`, prepared by `prepare-unified.php`, runs the real Laravel application with real Fortify cookies. It covers four role logins, the new Leaflet editor/search with two then three control points, persistent road/project/Q2/monthly/media/document creation, private download and cross-LGU denial, Viewer HTTP denial, municipality Cancel/Confirm and geometry preservation, four responsive directories and logout/back. Only external map providers and private Storage are mocked; canonical application responses and mutations are not intercepted or simulated. Photographs use their configured URLs when available. The local real-browser run completed successfully with no browser exceptions. All four 390px directories fit the viewport, with wide tables contained in their own scrollers. Logout/back shows the login form and a subsequent protected HTTP request redirects to login.

Both focused and full-system workflow branch triggers include the quoted new branch without removing source triggers. The full workflow adds a disposable PostgreSQL/Laravel browser job. Its original Docker build/runtime acceptance remains mandatory. There is no local Docker daemon in this workspace; Docker evidence must come from the actual CI job, not from a substituted local build claim.

## Remaining decisions and limits

- File/parent history retention and destructive file deletion remain subject to the team's existing policy decisions.
- Custom audit/notification architecture is unchanged; `auditLog_behavior` was not merged, and no historical event was rewritten or deleted.
- npm's configured high-severity audit threshold passes. The current advisory database also reports 15 moderate development-tool findings rooted in minimatch GHSA-g3hv-75wg-m249; npm proposes an incompatible tool downgrade rather than a safe compatible fix. No ignore entry or forced downgrade was applied.
- Inertia can keep the former protected URL in the address bar after Back while rendering the login form. The session is invalid, protected requests redirect, and authenticated content is absent; a later UI refinement can normalize that URL.
- Vite reports the existing optional fontaine fallback warning and a large geographic-boundary chunk. Neither warning is suppressed. SSR-server operation and real third-party map-provider/network availability are not claimed by this browser/local-Storage rehearsal.
- Design-exploration copies and the standalone Node demo remain preview-only; approved production workflows use the canonical routes described above. Unapproved deletion/replacement operations are deliberately unavailable.

This integration does not constitute a new full-system audit, production deployment, migration approval or approval to merge into main.

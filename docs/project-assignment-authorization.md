# Task 2: Engineer project creation and maintenance assignments

Continues Task 1 at `b712655c14bac8e6ebafc58f319b3ce302dfd45c` on the existing local `Quarterly/Role/Assignment_Update` branch. Task 2 publication destination: `EngineerProjectAssignment_Update`.

## Project creation

The existing `DataDictionaryIdentityResolver` verifies the canonical account bridge, active account, matching credentials/email, allowed role/link and active linked Engineer profile. Existing `DdRoleAccess` gates distinguish administrative authority, scoped Engineer operations and read-only Viewer access. These services were inspected and remain unchanged.

An Engineer's project creation/update additionally checks their own active account/profile and matching active EngineerLGU inside the project transaction. Shared locks hold the eligibility rows until the business change and existing audit insert finish. The municipality always comes from the selected RoadCoverage; submitted municipality, creator or project-assignment fields are not trusted. CreatedBy remains the authenticated canonical UserAccount ID. Existing one-project-per-coverage validation/locking is preserved.

The DD project directory/editor uses the backend's create/update/delete capabilities. Eligible Engineers can open Add Project and submit the native DD form; Viewer remains read-only and Engineers have no deletion rights.

## ManagingEngineer selection

Project Details queries manager choices for its RoadCoverage's actual municipality. Choices require an active linked canonical Engineer account, an Active Engineer profile and an active matching EngineerLGU. An Admin may additionally select their own active linked Engineer profile with that assignment. The exception is self-management: this task does not authorize assigning another Admin or a SuperAdmin/Viewer as a professional manager.

The same query validates new record submissions inside the existing parent-project transaction, using shared locks on eligibility rows. The dropdown is guidance; the endpoint performs the checks again. Engineer callers can select only their own verified identity. Admin/SuperAdmin can choose eligible Engineers. Missing, inactive, retired, unlinked or differently assigned candidates are rejected. Each quarterly record may have a different eligible manager, while ordinary edits cannot change an existing record's project or manager. The source's active-profile restriction on ordinary edits remains in place.

An Engineer may edit only records managed by their own profile while their current LGU assignment remains active. Existing inactive-account/retired-profile session restrictions, Viewer prohibitions, administrative gates and immutable assignment checks remain enforced on direct HTTP requests. CreatedBy confers no management privilege.

## Boundaries and separate decisions

MaintenanceProject has no saved manager. An Admin can create an empty project and select a ManagingEngineer when recording actual maintenance. Permanent assignment before any MaintenanceRecord exists needs a separately approved schema decision; this branch adds no column, table or temporary selection presented as persisted assignment.

No canonical models, migrations, physical schema, shared Supabase records, AuditLog behavior, password synchronization or document/storage code changed. Account provisioning and Account Type/Rank terminology cleanup are excluded. Existing unlinked Admin accounts retain administrative access without fabricated Engineer identities. The source's audit helper remains inside the business transaction unchanged; integration with separate AuditLog work remains separate.

## Verification

`tests/Quarterly/ProjectAssignmentAuthorizationTest.php` runs with the existing guarded PostgreSQL 17 infrastructure in `phpunit.quarterly.xml`. It covers Engineer form access and creation, creator attribution, forged fields, missing/duplicate coverage, wrong or inactive LGU assignments, inactive/unlinked/retired identities, Admin/SuperAdmin empty projects and manager selection, Admin self-management, manager choices, own-record scope, Viewer restrictions, and reassignment/deletion denial. Run the full configuration to retain Task 1 scheduling/concurrency coverage.

Use only an empty disposable loopback PostgreSQL 17 database named `jairoads_scratch_<suffix>`, with `JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY`. See `docs/twice-yearly-maintenance.md` for the guarded invocation. No shared database is used.

Browser verification uses a separate empty guarded database: prepare with `php tests/Browser/prepare-assignments.php`, then run `node tests/Browser/assignments.mjs` using the same local application and `QUARTERLY_BROWSER_FIXTURE`/`QUARTERLY_BROWSER_URL`/Playwright settings documented for Task 1. It exercises Engineer Add Project → own record and Admin empty project → self-managed period → another eligible Engineer for the next period. It also checks that Engineer manager selection is limited to self and deletion is unavailable.

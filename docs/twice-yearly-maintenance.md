# Task 1: twice-yearly maintenance

Approved business decision: a long-term MaintenanceProject has two maintenance periods per calendar year, using Q1 → Q3 or Q2 → Q4. Synchronize this decision with the official Data Dictionary's previously unresolved quarter-frequency question. Source: `feature/jairoads-map-demo` at `73129e9f9fc357438015e7ccd9430dd8e8dafc51`.

## Behavior

A project may initially have zero records. Its first record establishes Q1/Q3 or Q2/Q4; the same pair applies across years. Examples: 2026 Q1 → 2026 Q3 → 2027 Q1; 2026 Q2 → 2026 Q4 → 2027 Q2. The pattern is inferred from complete persisted history, never a limited listing or a new project field.

The next expected period follows the latest chronological record: first half → same year's second half; second half → next year's first half. Annual cards separately show missing earlier periods. Authorized users can enter legitimate missing historical maintenance. A second-half record requires its first-half counterpart in that year. Missing years are visible through the year selector and are not automatically backfilled.

Creation checks run inside the existing business/audit transaction after a parent-project row lock. This serializes competing requests before checking duplicates and the established pair. Mixed patterns, third periods and duplicate project/year/quarter submissions are rejected. Existing conflicting/duplicate history is preserved and flagged for administrator review; new periods are blocked for that project. No repair or schedule-change endpoint is introduced.

StartDate must match MaintenanceYear and the selected calendar quarter. Duration is a positive integer. Completed requires CompleteDate ≥ StartDate; Ongoing requires NULL CompleteDate. Ordinary edits can change actual start date, duration and other authorized details while preserving project, manager, year and quarter. Expected future slots are guidance only. Preparing/canceling a form never creates a record; status must be explicitly chosen before saving.

Project Details shows the annual pair, yearly completeness, current records, manager names and next expected period. The quick action preselects project/year/quarter and suggests a date within that quarter. A successful save returns to the same project's refreshed details. Details use the complete project history even when the general listing's 300-record limit would omit older records.

## Boundaries and remaining team decisions

This task preserves the source branch's account permissions, manager eligibility checks and existing audit helper. Engineer assignment, Admin self-management and Account Type/Rank changes are excluded. No authentication, AuditLog service, canonical model, migration, table definition, document/storage handler or shared Supabase data is changed.

Application locking protects cooperating application requests. The schema owner should separately consider uniqueness on `(project_id, maintenance_year, quarter)` after reviewing historical duplicates. No constraint or migration is added here. Historical corrections and approved schedule changes require a separate reviewed workflow.

## Disposable PostgreSQL 17 tests

Requirements: PHP 8.4, Composer dependencies and an **empty disposable PostgreSQL 17 database** on loopback, named `jairoads_scratch_<suffix>`. Guards reject other hosts/names, database URLs, production/Render environments and other PostgreSQL versions. Tests invoke the existing guarded baseline unchanged and create test-only public authentication fixtures. No standard migrations, seeders or shared credentials are used.

```sh
JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY \
DB_DATABASE=jairoads_scratch_quarterly DB_USERNAME=postgres DB_PASSWORD=local-test-password DB_PORT=5432 \
PAO_DISABLE=1 php vendor/bin/pest --configuration=phpunit.quarterly.xml
```

Use a fresh empty database for every suite run. Ordinary fixtures roll back. The concurrency test commits disposable fixtures so two independent HTTP-kernel processes can compete, confirms both PostgreSQL lock waits, and verifies one success, one validation rejection and one persisted record. Its cleanup is restricted to the guarded disposable database.

For browser testing, use a separate empty disposable database with the same guard/environment. `php tests/Browser/prepare-quarterly.php > /tmp/quarterly-fixture.json` prepares an Admin and a project only in that database. Start the local application with file sessions and local PostgreSQL TLS (the source connection requires TLS). Build frontend assets, then run:

```sh
QUARTERLY_BROWSER_URL=http://127.0.0.1:8000 \
QUARTERLY_BROWSER_FIXTURE=/tmp/quarterly-fixture.json \
JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY \
node tests/Browser/quarterly.mjs
```

The browser runner requires Playwright (or `PLAYWRIGHT_MODULE` pointing to an installed module) and Chromium (`CHROME_EXECUTABLE` may select an existing binary). It verifies Q2 creation, refreshed Q4 expectation, correct date prefill, no automatically saved future record and immutable existing manager selection. Fixtures use disposable test credentials only.

# Task 3: Account Type and Engineer Rank

Continues the published Task 2 commit `c88e2815f4ad7dd774d87ea8b49475be40a0bbf7`. Work stays on the existing local `Quarterly/Role/Assignment_Update` branch; Task 3 publication is `PositionCleanup_Update`.

## Active DD presentation

UserAccount forms, account listings, Settings identity summaries, SuperAdmin privileged-account summaries/distribution and related DD account-scope copy use **Account Type**. The values remain exactly SuperAdmin, Admin, Engineer and Viewer. Account provisioning continues to submit canonical `account_type`; the existing restrictions on which types may be provisioned remain intact. Internal `role` aliases in verified identity/authorization APIs are unchanged.

The active `/dd-phase3/users` Engineer form already uses **Rank**, and its backend already requires `rank` without a Position value. The form now explicitly explains that Rank is professional standing while Account Type controls permissions. Engineer associations, passwords, validation, account status and provisioning permissions are unchanged. There is no separate DD Engineer profile-edit endpoint or dedicated account-type filter in this source; this cleanup adds neither. Existing profile/association displays retain Rank.

No backend business code is changed. A guarded PostgreSQL test simulates an independent professional-rank update in disposable fixtures and verifies that account type, Engineer link, password hashes, status, resolved identity and capabilities stay intact. A Rank value matching an account-type name does not grant permissions.

## Navigation and legacy compatibility

DD ordinary-role navigation, DD SuperAdmin navigation and quick actions already use `/dd-phase3/users`. `DenyLegacyBusinessRoutesForDd` redirects exact read-only `/user-management` entry requests to the DD directory and blocks legacy Engineer/account mutation paths. Real HTTP regressions and browser navigation verify this boundary; it was not broadened or weakened.

Legacy `public.engineers.position` remains present and required by the legacy physical/controller contract. `routes/user-management.php` still reads it; `app/Http/Controllers/UserManagement/EngineerAdministrationController.php` and legacy `resources/js/pages/user-management/Index.tsx` still support it for legacy users. No column, legacy controller or legacy form was removed or renamed. Geographic marker-position variables and attachment Content-Disposition headers are unrelated and untouched.

Retiring legacy forms or dropping/mapping Position needs a separate route/data reconciliation plan approved with the schema owner. Confirm remaining legacy-only accounts and required fields, then review migration/retirement separately; do not silently map Position to Rank or direct DD requests to legacy tables. This task performs no such database or account migration.

## Verification

Run `php vendor/bin/pest --configuration=phpunit.quarterly.xml` using the existing explicit disposable PostgreSQL 17 guard. `tests/Quarterly/AccountTypeRankTest.php` covers Rank-required/Position-free Engineer creation, canonical Account Type provisioning, credential/link preservation, restricted type creation, Rank independence, safe DD directory fields and legacy-route isolation. Task 1/2 tests remain unchanged in the same suite.

For browser verification, use a separate empty guarded local PostgreSQL database and prepare `tests/Browser/prepare-account-terminology.php`. Run `tests/Browser/account-terminology.mjs` with the fixture, local application and Playwright settings documented for Task 1. It checks all four Account Type values, Rank creation, request field names, Engineer association, new-login compatibility, Settings/SuperAdmin terminology and DD-native navigation. Fixture credentials are disposable only.

Quarterly scheduling, project assignments, models/migrations, physical schema, AuditLog behavior, password synchronization, storage and shared database records remain outside this task.

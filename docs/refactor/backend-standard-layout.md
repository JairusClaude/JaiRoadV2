# JaiROADS backend structure cleanup — review only

**Status:** source refactor committed on `refactor/standard-backend-layout`, not merged, not deployed, and **not** runtime-validated against the operator's local Docker application. Official Supabase is unchanged.

## Why the nested folders existed

The project originally kept a second set of controllers/services under `DataDictionary/` so newly schema-qualified `jairoads_next` operations could be developed without immediately rewriting older public-table controllers. That separation made integration safer, but it also left duplicate-looking classes in multiple locations.

This refactor removes the nested `DataDictionary` backend folders and uses ordinary Laravel names at their actual responsibility level, following the instructor's resource-oriented project structure. **It changes PHP code organization and imports only, not the PostgreSQL schema, role-based rules or external HTTP URLs.**

## Examples: previous → new

| Previous | New |
|---|---|
| `app/Http/Controllers/DataDictionary/DdPhase3Controller.php` | `app/Http/Controllers/DirectoryController.php` |
| `app/Http/Controllers/DataDictionary/DdOperationsController.php` | `app/Http/Controllers/OperationsController.php` |
| `app/Http/Controllers/DataDictionary/DdFrontendController.php` | `app/Http/Controllers/OperationsFrontendController.php` |
| `app/Http/Controllers/DataDictionary/DdAuditHistoryController.php` | `app/Http/Controllers/AuditHistoryController.php` |
| `app/Http/Controllers/DataDictionary/DdPeopleLifecycleController.php` | `app/Http/Controllers/PeopleLifecycleController.php` |
| `app/Services/DataDictionary/DataDictionaryIdentityResolver.php` | `app/Services/AccountIdentityResolver.php` |
| `app/Services/DataDictionary/DdRoleAccess.php` | `app/Services/RoleAccess.php` |
| `app/Services/DataDictionary/DdOperationAudit.php` | `app/Services/OperationAudit.php` |
| `app/Models/DataDictionary/Canonical/RoadCoverage.php` | `app/Models/RoadCoverageReference.php` |
| `app/Models/DataDictionary/StagingUserAccount.php` | `app/Models/StagingUserAccount.php` |
| `routes/dd-phase3.php` | `routes/operations.php` |
| `routes/dd-frontend.php` | `routes/operations-pages.php` |
| `app/Http/Middleware/DenyLegacyBusinessRoutesForDd.php` | `app/Http/Middleware/GuardLegacyRoutesForCanonicalAccounts.php` |
| `tests/Feature/DdWorkspaceNavigationTest.php` | `tests/Feature/CanonicalWorkspaceNavigationTest.php` |
| `tests/Unit/DdNotificationAudienceTest.php` | `tests/Unit/ActivityNotificationAudienceTest.php` |
| `tests/Unit/DdRoleAccessTest.php` | `tests/Unit/RoleAccessTest.php` |

Reference models retain the `Reference` suffix because existing `App\Models\RoadCoverage`, `App\Models\UserAccount`, etc., already exist and may be used by legacy code. The read-only protections on canonical reference models are retained. Do **not** collapse two distinct implementations into a single writable model without a separate approved data migration and authorization review.

The middleware name now describes its fail-closed responsibility; `bootstrap/app.php` registers the renamed class and the corresponding feature test follows it. No redirect logic or external URLs were modified.

The route *file names* have changed, but public URL paths such as `/dd-phase3/dashboard` and Laravel route names remain unchanged so users' bookmarks, browser tests and active permissions do not silently break. React page names and the `resources/js/pages/dd-phase3` folder are also **left unchanged** for this backend-only refactor; that frontend rename can be a separately tested pass.

## Free local checks (Windows with Git Bash or WSL)

These commands are for your own already-provisioned **synthetic** Docker workspace. Do not use production credentials:

```bash
# In the JaiRoadV2 repository, keep your old local database safe:
bash scripts/staging/free-local.sh stop

git fetch origin
git switch --track origin/refactor/standard-backend-layout
# If this branch was already checked out locally:
# git switch refactor/standard-backend-layout && git pull --ff-only

# Lint all PHP files; audit PSR-4 namespaces and old references, offline:
php scripts/refactor/verify-backend-layout.php

# Use existing composer packages; do not install a paid service:
composer dump-autoload --no-scripts
php artisan route:list --path=dd-phase3

# Rebuild only the LOCAL application while retaining its synthetic database:
bash scripts/staging/free-local.sh up
bash scripts/staging/free-local.sh smoke
```

The PHP verifier scans application code, routes, tests, bootstrap, database and config. It checks for old class names/namespaces, class-to-file PSR-4 correspondence, the new route includes and `php -l` success. No network/API calls, migrations or staging data mutation are performed by that verifier. **These checks must actually be run on your machine** before marking them PASS. GitHub connector inspection verified the moved file names, updated namespace declarations, and affected references, but did not execute the Laravel application or its test suite.

After starting the rebuilt local app, manually recheck Admin, Engineer, Viewer, SuperAdmin login/dashboard and your routes for roads, projects, audit history, private files (using permitted local mocks only) and permissions. A browser login performed against an older image does **not** validate this refactor.

If the refactor branch fails, stop local containers and switch back to `docs/free-local-staging-no-cloud-cost`, then run `bash scripts/staging/free-local.sh up` to rebuild the previously working image. **Never** use `destroy` to roll back this naming change; it would delete your local synthetic database.

## Intentional limits

This is a code-location/name refactor, **not** permission simplification, database migration, feature completion, framework downgrade, production deploy, or GitHub PR merge. It retains existing restrictive account/canonical identity logic, history/audit protections, and all review-only release gates. The new folder structure must pass independent PHP syntax/route boot and role-based smoke checks before it can be merged into the draft candidate.

**Release remains NO GO**, see [Issue #19](https://github.com/JairusClaude/JaiRoadV2/issues/19).

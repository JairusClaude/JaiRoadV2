# JaiROADS backend

JaiROADS manages local government road coverage, maintenance projects, quarterly maintenance records, monthly updates, and supporting documents. It uses Laravel 13, PostgreSQL 17, and Fortify password authentication. The workspace supports SuperAdmin, Admin, Engineer, and Viewer accounts.

Use the [`main` branch](https://github.com/JairusClaude/JaiRoadV2/tree/main) for the backend review.

## Where to review the backend

| Area | Entry points |
| --- | --- |
| Workspace routes and business operations | [Workspace routes](routes/operations-pages.php), [operation routes](routes/operations.php), and [controllers](app/Http/Controllers) |
| Authentication and role permissions | [Fortify provider](app/Providers/FortifyServiceProvider.php), [identity resolver](app/Services/AccountIdentityResolver.php), and [authorization rules](app/Services/RoleAccess.php) |
| PostgreSQL data model | [Models](app/Models), [disposable schema](tests/Quarterly/fixtures/canonical.sql), and [reviewed database proposals](database/proposals) |
| Business rules and sensitive operations | [Quarterly maintenance](app/Services/TwiceYearlyMaintenance.php), [audit writer](app/Services/OperationAudit.php), and [private file services](app/Services/Files) |
| Automated evidence | [PostgreSQL regressions](tests/Quarterly), [browser workflows](tests/Browser/unified.mjs), and [GitHub Actions](https://github.com/JairusClaude/JaiRoadV2/actions?query=branch%3Amain) |

## Run an isolated reviewer instance

Use PHP 8.4 with `pdo_pgsql` and the extensions required by Composer, Composer 2, Node.js 22.12 or newer, and a local PostgreSQL 17 server. The example uses a local PostgreSQL role named `postgres`. Use your own local role and password if your setup differs.

```bash
git clone --single-branch --branch main https://github.com/JairusClaude/JaiRoadV2.git
cd JaiRoadV2
composer install --no-interaction --prefer-dist
npm ci
touch .env

export APP_NAME=JaiROADS APP_ENV=testing APP_DEBUG=false
export APP_URL=http://127.0.0.1:8000
export DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 DB_URL=
export DB_DATABASE=jairoads_scratch_review DB_USERNAME=postgres DB_SSLMODE=disable
export CACHE_STORE=array SESSION_DRIVER=file QUEUE_CONNECTION=sync MAIL_MAILER=array
export JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY
export APP_KEY="$(php artisan key:generate --show)"
```

If your local PostgreSQL server requires a password, set `DB_PASSWORD` for Laravel and `PGPASSWORD` for `createdb` in your terminal. Then initialize an **empty test database** and start the app.

```bash
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" "$DB_DATABASE"
mkdir -p .free-staging
(umask 077; php tests/Browser/prepare-system.php > .free-staging/fixture.json)
npm run build
php artisan serve --host=127.0.0.1 --port=8000
```

Open [the local sign-in page](http://127.0.0.1:8000/login). The four role emails are in the ignored `.free-staging/fixture.json` file. The synthetic fixture password is `Disposable-Test!123`. The fixture includes sample projects and attachment metadata. The browser suite supplies a local Storage mock for attachment bytes.

Run the PostgreSQL suite against a **second empty database**. The guard will reject a populated database or a remote connection.

```bash
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" jairoads_scratch_review_tests
DB_DATABASE=jairoads_scratch_review_tests php vendor/bin/pest --configuration=phpunit.quarterly.xml --fail-on-warning
php artisan route:list --path=workspace
```

The [Docker-based local guide](docs/release/free-local-staging.md) describes a persistent disposable setup. Hosted account, Storage, recovery, and production acceptance are tracked in the [release checklist](docs/release/operational-readiness-checklist.md) and [release issue](https://github.com/JairusClaude/JaiRoadV2/issues/25).

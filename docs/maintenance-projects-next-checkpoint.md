# Maintenance Projects: audit and environment checkpoint

Follow-up: all three requested Google document tabs are now readable. See
[maintenance-projects-document-alignment.md](maintenance-projects-document-alignment.md)
for the verified comparison and required account-lifecycle controls. The audit
execution and Herd instructions below remain available; exports are no longer
needed for the successfully retrieved tabs.

Continues local commit `1f31ad33739cf57d9c4bff7577795162fa7fd4a9` on
`integration/maintenance-projects`. No reconstruction, new merge, remote fetch,
push, shared-authentication change, database connection, migration, or seeding
was performed in this follow-up. Application source and completed integration
remain intact. Only audit scripts and documentation change at this checkpoint.

## 1. Read-only audit: verified behavior

The psql script was inspected statement by statement. Its server commands are
SELECT, SHOW, BEGIN/COMMIT and SET LOCAL. Every query executed by `\gexec` is a
generated SELECT. Schema/table identifiers use PostgreSQL format `%I` and table
labels use `%L`; no user-provided SQL is interpolated. It does not execute writes,
migrations, schema changes, seeders, shell commands, or backup/restore commands.
`BEGIN ... READ ONLY` provides an additional server-enforced guard.
Timeouts limit each statement to 30 seconds and lock waits to 5 seconds.

The original script has been tightened: no database login name or individual
project IDs are returned; potentially sensitive column defaults are redacted;
history is aggregate counts; enum labels and read-only status are included.
It never selects user passwords, identities, MFA secrets, session contents,
tokens, operational record contents, or geometry.

There are two supported routes. They inspect the current schema; confirm the
database/schema selection locally. A result with missing tables might reflect
the wrong schema or insufficient privileges, not necessarily absent tables.
No schema changes are needed to run either route. Do not grant new privileges
or expose PostgreSQL publicly to accommodate this audit.

### Route A: pgAdmin Query Tool (no terminal required)

1. Download `tools/maintenance-projects-pgadmin-audit.sql` from the provided link.
2. Open pgAdmin and connect to your EXISTING local development server/database.
   Verify it is the intended development database, then open a NEW Query Tool tab.
   Close or finish unrelated transactions in other working tabs first.
3. Open the file and execute the WHOLE script with **Execute script**, not only
   the current statement or a selected fragment. The first stage reads catalogs
   and returns one row with `schema_report` and `data_checks_sql` text columns.
4. Copy/save the COMPLETE `schema_report` cell as `schema-report.txt`. Ensure it
   is not truncated and contains `"read_only": "on"`. Review `schema`/`search_path`
   locally; redact any private schema identifiers consistently if needed.
5. Copy the COMPLETE `data_checks_sql` cell as plain SQL (not CSV quoting or a
   screenshot) into another NEW Query Tool tab connected to the same database.
   It contains only BEGIN READ ONLY, SET LOCAL, a SELECT, and COMMIT. Execute
   the whole generated script. Save its `data_report` cell as `data-report.txt`.
6. Return those two text files. There is no need to return the generated SQL.
   If the first report says no expected tables were found, return that report
   and the message rather than trying to create tables.

The pgAdmin version generates the second stage because actual tables/columns
may differ. It avoids querying nonexistent application tables. Both stages
are read-only; schema and aggregate data are separate snapshots. Report any
schema changes or active development that occurred between stages.

If a query fails or times out, do not retry by removing READ ONLY or changing
the database. Run `ROLLBACK;` in that same tab to clear its transaction and send
only the sanitized error text. Do not export connection properties or user rows.

### Route B: original psql audit

The original `maintenance-projects-database-audit.sql` contains `\set`, `\pset`
and `\gexec`; these are psql client commands and do not work in Query Tool.
In pgAdmin Desktop, select the development database and use **Tools > PSQL Tool**.
Use forward slashes in the file path, for example:

```text
\o 'C:/Users/YOU/Downloads/maintenance-projects-audit.txt'
\i 'C:/Users/YOU/Downloads/maintenance-projects-database-audit.sql'
\o
```

The first and last commands redirect/restore client output; they do not change
database data. The path refers to the machine running pgAdmin. For a remotely
hosted pgAdmin server, use your LOCAL psql client or Route A instead.

Alternatively, in Windows PowerShell with the local PostgreSQL client installed:

```powershell
psql -X -W -h localhost -p 5432 -U YOUR_LOCAL_DEV_USER -d YOUR_DEV_DATABASE -f "C:/path/maintenance-projects-database-audit.sql" -o "$env:TEMP/maintenance-projects-audit.txt"
```

Use the actual local host/port/database privately. `-W` prompts locally for a
password; do not paste it here or put it in command arguments. If psql is not
on PATH, launch PostgreSQL's installed SQL Shell or use its local psql.exe path.
Return the output file and any sanitized errors; remove database login/path
identifiers if the client includes them in errors.

### Expected evidence (either route)

* PostgreSQL version, inspected schema and read-only status.
* Relevant table/column types, nullability, nonsensitive defaults, constraints,
  native enum labels and indexes, including FK delete actions and validation.
* Applied Laravel migration names/batches, or confirmation migration table absent.
* Aggregate row counts for relevant tables, including users/accounts, engineers,
  LGUs, legacy roads, coverages, projects/records, updates/documents/media/audit logs.
* Account role labels grouped by activation state and counts; no account identities.
* Unmapped project and duplicate coverage counts if the coverage column exists;
  aggregate projects-with-history/history-row counts when history exists.

No passwords, credentials, private user records, full table exports or database
dumps are requested. Keep results private rather than committing them to git.
After receiving them, compare actual schema with source migrations and the
dictionary; then present the exact compatible migration plan for approval.

## 2. References

Both Google Docs URLs were retried; neither the Data Dictionary nor the Page
Specifications tab was readable. Please export both (PDF, DOCX, or text), making
sure the page-specification tab is included. No content is inferred from titles.
Your current instruction and the existing implementation govern safe work until
the references arrive. Older fixture/prototype descriptions will not override
the current rule: any MaintenanceRecord blocks deletion; single and atomic bulk
deletion must retain history. The existing UI is preserved, not redesigned.

## 3. PHP/Composer setup: what was actually attempted

PHP, Composer, psql, Docker and PostgreSQL connectivity are unavailable here.
Attempting `apt-get update` failed with denied setgroups/setegid/seteuid operations
and apt permission errors. The normal package-install route is blocked. No PHP,
Composer or PostgreSQL runtime was installed; privilege escalation was not used.
This does not establish that every possible user-space toolchain is impossible,
but there is no verified working PHP environment here. Use Herd for execution.

A temporary Python PostgreSQL parser was available through a user-space install,
so audit SQL can be syntax-parsed without accessing a database. This is not
server execution and does not establish live permissions/schema compatibility.

### Local Herd setup

In Herd's PHP settings, install/select an up-to-date PHP **8.4** patch version
(at least **8.4.1**). The exact lockfile has Pest 5.1.1 requiring 8.4 and PHPUnit
13.3.0 requiring 8.4.1+, despite composer.json's broad PHP 8.3 constraint.
Use the existing integration checkout, with local uncommitted work preserved.

```powershell
herd isolate 8.4
herd which-php
herd php --version
herd php --ini
herd composer --version
herd php -m
```

Herd's `php`/`composer` proxies use the site's isolated PHP version. Also verify
plain `php --version` resolves to 8.4.1+ before using npm build: Wayfinder invokes
the plain `php` command internally. Check `Get-Command php` in PowerShell if the
versions differ; fix the terminal's PHP selection before proceeding.

Required by the app/test workflow: PDO with **pdo_pgsql** for PostgreSQL,
**pdo_sqlite** for the current isolated tests. The direct lockfile
requirements additionally name ctype, date, dom, fileinfo, filter, hash, iconv,
json, libxml, mbstring, openssl, pcre, Phar, Reflection, session, SimpleXML,
tokenizer, xml, and xmlwriter. Many are built in. Composer's platform check is
authoritative for the installed locked packages. curl and zip/unzip are useful
for dependency downloads. Enable missing extensions for the same active PHP
version, then restart the local PHP service as needed and recheck CLI modules.

```powershell
herd composer install --no-interaction --prefer-dist
herd composer check-platform-reqs
npm ci
```

Do not run `composer update`, bypass platform requirements, or run `composer
setup`: this project's setup script automatically runs migrations. Retain the
existing `.env` and APP_KEY; copy the example/generate a key only for a completely
new local environment. Configure your local development PostgreSQL connection
privately and check DB_URL does not override it. Do not paste the configuration.

### Available checks after setup (no application migrations required)

```powershell
herd php artisan config:clear
herd php artisan wayfinder:generate --with-form
npm run build
npm run types:check
npm run lint:check
npm run format:check
herd composer lint:check
herd composer types:check
```

Review the repository's phpunit.xml first: it selects in-memory SQLite and clears
DB_URL. Verify no external environment override/config cache redirects testing
to the populated development database. Run the suite with that isolated test
configuration only:

```powershell
herd php artisan test
```

Existing Feature tests use RefreshDatabase and execute migrations in the test
database. Their SQLite result is regression evidence only. The project-specific
CRUD tests construct their own SQLite schema/test identity adapter. PostgreSQL
migration behavior, concurrency, real account authorization and persisted CRUD
still require later checks against approved/disposable development/test targets.

Return command versions and success/failure summaries with sanitized errors.
Do not send phpinfo dumps or environment listings. If real errors remain after
Wayfinder generation, fix only the confirmed offending shared files. The earlier
13 lint errors may be affected by unresolved imports; do not reorder the shared
authentication UI based solely on that incomplete environment.

## 4. Smallest account linkage (proposal, not applied)

Only the SOURCE schemas have been inspected; no actual PostgreSQL schema is
claimed. users is the Fortify Authenticatable with MFA/passkeys; user_accounts
is the operational model with legacy viewer/user/admin enum/check and activation.
No verified one-to-one relationship currently exists. The audit supplies actual
columns/constraints/role values without revealing any identities.

Retain Fortify, config/auth.php, login/registration/password reset, sessions,
settings, MFA and passkeys. Proposed changes after audit/dictionary review:

| File | Proposed change |
| --- | --- |
| New forward migration | Nullable UNIQUE user_accounts.user_id FK to users.id, ON DELETE SET NULL; no backfill |
| app/Models/User.php | Add userAccount(): HasOne; retain existing traits/casts/fillable |
| app/Models/UserAccount.php | Add user(): BelongsTo and boolean is_active cast; keep user_id out of fillable |
| app/Services/MaintenanceProjects/VerifiedProjectAccount.php | Resolve only the explicit verified relationship; keep active/role checks |
| New focused tests | Explicit linkage, no ID guessing, uniqueness, mass-assignment protection, inactive/unlinked denial, login deletion preserving history and creator attribution |

The FK proposal was refined from RESTRICT to SET NULL after inspecting
ProfileController::destroy: it deletes the Laravel login. SET NULL keeps that
settings workflow working, clears only the link, and preserves the UserAccount
and its historical creator references. No project/history is cascade-deleted.
If the group requires deactivating the operational account on login deletion,
that must be separately specified/approved; no such behavior is assumed.

Attribution continues to use UserAccount.id, never User.id. Updating a project
does not replace created_by. Links are assigned only after private verification
by the group's authorized administrator, not from matching IDs/names/emails or
client form inputs. The group need not send identity records to this workspace.

Source role reconciliation is provisional: admin => Admin, viewer => Viewer,
legacy user => unresolved/denied for this module. Engineer/SuperAdmin cannot be
stored under the current source enum and require an approved forward constraint
change plus corresponding account validation/policies. Engineer permissions also
need the approved active LGU-assignment structure; engineers.lgus_id is not
silently substituted. Exact role changes depend on audit and dictionary findings.

After those findings, present the final shared-file patch and migration SQL and
request approval BEFORE implementing it. Approval for a schema link does not
approve any particular private identity pairing or immediate migration execution.

## 5. Ready now versus waiting

Ready now: read-only evidence collection, audit usability/privacy improvements,
Herd dependency setup, existing build/static/SQLite checks, and narrow confirmed
lint fixes once route generation succeeds. The work at this checkpoint changes
only documentation and audit helpers.

Waiting: actual schema/dictionary comparison, migrations and verified backfills,
shared account linkage/role/assignment changes, genuine authenticated PostgreSQL
CRUD/concurrency tests and browser acceptance. No source compilation or test
success is newly claimed. The previous focused ESLint/format results remain the
last executed frontend evidence.

## 6. Preservation, verification and publication

`1f31ad3` is retained as the ancestor of this checkpoint. No app source, approved
sidebar CSS/React, CRUD/deletion behavior, classmate AuditLog/MaintenanceRecord
code, or historical migration is edited. Audit scripts are source-checked and
PostgreSQL syntax-parsed; actual database execution remains pending. No commit
is pushed. Before any push, list the exact local commits/files, destination
`JairusClaude/JaiRoadV2:integration/maintenance-projects`, and remaining database/
authentication blockers, then wait for the user's approval. Main remains untouched.

Official references consulted:

* [PostgreSQL read-only transaction behavior](https://www.postgresql.org/docs/18/sql-set-transaction.html)
* [psql meta-commands and gexec](https://www.postgresql.org/docs/18/app-psql.html)
* [pgAdmin PSQL Tool](https://www.pgadmin.org/docs/pgadmin4/9.18/psql_tool.html)
* [Herd Windows PHP management and CLI proxies](https://herd.laravel.com/docs/windows/technology/php-versions)
* [Composer platform requirements check](https://getcomposer.org/doc/03-cli.md#check-platform-reqs)

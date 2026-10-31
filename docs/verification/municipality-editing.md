# Safe RoadCoverage municipality editing

Priority 1 implementation, based on integration commit `283b4218bc952a3704c01124f512226e6308297d`.

## User workflow

Open a RoadCoverage's details in Road Sections, then choose **Change municipality**.
Select a destination and press **Review Changes**. This POST only reads and locks
current database values long enough to generate a consistent preview; it makes no
business or audit writes. The review shows the road ID/name, old/new municipality
names and LGU IDs side by side, linked project ID/title, complete record IDs/count,
each current ManagingEngineer and destination eligibility, and related MonthlyUpdate,
document and media counts. Counts follow the actual foreign-key relationships and
are independent of the paginated road/project listings.

**Cancel** closes the review without submitting a confirmation. **Confirm Municipality
Change** is enabled only when the preview has no manager conflicts. The server
independently rechecks every requirement at confirmation. A successful response names
both municipalities. Ordinary road editing retains its existing geometry/attribute
functionality, but cannot change LGU; the municipality selector there explains the
separate reviewed operation. A direct PUT cannot bypass confirmation.

The new dialog opts into Inertia state preservation on final submission so validation
redirects retain the dialog and explain rejection. A failed confirmation discards the
old preview and requires a fresh review. Other operation requests retain their existing
behavior.

## Authorization and concurrency

- The unchanged identity resolver verifies the explicit Fortify `public.users`
  bridge to an active canonical UserAccount, including credential consistency.
- Admin/SuperAdmin retain their existing business permissions. Engineers must have
  an active linked profile and active assignments to **both** original and destination
  LGUs. Viewers, unlinked Engineers, inactive accounts and retired profiles are denied.
- Every historical MaintenanceRecord manager must have an active Engineer profile,
  active linked Engineer account (or the already approved linked Admin manager), and
  active EngineerLGU destination assignment. This operation does not select or change
  a manager. Ineligible records are identified individually and block confirmation;
  administrators can resolve assignments or use the existing explicit reassignment
  workflow, then request a fresh preview. Completed records are checked too.
- The encrypted, authenticated review token expires after 15 minutes and binds the
  login/account, road, destination and a fingerprint of the reviewed state. It contains
  no passwords, hashes, private file paths or historical audit payloads.
- Final confirmation starts a transaction and locks RoadCoverage, projects and records
  in parent/child order, plus MonthlyUpdates. PostgreSQL parent row locks also serialize
  concurrent foreign-key insertions into this affected graph. Existing documents/media,
  municipality names, profiles, accounts, assignments and the login bridge are locked
  while inspected. Actor identity is resolved again after those locks.
- The fingerprint includes road values/updated time, project/record values, related
  child IDs/parent IDs/available update timestamps, relevant names and authorization
  state. Changed state requires a refreshed preview. Client-supplied impact lists,
  actor IDs, manager IDs, geometry or replacement destination values cannot override
  the authenticated token. Expiration is checked again after waiting for locks.
- Concurrent confirmations serialize on the road: the first commits, the second
  fails without another transition event. Transactions have bounded deadlock retries;
  the audit insert remains inside the retried business transaction.

## Data preservation and auditing

Only `road_coverages.lgu_id` and `updated_at` are written. Stored GeoJSON is never
decoded/re-encoded by the mutation, and road length/name/pavement/condition/creator
remain unchanged. No project, quarterly record, MonthlyUpdate, document, media or
Storage object is created or rewritten by this operation. Projects inherit the new
municipality through their existing RoadCoverage relationship.

The existing controller audit writer appends exactly one canonical `UPDATE` /
`RoadCoverage` event with verified UserAccount actor, stable actor identifier, old/new
LGU IDs and names, affected project/record IDs, timestamp and transition description.
The new call explicitly bypasses notification fan-out: recipient/message remain NULL,
and no additional recipient rows are created. Existing event writers retain their
behavior. An audit insertion exception rolls back the road update. No historical
audit row is updated/deleted, and the Engineer preview never queries full audit
history. Audit reader permissions and application/database immutability protections
are unchanged; this change does not add database enforcement.

No trusted municipality boundary dataset is available to this server-side workflow.
The review explicitly says geographic membership is unverified and asks the user to
check location. It never guesses membership from a municipality name or moves the
saved road. External map tiles were unavailable in the local test environment; the
existing map error state appeared. Tile availability is not claimed as verified.

## Verification

All database writes below targeted guarded, fresh, loopback-only disposable PostgreSQL
17.11 databases, never shared Supabase. No schema/model/migration/password changes.

| Check | Executed result |
| --- | --- |
| Complete quarterly/authorization/lifecycle PostgreSQL suite | 160 passed, 1,570 assertions; includes 42 new municipality cases |
| Password PostgreSQL regressions | 56 passed, 331 assertions |
| Standard Laravel suite with disposable test APP_KEY and in-memory SQLite | 95 passed, 2 existing public-registration skips, 483 assertions |
| PHPStan | No errors |
| Pint | Passed repository-wide |
| PHP syntax | All changed PHP files passed |
| ESLint | Passed repository-wide with `--max-warnings=0` |
| Prettier | Passed resources; new browser script also checked |
| TypeScript | Passed `tsc --noEmit` |
| Vite production build | Passed; existing large-chunk warning retained |
| Routes | 112 routes; both new municipality endpoints registered |
| Composer/npm audits | No advisories / zero vulnerabilities |
| Actual Chromium/Playwright against disposable PostgreSQL | Admin review/Cancel/final success; stale review rejection and conflict refresh; Engineer mobile success; Viewer action restriction; no JavaScript exceptions |

The new PostgreSQL tests cover all requested cases, invalid/expired/tampered/cross-actor
and cross-road tokens, direct PUT bypass, input injection, inactive/missing/retired/
wrong-role managers, every historical manager, relationship changes and explicit
reassignment followed by refreshed review. Two independent HTTP-kernel processes
are observed actually waiting on the same road lock, then produce `[302, 422]` and
one committed transition event. Audit failure is injected before insertion to prove
rollback and a subsequent single successful retry. Historical rows and GeoJSON are
compared with their original stored values.

Automated entry points:

- `php vendor/bin/pest --configuration=phpunit.quarterly.xml --display-warnings --fail-on-warning`
- `php vendor/bin/pest --configuration=phpunit-passwords.xml --display-warnings --fail-on-warning`
- `tests/Browser/prepare-municipality-change.php` prepares only an explicitly guarded,
  empty disposable PostgreSQL 17 database. `tests/Browser/municipality-change.mjs`
  runs against a loopback app with those fixtures, using the existing
  `QUARTERLY_BROWSER_URL`, `QUARTERLY_BROWSER_FIXTURE`, `JAIROADS_SCRATCH_APPROVAL`,
  optional `PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` conventions. The fixture and
  server must use the same disposable DB/key. Use file sessions for the HTTP server;
  the browser test also exercised real CSRF protection with a local-environment server.

Existing focused and full-system workflows run on pushes to the integration branch;
the quarterly workflow automatically discovers these new PostgreSQL tests. Final run
links/results are reported with the published commit. No PR, merge or deployment is
part of this change.

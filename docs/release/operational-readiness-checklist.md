# JaiROADS operational readiness checklist

This checklist prepares an authorized release; it does not replace the release manifest, UAT evidence, or owner approval. Do not use production credentials in CI, approve an incomplete manifest, or enable destructive operations to make a readiness check pass.

## Deployment and health

- Record the exact Git SHA after all required checks pass. Keep production auto-deploy disabled until the release policy is explicitly reviewed.
- On the authorized Render service, configure Health Check Path to `/up`. The Docker image also checks this endpoint through loopback. A successful health check indicates Laravel can respond, not that every database or Storage operation works.
- Confirm service URL, APP_URL and secure session settings for the chosen service. Do not rename a live service without reviewing its URL and cookie implications.
- Use an isolated staging database and private test buckets; run the approved role matrix and real attachment/map workflows before deploying.
- Manually deploy the approved SHA; verify the deployed revision and all four roles. Keep the last known good image available. Do not automatically roll back database records or schema.

## File recovery

The application registers `jairoads:resume-file-deletions --limit=20 --budget=240 --scheduled` every five minutes when both `JAIROADS_PERMANENT_FILE_DELETION_ENABLED` and `JAIROADS_FILE_DELETION_SCHEDULE_ENABLED` are enabled. The batch stops starting new operations after four minutes, allows an in-flight item to finish, and holds a 30-minute overlap lock. Keep both flags off until the file-deletion approval and exact-object recovery rehearsal are complete. Registration also requires a cache driver configured for shared atomic locks (database, Redis, Memcached or DynamoDB); file, array and failover stores cannot activate the schedule. Run `php artisan jairoads:file-recovery-readiness` for a secret-free configuration check. Verify the backend and locks independently in the target environment.

After that approval, configure a single environment-specific scheduler service using the same pinned image, application key, restricted database credentials, and private Storage settings. Run `php artisan schedule:run --no-interaction` every minute (the application controls the five-minute task cadence). Use a shared, atomic-lock-capable cache store; never use an ephemeral per-container cache for cross-process locks. Review `php artisan schedule:list`, verify a synthetic pending command is handled once, and inspect failures without exposing object paths or credentials. Do not create multiple recovery schedulers against the same live database.

Recovery evidence records whether the scheduler-marked or manual command path was requested. This label can also be supplied by a console operator. Confirm scheduler activity from runner logs and the isolated recovery rehearsal. Cached evidence can expire or be unavailable.

## Dashboard exports and receipt compatibility

- Dashboard PDF, XLSX and CSV files contain the current role's displayed aggregate metrics, reporting coverage and monthly counts. Before approving a server export, review an independent role/field allowlist, retention and audit policy. Keep private records and raw authentication or Storage details outside the export.
- The PDF uses the built-in WinAnsi fonts. The workbook and CSV retain Unicode. Include supported script coverage and office-application compatibility in release acceptance.
- New optional monthly intake receipts normalize ordinary decimal spelling without a floating-point conversion. Existing legacy receipts still match their original validated spellings. A rollback to code that only reads the original fingerprints cannot reconcile new-version receipts. Keep activation disabled until staging and rollback evidence is approved.

## Storage and indexes

- Verify the current effective upload limits for both the canonical and compatibility routes before setting bucket limits; the lowest application, PHP, proxy, or Storage limit governs. Set the reviewed limits using the Storage dashboard or supported Storage administration API, not direct writes to the managed storage schema.
- Review legacy unindexed foreign keys and unused indexes using real query plans and dependency information. Do not drop an index merely because a short observation window reports no reads.
- Check RLS and grants again after any approved migration; keep server-only credentials out of browser bundles.

## Repository protection

In GitHub Settings → Rules → Rulesets, an administrator can create an active branch ruleset targeting `main`. Require a pull request and at least one independent approval, dismiss stale approvals, require status checks from GitHub Actions, and enable the rules that block force pushes and restrict deletions. Keep bypass access empty unless the repository owner approves an exception. Confirm the rules against the branch settings and the pull-request checks view.

Select the applicable job checks exactly as GitHub displays them. Standard CI uses `ci`. Focused regressions use `frontend`, `password-postgres` and `quarterly-postgres`. Full verification uses `feature-postgres`, `unified-browser`, `passkey-browser`, `docker`, `integration / merged-system canonical contracts`, `qa / UAT evidence must block incomplete releases`, `release / unapproved deployment must remain blocked` and each applicable `repository / …` matrix check. Disposable staging uses the six `staging / …` checks named in the [workflow](https://github.com/JairusClaude/JaiRoadV2/blob/Improvement1/.github/workflows/disposable-staging-rehearsal.yml). The alternative ancestry job is intentionally skipped for pulls targeting `main`.

These are operational steps requiring an authorized operator. Passing disposable CI does not establish production acceptance or permission to change live infrastructure.

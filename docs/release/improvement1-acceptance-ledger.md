# Improvement1 acceptance ledger

This branch contains review candidates only. Keep production deployment and permanent file deletion disabled until the existing issue #25 gates are accepted.

## Current verification scope

- The exact-head workflows are recorded under [Improvement1 Actions](https://github.com/JairusClaude/JaiRoadV2/actions?query=branch%3AImprovement1). At baseline `dab99d8`, focused regressions and disposable staging passed. Standard CI and full verification independently reported the same System Health Center Prettier violation. The full workflow's other applicable jobs, including the unified browser, passed. Use the candidate's own check results for release evidence.
- The standalone offline editor downloads and restores encrypted drafts using the signed-in form's draft format. The browser can open the saved editor without network access. Plain JSON import and download in the signed-in form remain available for compatibility.
- The workspace layout suite covers 320, 375, 390, 768, 1024, 1440 and 1920 pixels. It exercises the listed dashboards, directories, details and forms using disposable role accounts. This is a browser coverage matrix, with hosted and human acceptance tracked separately.
- The SuperAdmin health snapshot reports a validated Render revision when available and shows Philippine timestamps. Its account counters share one grouped PostgreSQL aggregate. Private Storage, backup and scheduler execution still require direct operator evidence.
- The milestone grant rehearsal uses a disposable non-owner database role with active RLS and verifies create, read, cancellation and denied hard deletion. The hosted proposal and activation remain approval-gated.
- When the MapLibre basemap style fails, the workspace map loads a local style and installs the same saved road layers. The geometry remains unchanged.

## Implemented candidates

- Corrected duplicate browser test variable and prior report exporter syntax. Direct tests on Improvement1 remain enabled.
- Bounded canonical record search: up to five matches each for projects, roads, documents, LGUs, and monthly reports. Reuses the authenticated scope, literal search helper, and canonical details URLs. No private media URLs, account data, audit data, or file paths in results.
- Comparison of photos across selected reporting periods in the same project. Selection is authorized again by the server. Existing protected media endpoints remain unchanged; no assumption about photography dates.
- Explicit portable JSON field-report drafts: create form only, opt-in, local file download/import, no background sync or cached private files, no credentials. Current record authorization and normal submit validation still apply. The file contains unencrypted report text and identifiers and must be handled on an authorized device. Attachments must be selected again.
- Calendar export of up to twelve estimated finish dates and a one-day local calendar reminder. These are estimates, not official deadlines. Import into a compatible calendar is user-controlled; no server reminder delivery is claimed.
- Read-only SuperAdmin recovery counts: pending, previously attempted, and completed intents. Missing or inaccessible recovery schema is shown as unavailable, not zero. This does not prove a worker ran.
- Provisional road review index (0–100): stored Bad/Fair/Good condition contributes 60/30/0, any ongoing record past its estimated finish contributes 25, any started ongoing record without the current report contributes 15. Scores are not approved safety or dispatch decisions, and unknown conditions are excluded.
- Quick navigation focus restoration and keyboard focus containment.
- Existing geometry-only export, tile failure notice, timeline, dashboards and reports retained.

## Still requires implementation or acceptance

- Complete all-role UI/mobile and table behavior, accessibility and performance measurements under representative data; advanced GIS analysis beyond geometry export and fallback.
- Persistent milestone schema and retention policy; formal server reminders, fully offline application startup and automatic sync with approved data handling.
- Formal prioritization policy and operational owner review of the provisional score; field validation of road conditions.
- Repository owner must configure branch protection and independent review checks. Connector does not have administration rights.
- Disposable PostgreSQL backup restoration tests do not prove hosted DB or private object-byte restore. Owner-operated isolated restore rehearsal, storage policy acceptance, exact release SHA, verified scheduler runner/shared locking and recovery activation are mandatory.
- Real production role acceptance and human UAT/signoff remain open. Do not mark these green from synthetic automation.

See docs/release/main-enhancement-gates.md and GitHub issue #25.

## Follow-up: reconnect submission and search coverage

The six-category search now includes maintenance records. The create-report form can explicitly queue a valid text-only report for one reconnect attempt within 15 minutes, only while the current page remains open. The server checks the expected canonical account in addition to normal authorization and uniqueness validation. The queue is memory-only and never automatically retries ambiguous requests or attachments. Full browser verification, encrypted durable offline storage, custom persistent milestones and all production gates remain pending.

## Follow-up: encrypted portable drafts and milestone schema review

Encrypted report drafts use Web Crypto AES-256-GCM with fresh random salt and IV and PBKDF2-SHA-256 (310,000 iterations). The passphrase is supplied by the user, cleared from the input after use, and never stored by the application. Encrypted files survive browser closure. The signed-in form checks current record eligibility on import and normal authorization and validation on submission.

A review-only milestone table proposal is in database/proposals/maintenance_milestones_REVIEW_ONLY.sql. It enables RLS and denies public access. The companion runtime grant proposal separately permits scoped runtime reads and writes. Before hosted activation, review record-preservation and deletion dependencies, the audit and notification contracts, and actual operator acceptance evidence.

## Milestone pilot implementation

Disabled by default (JAIROADS_MILESTONES_ENABLED). Candidate canonical record detail view and create/edit/cancel endpoints use existing authentication, record ownership and locked mutation authority, optimistic version checks, existing audit and notification delivery. No hard deletion of milestones; max 100 retained entries per record. Project deletion preflight rejects retained milestones before file work. Pilot writes are prohibited when permanent deletion is enabled; owner must keep all instances consistently configured and approve retention and restricted grants before activation. No schema applied to hosted data. Added disposable PostgreSQL tests for flag, creation, validation, stale edit, role denial, audit and retention. Exact-head tests pending.

## Consolidated stabilization pass

Applied exact CI formatting diff, reset only test session hashes when switching synthetic actors (retained forbidden assertions), unified map geometry validation to reject malformed lines, added invalid-geometry regression fixtures, small-screen control rules, oldest pending recovery evidence and bounded retry of Composer transport failures. Added reviewed-only milestone runtime grants and a release handoff matrix. None of these artifacts establish actual hosted recovery, background sync or human signoff. See docs/release/improvement1-consolidated-handoff.md.

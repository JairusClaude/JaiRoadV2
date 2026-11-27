# Improvement1 acceptance ledger

## Verified baseline

Commit fe7d33f3c844d8f3dceef94b3f016aa316e79271 passed standard CI (45940971939), focused regressions (45940971957), full verification (45940972045), and disposable staging (45940971988), with 553 workspace viewport checks and 24 directory measurements. All four PR workflows passed too. These results apply only to that SHA.

## Implemented functionality

Six-category authenticated record search (projects, roads, documents, LGUs, maintenance records, monthly updates); report comparison with protected image endpoints; text-only portable encrypted drafts and downloaded offline editor; single in-page reconnect attempt with 15-minute expiry; aggregate PDF/XLSX/CSV exports; calendar export with estimated finish and local reminder; provisional 60/30/0 condition + 25 overdue + 15 missing report score; health configuration/readiness and recovery counts; saved geometry exports and map fallback; milestone pilot with retained cancellation, optimistic version and audited role-scoped writes. Milestones remain disabled until reviewed schema/grants/retention acceptance. No production feature activation is implied.

## Candidate corrections after verified baseline

Lock the monthly form during asynchronous import (including save and attachment controls); abort import on unmount, retain current values on failure. Track quick-navigation destination by URL, not result index, and time out requests. Add simplified Leaflet tile-error feedback and retry; add stored condition mode to canonical road directory map payload without changing ownership display. Paginate photo comparison periods and retain the selected period across pages. Added browser coverage for locked import. Subsequent changes paginate related record histories (12 per page), preserve database totals and global progress checkpoints, restore quick navigation in the canonical workspace, retain unchanged simplified map layers and preserve the viewport, and paginate monthly form record choices (25 per page plus a selected historical record when necessary). Reporting-month data is retrieved for the selected record rather than the entire project. Direct selected-record lookup remains role-scoped and supports encrypted draft import.

## Verification after the baseline

Commit `12a01ae0b157c4f49e9327cc6008d7831468abb9`: branch full verification (45950928820) passed 16 jobs, failed Prettier and skipped the conditional ancestry job. The unified browser, TypeScript, ESLint, PHPStan, production build, Docker, Laravel and release-blocking checks passed. Branch and PR disposable staging rehearsals passed (45950928863, 45950934388). Focused regressions (45950928823) failed the legacy lean-form response assertion: project-only lookup now intentionally returns no reporting months. Standard CI (45950928864) failed as well. The subsequent correction updates the test to check project-only, selected-record and revoked-record requests separately, retains the privacy assertions, and applies the exact reported formatting changes. These corrections require fresh exact-head checks; no new all-green result is claimed.

Commit `4f777961b29aab83847fdaeb3b8576b6d85571cd` passed standard CI (45951713957), focused regressions (45951714001), and disposable staging (45951713966). The next candidate adds a shared Leaflet basemap timeout and retry in road detail, editor, and simplified maps; retry redraws tiles without replacing road geometry. Browser failure/retry coverage was added. Hosted map provider verification and fresh candidate checks remain necessary.

Commit `57212e54d79e70bd48b536ae3a45ce0eb25869d5`: standard CI (45952094657), focused regressions (45952094742) and disposable staging (45952094677) succeeded. PR equivalents also succeeded (45952100591, 45952100482, 45952100902). Full-system workflows were still running at the last observation; no exact-head release approval is implied.

The next candidate adds stored road-condition visualization to the Engineer dashboard map, a read-only authenticated report-period outcome lookup (not an idempotent receipt), last observed recovery batch aggregates in SuperAdmin health, and stronger multi-page report history tests. The batch telemetry is optional cached evidence for up to seven days; manual and scheduled invocations cannot be distinguished from it alone. An absent report or absent execution observation is not proof that a request did not execute. No flags, production credentials, schemas, or Storage objects are changed.

Commit `b2ddbed0220ee9269da652fd24685ffc9525d6f4` passed both focused regressions (45952720970, 45952727109), both disposable rehearsals (45952720902, 45952727075), and PR standard CI (45952727133). The branch full-system repository checks completed successfully at inspection; unified browser and Docker were still running. The next candidate clamps comparison pages, projects only ID/month, filters comparison photos in SQL, omits long detail text from record history, and adds synthetic history measurements and cross-project comparison tests. Fresh exact-head verification remains required.

Commit `59dcbf22359f5c9391e2cd1bde4c3ddcc6340673` passed the quarterly PostgreSQL job including the new history benchmark (45953193585 / 140353560327); measured 2,942 / 12,377 / 12,427 JSON bytes and 11 queries at 1 / 100 / 1,000 reports and documents each. Frontend TypeScript failed on the history timeline prop; the unified browser job failed before running the application because an unrelated Microsoft Ubuntu apt repository returned HTTP 403. Follow-up narrows the prop contract, isolates the unrelated feed during Chromium installation on disposable runners, and preserves all verification requirements. Hosted performance and new exact-head browser evidence remain outstanding.

The next candidate replaces individual monthly uniqueness rows with year-keyed 12-bit occupancy masks, including fixed-context editing and encrypted draft import. Server-side write validation remains authoritative; the compact client snapshot does not grant authorization. Regression coverage includes 1,204 months, year 0001/9999, exact record scope and exclusion of the edited report. Exact-head tests remain required.

The next candidate preflights queued reconnect submissions with the existing account-bound, writable-record period lookup. Expired, cancelled, changed, unauthorized, occupied or unverifiable queued requests are not sent; a verified empty period permits at most one attempt with existing transactional server authorization and uniqueness checks. The preflight is not a reservation or durable receipt, and the queue is still in-page only. Browser cases cover denied and occupied preflights and the single successful attempt.

Commit `acd0f1d0c5627c2f598cb0b8e6f9e1c226be7c4c` passed standard CI (45954251740), focused regressions (45954251756), disposable staging (45954251722) and its repository TypeScript, PHPStan, Pint and Prettier jobs; full verification was still in progress at inspection. The next candidate adds explicit road-review totals, a tested non-multiplying provisional score, UTF-8-safe iCalendar exports of the displayed estimates, and freshness/integrity checks for optional recovery batch telemetry. These are not approval of the priority policy, a scheduler execution proof, or hosted recovery evidence.

## Outstanding

- Benchmark representative large data and verify the new record-history and monthly-choice pagination; the single-record month occupancy snapshot is compacted by year, but still grows with the number of distinct reporting years; verify measured behavior and hosted load.
- Verify incremental simplified map layer updates, extend condition visualization and failure recovery where missing, and validate map services in hosted staging.
- Approve and rehearse milestone retention and runtime grants in isolated hosted staging; no production schema changes.
- Durable background reporting synchronization requires reviewed session, revocation, durable idempotent receipts and encryption/attachment strategy; the manual period outcome lookup is implemented but is not a receipt and must not trigger silent replay.
- Formal server reminder and road priority policy approval.
- GitHub owner branch protection and required review.
- Hosted database restore and independent private object-byte recovery rehearsal, verified shared locks and recovery scheduler execution.
- Exact release candidate acceptance, production owner approval, actual human UAT and signoff.

See docs/release/improvement1-consolidated-handoff.md and issue #25. Never equate synthetic checks with hosted recovery or human acceptance.

# Improvement1 acceptance ledger

## Verified baseline

Commit fe7d33f3c844d8f3dceef94b3f016aa316e79271 passed standard CI (45940971939), focused regressions (45940971957), full verification (45940972045), and disposable staging (45940971988), with 553 workspace viewport checks and 24 directory measurements. All four PR workflows passed too. These results apply only to that SHA.

## Implemented functionality

Six-category authenticated record search (projects, roads, documents, LGUs, maintenance records, monthly updates); report comparison with protected image endpoints; text-only portable encrypted drafts and downloaded offline editor; single in-page reconnect attempt with 15-minute expiry; aggregate PDF/XLSX/CSV exports; calendar export with estimated finish and local reminder; provisional 60/30/0 condition + 25 overdue + 15 missing report score; health configuration/readiness and recovery counts; saved geometry exports and map fallback; milestone pilot with retained cancellation, optimistic version and audited role-scoped writes. Milestones remain disabled until reviewed schema/grants/retention acceptance. No production feature activation is implied.

## Candidate corrections after verified baseline

Lock the monthly form during asynchronous import (including save and attachment controls); abort import on unmount, retain current values on failure. Track quick-navigation destination by URL, not result index, and time out requests. Add simplified Leaflet tile-error feedback and retry; add stored condition mode to canonical road directory map payload without changing ownership display. Paginate photo comparison periods and retain the selected period across pages. Added browser coverage for locked import. Subsequent changes paginate related record histories (12 per page), preserve database totals and global progress checkpoints, restore quick navigation in the canonical workspace, retain unchanged simplified map layers and preserve the viewport, and paginate monthly form record choices (25 per page plus a selected historical record when necessary). Reporting-month data is retrieved for the selected record rather than the entire project. Direct selected-record lookup remains role-scoped and supports encrypted draft import.

## Verification after the baseline

Commit `12a01ae0b157c4f49e9327cc6008d7831468abb9`: branch full verification (45950928820) passed 16 jobs, failed Prettier and skipped the conditional ancestry job. The unified browser, TypeScript, ESLint, PHPStan, production build, Docker, Laravel and release-blocking checks passed. Branch and PR disposable staging rehearsals passed (45950928863, 45950934388). Focused regressions (45950928823) failed the legacy lean-form response assertion: project-only lookup now intentionally returns no reporting months. Standard CI (45950928864) failed as well. The subsequent correction updates the test to check project-only, selected-record and revoked-record requests separately, retains the privacy assertions, and applies the exact reported formatting changes. These corrections require fresh exact-head checks; no new all-green result is claimed.

## Outstanding

- Benchmark representative large data and verify the new record-history and monthly-choice pagination; exceptionally large single-record reporting-month collections remain unbounded.
- Verify incremental simplified map layer updates, extend condition visualization and failure recovery where missing, and validate map services in hosted staging.
- Approve and rehearse milestone retention and runtime grants in isolated hosted staging; no production schema changes.
- Durable background reporting synchronization requires reviewed session, revocation, idempotency, outcome lookup and encryption/attachment strategy; no silent replay.
- Formal server reminder and road priority policy approval.
- GitHub owner branch protection and required review.
- Hosted database restore and independent private object-byte recovery rehearsal, verified shared locks and recovery scheduler execution.
- Exact release candidate acceptance, production owner approval, actual human UAT and signoff.

See docs/release/improvement1-consolidated-handoff.md and issue #25. Never equate synthetic checks with hosted recovery or human acceptance.

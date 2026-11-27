# Improvement1 acceptance ledger

## Verified baseline

Commit fe7d33f3c844d8f3dceef94b3f016aa316e79271 passed standard CI (45940971939), focused regressions (45940971957), full verification (45940972045), and disposable staging (45940971988), with 553 workspace viewport checks and 24 directory measurements. All four PR workflows passed too. These results apply only to that SHA.

## Implemented functionality

Six-category authenticated record search (projects, roads, documents, LGUs, maintenance records, monthly updates); report comparison with protected image endpoints; text-only portable encrypted drafts and downloaded offline editor; single in-page reconnect attempt with 15-minute expiry; aggregate PDF/XLSX/CSV exports; calendar export with estimated finish and local reminder; provisional 60/30/0 condition + 25 overdue + 15 missing report score; health configuration/readiness and recovery counts; saved geometry exports and map fallback; milestone pilot with retained cancellation, optimistic version and audited role-scoped writes. Milestones remain disabled until reviewed schema/grants/retention acceptance. No production feature activation is implied.

## Candidate corrections after verified baseline

Lock the monthly form during asynchronous import (including save and attachment controls); abort import on unmount, retain current values on failure. Track quick-navigation destination by URL, not result index, and time out requests. Add simplified Leaflet tile-error feedback and retry; add stored condition mode to canonical road directory map payload without changing ownership display. Paginate photo comparison periods and retain the selected period across pages. Added browser coverage for locked import. Candidate verification is pending; see GitHub Actions for exact-head results.

## Outstanding

- Benchmark representative large data; paginate related maintenance record documents and updates and project period/month choices without compromising history, timeline or duplicate checks.
- Incremental map layer updates and broader condition visualization beyond road directory; validate map services in hosted staging.
- Approve and rehearse milestone retention and runtime grants in isolated hosted staging; no production schema changes.
- Durable background reporting synchronization requires reviewed session, revocation, idempotency, outcome lookup and encryption/attachment strategy; no silent replay.
- Formal server reminder and road priority policy approval.
- GitHub owner branch protection and required review.
- Hosted database restore and independent private object-byte recovery rehearsal, verified shared locks and recovery scheduler execution.
- Exact release candidate acceptance, production owner approval, actual human UAT and signoff.

See docs/release/improvement1-consolidated-handoff.md and issue #25. Never equate synthetic checks with hosted recovery or human acceptance.

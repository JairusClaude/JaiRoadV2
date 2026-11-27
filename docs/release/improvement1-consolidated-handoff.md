# Improvement1 consolidated release handoff

Do not treat implementation, synthetic testing, hosted acceptance, and human sign-off as interchangeable. Keep the pull request draft until exact-head evidence is complete.

| Gate | Responsible party | Evidence |
| --- | --- | --- |
| Exact-head CI | Developer / QA | Four workflows succeed at the same commit; no skipped required checks |
| Repository protection | GitHub owner | Protect main against direct/force pushes and deletion; require review and successful required checks; confirm rules in Settings |
| Mobile, accessibility and performance | QA | All four role workspaces at 320/375/768/1280px; keyboard, reduced motion, realistic data, measured latency and bundle reports |
| Milestones | Schema owner / QA | Apply reviewed table and grants to isolated staging; test runtime RLS, concurrent writes, retention and rollback; keep flag false until approval |
| Hosted backup recovery | Database owner | Approved isolated restore target; compare retained row hashes, counts, constraints, RLS and grant behavior; source unchanged |
| Private Storage recovery | Storage owner | Recover approved non-production object bytes and verify SHA-256, MIME, privacy, access and deletion-intent consistency |
| Background recovery scheduler | Hosting owner | Verify isolated exact-object rehearsal, readiness command and shared locks; configure single schedule runner only after authorization |
| Production acceptance | Release owner / QA | Exact commit, Render /up, real hosted account and role tests, private uploads and map providers, monitoring, rollback and recovery evidence |
| Human UAT | Actual authorized users | Complete existing UAT cases and signoff; record observed defects and retest results |

Encrypted portable drafts survive closing the browser; reconnect submissions are one-shot and page-bound. Background submission after closure is deliberately not enabled: it requires a reviewed credential/session strategy, durable idempotency, attachment and encryption-key handling, account-switch protection and a tested service-worker lifecycle. Never bypass reauthentication or replay an uncertain request.

Use docs/release/operational-readiness-checklist.md, docs/qa/uat-execution-template.md and issue #25 for authoritative release gates. Keep production deletion and the scheduler disabled until verified. Do not publish credentials, object paths or real record data in evidence. The GitHub connector cannot configure branch protection; do not substitute a CI check for owner enforcement.

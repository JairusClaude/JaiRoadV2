# Improvement1 consolidated release handoff

Do not treat implementation, synthetic testing, hosted acceptance, and human sign-off as interchangeable. Keep the pull request draft until exact-head evidence is complete.

| Gate | Responsible party | Evidence |
| --- | --- | --- |
| Exact-head CI | Developer / QA | Four workflows succeed at the same commit; no skipped required checks |
| Repository protection | GitHub owner | Protect main against direct/force pushes and deletion; require review and successful required checks; confirm rules in Settings |
| Mobile, accessibility and performance | QA | Browser matrix at 320/375/390/768/1024/1440/1920px over four synthetic roles. Collect hosted measurements with representative data and check keyboard and reduced motion with actual users. |
| Milestones | Schema owner / QA | Apply reviewed table and grants to isolated staging; test runtime RLS, concurrent writes, retention and rollback; keep flag false until approval |
| Hosted backup recovery | Database owner | Approved isolated restore target; compare retained row hashes, counts, constraints, RLS and grant behavior; source unchanged |
| Private Storage recovery | Storage owner | Recover approved non-production object bytes and verify SHA-256, MIME, privacy, access and deletion-intent consistency |
| Background recovery scheduler | Hosting owner | Verify isolated exact-object rehearsal, readiness command and shared locks; configure single schedule runner only after authorization |
| Production acceptance | Release owner / QA | Exact commit, Render /up, real hosted account and role tests, private uploads and map providers, monitoring, rollback and recovery evidence |
| Human UAT | Actual authorized users | Complete existing UAT cases and signoff; record observed defects and retest results |

Encrypted portable drafts survive closing the browser. The downloaded editor processes drafts offline. An authorized reconnect submission is a single text-only attempt within 15 minutes while the page remains open. Background submission after closure requires a defined session and account-revocation model, durable server-side idempotency with a result lookup, and approved encryption-key and attachment handling. Until those controls and a browser lifecycle rehearsal exist, users reopen the saved draft and check the report period before manually retrying an uncertain request. The authenticated Check saved reporting period control returns only a matching report ID or null, never proof that the queued request succeeded. It verifies the current account, project and writable record and does not replay or write anything. A missing result can mean an earlier request is still in flight.

The connected Supabase test project is `zphuzexikxbqbwkgdubn`. Its catalog has private buckets and lacks the `jairoads_next` schema. A hosted restore needs an approved isolated target and backup source, plus confirmation that the target can be initialized without displacing anything its owners need. Supabase database backups carry Storage metadata. Use an independent approved backup of the object bytes for the Storage rehearsal.

Use docs/release/operational-readiness-checklist.md, docs/qa/uat-execution-template.md and issue #25 for authoritative release gates. Keep production deletion and the scheduler disabled until verified. Do not publish credentials, object paths or real record data in evidence. The GitHub connector cannot configure branch protection; do not substitute a CI check for owner enforcement.

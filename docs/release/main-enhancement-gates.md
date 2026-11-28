# Main branch enhancement gates

The recorded `main` baseline is `bfa846eed598a8ccdd7abd7d086a902353f0d329`. Use the applicable [Improvement1 review checks](https://github.com/JairusClaude/JaiRoadV2/pull/36/checks) for the candidate and record release authorization separately.

## Repository owner
- Require successful applicable CI, focused regression, full system and disposable staging jobs on main pull requests, using exact check names from actual runs.
- Require at least one independent approval; dismiss stale approvals and block force pushes/deletion. Do not require mutually exclusive skipped jobs as mandatory checks.
- Confirm protected branch and approved revision before deploying.

## Hosted acceptance (operator + QA)
- Verify deployed SHA and /up, HTTPS, password login/logout, authorized password reset and session revocation for each actual authorized role without sharing credentials. Verify retired public reset, MFA and passkey endpoints remain disabled according to the current policy.
- Exercise role-scoped read/write/deny paths, map failures, private upload/preview/download, report periods, mobile navigation and slow connections.
- Rehearse database restore and exact private Storage object recovery in isolated staging. Record RPO/RTO and independently verify integrity.
- Keep permanent deletion and scheduler activation disabled until approved recovery rehearsal, shared lock and single scheduler checks pass.
- Record actual evidence in the existing release manifest and UAT templates; issue #25 remains open until its acceptance criteria are met.

## Proposed feature delivery
Read-only reporting, timelines and search must reuse canonical authorization scope. Any new road condition, priority, deadline, milestone, notification, or offline synchronization data requires an approved data dictionary, retention policy, schema review and tests. Never substitute fabricated inspection information or use production data for fixtures.

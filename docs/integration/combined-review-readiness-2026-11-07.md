# JaiROADS Task 10 — combined integration review candidate

**Status: unmerged, unapproved review candidate.** Prepared on 2026-11-07 from [PR #14](https://github.com/JairusClaude/JaiRoadV2/pull/14) head `ea4f4fbd864dc3d1ee40237d379292fe65783f3f`.

**Safe scope:** a new, disposable review branch only. The original teammate and integration branches are unchanged; no PR #6–#14 was merged, rebased, made ready for review, or marked approved. No official Supabase database, Storage, user identity or Data Dictionary was modified. No live app was deployed.

## The actual Git history, not an assumed merge

- Current reviewed head **descends from** `integration/dd-system-completion` (`c9ee10a145effa517b03c5d643266e194c123d4b`). Its feature work is already present in the combined source. GitHub reported **96 commits ahead, 0 behind** on the PR #14 head relative to that teammate integration branch.
- It also descends from `Oct10_Front&BackEnd_Merge_Integration` (`3e4a5c55d8b929d51b40f6c9983ba6c993315431`) with **76 commits ahead, 0 behind**.
- Draft PR **#6 -> #7 -> #8 -> #9 -> #10 -> #11 -> #12 -> #13 -> #14** is a contiguous ancestry chain on top of the prior security branch. The complete chain is verified by `tests/Integration/assert-reviewed-history.sh` on full Git history. These nine PRs remain separate reviews; a descendant is **not** evidence of approval or a permission to deploy.
- The repository's old `main` tip `16a0fe7679f06c31ad15939ed578b15dda52eaea` diverged by **one independently developed commit**, titled `Pint fix`, touching legacy HTTP controllers/requests. Modern `composer ci:check`/Pint must pass on the reviewed candidate instead of blindly restoring changed controller code.
- The older `integration/road-coverage-login` tip `47f6de3effeb397e1b267c3d41b97a29ddda044f` also diverged by **one large integration commit** from its common base. Its source has nine obsolete controller/request file names absent from the current branch; its other UI/road/login code has been significantly reworked in the reviewed lineage. **Do not blindly merge this old tip:** it may reintroduce legacy public controller routes, authentication behavior or duplicate models.
- Additional branches `feature/premerge-policy-alignment` and `feature/maintenance-projects` are already ancestors of the reviewed head; no extra copy/merge step is warranted.

These statements are based on GitHub compare/commit/tree data and can be independently rechecked. They say **which commits are ancestors**, not that teammate signoff, model compatibility or all runtime behavior has been approved.

## Candidate-specific automated gates

This candidate starts from the current reviewed branch and adds a **read-only Git ancestry + required-file contract test**. It adds the candidate branch name to the existing **full system verification** and **focused regression** workflow triggers, without weakening their test scripts or changing the ordinary pull request gates.

Required CI:
- `integration / canonical and teammate ancestry` — rejects if the October baseline, teammate system branch, security dependency branch or any PR #6–#14 head commit is not an ancestor. Checks that the reviewed identity/audit/file/road/Storage/schema test source still exists. Reports independent old branches for review rather than importing them.
- `repository-quality` (Pint, PHPStan, ESLint, Prettier, TypeScript, production frontend build, Laravel/PostgreSQL, route listing, Composer/npm audits).
- `feature-postgres` plus `JaiROADS focused regressions` for quarterly, assignment, auth/password, browser and security compatibility.
- Real `unified-browser` and `passkey-browser` test workflows using disposable PostgreSQL 17, mock private Storage and virtual WebAuthn hardware.
- Production Docker build/boot/fail-closed checks using a disposable database, with **no production secrets or connected database**.
- The existing standalone `composer ci:check` and `JaiROADS disposable staging rehearsal` workflows triggered by the draft PR.

**Do not infer green status until these workflows finish on the final candidate commit.** Any failure becomes a Task 11–12 issue, not a reason to force a merge or disable CI.

## Review/merge order once owners actually approve

1. Confirm all dependencies and CI/test revisions on the exact candidate commit; resolve independent branch and naming disputes with the responsible teammate.
2. Review all original PRs **in their documented stack order**, or explicitly agree on a squash/integration plan that preserves attribution and signed approvals. Do not merge a descendant while leaving earlier schema/identity prerequisites unaddressed.
3. Obtain the canonical Data Dictionary policy approval and schema-owner acceptance of both security auxiliary tables and the optional maintenance/history/file-intent schema proposals; these are still **outside automatic Laravel migrations**.
4. Ensure an approved isolated persistent staging environment exists with a real restricted Laravel database LOGIN, RLS/grants, private buckets, test-only mail, HTTPS origin and WebAuthn.
5. Use an authorized operator to prove the existing SuperAdmin's recovery and the truthful existing Admin-to-Engineer identity association. Record real `reviewed_transition` references **only after** review, not as backdated synthetic history.
6. Run Task 11 end-to-end system and human-role acceptance, then Task 12 defect fixes and UAT. Collect explicit permissions to stage any official migration and a tested recovery plan.
7. Only in Task 13, and after all release gates pass, merge approved source and deploy the exact signed build with controlled Supabase migration order and rollback monitoring.

## Stop conditions and limits

- A green combined branch **does not mean** the official schema is ready. At the last inspection, proposed `jairoads_security.account_provisioning`, `audit_notification_recipients`, preserved-context/file-deletion schemas and quarterly uniqueness were not applied to the shared database.
- No verified Admin-person/Engineer profile association, owner-reviewed historical provenance, real operator SuperAdmin login/recovery, or persistent staging exists as a completed release gate.
- A short-lived local PostgreSQL 17 container is not a production clone, and mock HTTP Storage/mail/WebAuthn does not validate actual service access.
- The prior `main` and `integration/road-coverage-login` commits have not been silently cherry-picked, rebased or merged. Their independently relevant requirements can be evaluated and reimplemented in fresh PRs **after** review.
- Do not overwrite teammates' branches, force push history, make a draft PR mergeable-by-policy, or touch official Supabase without explicit authorization.

**Candidate result sought:** a reviewable integrated build with reproducible CI evidence, a clear branch-drift disposition and an actionable signoff plan. It is **not a release**.

# JaiROADS — remaining gates, accountable review and safe handoff

**Review update:** 2026-11-14 (Asia/Manila) · **Pull request:** #24 (draft, stacked on #23) · **Production release:** **NO GO**

This is a truthful status register for the reviewed `PostDemo2Update--AuditLogModifications` line, not an authorization to deploy. Review base #23 first, then #24. Never convert missing human evidence into fictional PASS/APPROVED or backfill unidentified ordinary accounts.

## Confirmed hosted facts (not future tasks)

| Check | Verified at 2026-11-14 | Evidence / interpretation |
|---|---|---|
| Canonical Final DD | 11 tables, required MaintenanceRecord project and manager FKs NOT NULL/RESTRICT | Official hosted Supabase catalog; no history detachment authorized |
| Six migration versions | Applied, catalog verified | Exact applied SQL archived as **non-replayable** review evidence under `database/hosted-migration-history/` |
| Restricted PostgreSQL role | `LOGIN=true`, `SUPERUSER=false`, `BYPASSRLS=false` | Owner privately set password; real TLS 1.3 `psql` LOGIN and canonical SELECT succeeded |
| Existing UserAccounts | 7: 2 SuperAdmin, 1 Admin, 2 Engineer, 2 Viewer | Role aggregate only; possession/ownership not verified |
| Account provisioning | Support table exists, **0 evidence rows** | No historical account transition authorized or performed |
| Active unlinked Admin | 1 | No profile link should be invented or inferred |
| Existing AuditLog | 111 rows; immutability triggers protected | Count/presence is not full business-writer acceptance |
| Independent staging Supabase project | **Not present among connected projects** at inspection | Only the official project appeared; creation may require organization choice and cost consent |
| Render | Existing production service left unchanged | New separate Docker staging app not configured/deployed |

A table's presence does not authorize permanent Storage deletion. This PR adds the default-off `JAIROADS_PERMANENT_FILE_DELETION_ENABLED` gate; the actual object-delete operation and CLI worker must explicitly opt in **only after** an owner-reviewed and independently recoverable private Storage setup. The pending-intent read guard remains active even when deletion is disabled.

## Tasks GitHub contributors can prepare or review now

| ID | Task | State | Review requirement |
|---|---|---|---|
| GH-01 | Archive exact six hosted migration statements, separate from automatic deployment paths | **Included in PR #24** | DBA confirms snapshot equivalence and replay hazards |
| GH-02 | Reconcile pre-migration docs with post-migration login and support-table state | **Included in PR #24** | Preserve old snapshots as explicitly historical |
| GH-03 | Correct QA-04 Viewer/admin provisioning expectations | **Included in PR #24** | Owner confirms real profile policy; no dummy profiles |
| GH-04 | Correct QA-12/QA-15 to protect required record/project/manager relationships | **Included in PR #24** | No `maintenance_record_contexts`, nullable manager, record detach, or cascade |
| GH-05 | Default-off permanent private file removal, CLI retry hold, focused negative regression | **Included in PR #24** | Check disposable CI plus private Storage runbook |
| GH-06 | Review older stacked draft PRs #6–#23, dependency order and teammate integration | **Open; no merge** | Teammate source review and final SHA |
| GH-07 | Review realistic scenario coverage and exact source SHA | **Open; no human signoff** | Do not treat synthetic workflow checks as human acceptance |
| GH-08 | Resolve superseded Task 3 decision text versus strict Final DD | **Supersession banner included; remaining decisions open** | Get actual product-owner ruling, not inferred code changes |

## Real system and deployment dependencies (not completable by code-only PR)

| ID | Pending external gate | Minimum evidence before production |
|---|---|---|
| OP-01 | Independent PostgreSQL 17 / Supabase staging, private test Storage, synthetic four-role accounts | Project owner selects organization, approves any cost, provisions secure staging; do not copy official identities |
| OP-02 | Render staging web service for pinned reviewed SHA, HTTPS, private env/secrets | Build/image digest, accurate APP_URL, APP_KEY separate from DB password, secure Session pooler credentials |
| OP-03 | True restricted-role Laravel HTTP+RLS access | Authenticated real CRUD, denied Viewer/guest/other-LGU writes, sequence/grant tests, notification transaction rollback |
| OP-04 | Actual account ownership and reviewed transition | Verify Admin profile person and Fortify bridge, both Engineer identities, provenance reference by real approver; no fake backfill |
| OP-05 | Both real SuperAdmin recovery channels | Independent current password/MFA/passkey/reset possession and last-root safeguard, without credentials in logs |
| OP-06 | Real private Storage exact-object restore, upload/download/retry/delete | Independently recoverable bytes and metadata; keep `JAIROADS_PERMANENT_FILE_DELETION_ENABLED=false` until signed acceptance |
| OP-07 | Real SMTP/password reset | Provider ownership, delivery, expiry, replay denial, canonical/Fortify hash synchronization |
| OP-08 | Real HTTPS WebAuthn/passkeys and MFA | RP ID/origin/browser/device proof, lost-device recovery and wrong-origin rejection |
| OP-09 | Real maps and routing/geocoding | Availability, terms/rate limits/CORS, accurate fallback and older-user mobile usability |
| OP-10 | Independent DB and private Storage backup/restore | Actual isolated restore rehearsal, RPO/RTO, role/trigger/function restoration and object-byte recovery |
| OP-11 | Human UAT QA-01 through QA-25 | Every case executed on exact staging SHA with sanitized tester/evidence references; currently **25/25 NOT_RUN** |
| OP-12 | Thirteen owner gates | All currently **NOT_APPROVED** in the committed blank UAT template |
| OP-13 | Release governance | Teammate integration, DD/schema signoff, high-severity defect retest, change ticket, image digest, on-call and cutover window |

### Thirteen independent human approval gates

These are not permissions ChatGPT or GitHub CI can grant: `teammate_integration`, `data_dictionary`, `schema_runtime_rls_and_restore`, `actual_superadmin_recovery`, `real_account_transitions`, `persistent_isolated_staging`, `private_storage_recovery`, `password_reset_mail`, `real_device_passkeys_mfa`, `map_provider_acceptance`, `high_severity_defects_retested`, `authorized_user_acceptance`, `release_owner_review`.

See `docs/qa/uat-evidence-template.json`; the source template must remain 25 `NOT_RUN` and 13 `NOT_APPROVED` until **genuine evidence is recorded in a private, access-controlled workflow**. Do not put real credentials, identities, protected audit snapshots, signed tokens or Storage object paths in GitHub.

## Final-DD decisions still needing actual owners

- **Remain enforced:** `MaintenanceRecord.project_id` and `managing_engineer_id` are mandatory, with RESTRICT parents. Reject deleting any project with records. Reassign only to an eligible real Engineer; no nullable/detached history and no cascade.
- **Remain enforced:** append-only canonical AuditLog; no automatic platform-log replacement; recipient-specific notification reads; no premature read/unread/dismiss features.
- **Still need product decision:** historical RoadCoverage LGU transfer when a linked project has records; monthly historical update editing cutoff/timezone; exact document/media MIME limits and byte quotas; Engineer retirement/handover/unretirement details.
- **Still need formal approval:** generated Engineer profile UX for new Admin/Engineer, optional Viewer linkage, safe existing-account provenance, quarter identity acceptance and permanent-file recovery terms.
- File deletion of one selected document/media is code-supported but **not operationally enabled merely by schema installation**. Parent/bulk deletion remains a different, unapproved scope.

## Required release order

1. Review and merge only approved dependency PRs; pin exact final commit and immutable image digest.
2. Obtain real DD and schema-owner decisions and arrange **independent, synthetic** hosted staging with protected secrets.
3. Complete real restricted-Laravel HTTP, private Storage/messaging/device/maps, independent recovery rehearsal and all 25 human UAT cases.
4. Record all 13 authentic approvals plus deployment window, rollback/forward-repair plan and on-call responsibility.
5. Only then consider a separately authorized cutover of the official Render service and strict existing account transitions.

**Fail closed:** a green GitHub badge only validates its own synthetic checks. It cannot attest to a human signature, secure operations, actual browser/device use or a restored private object.

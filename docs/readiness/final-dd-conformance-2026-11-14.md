# JaiROADS Final Data Dictionary — remote conformance review (2026-11-14)

> **Status: DRAFT REVIEW / PRODUCTION NO GO.** This report compares the user's supplied Final DD entity/field/relationship/CRUD/Workflows/Page Specifications with the exact code reviewed in PR #26 and read-only official Supabase catalog/aggregate checks. It is **not** a signoff for the proposed notification triggers, a claim that the deployed Render site runs this branch, nor a license to bypass identity provenance.

## Canonical data and constraints

Canonical business schema: `jairoads_next` in official Supabase project `aeaaxwyytsagbacysvvx`, PostgreSQL 17. Source base: `review/postdemo2-remaining-gates-2026-11-14` at `e4e8f446f6ef`. This PR's source: `review/final-dd-alignment-2026-11-14`.

The catalog verified **all 18 Final-DD business foreign keys** with `ON DELETE RESTRICT` (22 total including four auxiliary support-table links). These are the exact canonical child-to-parent mappings, with no alternate project-level LGU or manager:

| Canonical child FK | Parent |
|---|---|
| engineer_lgus.engineer_id | engineers.id |
| engineer_lgus.lgu_id | lgus.id |
| user_accounts.engineer_id (nullable, unique) | engineers.id |
| road_coverages.lgu_id | lgus.id |
| road_coverages.created_by | engineers.id |
| maintenance_projects.road_coverage_id (required, unique) | road_coverages.id |
| maintenance_projects.created_by | user_accounts.id |
| maintenance_records.project_id | maintenance_projects.id |
| maintenance_records.managing_engineer_id | engineers.id |
| maintenance_records.created_by | user_accounts.id |
| monthly_updates.maintenance_id | maintenance_records.id |
| monthly_updates.created_by | user_accounts.id |
| maintenance_documents.maintenance_id | maintenance_records.id |
| maintenance_documents.uploaded_by | user_accounts.id |
| media.monthly_update_id | monthly_updates.id |
| media.uploaded_by | user_accounts.id |
| audit_logs.user_id | user_accounts.id |
| audit_logs.recipient_user_id (nullable) | user_accounts.id |

The live DB enforces required Project/ManagingEngineer/actor links, quarter enum and unique `(project_id,maintenance_year,quarter)`, per-record monthly `(maintenance_id,update_month)` uniqueness, `progress_percentage` 0–100, complete-date versus status, nonnegative road kilometers, allowed pavement/state and media MIME values, and two immutability AuditLog guards. Business entity tables use RLS and are not granted general browser roles' schema access. Do **not** recreate them or replay the seven already-applied hosted migrations.

## Changes included in this correction branch

1. **Legacy authentication quarantine:** `VerifiedProjectAccount` refuses legacy authorization for any Fortify login with non-NULL `dd_user_account_id`. This prevents a dual-linked account from using a legacy role when canonical eligibility fails; a live read-only count found one such dual-linked login. Added isolated regression.
2. **Viewer has no Engineer association:** strict `AccountIdentityResolver` only accepts unlinked Viewer identities; preserved mandatory independent immutable provisioning evidence and existing Viewer read-only authorization. Updated isolated PostgreSQL, feature and passkey fixtures and negative tests. No existing account was relinked or deleted.
3. **Schema contract regression:** the disposable PostgreSQL test checks all eighteen business foreign-key parents and `ON DELETE RESTRICT`, mandatory versus nullable fields, disallowed project/status fields, unique RoadCoverage/project and record/month links, EngineerLGU composite key and unique Engineer account link.
4. **Notifications conform to one recipient:** `OperationAudit` records at most one recipient and safe notification message in the same immutable canonical AuditLog INSERT. It never broadcasts new delivery rows, and Engineer actor changes remain audit-only. Eligible recipient must be the parent record's *current* ManagingEngineer with an active, properly provisioned Engineer login and active LGU assignment; self-delivery is suppressed. Record creation, reassignment, administrator update, and administrator changes to supporting monthly/document/media use the *proposed* event table in the supplied Workflows, pending team/client approval. Other actions are audit-only. Existing auxiliary delivery rows are retained as read-only legacy compatibility, not removed or altered. This does not create a twelfth business Notification entity.
5. **Browser and CI acceptance:** edited the browser audit assertion (an Engineer's own update must not broadcast), restricted-runtime staging smoke (LGU create is audit-only), and added/updated automated rollback, recipient and retention tests.

## Remaining verified mismatches and approval gates

| Area | Verified fact | Required decision/action |
|---|---|---|
| Engineer.ContactNo nullability | Quick Schema Reference marks required, but live `engineers.contact_no` permits NULL; all three current profiles have nonblank contacts | Confirm cross-tab inconsistency; after staging regressions and explicit migration review, add a NOT NULL constraint if accepted. Canonical creation and update forms already require contact. Do not silently backfill or modify existing personnel. |
| Existing-account eligibility | Seven active accounts (2 SuperAdmin, 1 Admin, 2 Engineer, 2 Viewer); zero historical immutable ordinary-account provisioning entries and one missing Viewer Fortify bridge; 1 Admin unlinked | Verify authentic account owners/transition evidence and resolve under approved workflows. Do not fabricate past provenance, infer account ownership or widen permissions. |
| Viewer role | One existing Viewer has no Fortify bridge; no Viewer currently has an EngineerID | Review and authorize any missing bridge repair; do not populate fake logins. |
| Dual-linked Fortify row | One canonical login also has a legacy `user_account_id` | Quarantined at code layer. Owner must investigate separately before changing live links. |
| Notification trigger policy | Single-recipient mechanics documented; action/event choices explicitly **proposed** in DD Workflows | Team/client approve trigger list and evidence before any production cutover. Existing auxiliary history preserved. |
| Engineer.LGU assignment | An active Engineer account has no active EngineerLGU row | Not automatically a violation; an Engineer may have zero active assignments. Do not invent work scope. |
| Parent deletion and Storage | RESTRICT FKs protect canonical history; private object retention/recovery policy still unresolved | No cascading, mass removal or permanent Storage deletion; independently verify backup/object recovery. |
| Old `public` resources | Historical legacy tables/routes are still present and must not grant canonical authority | Verify other legacy paths and maintain strict route quarantine; no routine destructive cleanup. |
| Monthly previous-update cutoff; road reuse; UI brand details | Deferred/unconfirmed in provided working reference | Retain current safe behavior pending owner/team decision. Do not invent a cutoff or remove one-project-per-road uniqueness. |
| Release environment | Only official Supabase project verified; persistent independent staging and actual Render, SMTP, passkey/device, map provider, human acceptance unverified | Pin exact code SHA and test against independent nonproduction environment. Complete 25 human UAT cases and 13 authentic approvals. |

## Direct read-only hosted recheck — 2026-11-15

This section supplements, rather than overwrites, the November 14 audit. It was read directly from the same connected official Supabase project on November 15 using a **READ ONLY** transaction:

| Aggregate | Rechecked observation |
|---|---|
| Active canonical UserAccounts | 7 |
| Immutable ordinary-account provisioning entries | 0 |
| Active ordinary accounts without those entries | 5 |
| Active Viewer identities without a Fortify bridge | 1 |
| Active Admin identities without an Engineer link | 1 |
| Dual-linked Fortify identities | 1 |
| Engineer profiles with blank/NULL ContactNo | 0 |
| `engineers.contact_no` declared nullable | YES |
| Preserved auxiliary notification-delivery rows | 2 |
| Pending file-deletion intents | 0 |

The *official* Final DD itself contains a real ContactNo conflict: its **Data Dictionary** table lists Engineer.ContactNo as nullable (`Yes`), but **Quick Schema Reference** lists `Null? No`. Consequently neither tightening nor relaxing this live column is authorized by an unqualified "fix all" request; a specific controlling-rule decision is needed. Current Laravel Engineer creation/update requires contact. No live database or account mutation was performed by this read.

Ordinary account repair remains blocked on authentic account-owner/provisioner identity evidence. Do not invent `reviewed_transition` records, new Fortify users or Engineer links to satisfy the resolver. The hosted project remains operationally **NO GO** for this branch, regardless of successful synthetic CI.

The notification bell can periodically refresh the authenticated recipient-only HTTP feed (foreground tab, every 60 seconds, plus focus/visibility changes). This is **not** Supabase Realtime or guaranteed instantaneous delivery, and does not introduce read/unread state.

## Upload-path correction after live review

The canonical document upload now derives its private-object extension from Laravel/Symfony's **verified** file MIME type (which is already checked by the document `mimes` validation). It also normalizes the stored download label to that verified extension. Downloads derive their MIME response from the immutable validated Storage path rather than the originally supplied label. This prevents a browser-supplied misleading extension from being incorporated into an object location that `PrivateSupabaseStorage` would reject.

A November 15 read-only check of the official hosted database found **two** existing canonical document rows, **zero** filename/path-extension mismatches and **zero** paths outside the allowlisted document-prefix pattern. No existing Storage object or metadata was modified. The client-approved upload MIME/size policy remains pending.

## 2026-11-15 bounded catalogue loading and notification freshness

The previously invisible fixed 300-row operation workspace cutoff now exposes a per-collection `windowHasMore` flag and a visible **Load 300 more records** action. It requests only rows authorized by the current server-side identity and LGU scope and retains the current project query when present. The backend caps a single Inertia response at 3,000 rows per collection to resist unbounded memory requests, and the UI explicitly says when this limit is reached. This is a bounded incremental-window correctness improvement, **not true server-side search/cursor pagination** for arbitrarily large datasets. The unbounded LGU, active Engineer and road-creator dropdown lookups still require scalable server-side filtering in a larger deployment.

Notification refresh is now best-effort every **20 seconds while the tab is visible**, plus focus/visibility-change refresh. It is **polling, not Supabase push delivery**, and the notification feed has no read/unread state by Final DD design. Neither change substitutes for real hosted HTTP acceptance.

## Operational safety and provenance

All this branch's changes are **GitHub source/tests only**; no official Supabase DDL/DML, account/role mutation, Storage deletion, deployed Render settings or merge were performed. Automated GitHub Actions use isolated disposable PostgreSQL 17 fixtures; those green checks never imply human acceptance, live account possession or recoverable private Storage. PR #26 remains **draft** until confirmed acceptance.

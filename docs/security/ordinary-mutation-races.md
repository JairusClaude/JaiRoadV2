# Ordinary mutation authorization races: test-first investigation

Source: reviewed remote `fix/audit-multirecipient-consistency` at
`4a8ec0cc26d203bafafcc738c3eff49d97528bd9`, freshly fetched and API-verified.
Dedicated branch: `fix/ordinary-mutation-authorization-races`.
No previous repair/teammate branch is edited. No shared database or Storage access.

## Inventory before production edits

All canonical routes below require Fortify auth and the strict canonical-session
middleware before their own checks. `actor` means the canonical resolver snapshot,
not a client role. The centralized audit writer rechecks canonical identity late,
but does not establish record-specific LGU/ManagingEngineer authority. Its actor
FK can serialize some later lifecycle operations; that alone is not a proof that
all business permissions stay valid. No defect is inferred solely from a captured
actor variable.

Locks: L=shared/exclusive lifecycle advisory 1927710916; P=provisioning 1927710914;
A=assignment 1927710915; S=settings username 1927710963. Row locks remain held to
transaction end. Existing global ordering/try-lock distinctions are recorded,
not assumed interchangeable.

| Method and real route | Initial check | Transaction / lock order before repair | Revalidation / pins after waits | Business + audit/delivery writes | Conflicting lifecycle operation |
| --- | --- | --- | --- | --- | --- |
| `saveProject` POST/PUT `/dd-phase3/ops/projects[/{id}]` | Canonical writer; validated fields | road FOR UPDATE; Engineer eligible JOIN FOR SHARE; existing project FOR UPDATE on edit | Fresh LGU/profile/assignment before project wait; JOIN pins Engineer authority; canonical audit check late | Project INSERT/UPDATE plus central event/deliveries; no-op skipped | Account deactivation, retirement, LGU withdrawal, municipality change |
| `saveRecord` POST `/dd-phase3/ops/records` | Canonical writer; Engineer self-selection | project FOR UPDATE; selected manager eligible JOIN FOR SHARE; period duplicate check | LGU/manager checked after project wait; JOIN pins selected account/profile/membership | Record INSERT plus event/deliveries | Deactivation, retirement, LGU withdrawal, manager changes |
| `saveRecord` PUT `/dd-phase3/ops/records/{id}` | Same writer/validation | project FOR UPDATE; scope read; target record FOR UPDATE | Scope and manager-active read BEFORE target-row wait; canonical identity rechecked by audit, not LGU scope | Record UPDATE plus event/deliveries; immutable period/creator rules | Assignment withdrawal, manager retirement, reassignment |
| `deleteEntity` DELETE `/dd-phase3/ops/{roads,records,updates}/{id}` | Admin/SuperAdmin only | target row FOR UPDATE; restrictive delete | Canonical audit check after wait/delete; FK/lifecycle interactions require tests | Single restrictive DELETE plus prior-state event/deliveries | Actor deactivation/retirement; concurrent dependency creation |
| `createLgu` POST `/dd-phase3/lgus` | Canonical administrator | INSERT (may wait on relation/FK/unique locks) | Central canonical audit check after insert | LGU CREATE plus event/deliveries | Actor deactivation/retirement |
| `updateLgu` PUT `/dd-phase3/lgus/{id}` | Canonical administrator | LGU FOR UPDATE; normalized diff | Central canonical audit check after update | LGU UPDATE plus event/deliveries; no-op skipped | Actor deactivation/retirement |
| `deleteLgu` DELETE `/dd-phase3/lgus/{id}` | Canonical administrator | LGU FOR UPDATE; restrictive delete | Central canonical audit check after delete | LGU DELETE plus event/deliveries | Actor revocation; dependency creation |
| `createEngineer` POST `/dd-phase3/engineers` | Canonical administrator | profile INSERT | Central canonical audit check after insert | Profile CREATE plus event/deliveries | Administrator deactivation/retirement |
| `setAssignment` POST `/dd-phase3/assignments` | Canonical administrator | A; target profile FOR UPDATE; membership read/write | Profile active after wait; actor canonical check at audit | Actual EngineerLGU CREATE/UPDATE plus event/deliveries | Actor deactivation, target retirement, competing assignment updates |
| `createAccount` POST `/dd-phase3/accounts` | Canonical administrator; allowed ordinary role | shared L; P; actor recheck; target profile FOR UPDATE | L serializes lifecycle revocation; actor checked again by immutable provenance and audit | Canonical + Fortify + provenance + event/deliveries atomically | Account deactivation; profile retirement/provisioning contention |
| `saveSettings` PUT `/dd-phase3/ops/settings` | Manager, current password, canonical account | S; optional synchronized password updater; canonical account FOR UPDATE | Password updater locks login/account/profile; username event rechecks actor | Approved username diff; synchronized credentials without secrets in business audit | Deactivation, password reset/change, competing usernames |
| `saveRoad` POST/PUT `/dd-phase3/ops/roads[/{id}]` | Canonical writer + LGU | road FOR UPDATE; **try** shared L; login SHARE; account SHARE; profile SHARE; membership SHARE | Canonical and LGU authority re-resolved after pins; 409 if lifecycle busy | Road change + event/deliveries; geometry preserved | Deactivation, retirement, LGU withdrawal; prior repaired method |
| `saveUpdate` POST/PUT `/dd-phase3/ops/updates[/{id}]` | Canonical writer; record write scope | project FOR UPDATE; record FOR UPDATE; actor/scope recheck; target monthly row on edit | Recheck after project/record waits; no explicit LGU pin through later creator/audit FK waits | Monthly INSERT/UPDATE plus event/deliveries | LGU withdrawal/reassignment/account revocation; prior repaired early wait |
| `updateDocument` PUT `/dd-phase3/ops/documents/{id}` | Canonical writer + parent scope | shared L; project SHARE; record SHARE; eligible manager JOIN SHARE; document FOR UPDATE | Re-resolve actor/scope after parent locks; Engineer eligibility JOIN pins membership | Metadata UPDATE plus event/deliveries; pending deletion denied | Lifecycle, LGU assignment, manager reassignment, permanent delete |
| `uploadDocument` / `uploadMedia` POST `/dd-phase3/ops/{documents,media}` | Canonical writer + parent scope | Storage first; SQL shared L, parent SHARE, eligible manager JOIN SHARE | Authorization rechecked after Storage; failure compensation retained | Metadata CREATE/event/deliveries; exact-object compensation | Revocation during external I/O or parent waits |
| `reassignRecord` / `unassignRecord` POST `/dd-phase3/ops/records/{id}/{reassignment,unassignment}` | Admin/SuperAdmin + expected manager | shared L; project then record; actor account/profile SHARE; replacement JOIN SHARE | Actor and stale manager rechecked under locks | Explicit manager UPDATE/event/deliveries only | Lifecycle, competing manager/assignment changes |
| `updateEngineer` PUT `/dd-phase3/engineers/{id}` | Canonical administrator | exclusive L; actor recheck; target profile FOR UPDATE | L serializes supported lifecycle changes | Professional diff UPDATE/event/deliveries | Actor/target retirement, deactivation |
| `retireEngineer` POST `/dd-phase3/engineers/{id}/retirement` | Canonical administrator | P; exclusive L; login UPDATE; account UPDATE; profile UPDATE; memberships UPDATE | Actor checked under L; self/last-root protections | Distinct actual account/profile/membership events | Provisioning and lifecycle contention; do not infer lock-order safety without schedules |
| `accountStatus` PATCH `/dd-phase3/accounts/{id}/status` | Canonical administrator | exclusive L; actor recheck; target login/account UPDATE; profile on reactivation | L coordinates actor status; eligibility and last-root/self checks | Actual activation UPDATE/event/deliveries | Pending mutations/provisioning; reactivation eligibility changes |
| `RoadMunicipalityChange::confirm` POST `/dd-phase3/ops/roads/{id}/municipality/confirm` | Canonical writer; signed impact token | road; LGUs; projects; records; children; profiles/accounts/memberships; bridge SHARE | Actor, both LGUs, manager eligibility and fingerprint rechecked under pins | Road LGU only + transition event/deliveries | Municipality/manager/lifecycle changes; geometry unchanged |
| `PermanentFileDeletion::delete/process` DELETE `/dd-phase3/files/{kind}/{id}` | Canonical administrator, approved parent context | durable intent; shared L; intent/file; account/profile SHARE; Storage; SQL finalization | Actor/role/parent/path rechecked; idempotent pending/completed handling | One exact file/metadata removal plus event/deliveries | Lifecycle, concurrent delete/retry; external I/O cannot roll back |
| `PreservedProjectDeletion::confirm` DELETE project route with token | Canonical administrator | shared L; road SHARE; project/records/children; actor account/profile SHARE | Actor and complete impact fingerprint rechecked | Project delete, actual detachments, retained contexts and events/deliveries | Lifecycle; project/record changes; teammate behavior preserved |

Legacy `public` business controllers remain unreachable to valid canonical users
through existing legacy-route guards, and legacy-only users cannot authenticate.
They are not silently redirected or rewritten. Privileged initial bootstrap,
password/MFA/passkey infrastructure and read-only preflight remain out of scope
for ordinary authenticated business-mutation changes.

## Test design and baseline proof

`OrdinaryMutationRaceTest` runs real HTTP kernels in a separate PHP process against
positively guarded disposable PostgreSQL 17. The parent connection owns the chosen
lock. `pg_stat_activity.wait_event_type = Lock` and `pg_blocking_pids` must identify
the actual blocker; a started process/sleep alone is not evidence. Revocations use
the real administrator HTTP controller, in the blocker transaction where possible,
and commit before the blocked request resumes. Snapshots taken after the legitimate
revocation exclude its legitimate audit/delivery rows from victim-change detection.
No role/identity/authorization service is mocked. Worker principal injection is a
guarded synthetic HTTP test facility, not a production authentication endpoint.

Initial baseline (no production edits): 36 cases, **4 failed / 32 passed**.
All failing security expectations corresponded to actual HTTP 302 plus committed
business changes, canonical events and linked deliveries:

| Case | Verified wait | Revocation committed before release | Baseline result |
| --- | --- | --- | --- |
| Record edit / Engineer | target maintenance record FOR UPDATE | Real EngineerLGU withdrawal | Unauthorized UPDATE + event + deliveries |
| Record edit / Admin | target maintenance record FOR UPDATE | Real retirement of selected manager | Edit accepted despite stale manager-active validation |
| Monthly CREATE / Engineer | created_by canonical FK during monthly INSERT | Real EngineerLGU withdrawal | Unauthorized CREATE + event + deliveries |
| Monthly UPDATE / Engineer | actor FK during AuditLog INSERT | Real EngineerLGU withdrawal | Unauthorized UPDATE + event + deliveries |

The unchanged-user counterpart succeeds for each schedule. The 26 other early-wait
cases reject actor deactivation with no victim mutation/event/delivery, or permit
the unchanged control. Two provisioning controls prove its existing shared
lifecycle guard queues deactivation until provisioning commits. These are bounded
schedule results, not a claim that every interleaving in each method is safe.

The raw before/after observations and final results will be recorded after the
focused correction and regression verification. No general controller rewrite,
AuditLog redesign, schema change or teammate deletion change is authorized here.

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

| Method and real route                                                                              | Initial check                                    | Transaction / lock order before repair                                                         | Revalidation / pins after waits                                                                            | Business + audit/delivery writes                                                   | Conflicting lifecycle operation                                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `saveProject` POST/PUT `/dd-phase3/ops/projects[/{id}]`                                            | Canonical writer; validated fields               | road FOR UPDATE; Engineer eligible JOIN FOR SHARE; existing project FOR UPDATE on edit         | Fresh LGU/profile/assignment before project wait; JOIN pins Engineer authority; canonical audit check late | Project INSERT/UPDATE plus central event/deliveries; no-op skipped                 | Account deactivation, retirement, LGU withdrawal, municipality change                   |
| `saveRecord` POST `/dd-phase3/ops/records`                                                         | Canonical writer; Engineer self-selection        | project FOR UPDATE; selected manager eligible JOIN FOR SHARE; period duplicate check           | LGU/manager checked after project wait; JOIN pins selected account/profile/membership                      | Record INSERT plus event/deliveries                                                | Deactivation, retirement, LGU withdrawal, manager changes                               |
| `saveRecord` PUT `/dd-phase3/ops/records/{id}`                                                     | Same writer/validation                           | project FOR UPDATE; scope read; target record FOR UPDATE                                       | Scope and manager-active read BEFORE target-row wait; canonical identity rechecked by audit, not LGU scope | Record UPDATE plus event/deliveries; immutable period/creator rules                | Assignment withdrawal, manager retirement, reassignment                                 |
| `deleteEntity` DELETE `/dd-phase3/ops/{roads,records,updates}/{id}`                                | Admin/SuperAdmin only                            | target row FOR UPDATE; restrictive delete                                                      | Canonical audit check after wait/delete; FK/lifecycle interactions require tests                           | Single restrictive DELETE plus prior-state event/deliveries                        | Actor deactivation/retirement; concurrent dependency creation                           |
| `createLgu` POST `/dd-phase3/lgus`                                                                 | Canonical administrator                          | INSERT (may wait on relation/FK/unique locks)                                                  | Central canonical audit check after insert                                                                 | LGU CREATE plus event/deliveries                                                   | Actor deactivation/retirement                                                           |
| `updateLgu` PUT `/dd-phase3/lgus/{id}`                                                             | Canonical administrator                          | LGU FOR UPDATE; normalized diff                                                                | Central canonical audit check after update                                                                 | LGU UPDATE plus event/deliveries; no-op skipped                                    | Actor deactivation/retirement                                                           |
| `deleteLgu` DELETE `/dd-phase3/lgus/{id}`                                                          | Canonical administrator                          | LGU FOR UPDATE; restrictive delete                                                             | Central canonical audit check after delete                                                                 | LGU DELETE plus event/deliveries                                                   | Actor revocation; dependency creation                                                   |
| `createEngineer` POST `/dd-phase3/engineers`                                                       | Canonical administrator                          | profile INSERT                                                                                 | Central canonical audit check after insert                                                                 | Profile CREATE plus event/deliveries                                               | Administrator deactivation/retirement                                                   |
| `setAssignment` POST `/dd-phase3/assignments`                                                      | Canonical administrator                          | A; target profile FOR UPDATE; membership read/write                                            | Profile active after wait; actor canonical check at audit                                                  | Actual EngineerLGU CREATE/UPDATE plus event/deliveries                             | Actor deactivation, target retirement, competing assignment updates                     |
| `createAccount` POST `/dd-phase3/accounts`                                                         | Canonical administrator; allowed ordinary role   | shared L; P; actor recheck; target profile FOR UPDATE                                          | L serializes lifecycle revocation; actor checked again by immutable provenance and audit                   | Canonical + Fortify + provenance + event/deliveries atomically                     | Account deactivation; profile retirement/provisioning contention                        |
| `saveSettings` PUT `/dd-phase3/ops/settings`                                                       | Manager, current password, canonical account     | S; optional synchronized password updater; canonical account FOR UPDATE                        | Password updater locks login/account/profile; username event rechecks actor                                | Approved username diff; synchronized credentials without secrets in business audit | Deactivation, password reset/change, competing usernames                                |
| `saveRoad` POST/PUT `/dd-phase3/ops/roads[/{id}]`                                                  | Canonical writer + LGU                           | road FOR UPDATE; **try** shared L; login SHARE; account SHARE; profile SHARE; membership SHARE | Canonical and LGU authority re-resolved after pins; 409 if lifecycle busy                                  | Road change + event/deliveries; geometry preserved                                 | Deactivation, retirement, LGU withdrawal; prior repaired method                         |
| `saveUpdate` POST/PUT `/dd-phase3/ops/updates[/{id}]`                                              | Canonical writer; record write scope             | project FOR UPDATE; record FOR UPDATE; actor/scope recheck; target monthly row on edit         | Recheck after project/record waits; no explicit LGU pin through later creator/audit FK waits               | Monthly INSERT/UPDATE plus event/deliveries                                        | LGU withdrawal/reassignment/account revocation; prior repaired early wait               |
| `updateDocument` PUT `/dd-phase3/ops/documents/{id}`                                               | Canonical writer + parent scope                  | shared L; project SHARE; record SHARE; eligible manager JOIN SHARE; document FOR UPDATE        | Re-resolve actor/scope after parent locks; Engineer eligibility JOIN pins membership                       | Metadata UPDATE plus event/deliveries; pending deletion denied                     | Lifecycle, LGU assignment, manager reassignment, permanent delete                       |
| `uploadDocument` / `uploadMedia` POST `/dd-phase3/ops/{documents,media}`                           | Canonical writer + parent scope                  | Storage first; SQL shared L, parent SHARE, eligible manager JOIN SHARE                         | Authorization rechecked after Storage; failure compensation retained                                       | Metadata CREATE/event/deliveries; exact-object compensation                        | Revocation during external I/O or parent waits                                          |
| `reassignRecord` / `unassignRecord` POST `/dd-phase3/ops/records/{id}/{reassignment,unassignment}` | Admin/SuperAdmin + expected manager              | shared L; project then record; actor account/profile SHARE; replacement JOIN SHARE             | Actor and stale manager rechecked under locks                                                              | Explicit manager UPDATE/event/deliveries only                                      | Lifecycle, competing manager/assignment changes                                         |
| `updateEngineer` PUT `/dd-phase3/engineers/{id}`                                                   | Canonical administrator                          | exclusive L; actor recheck; target profile FOR UPDATE                                          | L serializes supported lifecycle changes                                                                   | Professional diff UPDATE/event/deliveries                                          | Actor/target retirement, deactivation                                                   |
| `retireEngineer` POST `/dd-phase3/engineers/{id}/retirement`                                       | Canonical administrator                          | P; exclusive L; login UPDATE; account UPDATE; profile UPDATE; memberships UPDATE               | Actor checked under L; self/last-root protections                                                          | Distinct actual account/profile/membership events                                  | Provisioning and lifecycle contention; do not infer lock-order safety without schedules |
| `accountStatus` PATCH `/dd-phase3/accounts/{id}/status`                                            | Canonical administrator                          | exclusive L; actor recheck; target login/account UPDATE; profile on reactivation               | L coordinates actor status; eligibility and last-root/self checks                                          | Actual activation UPDATE/event/deliveries                                          | Pending mutations/provisioning; reactivation eligibility changes                        |
| `RoadMunicipalityChange::confirm` POST `/dd-phase3/ops/roads/{id}/municipality/confirm`            | Canonical writer; signed impact token            | road; LGUs; projects; records; children; profiles/accounts/memberships; bridge SHARE           | Actor, both LGUs, manager eligibility and fingerprint rechecked under pins                                 | Road LGU only + transition event/deliveries                                        | Municipality/manager/lifecycle changes; geometry unchanged                              |
| `PermanentFileDeletion::delete/process` DELETE `/dd-phase3/files/{kind}/{id}`                      | Canonical administrator, approved parent context | durable intent; shared L; intent/file; account/profile SHARE; Storage; SQL finalization        | Actor/role/parent/path rechecked; idempotent pending/completed handling                                    | One exact file/metadata removal plus event/deliveries                              | Lifecycle, concurrent delete/retry; external I/O cannot roll back                       |
| `PreservedProjectDeletion::confirm` DELETE project route with token                                | Canonical administrator                          | shared L; road SHARE; project/records/children; actor account/profile SHARE                    | Actor and complete impact fingerprint rechecked                                                            | Project delete, actual detachments, retained contexts and events/deliveries        | Lifecycle; project/record changes; teammate behavior preserved                          |

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

| Case                      | Verified wait                                 | Revocation committed before release | Baseline result                                       |
| ------------------------- | --------------------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Record edit / Engineer    | target maintenance record FOR UPDATE          | Real EngineerLGU withdrawal         | Unauthorized UPDATE + event + deliveries              |
| Record edit / Admin       | target maintenance record FOR UPDATE          | Real retirement of selected manager | Edit accepted despite stale manager-active validation |
| Monthly CREATE / Engineer | created_by canonical FK during monthly INSERT | Real EngineerLGU withdrawal         | Unauthorized CREATE + event + deliveries              |
| Monthly UPDATE / Engineer | actor FK during AuditLog INSERT               | Real EngineerLGU withdrawal         | Unauthorized UPDATE + event + deliveries              |

The unchanged-user counterpart succeeds for each schedule. The 26 other early-wait
cases reject actor deactivation with no victim mutation/event/delivery, or permit
the unchanged control. Two provisioning controls prove its existing shared
lifecycle guard queues deactivation until provisioning commits. These are bounded
schedule results, not a claim that every interleaving in each method is safe.

## Narrow correction and passing-after evidence

Only `DdOperationsController::saveRecord` (UPDATE branch) and `saveUpdate`
(CREATE/UPDATE) change production behavior. `RecordMutationAuthority::lock` is
called inside their business transaction after parent/record locks. It attempts
shared lifecycle coordination without waiting for an exclusive lifecycle owner;
a busy lifecycle returns HTTP 409 with no business/event/delivery writes. The
user may retry the unchanged request. There is no automatic partial retry.

Under that guard, it takes shared locks in bridge -> canonical account -> active
linked profile -> EngineerLGU order, re-resolves strict canonical identity,
checks the writer role and pins an Engineer's current LGU membership. Pins last
through creator, AuditLog and recipient FK waits until commit. Record editing
now reads scope after locking the record and rechecks/pins its current manager's
active status. The existing project/manager/year/quarter immutability and nullable
manager policy remain unchanged. Monthly scope is checked against the locked
record, so reassignment cannot slip between final scope and business commit.

This is intentionally scoped to the reproduced methods. Record CREATE, project
writes, ordinary DELETE, LGU methods, assignment/provisioning, existing road,
municipality, file, lifecycle and retained-history implementations are unchanged.
No model, migration, database object, geometry or stored history changes.

The exact original 36 schedules now pass (237 assertions), against the same
local PostgreSQL 17 setup. The expanded focused suite passes **43 cases / 301
assertions**. `ordinary-mutation-race-evidence.json` contains 36 baseline and 36
matching after observations, plus 39 final lock-wait observations. Four additional
busy-lifecycle/rollback cases assert their outcomes directly and do not append
wait observations because a successful nonblocking rejection or released lock,
not a victim lock wait, is the expected outcome.

| Method                                                                                                                     | Race reproduced?                                | Evidence                                                                                                                                      | Repair made?                                                           | Final result                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `saveRecord` UPDATE                                                                                                        | Yes                                             | Real record-row wait; committed EngineerLGU withdrawal or manager retirement; baseline business + event + deliveries committed                | Yes: final identity/LGU pins, locked scope and current manager recheck | Engineer revocation 403; manager retirement 422; no victim writes; active controls succeed               |
| `saveUpdate` CREATE                                                                                                        | Yes                                             | Real monthly INSERT creator-FK wait; committed EngineerLGU withdrawal; baseline business + event + deliveries committed                       | Yes: final transaction authority pins                                  | 403, no victim rows/events/deliveries; active control succeeds                                           |
| `saveUpdate` UPDATE                                                                                                        | Yes                                             | Real AuditLog INSERT actor-FK wait; committed EngineerLGU withdrawal; baseline monthly edit + event + deliveries committed                    | Same scoped pins                                                       | 403, monthly unchanged, no victim event/delivery; active control succeeds                                |
| `saveProject` CREATE/UPDATE                                                                                                | No in tested schedules                          | Account deactivated during verified initial row wait; plus Engineer CREATE late notification-FK wait with assignment revoker verified blocked | No                                                                     | Deactivated actor rejected/rolled back; active controls succeed; late revocation serializes after commit |
| `saveRecord` CREATE                                                                                                        | No in tested schedule                           | Account deactivated during project-row wait                                                                                                   | No                                                                     | 403/no victim writes; active control succeeds                                                            |
| `deleteEntity` roads/records/updates                                                                                       | No in tested schedules                          | Target-row waits plus actor deactivation, each with unchanged control                                                                         | No                                                                     | 403/no victim deletion/event/delivery; active controls succeed                                           |
| `createLgu` / `updateLgu` / `deleteLgu`                                                                                    | No in tested schedules                          | Real relation/row lock waits plus actor deactivation                                                                                          | No                                                                     | Deactivated actor rolls back; active controls succeed                                                    |
| `createEngineer`                                                                                                           | No in tested schedule                           | Real relation lock wait plus actor deactivation                                                                                               | No                                                                     | Deactivated actor rolls back; active control succeeds                                                    |
| `setAssignment`                                                                                                            | No in tested schedule                           | Assignment advisory-lock wait plus actor deactivation                                                                                         | No                                                                     | Deactivated actor rolls back; active control succeeds                                                    |
| `createAccount`                                                                                                            | No in tested schedules                          | Provisioning advisory wait; concurrent deactivator verified waiting on victim lifecycle guard                                                 | No                                                                     | Provisioning commits while still eligible, then deactivation; active control succeeds                    |
| `saveSettings`                                                                                                             | No in tested schedule                           | Username advisory-lock wait plus actor deactivation                                                                                           | No                                                                     | Deactivated actor rolls back; active control succeeds                                                    |
| Previously protected road/monthly early waits, uploads, metadata, reassignment, lifecycle, permanent file/project deletion | No new defect established by this investigation | Existing source protections reviewed; existing canonical/concurrency/browser regressions rerun                                                | No unrelated edits                                                     | Existing regression results below; not exhaustive new lock-pair coverage                                 |

Additional through-commit tests hold a recipient FK lock after final business
authorization, then launch a real EngineerLGU withdrawal request. For project
CREATE, repaired record UPDATE and monthly CREATE, PostgreSQL confirms the
revoker waits on the mutation-held profile. Membership remains active until the
mutation commits; only then can withdrawal commit. Audit order matches that
serial order. Thus rejection is not the only valid result: a revocation queued
behind already pinned final authorization legitimately takes effect afterwards.

Two 409 controls hold lifecycle exclusivity while requesting record/monthly
writes, require a bounded response before releasing it, then retry successfully
with one event. Two audit-failure controls force SQL audit insertion failure,
assert full business/event/delivery rollback, and require an independent
assignment mutation to finish while the test connection remains open, showing
transaction pins have been released. Existing retry/idempotence regressions
remain in the canonical suite; no new transaction-retry implementation is added.

## Verification and limits

Local checks executed after the final production correction:

| Check                                                           | Actual result                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| New focused real concurrency suite                              | 43 passed, 301 assertions                                          |
| Complete canonical PostgreSQL 17 suite                          | 433 passed, 4,723 assertions                                       |
| Password PostgreSQL regressions                                 | 56 passed, 330 assertions                                          |
| PostgreSQL Feature suite                                        | 49 passed, 344 assertions; 2 pre-existing registration skips       |
| Standard Laravel suite                                          | 105 passed, 649 assertions; same 2 pre-existing registration skips |
| All tracked PHP syntax                                          | 298 files passed                                                   |
| Pint, PHPStan, ESLint, Prettier, TypeScript, Vite build, routes | Passed                                                             |
| Composer strict validation and locked audit                     | Passed; zero advisories                                            |
| npm high-threshold audit                                        | Passed; zero vulnerabilities                                       |

The skipped registration cases do not count as passes. Public registration is
disabled and strict canonical registration denial is exercised elsewhere.
No assertions or checks were disabled for this repair.

Real Laravel/Fortify Chromium acceptance completed successfully: all four roles,
project/quarter/monthly writes, private uploads/downloads, duplicate warning,
geometry preservation, municipality confirmation, notification/audit readership,
file deletion recovery, retained project history, logout/Back and session expiry.
The 24 directory/viewport measurements fit all six tested widths.

The real registered WebAuthn suite also completed: all four eligible roles,
legacy/inactive/retired/missing/invalid-link/email/hash/profile/provenance denial,
wrong-origin/replay/foreign-credential rejection, remember-me revocation and an
administrator-provisioned Engineer-linked Viewer login/read-only workflow.
Neither browser suite uses the standalone Node preview as its backend.

Docker is unavailable locally; its existing production-image acceptance job must
execute in disposable GitHub CI before claiming Docker verified. The only workflow edit adds this
repair branch to both existing push allowlists; every existing job remains.

This investigation is **not** proof that all possible authorization races are
fixed. Out-of-band privileged SQL changes, every possible pair of lifecycle
operations, provisioning-versus-retirement ordering, and all complex file,
municipality or retained-history interleavings have not received new exhaustive
schedules here. Existing protections are preserved and their suites rerun.
No untested lock-order difference is classified as a confirmed vulnerability.
Any newly suspected path needs its own reproducible schedule before edits.

No schema change is required by this repair. Prior canonical provisioning and
notification auxiliary-schema activation prerequisites remain the schema owner's
responsibility; disposable tests rehearse them without touching shared Supabase.

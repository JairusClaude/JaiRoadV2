# MaintenanceRecord duplicate warning — Repair 5B

The merged create form now marks occupied quarters for the selected project/year. Attempting an occupied period opens an accessible warning dialog showing project ID/title, maintenance year and quarter. Close preserves every input. Choose Another Quarter clears only the quarter and returns focus to its selector; project, manager, dates, duration, status and description are retained. Unoccupied Q1–Q4 remain selectable independently. No automatic quarters or assignment changes are introduced.

## Server authority and privacy

`DdOperationsController::saveRecord` retains the parent-project `FOR UPDATE` lock, complete-history duplicate check, eligibility checks and transactional record/audit insertion. The period is unique across managers, not per Engineer. `DuplicateMaintenancePeriod` distinguishes this conflict from unrelated validation errors.

The canonical frontend adapter flashes only the validated period key for a normal Inertia/form validation redirect. The create-page projection rechecks the current canonical actor's project/record read scopes and supplies the warning context and existing-record URL. Period choices also obtain links exclusively from scoped server projections. If the project is no longer authorized, no conflict context is exposed; a missing/inaccessible record has no details link. JSON API failures retain their ordinary 422 response without leaving a warning for a later unrelated page visit.

This also handles stale forms: another authorized user may occupy a period after the form loads. The POST reaches the locked server check, redirects with validation errors and refreshed warning props, and Inertia preserves local form state. A known occupied period is rejected locally for responsiveness, but direct HTTP requests remain protected by the same server rule.

Duplicate attempts do not reach the insert/audit calls. A database failure rolls back the transaction; unrelated database/audit failures are rethrown rather than labelled as duplicates. Existing history is never rewritten.

## Schema teammate handoff — not executed

The previously reviewed [occurrence-constraint proposal](reconciliation/maintenance-period-constraint-proposal.md) remains the handoff for `UNIQUE(project_id, maintenance_year, quarter)`. This repair does not claim that the shared database already has it and makes no live inspection or schema change. The owner must repeat the duplicate/catalog preflight and coordinate all writers; application locks protect cooperating requests, while imports/direct SQL still need the physical invariant.

After an approved ordinary non-deferrable constraint (or equivalent unique index) is added, the application recognizes PostgreSQL SQLSTATE 23505 **only** for an insert into canonical maintenance_records whose reported index is catalog-verified as valid, unique, unfiltered and exactly these three key columns. The owner's index name is discovered, not assumed. Recognition happens after rollback and produces the same typed period conflict and UI warning. Primary-key, foreign-key, other-table, partial-index and unrecognized diagnostic failures are not broadly suppressed.

The positive future-index recognition test substitutes a catalog response; negative primary-key recognition uses the actual disposable PostgreSQL catalog. No period constraint DDL is applied as part of this repair. The teammate should additionally exercise the real constraint path in their approved disposable schema rehearsal before shared execution.

## Regression coverage

- `tests/Quarterly/DuplicatePeriodWarningTest.php`: verified warning/link, retained input, unchanged audit history, another authorized Engineer, changed LGU scope, missing record, JSON behavior, precise future-index classification and unrelated audit database rollback.
- Existing `MaintenanceBehaviorTest.php`: first/duplicate periods, independent Q1–Q4, another year/project, preserved history and direct HTTP rejection.
- Existing `ConcurrentPeriodTest.php`: two independent HTTP-kernel workers actually wait on a PostgreSQL project lock, then commit exactly one record and one business audit event.
- `tests/Browser/duplicate-period.mjs`, called by `unified.mjs`: real Fortify sessions and PostgreSQL; occupied labels; client warning without POST; a second session occupying an initially available quarter; server warning; accurate authorized link; Close/Choose Another Quarter input preservation and focus; all four unoccupied options; successful replacement period.

Run the guarded PostgreSQL suite with the existing `phpunit.quarterly.xml` disposable configuration and the established unified browser runner. No production sessions, preview authentication, shared Supabase or live Storage are used. Canonical models, migration files, authorization policy, quarterly semantics and AuditLog architecture remain unchanged.

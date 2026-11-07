# Strict canonical-only account access

Implementation baseline: security branch `5c3ab221d18594d2c1fa42e9dafd2871c3846b5f`.
Working branch: `fix/canonical-only-provisioned-auth`. This supersedes the older
legacy-only and unlinked-Admin compatibility statements in the November 5 report.

## Eligibility contract

Laravel Fortify, `public.users`, MFA, password brokers, and registered passkeys stay
in place. There is no direct-UserAccount authenticatable rewrite or Supabase Auth.
`DataDictionaryIdentityResolver` is the single eligibility policy:

| Requirement                                                  | SuperAdmin                          | Admin / Engineer / Viewer |
| ------------------------------------------------------------ | ----------------------------------- | ------------------------- |
| Persisted Fortify identity and explicit `dd_user_account_id` | Required                            | Required                  |
| Exactly one Fortify identity for canonical account           | Required                            | Required                  |
| Recognized canonical Account Type, active account            | Required                            | Required                  |
| Matching email and synchronized credential hashes            | Required                            | Required                  |
| Active existing Engineer                                     | Optional; if linked, must be active | Required                  |
| Immutable administrative provisioning evidence               | Bootstrap exception                 | Required                  |
| Email verification                                           | Optional                            | Optional                  |

Engineer linkage does not confer Engineer permissions. Viewer remains read-only;
Admin keeps approved administrative access; existing EngineerLGU/ManagingEngineer
scopes are unchanged. No automatic linkage, profile fabrication, grandfathering,
registration or invitation flow is introduced. `engineer_id` remains unique.

Password login and confirmation, remember-me lookup, passkey authorization, all web
sessions, MFA completion and credential-management requests use this policy. The
web middleware is explicitly ordered after sessions and before authentication,
bindings, Inertia user sharing, and legacy route execution. A revoked session is
logged out, invalidated and its CSRF token regenerated; the first request is denied
403, subsequent JSON protected requests are guest 401. Explicit logout remains
available to a revoked authenticated principal. A pending MFA challenge is cleared
before consuming a recovery code if eligibility has been lost.

Token-verified password recovery retains the existing narrow ability to repair
hash desynchronization. It cannot repair identity/email linkage, activation,
Engineer eligibility or absent provisioning evidence. Invalid reset requests leave
canonical data unchanged. No secrets are added to AuditLog. Existing AuditLog
writers/notification policy remain unchanged.

## Schema-owner dependency: do not deploy before review

`database/proposals/canonical_account_provisioning.sql` is a **review proposal**,
not an applied migration. No teammate migration/model was changed. Tests load this
proposal only after the empty local PostgreSQL 17 guard. The shared development
database has not received any DDL or backfill.

The private `jairoads_security.account_provisioning` table has one immutable row per
ordinary canonical account, restrictive foreign keys, role/profile snapshots,
server-generated timestamp and the actual provisioning administrator. A current
profile/role must still match that snapshot. UPDATE, DELETE and TRUNCATE are
rejected, even in the owner-level disposable rehearsal. A database owner can always
alter/drop objects; triggers are not protection against a privileged operator.

Administrative account creation takes the existing lifecycle shared lock, checks
the actor again, creates canonical + Fortify rows, inserts provenance using the
server actor and writes the existing audit event in **one transaction**. Failure
at any stage rolls everything back. Client `provisioned_by`, creator or timestamp
values are never used. There is no provenance-edit HTTP endpoint. Deactivating a
past provisioner does not erase a child's historical evidence or implicitly revoke
all of that administrator's accounts.

The owner must review the proposal, naming, role grants, storage/backup and review
process before converting it to their own forward migration. Do not execute it
against shared Supabase from tests, application startup or an automatic CI step.
No schema/profile cardinality change is proposed to canonical business tables.

Use a dedicated Laravel database role, not the schema owner. Keep this schema out
of the Data API. Explicitly deny anon/authenticated/service roles and PUBLIC unless
separately reviewed. The application role needs USAGE + SELECT + INSERT, never
UPDATE/DELETE/TRUNCATE/CREATE or ownership. Enable targeted RLS as follows, replacing
the example role with the actual reviewed **database role** (not Account Type):

```sql
-- Owner-review template only; not applied by this repair.
GRANT USAGE ON SCHEMA jairoads_security TO jairoads_app_runtime;
GRANT SELECT, INSERT ON jairoads_security.account_provisioning TO jairoads_app_runtime;
CREATE POLICY runtime_provenance_read ON jairoads_security.account_provisioning
  FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY runtime_provenance_insert ON jairoads_security.account_provisioning
  FOR INSERT TO jairoads_app_runtime WITH CHECK (method = 'administrator');
```

Existing canonical table permissions still apply to the invoker trigger. The
application is the trusted actor-verification boundary; DB roles are not Laravel
user identities. The SQL trigger independently checks eligible provisioner role,
activation, bridge integrity, target profile and snapshot values. No SECURITY
DEFINER function, broad PUBLIC grant or client-writable metadata is used.

If the table is absent, ordinary access fails closed and account provisioning is 503. Bootstrap SuperAdmin eligibility does not depend on that table. Do not enable
this code on a real database without finishing the transition below.

## Trusted initial SuperAdmin bootstrap

Only a trusted database operator may run this procedure. It is a console command,
not a web route or API, and requires a privileged PostgreSQL role: superuser, or
both CREATEROLE and BYPASSRLS. Keep privileged credentials in the operator's local
environment/secret manager, never in chat, committed files, command arguments or
CI variables. The ordinary application database role must not have these powers.

1. Independently verify the repository revision, database host/name and operator
   authorization. Back up the database and follow the schema owner's runbook.
2. Confirm there is **no existing canonical SuperAdmin**, active or inactive.
   If one exists, repair that reviewed identity instead; this command refuses to
   create another. Do not delete an existing SuperAdmin to bypass that safeguard.
3. In a private trusted operator shell configured for the intended database, run:

    ```bash
    php artisan jairoads:bootstrap-superadmin
    ```

4. Type the explicit operator acknowledgement, then supply unique username,
   email/display name and a unique strong password in hidden interactive prompts.
   There is no default password or noninteractive secret option. Do not log the
   interactive terminal session. Hashing uses Laravel's configured hasher once;
   both password columns receive that exact hash.
5. The command serializes with lifecycle/provisioning, checks again that no
   SuperAdmin exists, and inserts active canonical SuperAdmin plus Fortify bridge
   atomically with NULL EngineerID and optional NULL email verification. It does
   not create Engineers, LGUs, evidence rows, extra SuperAdmins or legacy roles.
6. Verify login over the real secure application origin, configure MFA/passkeys,
   and populate Engineers/LGUs through approved administrative routes. The command
   is tested with zero Engineers/LGUs and rolls back if the Fortify insert fails.

Last-active-SuperAdmin protection now also checks other roots' actual eligibility:
an active row with a broken bridge cannot justify deactivating the last usable
SuperAdmin. Normal self-lockout protections are retained.

## Read-only preflight and existing-account transition

The operator can run `php artisan jairoads:canonical-access-preflight` against the
configured database. It opens a PostgreSQL READ ONLY transaction and prints IDs,
roles, profile IDs and reason codes; no hashes, tokens or email addresses. It never
repairs or labels accounts as historically administrator-created.

The actual development-account inventory was delivered separately to the project
owner as a private preflight report. This public runbook intentionally contains no
shared-database account IDs, counts, profile associations or account-specific
remediation findings. Run the read-only command privately against the intended
database and obtain administrator review before transition.

Safe deployment order:

1. Verify and retain a usable eligible SuperAdmin and a tested operator recovery path.
   Do not run initial bootstrap where a canonical SuperAdmin already exists.
2. Have the schema owner approve/rehearse/apply their provenance migration and
   restricted runtime grants, backups and RLS policies. Never migrate from this
   branch's automated startup or test jobs.
3. Review each ordinary account's identity, role, active available Engineer, bridge
   and credential consistency. A designated administrator must explicitly approve
   eligibility, supported by a ticket/review record. Do not reuse an already linked Engineer or fabricate a profile just to pass a login check. Obtain a real profile
   and approved account linkage through the separate operator-reviewed remediation.
4. For existing identities, a trusted schema/database operator may insert one
   `method='reviewed_transition'` row after the review, with the actual reviewing
   Admin/SuperAdmin, target role/profile and a non-sensitive review/ticket reference.
   It records the review timestamp, **not an invented original creation date**.
   No automatic converter or application backfill is provided. Runtime RLS must
   forbid inserting this method. Missing evidence means access remains denied.
5. Re-run the read-only preflight. Require all approved ordinary accounts eligible
   and at least one independently verified usable SuperAdmin. Resolve exceptions
   explicitly; never silently grandfather them.
6. Publish only the dedicated repair branch for requested CI review. Separately
   authorize deployment, then activate the strict code with
   sessions considered revoked until eligibility is checked. Exercise real login,
   reset/MFA/passkeys and role workflows. Keep an operator present for recovery.

No automatic reversal to legacy login is provided as an outage workaround. If a
transition prerequisite fails, stop deployment and remediate with the owner.

## Verification scope

Canonical/password/Feature and the standard Laravel suite use positively guarded
disposable PostgreSQL 17. Legacy controller/domain tests retain their existing
explicit identity stub and isolate the new outer authentication middleware **only
in that unit file**; they do not certify public legacy access. Their temporary
legacy schemas now also use PostgreSQL, not SQLite. Separate real-stack negative
tests prove legacy password/passkey/session and HTTP business routes are denied.
No global middleware exception, analyzer exclusion, audit ignore or test skip was
added. Existing registration skips remain because the feature is disabled.

CI workflows include this dedicated branch and a disposable PostgreSQL service for
the standard Laravel job. Results on the final SHA, actual counts and environmental
limitations are recorded in the accompanying verification report, not inferred
from the source security branch's historical CI.

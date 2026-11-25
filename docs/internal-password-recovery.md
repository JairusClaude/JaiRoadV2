# Internal password recovery

JaiROADS now uses SuperAdmin-assisted, one-time code recovery for eligible canonical Admin, Engineer and Viewer accounts. No email/SMS transport is required. The existing direct SuperAdmin password reset remains available under account management.

## Required owner setup

1. Back up the database and confirm the target PostgreSQL/Supabase project. Review and run `database/sql/internal_password_recovery.sql` as its authorized schema owner, first in an isolated test database.
2. Keep the `jairoads_security` schema private (not exposed by Supabase PostgREST). If the application connects as a non-owner, grant only the dedicated server-side database role the required schema USAGE, table SELECT/INSERT/UPDATE, identity sequence USAGE and a role-specific RLS policy. Never grant these privileges to anon/authenticated API users. Confirm the existing account-provisioning, audit-delivery and session schemas are operational. No schema changes are performed by the container entrypoint.
3. Deploy the updated branch after the setup is verified. Keep `APP_KEY` stable and secret, and `APP_DEBUG=false`. Production email reset routes are disabled by default; `JAIROADS_EMAIL_PASSWORD_RECOVERY=true` is an explicit compatibility opt-in and is not needed for this workflow. Keep it unset or false on Render.
4. Prefer database-backed Laravel sessions and cache/rate limiting. Confirm the database session driver uses the same connection as the linked password updater if immediate deletion of all existing sessions is required. Do not share a test deployment with live data.

## Usage

- On Forgot Password, enter a username or registered email and submit a recovery request. The response is deliberately generic regardless of account eligibility.
- SuperAdmin opens User Management > Password recovery requests. The inbox refreshes every 30 seconds while the page is visible. Pending requests expire after 24 hours.
- Verify the requester's identity independently (for example, in person using the organization's approved identity-verification process), tick the confirmation and re-enter the SuperAdmin password. Provide the displayed six-digit code privately to the verified person. The code is shown only in the approval response, expires after ten minutes, and is never mailed or stored in plaintext.
- The requester uses I have a code and sets their own password. Five incorrect attempts lock the issued code. A new request and independent approval are required for another code. A lost issued code cannot be retrieved; wait for expiry before requesting again.
- The existing linked password updater synchronizes password hashes and invalidates remember-me credentials; database-backed sessions on the same connection are removed. Current session enforcement also checks canonical eligibility. Outstanding email reset tokens are deleted. The approval and consumption history is stored in the private request table, and a successful reset is recorded in the canonical Audit Log without recording credentials.
- SuperAdmin recovery remains the separate approved owner procedure. This feature never grants new roles or changes account links.

## Verification

Use the existing disposable PostgreSQL test harness only (never a live database), applying its normal test database safety settings. Run `php artisan test tests/Quarterly/InternalPasswordRecoveryTest.php`, `npm run types:check`, and `npm run build`. Test the full flow in a browser with disposable accounts, including invalid identifiers, retired/inactive accounts, Admin approval denial, incorrect approver password, expiry, five failures, reuse, password changes after issuance, audit event and session revocation. Review RLS grants and confirm neither codes nor passwords appear in logs or API responses to unauthorized users.

Establish a retention policy for the request history. Expired codes are rejected even before cleanup; a later request clears that account's expired digests. The schema setup does not install an automatic retention job.

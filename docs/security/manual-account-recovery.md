# Manual recovery of a reviewed existing account

A legacy account can be Active but unable to sign in or use SuperAdmin password recovery when its immutable provisioning evidence is missing. Do not remove the eligibility check or grant historical approval from the application runtime.

1. Follow the owner approval, private identity review, backup and staging requirements in [approved-account-transition-readiness.md](approved-account-transition-readiness.md).
2. Open the official Supabase project SQL Editor with the authorized database-owner account. Run only the first SELECT in [approve-reviewed-existing-account.sql](../../database/operator/approve-reviewed-existing-account.sql). Review the target and approving SuperAdmin IDs, matching login and existing approval.
3. For a genuinely reviewed account with no approval, fill the three placeholders in the transaction: target ID, approving SuperAdmin ID, and the actual private review reference. Run only that transaction. It rejects invalid or shared identities, duplicate evidence, and ineligible approvers. Do not fabricate a reference or use the script if review is incomplete. Do not approve accounts in bulk.
4. Re-run the inventory and canonical access preflight. In JaiROADS, open User Management > Manage > Reset Password. Reauthenticate as SuperAdmin and set a new password. No mailbox is needed.
5. If the SQL fails, stop and review the cause privately. Existing mismatched evidence, missing login bridges and password hash drift require separate authorized remediation; never overwrite immutable evidence or guess links.

This manual script is not a migration and is never executed by Render. Execution requires actual, independently verified approval; a repository change or automated scan is not approval. No passwords, roles, account links or maintenance records are modified by the approval transaction.

## Existing Viewer with no login bridge

For a privately verified active Viewer whose canonical account has zero login bridges, use [restore-reviewed-viewer-login.sql](../../database/operator/restore-reviewed-viewer-login.sql). It rejects any matching existing Fortify email or bridge, shared canonical email, existing approval, non-Viewer role, linked profile or unsupported existing bcrypt hash. Run as database owner, one reviewed account at a time. If a matching login exists, stop for separate identity review; never attach by email alone. The transaction preserves the existing hash and canonical ID, inserts a login and immutable reviewed evidence, and is followed immediately by the normal SuperAdmin password reset. No secret is entered in SQL.

## Another SuperAdmin with unavailable mailbox

The web Reset Password route remains restricted to non-SuperAdmin accounts. For a separately reviewed eligible root, a trusted operator with access to an approved Laravel CLI and the working root's password can run `php artisan jairoads:recover-superadmin`. The interactive command requires distinct canonical IDs, actual private review reference, acknowledgement, existing root password and a confirmed compliant new password (hidden input). It uses the synchronized credential updater, rotates remember tokens, revokes applicable database sessions and reset links, and records the event. It does not modify retained historical authentication data, reactivate an account, change roles or repair missing links. Public reset, passkeys and MFA are retired. Record outcome privately. Rehearse on staging first; keep the working root unchanged. Do not use a noninteractive shell or put passwords into command arguments, SQL, GitHub or chat.

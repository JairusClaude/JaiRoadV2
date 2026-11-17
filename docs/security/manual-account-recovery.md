# Manual recovery of a reviewed existing account

A legacy account can be Active but unable to sign in or use SuperAdmin password recovery when its immutable provisioning evidence is missing. Do not remove the eligibility check or grant historical approval from the application runtime.

1. Follow the owner approval, private identity review, backup and staging requirements in [approved-account-transition-readiness.md](approved-account-transition-readiness.md).
2. Open the official Supabase project SQL Editor with the authorized database-owner account. Run only the first SELECT in [approve-reviewed-existing-account.sql](../../database/operator/approve-reviewed-existing-account.sql). Review the target and approving SuperAdmin IDs, matching login and existing approval.
3. For a genuinely reviewed account with no approval, fill the three placeholders in the transaction: target ID, approving SuperAdmin ID, and the actual private review reference. Run only that transaction. It rejects invalid or shared identities, duplicate evidence, and ineligible approvers. Do not fabricate a reference or use the script if review is incomplete. Do not approve accounts in bulk.
4. Re-run the inventory and canonical access preflight. In JaiROADS, open User Management > Manage > Reset Password. Reauthenticate as SuperAdmin and set a new password. No mailbox is needed.
5. If the SQL fails, stop and review the cause privately. Existing mismatched evidence, missing login bridges and password hash drift require separate authorized remediation; never overwrite immutable evidence or guess links.

This manual script is not a migration and is never executed by Render. It has not been run on the official database. No passwords, roles, account links or maintenance records are modified by the approval transaction.

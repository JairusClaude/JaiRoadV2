# Integration readiness — current password-only release

The configuration-only command `php artisan jairoads:integration-readiness` checks HTTPS application and map origins, separate private Storage bucket names, server-only Storage credentials, current password sign-in and authorized recovery routes, and absence of retired authentication features and routes. It does not perform network probes or prove user acceptance.

## Required operator verification

- Verify both real Storage buckets are private and unversioned. Test authorized upload, download, exact-object deletion, retry and reconciliation in isolated staging.
- Verify HTTPS password sign-in and role-specific authorization for SuperAdmin, Admin, Engineer and Viewer. Confirm revoked accounts and stale sessions are denied.
- Verify SuperAdmin-assisted ordinary-account password reset requires reauthentication, synchronizes hashes and revokes old sessions. Trusted operator root recovery requires independent private identity review.
- Confirm public registration, public password reset, passkeys and MFA routes are unavailable. Do not require retired features to work.
- Verify map provider terms, connectivity, CORS, rate limits and manual drawing fallback.
- Verify the restricted PostgreSQL runtime role, RLS, backup and independent restore; record actual evidence privately.

CI uses disposable PostgreSQL, browser automation and mock Storage/map providers. Passing CI does not authorize a real deployment. Do not include credentials, raw identity records or human approval evidence in GitHub.

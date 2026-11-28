# JaiROADS Android field pilot

The internal Android APK bundles an Engineer report queue and a Viewer read-only record browser. It uses Android WebView's asset loader to serve bundled screens under the selected staging HTTPS origin, so the online requests use the existing Laravel session and CSRF protections. The app never receives PostgreSQL credentials.

## Install and connect

1. Download the APK artifact from the **JaiROADS Android field pilot** GitHub Actions run and install it on a test device.
2. Enter the HTTPS origin of an isolated JaiROADS staging instance running this commit, with no path or port. Use staging test accounts only. The **Field reports** button returns to the bundled offline workspace at any time.
3. The staging instance needs `APP_ENV=staging`, `JAIROADS_ANDROID_PILOT_ENABLED=true`, and the already-reviewed monthly receipt schema with `JAIROADS_MONTHLY_RECEIPTS_ENABLED=true`. Apply the receipt proposal only on an approved disposable staging database. This branch leaves the hosted flags off and does not deploy or apply DDL.
4. Choose **Open staging sign-in**. Sign in through Fortify, then tap the native **Field reports** button. Choose a separate passphrase to encrypt the workspace.

The pilot caches up to 100 recent record summaries and stores up to 20 encrypted reports, including confirmed ones, per selected server. Engineer records are restricted to assigned records. Viewer records follow existing read permissions. Changing the server keeps its previous encrypted workspace separate. Closing the app or pressing **Lock** requires unlocking again.

Once a report is saved with consent, the unlocked foreground app attempts its first upload when connectivity returns. Confirmed reports link to the canonical web record. An uncertain POST remains in **Checking server receipt**, and future syncs perform a read-only receipt check for it. Expired, conflicting, or reassigned reports stay on the phone as **Needs review**. Local remove controls do not delete server data. Sync stays foreground-only, and photos and offline maps are outside this pilot.

## Acceptance on a test phone

- Sign in as an Engineer and cache two authorized record/month combinations. Enter airplane mode and save both reports. Force-close, reopen, and unlock while still offline.
- Restore the connection. Interrupt one upload, reconnect, and check receipts. Confirm exact report IDs, one web report per submission, and a create audit entry per report in the staging database.
- Repeat with an already-filed month, a changed Engineer assignment, and an expired session. Keep the local draft intact and verify that no unauthorized report is added.
- Sign in as Viewer on a separate device or clean app install and verify that cached record summaries are readable and the write form is absent.

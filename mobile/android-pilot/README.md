# JaiROADS Android field pilot

The APK opens a bundled sign-in page. It authenticates online through Fortify on the dedicated Render pilot. Install the Offline Pilot alongside the earlier Field Pilot to keep access to drafts saved by that app.

Sign in online once on the phone to cache assigned records automatically. When offline, use the same email and password to unlock that account's encrypted workspace. The Offline mode notice appears above cached records and draft reports. Admin and SuperAdmin dashboards require a connection. Viewer access to its cached workspace is read-only.

Engineers can queue monthly text reports for existing assigned maintenance records. Queued reports sync after reconnecting while the workspace is open and the pilot session is valid. Sign in online again if the session has expired. The server rechecks the account and assignment before accepting a report. An uncertain submission is checked through its receipt. Sync only runs in the foreground.

On a pilot phone, sign in online as an Engineer, activate airplane mode, lock the workspace, then sign in with the same credentials. Confirm Offline mode appears and save a report for an assigned record. Lock and reopen while still offline to confirm the draft persists. Reconnect and check that one report is recorded.

# JaiROADS Android field workspace

Install the Field Review APK alongside earlier pilot builds. It opens the bundled introduction and sign-in sheet, then uses the JaiROADS review service and its normal account credentials. The install has a separate data directory. Drafts from older pilot builds remain in those apps.

Online sign-in downloads recent authorized work. Sign in with the same credentials on the same phone in airplane mode to open the encrypted workspace. Engineers can save and edit roads, projects, records, and monthly text reports locally, with manual coordinates when maps are unavailable. The app automatically tries to sync at reconnect, resume, and intervals while open. Retry uses the original operation ID until Laravel confirms the database transaction. Review unresolved conflicts before retrying. Viewer access is read-only.

Supported files can be attached locally to the workspace. Upload them through the online private Storage workflow. Cached road alignments over 32 KiB are retained on the server and must be edited in the online map. Admin and SuperAdmin use the online dashboard.

The review service enables field routes with `JAIROADS_ANDROID_FIELD_ENABLED=true` and uses the private schema in `database/proposals/android_field_receipts.sql`. The APK includes neither database credentials nor Supabase API keys.

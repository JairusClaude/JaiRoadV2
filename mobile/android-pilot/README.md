# JaiROADS Android field workspace

Install JaiROADS Review alongside earlier APKs. It uses the review service and its normal accounts. The build has a separate data directory so earlier apps and their drafts stay on the phone.

Online sign-in downloads recent authorized work in the background and opens the normal dashboard. The app keeps the hosted page open and shows the bundled workspace when the link or server is unavailable. The cached workspace uses the same role theme and module names. Sign in with the same credentials on the same phone in airplane mode to reopen it after closing the app. Engineers can save and edit roads, projects, records, and monthly text reports locally, with manual coordinates when maps are unavailable. The app automatically tries to sync at reconnect, resume, and intervals while open. Retry uses the original operation ID until Laravel confirms the database transaction. Review unresolved conflicts before retrying. Viewer access is read-only.

Supported files can be attached locally to the workspace. Upload them through the online private Storage workflow. Cached road alignments over 32 KiB are retained on the server and must be edited in the online map. Admin and SuperAdmin use the online dashboard.

The review service enables field routes with `JAIROADS_ANDROID_FIELD_ENABLED=true` and uses the private schema in `database/proposals/android_field_receipts.sql`. The APK includes neither database credentials nor Supabase API keys.

The authentication page now enters as a full-screen vertical transition. Swipe down from non-interactive content at the top, use Explore, or press Android Back to return to the same preview slide. The normal hosted dashboard remains primary after successful online authentication; a failed background cache refresh must not force an otherwise healthy dashboard into the local workspace. The bundled workspace uses role and appearance tokens and a fixed bottom connectivity/status banner. It remains a limited offline equivalent, not a full cache of every hosted page. Keep earlier APKs installed until all locally saved records are synchronized; this review app has a separate application ID.

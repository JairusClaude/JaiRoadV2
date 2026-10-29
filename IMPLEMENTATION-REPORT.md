# Corrected JaiROADS frontend login preview

## Authoritative source and result

This revision rebuilds the preview from `source/` in the corrected attachment, `JaiROADS_Road_Coverage_Details_Review (1)(1).zip` (SHA-256 `55e631ca9971e50e11d9bd4a3d9d1f0fddbbf7b9933918b6ebb90dfc595c5f72`). It replaces the earlier Map First Review base. The newer Road Coverage Details page, map preview, directory navigation, editor return behavior, permission checks, and all other application pages come from the corrected ZIP.

The login remains the GitHub `feature/jairoads-map-demo` design: source login blob `2dc27e2dba43eeab44cfe6cb0511d5f2d774dd04`, stylesheet blob `77a53bdc784db28f6fee71cd0e5cf7baaf66679d`, and the bundled road photograph. The imported login was adapted only for the demonstration session and unavailable backend features. No production backend or database connection was imported.

The existing destination branch is updated with a new commit: `feature/frontend-only-login-preview`. No history is rewritten and other branches are untouched.

## Changed and added files

- `resources/js/pages/auth/login.tsx`: imported photographic login/slideshow, explicit preview credentials, invalid-email retention, no registration UI, unavailable recovery/passkey notice.
- `resources/css/jairoads-login.css`, `public/images/jairoads/road-rehabilitation.jpg`: login design assets.
- `resources/js/app.tsx`: full-page login layout and preview-session initialization.
- `resources/js/lib/preview-session.ts`: preview-only checks on browser Back, page restoration, and focus.
- `resources/js/layouts/maintenance-project-layout.tsx`: demo sign-out action; preserves the corrected ZIP's Details breadcrumb and layout.
- `tools/maintenance-project-preview/server.mjs`: isolated demo login/logout/session guard, session-derived users, local login image, history clearing, and protected pages/downloads. Preserves the corrected Details route and its shared permission check. Formatting was normalized in this touched file.
- `README.md`, `review/VIEW-AND-RESTORE.txt`, this report: corrected-source identity and Node-only Windows instructions.
- `public/build/`: rebuilt assets for first launch without installing dependencies.
- `preview-review/`: current browser results, screenshots, and source-preservation hashes.

Only six existing files changed beyond generated build assets: README, review launch instructions, app entry, login page, application layout, and preview server. All other packaged originals are byte-identical to the corrected ZIP, including PHP files, authentication configuration, migrations, models, package manifests, Road Coverage Details/map components, the full map editor, geometry utilities, and application pages. `preview-review/source-preservation.json` records the exact comparison and SHA-256 hashes. Historical screenshots and restoration backups containing obsolete generated builds were omitted; they do not participate in the running application.

## Verification

Actual Chromium runtime: **16 passing groups, zero browser JavaScript errors**. The checks cover:

1. Guest page and mutation requests redirect to login.
2. Root opens the GitHub login design with bundled image and preview notices.
3. Invalid credentials display a real Node validation error and retain the entered email.
4. Slideshow pause/navigation and password visibility.
5. Desktop, 768px, 390px, and 320px login layouts without horizontal overflow.
6. Reduced-motion slideshow behavior.
7. Valid login and refresh session persistence.
8. Existing directories, Add/Edit/Details, records, documents, LGUs, and exploration pages render.
9. The corrected map editor places A/B, adds C, and routes portions.
10. Marker dragging, undo, and manual redraw use the corrected editor's actual toolbar.
11. Temporary project creation/update/deletion.
12. Temporary road save/edit preserves exact saved geometry and renders its markers.
13. Road Coverage Details displays the saved three-location map; Edit/Save returns to that Details page and preserves geometry.
14. Two-location Details, Edit/Cancel return, mobile Details layout, and missing-geometry fallback with the correct associated project.
15. Sign out clears the session; browser Back and direct protected URLs cannot restore access.
16. Zero browser runtime exceptions.

External Unsplash images and map tiles were blocked to verify the local image fallback and isolate map behavior. OSRM replies used deterministic geometry fixtures. These are real browser interaction checks, not a claim about public map-provider availability or geographic accuracy. Provider and editor implementation files are byte-identical to the corrected ZIP.

Development checks:

- `npm ci --prefer-offline`: passed.
- `npm run types:check`: passed.
- `npm run format:check`: passed.
- `npm run build -- --mode review`: passed.
- ESLint on changed/new TypeScript files and the Node preview server: passed.
- Full `npm run lint:check`: fails with **814 pre-existing errors in untouched files**, including historical review scripts. Before omitting obsolete restoration backups, the complete attachment scan reported 62,697 errors because it included historical generated builds. The supplied frontend's remaining lint issues were preserved; global lint is not claimed to pass.

No database, migrations, seeders, PHP runtime, or production credentials were used. Prebuilt assets and generated route helpers are included. A freshly extracted archive is checked for Node-only startup, login entry, and bundled image access.

## Launch and limitations

Run `node .\tools\maintenance-project-preview\server.mjs` in the extracted project root, then open `http://localhost:5179/`. Node.js 22.12+ is required. Demo credentials: `demo@example.test` / `JaiROADS-Demo-2026!`.

The account and session are explicitly demonstration-only. Edits/uploads and sessions belong to the Node process and reset on restart; they are not permanent database records. Existing unfinished navigation remains in its supplied state. Password recovery, passkeys and account settings are unavailable in preview. The original map providers require internet; their availability is not guaranteed. Details remains a display-only map; editing continues in the existing editor.

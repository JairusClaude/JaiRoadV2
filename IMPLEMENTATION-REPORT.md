# JaiROADS frontend login preview integration

## Result and sources

The authoritative application is `source/` from the supplied `JaiROADS_Map_First_Review(2).zip`. The instructions refer to revision (1); the newly supplied revision (2) was used. The login design was retrieved from `feature/jairoads-map-demo` in `JairusClaude/JaiRoadV2`. Imported login blob: `2dc27e2dba43eeab44cfe6cb0511d5f2d774dd04`; stylesheet blob: `77a53bdc784db28f6fee71cd0e5cf7baaf66679d`. Its bundled road photograph was retained. Other GitHub application pages and authentication backend changes were not imported.

Destination branch: `feature/frontend-only-login-preview`.

## Changes

- `resources/js/pages/auth/login.tsx`: imported the existing GitHub photographic login/slideshow; added preview-only account details, preserved invalid-email input, and labelled unavailable backend features. No registration UI or newer welcome animation was added.
- `resources/css/jairoads-login.css` and `public/images/jairoads/road-rehabilitation.jpg`: imported design dependencies.
- `resources/js/app.tsx`: login owns its full-page layout; installs preview-only session checks.
- `resources/js/lib/preview-session.ts`: rechecks the Node preview session on history, focus and page restoration so browser navigation cannot restore a logged-out preview screen. It only runs when the standalone preview's page data includes previewOnly.
- `resources/js/layouts/maintenance-project-layout.tsx`: connected existing preview Sign out to POST /logout and marked unavailable account settings. Existing shell and navigation are preserved.
- `tools/maintenance-project-preview/server.mjs`: root/login/logout routing, authenticated application/download access, rotated demo-session cookies, session-derived user props, login validation, public local photograph, no-store responses, and Inertia history clearing/encryption. The original sample mutation handlers remain. ESLint/Prettier also normalized this file's layout.
- `README.md`, `review/VIEW-AND-RESTORE.txt`, this report: standalone launch and rebuild instructions, credentials, limitations and results.
- `public/build/`: regenerated assets included for launch with Node alone.
- `preview-review/`: browser results and representative desktop/tablet/mobile/map screenshots.

A byte comparison against the supplied source found only six existing files changed (README, review instructions, app entry, login, application layout, preview server), aside from regenerated build assets. 491 other packaged existing source/review files were byte-identical. Fourteen historical review screenshots were omitted as unnecessary old artifacts. This includes PHP controllers, routes, authentication configuration, models, migrations, seeders, package manifests, the map editor, geometry utilities, and existing application pages. Source file hashes are recorded in `preview-review/source-preservation.json`.

## Runtime verification

Actual Chromium checks passed (14 groups; zero browser JavaScript errors):

1. Guest GET and mutation requests redirect to login.
2. Root opens login; local image loads; unavailable backend features and preview scope are clear.
3. Invalid demo credentials show a real server validation error and preserve email.
4. Slideshow pause/navigation and password visibility work.
5. Desktop plus 768px, 390px and 320px layouts have no document horizontal overflow.
6. Reduced motion disables automatic slideshow progression.
7. Valid demo login and refresh retain the session and open Maintenance Projects.
8. Existing Road Coverage, project, record, monthly update, document, LGU and exploration pages render.
9. Map A/B/C placement and routed portions work.
10. Manual trace, marker dragging and undo work.
11. Project creation, update and deletion persist for the preview process.
12. Road save/edit retains saved geometry and renders its three saved markers.
13. Sign out clears the session; browser Back and protected URLs cannot restore access.
14. Zero browser runtime exceptions.

External Unsplash photographs were deliberately blocked to exercise the bundled fallback. Map tiles were blocked and OSRM responses were stubbed with deterministic coordinates during browser interaction checks. These checks verify UI behavior, not the live availability or geographic accuracy of third-party services. Existing map/provider integration code is byte-identical to the supplied ZIP.

## Development checks

- `npm ci --prefer-offline`: passed (lockfile installation).
- `npm run types:check`: passed.
- `npm run format:check`: passed.
- `npm run build -- --mode review`: passed.
- ESLint on all changed/new TypeScript files and the preview server: passed.
- `npm run lint:check`: failed with 489 existing errors in other files. The unmodified supplied ZIP produced 587 errors with the same dependencies; formatting the touched preview server reduced the count. No global lint cleanup was attempted. This is not a claim that repository-wide lint is green.

No PHP/backend tests or database operations were required or performed. This branch deliberately uses the Node preview; the preserved Laravel scaffold is not the supported runtime for this demonstration flow.

## Limitations

Demo authentication and sample edits are process-local. Restarting resets sessions and temporary records/uploads. Maps and external photographs still depend on the original public providers; the first photograph works locally. Existing unfinished/disabled navigation remains unchanged. `/maintenance-records` is the existing records directory; `/maintenance-projects/101/records` is an unsupported URL in the original source. Historical review scripts predate the login guard.

## Packaging

`JaiROADS_Frontend_Login_Preview.zip` contains the runnable project under one `JaiROADS_Frontend_Login_Preview/` folder. It includes source, local assets, generated route helpers, rebuilt assets, current instructions/report and sample fixtures. It excludes .git, node_modules, real .env files, dependency folders and caches. After fresh extraction, the Node server can start and serve the login without installing packages, running PHP, or connecting a database.

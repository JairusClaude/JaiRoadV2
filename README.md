# JaiROADS Frontend Login Preview

This is the frontend from `JaiROADS_Road_Coverage_Details_Review (1)(1).zip`, with the login design from GitHub's `feature/jairoads-map-demo` branch. It is a standalone interface review with sample data. The Laravel scaffold remains for future integration, but this preview runs on Node.js without PHP, Composer, Herd, database setup, or production accounts.

## Run on Windows

1. Extract the complete ZIP into a new folder.
2. Install Node.js 22.12 or newer (Node.js 24 also works). Check with `node --version`.
3. Open PowerShell in this folder (the folder containing this README and `package.json`).
4. Run:

   ```powershell
   node .\tools\maintenance-project-preview\server.mjs
   ```

5. Keep that terminal open and visit **http://localhost:5179/**.

Prebuilt frontend assets are included, so dependency installation is not required for this first launch. Use port 5179; Laravel's port 8000 and Herd's `.test` URL serve a different application path and do not run this preview.

## Demo login

- Email: `demo@example.test`
- Password: `JaiROADS-Demo-2026!`

These are public sample credentials, displayed on the login page. Successful login opens Maintenance Projects. Invalid credentials display an error and keep the entered email. The session survives navigation and refresh. The account menu's **Sign out** clears it. Password recovery, account settings, and passkey authentication are unavailable in preview mode. There is no registration interface.

This demonstration session is not production authentication or a production security boundary. Do not expose this local server as a production service.

## Edit and rebuild

After changing React, TypeScript, or CSS, run in PowerShell:

```powershell
npm.cmd ci
npm.cmd run build -- --mode review
node .\tools\maintenance-project-preview\server.mjs
```

The server reads its asset manifest at startup: stop it with **Ctrl+C**, rebuild, and start it again. `npm run dev` starts Vite, not this preview server. Review build mode uses the included generated route helpers without invoking PHP. No `.env` is needed.

Optional development checks:

```powershell
npm.cmd run types:check
npm.cmd run lint:check
npm.cmd run format:check
```

The supplied source has pre-existing repository-wide ESLint failures; see `IMPLEMENTATION-REPORT.md` for results. Do not run database migrations or seeders to use this preview.

## Sample data and limitations

The Node process owns all sample collections, uploaded preview files, and demonstration sessions. Temporary edits are shared by local preview sessions and may disappear when the server stops or restarts. They are not stored in a database. Restarting also requires logging in again, including when Keep me signed in was selected.

Existing Road Coverage directory/Add/Edit/Details and two- or three-location mapping, Maintenance Project directory/Add/Edit/Details, Maintenance Records, Monthly Updates, Maintenance Documents, LGUs, and design-exploration pages remain available after login. Existing unfinished navigation sections and unavailable actions retain their original behavior. There is no new production dashboard; the entry point is Maintenance Projects. `/maintenance-records` is the records directory; `/maintenance-projects/101/records` is not an implemented directory URL in the supplied frontend.

Internet is required for OpenStreetMap tiles, OSRM route calculation, Photon place search, and the two external Unsplash slideshow photos. The first photo is bundled locally, and external-photo errors fall back to it. Map-provider availability is outside this project; provider errors retain the existing manual editing and retry behavior. Routing and geocoding can be configured with `JAIROADS_ROUTING_URL` and `JAIROADS_GEOCODING_URL` as in the supplied preview.

Historical scripts/reports under `review/` predate the login requirement. Current browser results and representative screenshots are in `preview-review/`.

## GitHub branch

`feature/frontend-only-login-preview`

https://github.com/JairusClaude/JaiRoadV2/tree/feature/frontend-only-login-preview

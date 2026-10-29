# JaiROADS — Location Management and Manual Drawing

26 October 2026

## Baseline and changed files
Continues the latest working source delivered as JaiROADS_Road_Mapping_Refined_Review.zip. The existing source was available; no older application checkpoint or SE1 source was substituted. Previous findings were reused instead of another repository audit.

Application changes are limited to:
- resources/js/components/road-coverages/coverage-map-editor.tsx
- resources/js/components/road-coverages/coverage-form.tsx
- resources/css/road-coverage-form.css

Generated public/build assets were rebuilt. Reports, browser scripts, screenshots, logs and restoration files are in review-locations/. A before/after hash comparison confirms that other existing resources, preview providers, Laravel models, routes and database files remain unchanged. No dependencies were added. The source has no Git metadata; no commit, reset, push or merge was performed.

## Implemented behavior

### Locations
Add Location sits beside Select, Draw and Undo. Add still opens ready for A and then B without activating a tool. Toolbar and panel entry points share the same placement function. It resumes the next missing location, adds optional C without resetting A–B and disables once all three locations exist. Two locations remain sufficient to save a valid coverage.

Clicking A/B/C opens a compact contextual popup with Move, Replace and Remove. Move retains ordinary marker dragging; its button explains the existing drag interaction rather than creating another mode. Replace keeps the original marker and road until the new map click, allows ordinary navigation and has Cancel/Escape. Committing replacement updates only adjacent portions. Automatic portions can reroute; manual paths are retained and marked for correction when disconnected. Undo restores the previous mapping snapshot.

Location removals follow the requested rules:
- Two locations: remove either endpoint, preserve the other as A, clear the old road and resume B placement.
- Three locations, remove C: preserve A–B exactly.
- Three locations, remove A: preserve former B/C and their path as the new A–B, including manual geometry.
- Three locations, remove B: confirm, preserve A/C as new A/B and clear both old connections. The engineer deliberately retries routing or draws a new connection. Paths are not silently combined.
- Start Over confirms and clears working locations/geography, retaining Road Information. It does not delete the saved record.

Confirmations reuse the application's Radix dialog pattern and established dialog/button styles. Their portal stays inside the workspace so they also work in fullscreen. The Undo snapshot is for the last mapping operation, not a database revision or form-field history.

### Drawing
The prior Draw handler had no target when two portions existed and neither was selected. It now opens a compact target chooser beside Draw. One-portion Draw starts immediately; a selected portion also starts immediately. The same tracing operation is used by toolbar, chooser and road popup.

Intermediate tracing points are draggable during drawing. Drag events redraw the draft line immediately; drag-end records one undoable change. Marker event isolation and post-drag click suppression prevent accidental extra points. Main A/B/C markers stay protected while tracing. Existing Edit Path remains available after accepting a manual path.

Drawing progress excludes the unfinished replacement from completed counts, even though its previous accepted geometry remains as a gray reference. Length feedback identifies the previous accepted measurement while a temporary operation is active. Finish validates and accepts; Cancel restores the accepted path/status. Save cannot submit unfinished drawing or location replacement. Invalid endpoint/repeated-location/point-limit feedback remains specific; invalid geometry is not bypassed.

### State safeguards
Structural location changes abort and invalidate earlier routing requests. Completed unaffected portions remain protected. An already disconnected manual neighbor does not unnecessarily prevent a deliberately replaced location from aligning to a genuine automatic route endpoint; its manual geometry is still retained for correction.

Undo now clears stale messages such as “locations cleared” after restoring the road. Partial location-only work also participates in the existing unsaved-navigation confirmation; previously this guard checked form fields without the separate map-dirty flag.

## Verification

Main browser suite: 18 passing interaction groups, no runtime errors.
Supplemental browser suite: 8 passing interaction groups, no runtime errors.

Covered in the actual rendered frontend:
- Immediate A placement, paused placement and toolbar resume.
- Genuine automatic A–B and B–C requests, A–B preservation, no fourth location.
- All marker popups, replacement/cancellation and direct map repositioning.
- Replacing A/C affects the correct automatic portion; replacing B preserves manual geometry for correction.
- C/A/B removal rules, confirmation cancellation, sequential relabeling and Undo.
- Deliberate two-point rebuilding after removing B.
- Start Over, retained form values, unchanged saved geography and Undo.
- One-portion Draw, selected Draw, unselected two-portion chooser, outside/Escape dismissal and failed-route drawing.
- Live intermediate-point dragging before Finish; no extra point, scoped Undo, Cancel restoration and successful Save.
- Drawing-state counts, measurements and unfinished-operation submission rejection.
- Fullscreen confirmation visibility, narrow toolbar/menu bounds, panning and zoom controls without stray points.
- Delayed stale routing response after Clear cannot restore old map state.
- Navigation cancellation protects partial mapping work.

The stale-response test deliberately delayed a genuine previously captured OSRM response. This controlled replay was test infrastructure only; application routing still uses the real provider. Other test fixtures use actual stored route coordinates and explicit development records. Existing application fixture records were not replaced.

Build in review mode, whole-project TypeScript, scoped ESLint and Prettier checks passed. Shared geometry-boundary and preview-provider regression checks also passed. Exact check output is included in the corresponding text/JSON files.

## Limitations and unchanged behavior
- This is the existing standalone frontend preview with process-local data. Saves reset on server restart. Laravel/PostgreSQL persistence and production authorization were not verified.
- Admin/SuperAdmin preview writes and the previous fail-closed Engineer/Viewer restrictions are unchanged. No authentication or AuditLog implementation was changed or newly claimed verified.
- No schemas, migrations, seeders, geographic revision tables, historical restoration, automatic overlap enforcement or generated-route vertex conversion were introduced.
- Routing remains an external OSRM service with existing request throttling and timeouts. Genuine routing succeeded in tests; outages still require Retry or manual drawing. No straight-line substitute is generated on failure.
- Tile loading was intermittent. Some desktop captures show the existing neutral loading background; actual basemap tiles loaded in narrow browser captures. No fake map background or unrelated provider was substituted.
- Existing Photon search, layers, read-only overlays and contextual road styling were retained. Live geocoding and every overlay-filter combination were not exhaustively retested during this task.
- The source still has no dedicated Road Coverage Details page. No nonfunctional Details route was added.
- The source files of unrelated modules are hash-verified unchanged; this is not an exhaustive production test of every JaiROADS module.

## Review and restoration
The previous full review package remains available separately as JaiROADS_Road_Mapping_Refined_Review.zip. The new package also includes the three pre-change source files and their matching previous compiled assets under source/review-locations/restore/.

To restore locally, stop the preview, preserve a copy of your current folder, then copy each file from review-locations/restore/ to its matching path relative to source/. This restores both source and the previous public/build manifest/assets without requiring a rebuild. Do not overlay an old full package onto a folder containing unrelated newer work. No database restore or data deletion is involved.

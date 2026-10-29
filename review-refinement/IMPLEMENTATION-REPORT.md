# JaiROADS SE2 — Road Coverage Mapping Refinement

26 October 2026

## Baseline and scope
Continues the working source from JaiROADS_Map_First_Review.zip, itself based on the user-approved JaiROADS_Road_Coverage_Mapping_Review.zip. The previous package is included unchanged under baseline/ in this review ZIP. SE1 was not used as the implementation or visual baseline. The source has no Git metadata; no branch, commit, push, reset or merge is claimed.

Only these application source files changed:
- resources/js/components/road-coverages/coverage-map-editor.tsx
- resources/js/components/road-coverages/coverage-form.tsx
- resources/js/lib/road-coverages/geometry.mjs
- resources/css/road-coverage-form.css

Compiled public/build assets were regenerated. Reports, scripts, screenshots and restoration copies are in review-refinement/. Before/after hashes confirm that other existing resources, preview providers, Laravel models, routes, database files and modules were not modified. No dependencies were added.

## Resulting workflow
Add opens ready for A. B automatically requests A–B and completes a two-location coverage. Add Location C explicitly extends it with B–C; the existing A–B geometry remains unchanged. Both configurations save one RoadCoverage record using the same fields and GeoJSON storage. The existing version-1 mapping metadata accepts either two or three locations, and existing three-location records remain readable.

Select/Draw controls live inside the map, below search and above the Leaflet zoom control. Clicking a line or a portion summary selects only that portion in blue. Unselected completed paths are brown. Compact, bounded, white popups provide actions appropriate to automatic, manual or unavailable routes. No permanent bottom action toolbox was added.

Manual drawing uses a blue dashed draft, keeps the previous alignment as a subdued recovery reference and changes only the selected portion after Finish Drawing. Cancel retains the previous geometry. Edit Path is offered for manual traces; its intermediate tracing points can be dragged. Dense older manual traces expose a selected handle rather than hundreds of controls. Advanced generated-route vertex editing is intentionally deferred. Undo changes mapping only; it does not undo form fields.

The right panel retains the independent Road Information and whole-panel collapse controls. It shows concise location information, optional coordinates, clickable portion summaries and road measurements. Two-location roads do not show B–C or a requirement to complete two portions.

Calculated road length is the primary measurement. Adjust Recorded Length reveals the existing numeric input. Manual overrides survive geometry changes and show a discrepancy notice; Use calculated length restores the mapped measurement. Existing correction reasons remain required when editing saved geometry.

## Root cause and correction
The earlier editor treated router endpoints like manual vertices and allowed only 0.16 m of difference from clicked markers. Ordinary road-network snapping therefore left visibly generated routes in Needs correction, withheld their GeoJSON and prevented length calculation.

The refined router requests actual road geometry with a 50 m snap radius. New/unshared locations are aligned to the genuine returned road endpoints, with a visible notice asking the user to review the markers. No invented connector is inserted. If an endpoint belongs to another completed or manual portion, that shared location is protected: the adjacent portion is preserved, and an incompatible route receives a specific missing-connection explanation. Small 0.16 m reconciliation remains only for numerical rounding at a protected shared endpoint.

Missing routing has Retry Route and Draw Road recovery, including from the portion summary when no visible line exists. Moved manual locations identify the specific missing connection instead of overwriting manual work. Repeated/invalid geometry remains blocked; validation was not bypassed. Initial saved-map framing is nonanimated to avoid an initial line-rendering race.

## Verification
- Production frontend build in review mode: PASS.
- TypeScript: PASS.
- ESLint on both changed React components: PASS, no warnings/errors.
- Prettier on the four changed source files: PASS.
- Main browser suite: 21 PASS, 0 FAIL, one provider limitation; no runtime errors.
- Supplemental browser suite: 6 PASS, no runtime errors.
- Geometry boundary checks: PASS for two/three locations, original three-point compatibility, duplicate/missing locations, length validation and unchanged legacy-geometry retention.
- Existing provider regression checks: positive length, creation, information-only concurrent preservation, stale-geometry rejection, Viewer denial and creator/geometry preservation.

Browser checks included automatic A–B, automatic B–C, two-location save, three-location save, exact A–B preservation after B–C changes, manual drawing, tracing-point movement, Cancel restoration, scoped Undo, moved-marker error/recovery, dynamic popups, blue selection, keyboard action focus/Escape, manual length retention/reset, unfinished-operation validation, independent collapses, fullscreen, wheel zoom, narrow-screen popup boundaries, directory rendering and information-only geometry preservation.

The UI screenshot records are development-only temporary records. Actual OSRM responses supplied automatic route geometry. Manual test paths were explicitly drawn in the UI. Tests do not replace the package's existing fixture records.

## External services and limits
- Actual OSRM requests succeeded, including bounded snapping. The tested alternative request returned only one route; the UI correctly explained that there were no alternatives. Applying multiple genuine alternatives was not verified because none were returned for this test road.
- OpenStreetMap background tiles were delayed/blocked in this automated environment. A direct response carried an access-denied tile-policy header. No restriction was bypassed, no replacement map image was used and no unrelated tile provider was introduced. The screenshots show the actual rendered UI and real route geometry over the neutral loading background. A user's ordinary browser/network may have different tile availability.
- Existing Photon place search, layers and read-only saved-road popups were retained. Live geocoding and every layer-filter combination were not separately reverified during this refinement; previous implementation findings remain applicable.
- Legacy retention is covered by shared-validator checks. No production legacy data migration was performed.
- The current source has no dedicated Road Coverage Details page. This task preserved the directory and Add/Edit behavior; it did not create a new Details page.

## Persistence and permissions
This is the existing standalone frontend preview using process-local data. Changes reset on server restart. Laravel/PostgreSQL persistence, authenticated attribution and active EngineerLGU authorization were not verified. The previous fail-closed preview authorization remains unchanged: Admin/SuperAdmin writes work, Viewer and unresolved Engineer writes are restricted. No authentication logic, schema, migration, seeder, audit subsystem or revision-history tables were modified. No production persistence or immutable geographic history is claimed.

The attached Data-Dictionary.txt still contains an incomplete Google Docs link, not a full field dictionary. No schema assumptions or new database fields were introduced to compensate.

## Restoration
The previous complete review ZIP is preserved under baseline/JaiROADS_Map_First_Review.zip. Extract it to a separate folder to run the previous version. Do not overlay it onto a working folder that contains newer changes. Individual pre-refinement source files are also under source/review-refinement/restore/, but running those requires rebuilding assets; restoring the complete previous package also restores its matching compiled assets.

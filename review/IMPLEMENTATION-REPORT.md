# JaiROADS map-first Road Coverage frontend review

Approved source: JaiROADS_Road_Coverage_Mapping_Review. Original package is preserved in baseline/. This is a frontend/local-preview implementation, not production Laravel/database integration.

## Implemented
- Leaflet map-first Add/Edit workspace, approximately 72% map/28% contextual panel on desktop; existing JaiROADS shell retained.
- Independent Road Information and full-panel collapse; fullscreen includes map and panel. Temporary Apply/Undo/Cancel remain available with panel hidden.
- Add starts placement immediately. B requests real OSRM A–B geometry; C requests B–C; no fourth marker. Edit opens saved geometry without a routing call.
- Exact clicked points retained. Routes outside the documented 0.16m serialization tolerance remain dashed/unconfirmed and cannot save. No invented connector or fallback straight automatic line.
- Per-portion selection, genuine on-demand alternatives request, preview/apply/cancel, explicit no-alternatives state; no fabricated alternatives.
- Per-portion manual trace, temporary path editing, selectable single vertex handle (no simplification or hundreds of handles), insertion/removal, Apply/Cancel/Undo. Endpoints protected; explicit manual alignment correction available.
- Automatic portions reroute only when affected by a moved marker; manual portions retain their path and require correction. Last-change undo.
- Wheel zoom, panning, map search through Photon, subdued saved-geometry references, municipality scope/all-municipalities switch and read-only popups. Search does not create waypoints.
- Calculated/recorded length, positive decimal(10,2) validation, manual override retained across geometry changes, reset-to-calculated action, and override retained on reopening in temporary storage.
- Legacy valid lines can be retained exactly for metadata edits. Identifying B projects onto the existing alignment and splits it without rerouting; no original vertices are discarded.
- Unsaved-work navigation warning; collapsed sections reveal client validation; working geometry retained on save failures.
- Preview information-only writes preserve the latest geography. Digest-based optimistic conflict rejection for geometry changes, plus correction reason validation. Creator/ID/maintenance relationships unchanged.

## Actual verification
19 browser check groups passed, with one alternatives limitation. The actual OSRM browser responses returned 281 and 248 coordinates for A–B and B–C. Test points intentionally clicked off the network were correctly marked Needs correction; these screenshots do not represent confirmed automatic alignments. Manual test traces are explicitly development verification input, not production roads or injected startup fixtures.

Passed: immediate placement, B/C routing requests and rendered geometry, three-marker limit, forced failure recovery, independent collapse preservation, fullscreen, independent manual tracing, manual-marker move plus undo, temporary edit cancellation with hidden panel, form save/return, wheel zoom, saved Edit review and kilometer override, information-only save, actual saved overlay popup, live geographic search, narrow-screen overflow check, and unchanged Maintenance Projects directory rendering.

The forced-failure test exposed an unhandled rejection on the routing queue's derived promise. It was corrected; a targeted browser retest verifies visible recovery and zero unhandled runtime errors. The original browser-results.json retains that discovery for traceability; failure-retest.txt and initial-browser.txt record the corrected result.

Six provider assertions passed: positive kilometers, creation, concurrent information-only preservation, stale geography rejection, Viewer denial, unchanged geography/creator on metadata edits. These are temporary Node provider tests, not Laravel authorization or SQL tests.

Build: `npm run build -- --mode review` passes. TypeScript passes. Scoped ESLint passes with no errors/warnings. Prettier checks pass. Normal Laravel build requires its original PHP/Composer environment; review mode reuses the already-generated route helpers. Fonts plugin prints a pre-existing optional-fontaine advisory.

## Limits and unverified behavior
- The selected real route returned only one route, so no actual alternate alignment could be applied during this browser run. The no-alternatives state is captured; alternative application is implemented but not browser-proven with multiple genuine candidates.
- A targeted rendered-browser test additionally inserted/removed a vertex, moved the single selected handle, applied/saved with a correction reason and proved B–C remained exactly unchanged. See vertex-results.txt and screenshot 12. Detailed legacy-B recovery is implemented and source-reviewed but not browser-proven in this run. Stale routing responses are guarded by abort controllers and generation counters; exhaustive asynchronous race testing remains outstanding.
- Admin/SuperAdmin preview writes and Viewer denial work. Engineer writes fail closed because a verified active EngineerLGU assignment/identity source is not available here; production permission handling is not claimed.
- Immutable geographic revisions, version viewing/restoration, authenticated editor attribution and atomic database saves are NOT implemented. See BACKEND-PROPOSAL.md for the concrete integration requiring separate approval. The preview does not claim recoverable revision history.
- No Road Coverage Details implementation exists. Saves return to the established directory instead of inventing a Details destination.
- The Data Dictionary attachment contains a truncated link only. Full dictionary/schema comparison is unavailable.
- OSM tiles were slow initially but loaded in the actual browser; a separate direct tile probe was blocked by the provider. No access restriction was bypassed. Public routing and geocoding are demo dependencies, not guaranteed production services. Map requests are serialized to <=1/sec in this editor. Configure approved runtime endpoints for deployment; no credentials are invented.

## Files and restoration
See CHANGED-FILES.txt for the exact eight source/configuration files. public/build contains regenerated assets. No other application source was changed; unrelated modules were byte-compared to the approved package. No migrations/seeders/authentication changes, pushes, merges or legacy data deletion occurred.

Extract into a new folder. Run the included prebuilt preview with Node; VIEW-AND-RESTORE.txt describes startup. baseline/JaiROADS_Road_Coverage_Mapping_Review.zip contains the unchanged source checkpoint for restoration to a separate folder. Do not reset or overwrite an uncommitted checkout.

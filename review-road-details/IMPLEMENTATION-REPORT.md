# JaiROADS — Road Coverage Details

27 October 2026

## Implementation baseline

Continues the latest accessible SE2 working source from **JaiROADS_Map_Navigation_Review.zip**, including the completed location-management and map-panel navigation refinements. No old SE1 design, older Integration checkout or replacement application was used. Relevant Project Details, Road Coverage Directory/Add/Edit, geometry helpers and preview data relationships were inspected; no broad repository audit or backend changes were undertaken.

## Implemented

- New `RoadCoverages/Show` page uses the established ProjectWorkspace, Project Details header/action conventions, open two-column overview, uppercase field labels, metadata divider and compact lower related-record styling.
- Displays municipality through the existing LGU relationship, pavement, the unchanged directory condition badge, and the actual recorded `Kilometers` formatted to two decimals. RoadCoverage ID remains internal and is not displayed.
- Created By resolves the existing `created_by` Engineer foreign key. Missing creator or timestamps display Unavailable. Editing does not change original attribution.
- A separate display-only Leaflet component renders the exact saved LineString/Feature(LineString). It has one neutral rounded boundary, a 420px desktop height (360px on mobile), the same brown line/marker colors, initial framing, wheel/keyboard zoom, panning, standard zoom controls, scale and bottom-right fullscreen.
- Verified saved waypoint metadata produces A/B or A/B/C markers. Valid legacy geometry without verified waypoint metadata renders the line without fabricated markers. Markers cannot be dragged; the line has no editing interactions. The component does not import or initialize the editor or call routing/geocoding.
- Only the selected road is supplied/rendered. No reference roads, layers toggle, placement/drawing tools, permanent Fit Route button, manual length controls or correction-history UI were added.
- Missing/invalid geography uses the existing neutral map-placeholder convention. Other information and the related project remain available.
- Associated Maintenance Project uses the actual `road_coverage_id` foreign key. It displays only project title and a View Project link, or the requested empty state. No assignment or project-management workflow was added.
- Directory row clicks and keyboard-accessible primary title links open the selected Details record. Existing three-dot actions remain independent.
- Edit loads the existing editor with the selected saved road. Cancel and Save return to the originating Details page when editing from Details; directory-origin behavior remains unchanged. Contextual directory filters survive the Details back link. Return URLs are restricted to the directory or the same road.
- Breadcrumb naming recognizes the new route; existing navigation/collapse behavior is retained.

## Deletion and permissions

The source has no Road Coverage delete handler or integrated safe Laravel deletion workflow. The directory already contained a disabled pending Delete item. It remains unchanged. Details therefore does **not** expose a nonfunctional Delete button. A direct delete attempt remains rejected and changes neither the road nor its related project. No cascading deletion was introduced.

The existing form's Admin/SuperAdmin preview-write check is now shared with Details and Directory, removing the directory's inconsistent enabled Engineer controls. Actual EngineerLGU authorization data is not integrated; Engineer/Viewer/unknown writes continue to fail closed. These are server-owned preview-role checks, not production authentication verification.

## Changed application source

Created:
1. resources/js/pages/RoadCoverages/Show.tsx
2. resources/js/components/road-coverages/coverage-map-preview.tsx
3. resources/css/road-coverage-details.css
4. tools/maintenance-project-preview/road-coverage-details.mjs

Modified:
1. resources/js/pages/RoadCoverages/Index.tsx — record links/row navigation, independent menu cell.
2. resources/css/road-coverage-directory.css — row cursor and keyboard-link focus.
3. resources/js/types/road-coverages.ts — Details response type only; entity structure unchanged.
4. resources/js/layouts/maintenance-project-layout.tsx — new Details breadcrumb label only.
5. resources/js/components/road-coverages/coverage-form.tsx — contextual back-label wording only.
6. tools/maintenance-project-preview/road-coverage-forms.mjs — shared existing permission check and same-record Details return validation.
7. tools/maintenance-project-preview/server.mjs — preview Details route and shared directory permission check.

Generated public/build assets were rebuilt. Review reports, tests, screenshots and restoration copies are under review-road-details/. The before/after source hashes confirm **372 other existing files** across resources/tools/app/routes/database are unchanged, including the mapping editor, shared geometry logic, Project Details, Maintenance History, LGU, Records, Monthly Updates and Documents implementations. No schema, migrations, seeders, authentication configuration, dependencies or backend model changes were made. No Git reset/clean, push, merge or commit was performed.

## Verification results

**Actual browser: 18 passing groups, zero failed groups, zero runtime errors.**

1. Directory full-row navigation opens the correct record; menus remain independent and directory origin is retained.
2. Stored three-location geometry, one selected road, LGU/creator/project joins are correct.
3. Header actions, two-column proportions, 420px map, length, badge and metadata follow established presentation; no visible RoadCoverage ID.
4. Editor controls, overlays, draggable markers and unsupported Delete action are absent.
5. Standard zoom, wheel zoom and panning work.
6. Bottom-right fullscreen enters/exits and the map resizes.
7. View Project opens the actual associated Project Details.
8. Two-location map has only A/B; unassigned-project empty state has no assignment actions.
9. Edit loads the correct saved road; Cancel returns without changes.
10. Information-only Save returns to Details and preserves exact GeoJSON, original creator/creation timestamp and project association.
11. A current sample without geometry retains textual information and its project association while showing the neutral placeholder.
12. Invalid geometry and unavailable metadata show appropriate fallback values.
13. Legacy LineString without waypoint metadata displays no invented markers.
14. Existing sidebar collapse and active navigation work.
15. 390px and 320px layouts stack sections and wrap metadata/actions without document overflow.
16. Existing Add Road Coverage, Add Project and Project Details/Maintenance History remain available.
17. Unsupported delete requests leave road/project data unchanged.
18. Details/navigation/edit-load checks send **zero routing requests** and cause no runtime exceptions.

**Additional browser permission checks: 2 passed.** Viewer Details has no Edit/Delete action; directory create/edit remain disabled while keyboard-accessible Details navigation works.

**Provider checks: 7 passed.** Actual FK joins and geometry identity, missing data/unknown IDs, existing role checks, safe contextual return URLs, Edit returns, original-attribution preservation and absence of unsupported deletion/cascades.

**Build and quality checks:** review-mode production frontend build, whole-project TypeScript, scoped ESLint and Prettier passed. Exact logs and executable review test scripts are included. ESLint covers changed TS/TSX plus the new Details adapter; the older preview server is not claimed to have passed a repository-wide lint run. The existing optional fontaine build advisory remains non-blocking.

## Screenshots and fixtures

All screenshots come from the actual built frontend in Chromium, not generated mockups:
- 01-linked-three-location-road.png
- 02-unassigned-two-location-road.png
- 03-missing-geography.png
- 04-collapsed-sidebar.png
- 05-narrow-details.png
- 06-reference-project-details.png
- 07-reference-add-project.png

The mapped captures use explicitly labeled, temporary **Development fixture** roads created through the existing preview creation workflow, with genuine OSRM coordinates captured during the preceding mapping review. A temporary project was created through the established project workflow to verify the actual relationship. No route was generated by opening Details, and no permanent source fixtures were replaced. Invalid/legacy response cases were isolated browser test fixtures. The existing first sample road supplies the missing-geography screenshot.

Basemap requests initially loaded slowly; final desktop/mobile captures include actual OpenStreetMap tiles. External tile availability remains a runtime dependency. No replacement or fabricated basemap was used.

## Limits and integration

This implementation is verified against the existing Node frontend preview with process-local sample data. Preview changes reset on restart. The packaged initial road fixtures still have no saved geometry; create/save a coverage in the preview to inspect its map, or open an existing row to inspect the missing-map state. Test-created screenshot records are not permanent application data.

Laravel Road Coverage CRUD routes/controllers/policies and PostgreSQL persistence are not integrated in this baseline. Production record retrieval, persistence, attribution and authorization have **not** been verified. The new frontend response adapter must be supplied equivalently by the future Laravel integration; no production behavior is claimed. Safe deletion remains pending that capability.

The read-only map deliberately uses the current shared geographic contract (LineString or Feature containing LineString, valid finite coordinates, positive length, at most 1000 vertices). Unsupported/malformed geographic data receives the placeholder rather than an invented approximation. Waypoints are shown only when the existing saved metadata passes its established checks.

Source preservation was checked by hashes, and focused browser smoke tests covered the referenced existing pages. This is not a claim of exhaustive production regression testing of every unrelated module.

## View and restore

See VIEW-AND-RESTORE.txt for commands and restoration steps. The previous complete JaiROADS_Map_Navigation_Review.zip remains available separately. Pre-change copies of all seven modified files and matching compiled assets are included in review-road-details/restore/.

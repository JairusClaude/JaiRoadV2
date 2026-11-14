# Road reference loading — Repair 5A

The road editor no longer embeds the entire authorized road network in its form props. `/dd-phase3/ui/map/roads` is an authenticated, verified, writer-only read endpoint using the existing canonical identity and EngineerLGU scope.

## Contract and preservation

- Required numeric `west`, `south`, `east`, `north`; optional `lgu_id`, road-name search `q`, and keyset `after`. Invalid or reversed bounds fail validation.
- Each response contains at most 100 roads plus `next_cursor`. The client follows every page; this is a page size, not a total-result cap. It preserves viewport/municipality filters on every page.
- Only ID, name, municipality association, recorded length, pavement, condition and exact stored GeoJSON values are returned. No creator/account payload, credentials, private files, or audit payloads are selected.
- The PostgreSQL JSONB bounding-box prefilter covers LineString, Feature, MultiLineString, GeometryCollection and FeatureCollection, including higher dimensions. It conservatively includes any bounding-box overlap, including lines crossing a viewport with both endpoints outside. Extra matches are possible; geometry is never simplified or rewritten.
- Saved reference lines render as separate lines using `savedRoadLines`; their full stored vertex lists are supplied to Leaflet with smoothing disabled. The display projection never changes saved dimensions.
- Pan/zoom/municipality changes cancel stale requests and debounce replacement loads. Hiding references stops loading. Loading/error notices do not block saving the current road or overwrite its geometry.
- No PostGIS extension, function, table, index, migration, role or RLS change is introduced. SQL JSONB bounds are not backed by a new spatial index. ID keyset pagination uses the existing primary key.

## Measured form requests

See [raw samples](repair5-road-measurements.json). Values below are medians of three warmed requests on the same deterministic fixtures, original application/asset build from the base commit versus optimized code, on the same local runtime and disposable PostgreSQL 17 configuration.

| Roads | Before JSON bytes | After JSON bytes | Before/after SQL count | Before/after server ms | Before/after PHP peak delta KiB |
| ----: | ----------------: | ---------------: | ---------------------- | ---------------------- | ------------------------------- |
|     1 |             1,360 |            1,066 | 5 / 4                  | 5.903 / 3.947          | 63.8 / 59.6                     |
|   100 |           397,972 |            1,066 | 5 / 4                  | 64.056 / 4.044         | 8640.9 / 59.6                   |
|   500 |         2,000,172 |            1,066 | 5 / 4                  | 282.298 / 4.375        | 43292.6 / 59.6                  |
|  1000 |         4,002,924 |            1,066 | 5 / 4                  | 592.472 / 6.382        | 86600.6 / 59.6                  |

The initial response is only one part of the cost. The following totals cover **all** cursor pages for the measured viewport (125.9–126.0 longitude, 7.5–7.7 latitude). They must be added to the optimized form request, not counted as zero-cost deferred work.

| Dataset roads | Visible reference roads | Reference JSON bytes | SQL count across pages | Server ms across pages | Largest per-page PHP peak delta KiB |
| ------------: | ----------------------: | -------------------: | ---------------------: | ---------------------: | ----------------------------------: |
|             1 |                       0 |                   30 |                      2 |                  3.661 |                                76.9 |
|           100 |                      49 |              180,298 |                      2 |                 34.240 |                              2447.4 |
|           500 |                     249 |              916,354 |                      6 |                302.862 |                              6357.7 |
|          1000 |                     499 |            1,836,411 |                     10 |                935.808 |                              4936.3 |

## Actual Chromium observations

Viewport 1440×1000, reduced motion, mocked map tiles, real Laravel login and loopback PHP server. “Interactive” is navigation through the map element appearing plus two animation frames; it is **not** LCP or a field-based user metric. Reference-ready is observed separately from the loader state. The one seed road is outside the measured initial viewport; subsequent synthetic roads alternate between near and distant coordinates.

| Roads | Before/after interactive ms | Before/after all-reference-ready ms | Before/after HTML bytes |
| ----: | --------------------------- | ----------------------------------- | ----------------------- |
|     1 | 429 / 554                   | 431 / 1363                          | 10,059 / 9,765          |
|   100 | 501 / 447                   | 504 / 1244                          | 406,669 / 9,765         |
|   500 | 1059 / 369                  | 1062 / 1671                         | 2,008,869 / 9,765       |
|  1000 | 1352 / 329                  | 1355 / 2170                         | 4,011,620 / 9,765       |

**Tradeoff:** initial form transfer, heap and interactive time improve on the larger fixtures, but completing the visible references is slower here because it adds debouncing, multiple authenticated HTTP requests and unindexed JSONB bounds work. This is not an across-the-board latency improvement. Dense or world-sized viewports can still require many pages. A single exceptionally large saved geometry can still make one page large; page size bounds row count, not bytes. No geometry is truncated to conceal that cost.

## Measurement limits and reproduction

- Three warmed observations per case; no production network, concurrency, p95, database-server RSS or production-cache claims. PHP peak delta is `memory_get_peak_usage() - request_start_heap` in a reused Laravel test application, not isolated FPM process RSS. Query counts include warm test-kernel behavior; production auth/session work may differ.
- The original application was exported from the exact base SHA into a separate temporary application with its own build; the working branch was never reset. Both variants use the same installed dependencies, synthetic fixture generator and PostgreSQL settings. Failed early harness runs are excluded. The stripped local PostgreSQL distribution lacked LLVM, so JIT was disabled for **both** final variants; production configuration was not changed.
- Server bytes are uncompressed Inertia JSON, browser bytes are uncompressed HTML. Volatile test usernames/timestamps can cause tiny byte differences. Synthetic 150-vertex lines differ from the earlier audit's fixture, so these numbers do not reproduce its exact 3.09 MB measurement.
- `tests/Performance/frontend-payloads.php`, `prepare-road-browser.php` and `road-browser.mjs` provide the fixture/measurement logic. They use the existing guarded `PostgresTestCase`, require an empty disposable local database and `JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY`, and never target shared Supabase. Supply testing APP_KEY, local PostgreSQL settings and an array session driver for kernel measurements. Browser measurements use the established loopback Laravel/Playwright runner, file sessions and `BENCH_ROADS=1|100|500|1000`.
- All geometry preservation, scope, pagination and invalid-input assertions are in `RoadReferenceLoadingTest.php`; the real browser suite additionally waits for authorized reference lines before mapping a new road.

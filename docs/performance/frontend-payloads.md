# Frontend form and history payloads — Repair 5A

[Road-reference optimization and its tradeoffs](road-references.md) is the first focused change. This second change trims unnecessary form/selection data without capping valid choices or changing validation/permissions. [Raw same-fixture samples](repair5-measurements.json) contain every observation.

## Loading-path inventory

| Path                                | What the UI needs                                                     | Change / retained information                                                                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roadForm`                          | Current road and viewport references                                  | Current road retains exact GeoJSON. Background references use the paginated viewport endpoint.                                                                                                          |
| `recordCreate`                      | All authorized project labels, eligible managers, period availability | Lightweight project and period DTOs; no project GeoJSON, descriptions or complete record objects. Eligibility is batched across LGUs using the same role/account/profile/assignment predicates.         |
| `recordForm`                        | One project, current record and that project's occupied periods       | Current record remains complete. Parent is a lightweight choice; all period keys remain available for duplicate validation.                                                                             |
| `parents`                           | All writable parent choices, or one already-fixed record              | SQL selects only period identifiers and manager for authorization. A fixed context queries only that record/project; other authorized choices remain complete and uncapped when the picker is enabled.  |
| `updateForm`                        | Current report, media and relevant uniqueness keys                    | Fixed-context uniqueness rows are filtered by the actual parent. Unfixed forms retain all required authorized month keys.                                                                               |
| Project Details history             | Every year/quarter, status, manager, start date and actions           | Every row/year is retained as a history summary. Large descriptions, creator and other detail fields load only from the existing authorized record detail route. Its current-road map remains complete. |
| Directory project filters           | Project ID/title/municipality                                         | Lightweight choices, no geometry. Main project directory rows also omit unused GeoJSON.                                                                                                                 |
| Project create/edit coverage picker | Existing global coverage-selection map/list                           | Not redesigned in this checkpoint; it still loads its eligible coverage geometry. Reusing viewport references there requires a separately tested selection/search interaction.                          |

The complete chooser lists and history summaries still grow linearly. This is a smaller representation and context filtering, not a claim that every collection now uses remote pagination. All authorized projects/records remain reachable; no arbitrary truncation is introduced. Further searchable picker/year-loading contracts are a follow-up if metadata-only lists themselves become costly. Road-map reference pagination/search is implemented now.

## Comparable server observations

Each dataset has one authorized project/record/monthly report per road, plus up to 398 additional historical records with long descriptions on the first project, and one cross-LGU road. The synthetic history cap keeps fixture periods within the approved year range; it is **not** an application cap. The same generator runs in the original and optimized applications. Statistics are three warmed request medians.

At 500 roads:

| Page            | Before JSON bytes | After JSON bytes | Before/after SQL count | Before/after server ms | Before/after PHP peak delta KiB |
| --------------- | ----------------: | ---------------: | ---------------------- | ---------------------- | ------------------------------- |
| record          |         3,534,637 |          144,318 | 5 / 5                  | 347.711 / 26.685       | 49830.5 / 3886.4                |
| fixed-record    |         1,157,936 |           22,096 | 5 / 5                  | 25.757 / 18.057        | 4090.4 / 1965.4                 |
| monthly         |         2,289,468 |          324,703 | 5 / 5                  | 355.954 / 32.407       | 44822.8 / 3382.7                |
| fixed-monthly   |         2,289,486 |            1,444 | 5 / 5                  | 275.822 / 8.735        | 44822.5 / 65.5                  |
| project-history |         1,157,791 |          134,639 | 4 / 4                  | 20.083 / 19.234        | 4087.7 / 2299.7                 |

The raw file also includes 1, 100 and 1000 roads. The one-LGU benchmark does not measure an N-LGU speedup; the regression fixture with 110 LGUs instead asserts a bounded query count (at most 12 for record creation) and compares batched choices with the individual approved eligibility results for Engineer/Admin/SuperAdmin. PHP memory/timing and browser limitations are described in the road report.

## Verification

`LeanFormChoicesTest.php` proves all 110 authorized projects/periods remain present, the last fixed record is selectable, unauthorized fixed contexts fail, report uniqueness data is parent-scoped, batched manager eligibility is unchanged, and all 300 history rows remain reachable with complete descriptions on the detail route. Existing canonical, password, authorization and real browser suites remain enabled.

No canonical model, migration, database structure, stored geometry, permission rule, AuditLog or shared Supabase data is changed. Loading endpoints always apply canonical server identity and scopes; presentation filtering is not authorization.

# Improvement1 — measured directory payloads

Source: disposable PostgreSQL 17 focused regression run [45960271935, job 140376195443](https://github.com/JairusClaude/JaiRoadV2/actions/runs/45960271935/job/140376195443), exact SHA `9c458989e12dbbb17d74dd42f820b2112c812c12`. 502 tests passed, 7,784 assertions. Each case warmed once and sampled three times. Uncompressed Inertia JSON bytes; elapsed time in milliseconds (median of three); peak memory delta is the maximum observed sample. These are synthetic, not hosted, and not matched before/after comparisons.

| Directory | Rows | Bytes | SQL queries | Median ms | Max peak delta bytes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Monthly updates | 1 | 1933 | 9 | 7.752 | 82680 |
| Monthly updates | 100 | 7530 | 9 | 8.034 | 118432 |
| Monthly updates | 1000 | 8407 | 9 | 10.825 | 128992 |
| Maintenance documents | 1 | 1833 | 6 | 5.880 | 82704 |
| Maintenance documents | 100 | 8063 | 6 | 6.500 | 114104 |
| Maintenance documents | 1000 | 8483 | 6 | 8.166 | 120088 |

Both directories retained up to 12 rows per response, correct totals, and omitted unrendered descriptions or report summaries. Query counts were constant in these fixtures. The reporting-year facet and pagination metadata can still grow; this is not a guarantee of constant response bytes or latency at arbitrary scale. Hosted load and exact candidate measurements remain required.

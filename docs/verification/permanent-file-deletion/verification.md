# Priority Repair A verification checkpoint

> **New safety gate (2026-11-14, PR #24):** The hosted `file_deletions` intent table has been installed, but real private Storage backup/recovery and operator acceptance remain unverified. The code now requires explicit `JAIROADS_PERMANENT_FILE_DELETION_ENABLED=true` to accept/execute destructive object deletion; the default is off. Automated tests use disposable mock Storage and are not proof of live object recovery. The following 2026-11-04 test evidence is historical for that earlier code revision.

4 November 2026. Recovered from local HEAD `4910293610d35c69bd9bdb5864610099325f05b9`, remote base `e5a42a985b2d2657011ccab0de486ba5d7d53663`, on `Oct10_Front&BackEnd_Merge_Integration`. The workspace contained 21 modified tracked implementation/test files and eight new implementation/test files; no staged work or published Repair A commit existed. Earlier local preservation merges/audit documents were retained without publishing them as part of this feature.

Recovered backend/frontend implementation and earlier passing logs were inspected rather than recreated. Remaining work completed: final bucket versioning/private-state verification, exact confirmation wording, legacy DD review integration, additional fail-closed regression cases, Docker production-image acceptance, schema/operations handoff and final local verification.

## Executed local checks

| Check | Actual result |
| --- | --- |
| Focused permanent deletion + earlier review tests | 33 passed, 303 assertions |
| Entire canonical PostgreSQL 17 suite | 286 passed, 3,379 assertions (includes focused cases) |
| Password PostgreSQL suite | 56 passed, 331 assertions |
| PostgreSQL Feature suite | 45 passed, 205 assertions; 2 existing registration skips |
| Standard Laravel/SQLite Feature/unit suite | 101 passed, 532 assertions; 2 existing registration skips |
| PHP syntax, Pint, PHPStan | Passed; PHPStan 206 files, no errors |
| ESLint, Prettier, TypeScript, Vite production build | Passed |
| Route list | Passed, including canonical file DELETE/review/download routes |
| Real Laravel/Fortify unified browser suite | Passed; four roles, deletion/failure/retry, prior geometry/monthly/duplicate/municipality/logout checks and 24 responsive measurements |
| npm audit --audit-level=high | Passed threshold; 15 moderate advisories, no high/critical advisories |
| Composer audit --locked | Local Packagist network timeout; CI must execute successfully before claiming clean |
| Docker production image | Docker unavailable locally; added acceptance runs in full-system CI, result must be verified on published SHA |

All write tests used new disposable PostgreSQL 17 clusters, SQLite memory databases or exact-object Storage mocks. Existing registration skips were not newly introduced and are not counted as passes. Audit/history and all sibling/parent SQL snapshots are compared before/after. Two real processes test concurrency and SIGKILL after simulated Storage deletion. The final schema proposal was rehearsed only in guarded disposable fixture builders/tests.

## Deployment dependencies

See [the schema-owner and operations handoff](../../permanent-individual-file-deletion.md). Shared activation requires separate approval/application of the private intent table, backend permissions, private unversioned bucket verification and trusted periodic reconciliation. No live schema, data, Storage objects, canonical models or existing migrations were changed. No parent deletion policy is implemented.

## Changed file inventory

- `.github/workflows/system-verification.yml`
- `app/Console/Commands/ResumeFileDeletions.php`
- `app/Http/Controllers/DataDictionary/DdFrontendController.php`
- `app/Http/Controllers/DataDictionary/DdOperationsController.php`
- `app/Services/DataDictionary/DdOperationAudit.php`
- `app/Services/Documents/PrivateSupabaseStorage.php`
- `app/Services/Files/PermanentFileDeletion.php`
- `app/Services/MonthlyUpdates/PrivateMonthlyMediaStorage.php`
- `database/proposals/create_file_deletions.php`
- `docs/file-removal-policy-decision.md`
- `docs/permanent-individual-file-deletion.md`
- `resources/js/components/files/permanent-file-deletion.tsx`
- `resources/js/components/maintenance-documents/maintenance-documents-page.tsx`
- `resources/js/components/monthly-updates/media-gallery.tsx`
- `resources/js/components/monthly-updates/monthly-update-form.tsx`
- `resources/js/pages/MaintenanceDocuments/Form.tsx`
- `resources/js/pages/MaintenanceDocuments/Index.tsx`
- `resources/js/pages/MaintenanceDocuments/Show.tsx`
- `resources/js/pages/dd-phase3/DdFileRemovalReview.tsx`
- `resources/js/types/maintenance-documents.ts`
- `resources/js/types/monthly-updates.ts`
- `routes/dd-phase3.php`
- `tests/Browser/docker-smoke.mjs`
- `tests/Browser/permanent-file-deletion.mjs`
- `tests/Browser/prepare-system.php`
- `tests/Browser/prepare-unified.php`
- `tests/Browser/private-storage-mock.mjs`
- `tests/Browser/unified.mjs`
- `tests/Quarterly/FileRemovalPreparationTest.php`
- `tests/Quarterly/PermanentFileDeletionTest.php`
- `tests/Quarterly/file-deletion-worker.php`

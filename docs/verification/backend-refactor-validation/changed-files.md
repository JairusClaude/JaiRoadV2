# Exact modified files

- `.github/workflows/disposable-staging-rehearsal.yml`
- `.github/workflows/quarterly-maintenance.yml`
- `.github/workflows/system-verification.yml`
- `.github/workflows/tests.yml`
- `app/Console/Commands/CanonicalAccessPreflight.php`
- `app/Http/Controllers/AuditHistoryController.php`
- `app/Http/Controllers/DirectoryController.php`
- `app/Http/Controllers/OperationsController.php`
- `app/Http/Controllers/OperationsFrontendController.php`
- `app/Http/Controllers/PeopleLifecycleController.php`
- `app/Http/Controllers/PreservedHistoryController.php`
- `app/Http/Controllers/RoleLandingController.php`
- `app/Http/Controllers/SectionController.php`
- `app/Models/User.php`
- `app/Services/Files/PermanentFileDeletion.php`
- `bootstrap/app.php`
- `routes/operations.php`
- `scripts/refactor/verify-backend-layout.php`
- `tests/Integration/assert-reviewed-history.sh`
- `tests/Local/test_workflow_backend_paths.py`
- `tests/Quarterly/CanonicalOnlyAuthenticationTest.php`
- `tests/Quarterly/ProvisioningEvidenceTest.php`
- `tests/Quarterly/ReviewedAccountTransitionTest.php`

17 PHP files: token-equivalent formatting and top-level import cleanup only, verified in format-token-equivalence.json.
Four workflows: new branch filters and corrected moved source paths; one step executes the new path regression.
Integration lineage script: two renamed service paths only.
One new Python test: checks every PHP path referenced by workflow files and the integration shell guard.
No canonical reference models or migrations were modified.

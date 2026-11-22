#!/usr/bin/env bash
# Canonical contract check for the current merged-system delivery branch.
# The immutable reviewed-ancestry release gate is separately preserved for the
# stacked integration candidate; its ancestry must not be claimed here.
set -Eeuo pipefail
cd "$(git rev-parse --show-toplevel)"

for file in \
  app/Auth/LinkedPasswordUserProvider.php \
  app/Services/AccountIdentityResolver.php \
  app/Services/OperationAudit.php \
  app/Services/Files/PermanentFileDeletion.php \
  app/Services/Documents/PrivateSupabaseStorage.php \
  app/Services/RoleAccess.php \
  resources/js/pages/auth/login.tsx \
  resources/js/components/road-coverages/coverage-map-editor.tsx \
  database/proposals/canonical_account_provisioning.sql \
  database/proposals/audit_notification_recipients.sql \
  database/proposals/quarterly_record_uniqueness.sql \
  tests/Quarterly/ReviewedAccountTransitionTest.php \
  tests/Quarterly/IntegrationDeploymentReadinessTest.php; do
  if ! git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
    echo "FAIL: canonical contract missing from merged-system: $file" >&2
    exit 1
  fi
done

# Check implementation signatures in addition to mere filenames.
grep -q 'function resolve(' app/Services/AccountIdentityResolver.php
grep -q 'function record(' app/Services/OperationAudit.php
grep -q 'function operationallyEnabled(' app/Services/Files/PermanentFileDeletion.php
echo "PASS: merged-system canonical contracts exist; reviewed stacked ancestry not asserted for this branch."

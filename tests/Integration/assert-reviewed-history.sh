#!/usr/bin/env bash
# Immutable Git ancestry audit for the Task-10 combined review candidate.
# Read-only. Does not merge branches, alter refs, use real credentials, or run SQL.
set -Eeuo pipefail
if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "This lineage gate runs only on the disposable GitHub CI runner." >&2
  exit 2
fi
root="$(git rev-parse --show-toplevel)"
cd "$root"
if [[ "$(git rev-parse --is-shallow-repository)" != "false" ]]; then
  echo "Expected fetch-depth: 0 so the full ancestry can be verified." >&2
  exit 2
fi
while read -r label sha; do
  [[ -z "$label" || "$label" = \#* ]] && continue
  if ! git cat-file -e "${sha}^{commit}" 2>/dev/null; then
    echo "FAIL: reviewed commit object is missing from this checkout: $label" >&2
    exit 1
  fi
  if ! git merge-base --is-ancestor "$sha" HEAD; then
    echo "FAIL: expected reviewed baseline missing from combined tree: $label" >&2
    exit 1
  fi
  printf 'PASS: retained reviewed ancestry: %s (%s)\n' "$label" "${sha:0:12}"
done <<'APPROVED_ANCESTRY'
October-integration 3e4a5c55d8b929d51b40f6c9983ba6c993315431
teammate-dd-system c9ee10a145effa517b03c5d643266e194c123d4b
security-base 5c3ab221d18594d2c1fa42e9dafd2871c3846b5f
draft-PR-6 f183f51760c45fe707c056ae2cb53305e1ce9cea
draft-PR-7 a5a874212e785e8b20eb77052fdee42bfe450789
draft-PR-8 8c771ba53cb75f2a73eaf30eb717391286a3800a
draft-PR-9 6057399d3cd3dcac8e8481ee5f7136ce942245ed
draft-PR-10 8236a4522b7d47ac0de922e4e7044b5209fa8412
draft-PR-11 4fa6075771e4366ee8c0e47b3b67b841ff632b69
draft-PR-12 9a788ee59e779f81100efaece5385a1911ac384d
draft-PR-13 64c6f2bdb3076c173a23d8b94261f06c1c47f8d8
draft-PR-14 ea4f4fbd864dc3d1ee40237d379292fe65783f3f
APPROVED_ANCESTRY

# Two older tips diverged by a separate commit. Never implicitly adopt their
# legacy controller/metadata behavior into the security and schema review.
for label_sha in \
  'main:16a0fe7679f06c31ad15939ed578b15dda52eaea' \
  'older-road-login:47f6de3effeb397e1b267c3d41b97a29ddda044f'; do
  label="${label_sha%%:*}"
  sha="${label_sha#*:}"
  if git merge-base --is-ancestor "$sha" HEAD; then
    echo "INFO: independently diverged $label is an ancestor; owner must review any change."
  else
    echo "REVIEW REQUIRED: independent $label tip not merged; do not auto-import."
  fi
done

# Assert essential canonical/feature contracts still exist in the candidate.
for file in \
  app/Auth/LinkedPasswordUserProvider.php \
  app/Services/DataDictionary/DataDictionaryIdentityResolver.php \
  app/Services/DataDictionary/DdOperationAudit.php \
  app/Services/Files/PermanentFileDeletion.php \
  app/Services/Documents/PrivateSupabaseStorage.php \
  resources/js/pages/auth/login.tsx \
  resources/js/components/road-coverages/coverage-map-editor.tsx \
  database/proposals/canonical_account_provisioning.sql \
  database/proposals/audit_notification_recipients.sql \
  database/proposals/quarterly_record_uniqueness.sql \
  tests/Quarterly/ReviewedAccountTransitionTest.php \
  tests/Quarterly/IntegrationDeploymentReadinessTest.php; do
  if ! git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
    echo "FAIL: required reviewed integration contract missing: $file" >&2
    exit 1
  fi
done
echo "PASS: combined candidate contains the existing reviewed integration features."

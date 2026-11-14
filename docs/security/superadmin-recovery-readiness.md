# SuperAdmin access and recovery readiness — Task 5

**Status:** Automated synthetic PostgreSQL 17 regression coverage; official account operation **not performed**.

This work is stacked after [PR #9](https://github.com/JairusClaude/JaiRoadV2/pull/9) and complements the existing Fortify/canonical tests in `CanonicalOnlyAuthenticationTest`, `AccountLifecycleTest`, `ProvisioningEvidenceTest`, `PasskeyEligibilityTest`, and real WebAuthn browser tests. It introduces **no authentication bypass, database migration, account change, production credential or recovery backdoor**.

## Security requirements and automated proof

The new `tests/Quarterly/SuperAdminRecoveryReadinessTest.php` tests strictly fake accounts in disposable local PostgreSQL 17:

1. **Single initial trusted root:** privileged bootstrap creates a SuperAdmin without an Engineer or administrative provenance. A valid Fortify login reaches the privileged directory. An intentional synthetic password-hash mismatch denies login; a valid broker-issued recovery token repairs the canonical and Fortify hashes, preserving the same canonical account ID and leaving business AuditLog untouched.
2. **No token bypass for a broken root:** a token may not activate/repair a deactivated, bridge-less, email-mismatched or retired-Engineer-linked SuperAdmin. The failed attempts leave canonical hashes and AuditLog unchanged.
3. **Actual last-*eligible*-root protection:** an Admin cannot deactivate a root merely because a second active row exists if that second root's Fortify bridge is invalid. Once a second root is truly eligible, the administrator may deactivate and later reactivate the first, preserving identity/credentials and recording exactly the two legitimate business events. Self-deactivation is still forbidden.
4. **Revocation during a pending MFA challenge:** disabling the root before the recovery-code step clears the pending challenge, denies the authentication, does not consume the unused recovery code, and rejects the synthetic passkey login callback.
5. **Valid MFA recovery:** an eligible SuperAdmin can complete a broker-managed Fortify challenge with a real synthetic recovery code, retain the exact SuperAdmin canonical role and reach its privileged directory without inventing a business AuditLog entry.

These are not substitutes for real signed passkey/browser checks already implemented in the separate passkey workflow. They supplement those checks with root-specific recovery sequence coverage.

## CI and operator limitations

`.github/workflows/disposable-staging-rehearsal.yml` includes a new `superadmin-recovery` job with a fresh `jairoads_scratch_superadmin_recovery` PostgreSQL 17 service. The existing fixture **refuses any nonlocal DB host, non-scratch name, non-testing environment or missing explicit disposable approval**. Run with:
`php artisan test tests/Quarterly/SuperAdminRecoveryReadinessTest.php --stop-on-failure`

**These tests do not verify that the actual official SuperAdmin knows their password, controls their MFA keys, or can authenticate at a live deployment.** That requires a separately approved operator session with an independent recovery channel, on isolated staging first. Do not request or share passwords, one-time codes, backup codes or raw tokens in GitHub or chat.

Manual owner signoff still needed:
- [ ] Database owner confirms **exactly one or more currently eligible canonical SuperAdmin identities** and a recovery operator/backup route, without public disclosure of identity details.
- [ ] Data Dictionary owner approves the strict account and immutable provenance transition before official deployment.
- [ ] On approved separate staging, test real HTTPS origin, Fortify login, password reset email delivery, MFA recovery, registered passkey and lost-device response.
- [ ] Rehearse restoring administrator access after accidental deactivation; do **not** create a second bootstrap SuperAdmin if any SuperAdmin record already exists.
- [ ] Existing Admin/Engineer transition evidence, real runtime-role/RLS grants, private Storage and final approval still pending.

**Never run the disposable fixture against official Supabase `aeaaxwyytsagbacysvvx`; never edit an existing account as part of automated recovery readiness.** This is a code/staging review artifact only.

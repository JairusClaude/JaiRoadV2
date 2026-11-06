# Passkey lifecycle eligibility (SEC-003)

Real Chromium virtual-authenticator testing reproduced the baseline problem:
all four canonical roles and legacy-only users could register/authenticate,
but inactive, retired, missing-account, mismatched-link, mismatched-email and
mismatched-hash canonical identities also established passkey sessions while
the same accounts' password logins returned 422. Protected DD controllers still
denied invalid canonical identities; this was not a demonstrated DD data leak.

Fortify's installed passkey package validates the WebAuthn proof before calling
`Passkeys::authorizeLoginUsing`. The application now registers that supported
callback, requiring the existing canonical identity resolver for linked accounts.
Legacy-only accounts preserve their existing authentication path. No identity is
inferred from email or a coincident account ID. No vendor code is modified.

Fortify's supported `auth_middleware` configuration now uses an Authenticate
subclass that also denies invalid linked identities at credential-management
endpoints. Security Settings uses the same middleware. Logout remains available
to invalidate revoked sessions. Password reset remains on its existing broker
and linked-updater path; no authentication or project ownership redesign occurs.

A correctly signed wrong-origin assertion was rejected by the underlying
library but surfaced as HTTP 500 at baseline. A route-scoped renderer converts
that precise WebAuthn verification exception to a generic credential-validation
422. It does not catch unrelated exceptions or bypass cryptographic checks.

`tests/Browser/passkey-lifecycle.mjs` performs real registration, signature-based
authentication, replay denial, invalid canonical account/password parity,
signed wrong-origin rejection, and foreign-account confirmation denial. It
verifies rejected authentication remains guest for dashboard, Security Settings
and passkey registration options; credential ownership/IDs are unchanged.
All four roles have NULL email verification timestamps. The legacy fixture may
authenticate but cannot enter the canonical business workspace.

Chromium requires a domain RP, so this isolated test uses `http://localhost`
with a loopback-only PHP server and disposable PostgreSQL 17. The fixture-state
CLI is never an HTTP route and positively guards target/environment/version.
Its corrupt missing-link case uses transaction-local replica mode in that
disposable database only, to test a condition normally prevented by real FKs.
No real user, passkey, bucket or shared schema is used.

The full-system workflow now includes this browser job; both existing workflows
recognize the security branch for future authorized publication. No workflow
run on these new commits is claimed while publication remains unauthorized.

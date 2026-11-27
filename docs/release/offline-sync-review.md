# Durable offline reporting — review-only design

Status: design for schema-owner, security and product review. No migration, service worker, background write, persistent receipt or production feature flag is included. The deployed contract remains encrypted portable drafts plus one in-page reconnect attempt, with a read-only reporting-period lookup. A period match is not a submission receipt.

## Required transaction and identity contract

- A deliberately queued text-only report receives a cryptographically random UUID. Bind it to the verified canonical account, project, maintenance record, reporting month and canonical payload fingerprint. A receipt must never confer access.
- A server-side receipt table would have a unique (canonical account ID, submission UUID) key and a unique or otherwise constrained reference to the successfully created report, with explicit retention and a schema-owner-approved lifecycle. Store only the minimum required metadata; do not store raw report contents, credentials, paths, or session identifiers in the receipt.
- The server must recompute a versioned fingerprint from validated canonical business fields using deterministic UTF-8 serialization; do not trust a client digest. Define numeric normalization, newline handling, field order and Unicode handling in the protocol. A reused UUID with different content returns conflict without modifying either report.
- In one PostgreSQL transaction: verify the current canonical login and writer scope under the same locking rules as the existing write path; claim the receipt key with unique-constraint conflict handling; create the report under existing reporting-period uniqueness; write its existing audit and notification records; finalize the receipt and commit. Any failure rolls back all of these database changes. No independent transaction may commit the report before its receipt.
- On a repeat, revalidate current authorization and compare the exact canonical fingerprint before returning the recorded outcome. A changed/revoked account, invalid bridge or reassigned record fails closed. A distinct report occupying the same period is a conflict, not success for this request. A lost response is resolved by receipt lookup, not by automatic resubmission.
- Receipt lookup is read-only, authenticated, account-scoped, rate-limited and private/no-store. A missing receipt means unknown at observation, not permission to retry an in-flight write.

## Client lifecycle

1. Save encrypted text draft only by explicit consent. Use current AES-GCM/PBKDF2 envelope; any added UUID and account binding belong inside authenticated encrypted content.
2. Queue a frozen snapshot with explicit expiry. A changed snapshot, expired session, account switch, revocation, or cancellation invalidates queued consent; no silent background action.
3. On reconnection with an active verified session, decrypt only after explicit unlock and check scope. Send one authorized submission. Persist no plaintext report, passphrase, token, or cookie.
4. On network interruption or ambiguous response, present an unknown outcome and a read-only receipt lookup. Only after verified outcome and explicit user action can a new attempt be considered.
5. On browser closure, preserve only the encrypted portable draft, not a promise of unattended execution. Durable encrypted local storage, key derivation and eviction policy require independent review before implementing. Never cache private authenticated pages or unrestricted media in a service worker.

## Attachments and activation dependencies

Exclude attachments from the first durable synchronization protocol. Private Storage bytes are outside the PostgreSQL transaction; a later attachment protocol requires separately scoped intents, object identity, quotas, integrity checks, partial-failure recovery, explicit user consent and reconciliation. Do not silently discard selected attachments or replay an uncertain upload.

Before activation, the schema owner must approve table constraints, grants/RLS, migration and rollback, receipt retention, audit/privacy policy and isolated runtime-role rehearsal. Product approval is needed for expiration, conflict UX and background behavior. Run concurrent same-ID/same-payload, same-ID/different-payload, same-period/different-ID, lost-response, rollback after audit failure, revoked account, reassignment, session expiry, cancellation, encrypted-draft tampering and retention tests on a disposable PostgreSQL instance. Hosted staging and human acceptance are mandatory. No production application, DDL or feature flag changes are authorized by this document.

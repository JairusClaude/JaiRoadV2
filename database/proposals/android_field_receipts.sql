BEGIN;
CREATE TABLE jairoads_security.android_field_receipts (
    account_id bigint NOT NULL CHECK (account_id > 0),
    operation_id uuid NOT NULL,
    fingerprint text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
    entity_id bigint NOT NULL CHECK (entity_id > 0),
    entity_version varchar(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, operation_id)
);
ALTER TABLE jairoads_security.android_field_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jairoads_security.android_field_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON jairoads_security.android_field_receipts TO jairoads_app_runtime;
CREATE POLICY field_runtime_read ON jairoads_security.android_field_receipts
    FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY field_runtime_insert ON jairoads_security.android_field_receipts
    FOR INSERT TO jairoads_app_runtime WITH CHECK (true);
COMMIT;

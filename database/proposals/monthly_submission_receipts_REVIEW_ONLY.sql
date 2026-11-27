-- REVIEW ONLY: never automatically migrate official Supabase.
-- Retained receipt IDs deliberately do not reference deletable report rows.
-- Owner must approve retention, identifier non-reuse and backup/restore policy.
BEGIN;
CREATE TABLE jairoads_next.monthly_submission_receipts (
    account_id bigint NOT NULL CHECK (account_id > 0),
    submission_id uuid NOT NULL,
    project_id bigint NOT NULL CHECK (project_id > 0),
    maintenance_id bigint NOT NULL CHECK (maintenance_id > 0),
    reporting_month varchar(7) NOT NULL CHECK (reporting_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND left(reporting_month, 4) <> '0000'),
    fingerprint varchar(64) NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
    report_id bigint NOT NULL UNIQUE CHECK (report_id > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, submission_id)
);
ALTER TABLE jairoads_next.monthly_submission_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jairoads_next.monthly_submission_receipts FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON jairoads_next.monthly_submission_receipts FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON jairoads_next.monthly_submission_receipts FROM authenticated;
    END IF;
END $$;
COMMIT;

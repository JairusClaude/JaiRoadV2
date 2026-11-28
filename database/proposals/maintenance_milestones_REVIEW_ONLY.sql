-- REVIEW ONLY: NOT an automatic migration. Apply only to isolated PostgreSQL
-- after schema-owner approval. Do not enable application writes until the
-- preservation/deletion contract, audit events, RLS grants and UAT are reviewed.
BEGIN;
CREATE TABLE jairoads_next.maintenance_milestones (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    maintenance_id bigint NOT NULL REFERENCES jairoads_next.maintenance_records(id) ON DELETE RESTRICT,
    title varchar(160) NOT NULL CHECK (length(btrim(title)) > 0),
    planned_date date NOT NULL,
    completed_date date,
    status varchar(16) NOT NULL DEFAULT 'planned'
        CHECK (status IN ('planned', 'completed', 'cancelled')),
    created_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    updated_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((status = 'completed') = (completed_date IS NOT NULL))
);
CREATE INDEX maintenance_milestones_record_schedule_idx
    ON jairoads_next.maintenance_milestones(maintenance_id, planned_date, id);
ALTER TABLE jairoads_next.maintenance_milestones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jairoads_next.maintenance_milestones FROM PUBLIC;
REVOKE ALL ON SEQUENCE jairoads_next.maintenance_milestones_id_seq FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON jairoads_next.maintenance_milestones FROM anon;
        REVOKE ALL ON SEQUENCE jairoads_next.maintenance_milestones_id_seq FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON jairoads_next.maintenance_milestones FROM authenticated;
        REVOKE ALL ON SEQUENCE jairoads_next.maintenance_milestones_id_seq FROM authenticated;
    END IF;
END $$;
COMMIT;
-- No runtime grants or application mutation endpoint are enabled by this proposal.
-- RESTRICT deliberately prevents silent milestone loss. Review preserved record
-- history and account-retention behavior before granting write access.

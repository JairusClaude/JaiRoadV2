-- Additive active-schema indexes; no data, permissions or constraints change.
-- Small tables verified before application; bounded locks; atomic failure on contention.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
CREATE INDEX IF NOT EXISTS file_deletions_initiated_by_fk_idx ON jairoads_next.file_deletions (initiated_by);
CREATE INDEX IF NOT EXISTS file_deletions_requested_by_fk_idx ON jairoads_next.file_deletions (requested_by);
CREATE INDEX IF NOT EXISTS maintenance_documents_uploaded_by_fk_idx ON jairoads_next.maintenance_documents (uploaded_by);
CREATE INDEX IF NOT EXISTS maintenance_projects_created_by_fk_idx ON jairoads_next.maintenance_projects (created_by);
CREATE INDEX IF NOT EXISTS maintenance_records_created_by_fk_idx ON jairoads_next.maintenance_records (created_by);
CREATE INDEX IF NOT EXISTS media_uploaded_by_fk_idx ON jairoads_next.media (uploaded_by);
CREATE INDEX IF NOT EXISTS road_coverages_created_by_fk_idx ON jairoads_next.road_coverages (created_by);
CREATE INDEX IF NOT EXISTS account_provisioning_engineer_id_fk_idx ON jairoads_security.account_provisioning (engineer_id);
CREATE INDEX IF NOT EXISTS account_provisioning_provisioned_by_fk_idx ON jairoads_security.account_provisioning (provisioned_by);
CREATE INDEX IF NOT EXISTS active_sessions_user_account_id_fk_idx ON jairoads_security.active_sessions (user_account_id);
CREATE INDEX IF NOT EXISTS authentication_events_user_account_id_fk_idx ON jairoads_security.authentication_events (user_account_id);
COMMIT;

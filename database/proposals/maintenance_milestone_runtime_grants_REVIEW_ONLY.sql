-- REVIEW ONLY. Apply after approved milestone table creation, in isolated staging.
-- No browser role or public grant, no DELETE/TRUNCATE. The backend must remain
-- non-owner, and the existing authorization/retention tests must pass.
BEGIN;
GRANT SELECT, INSERT, UPDATE ON jairoads_next.maintenance_milestones TO jairoads_app_runtime;
GRANT USAGE ON SEQUENCE jairoads_next.maintenance_milestones_id_seq TO jairoads_app_runtime;
CREATE POLICY runtime_milestone_read ON jairoads_next.maintenance_milestones
    FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY runtime_milestone_create ON jairoads_next.maintenance_milestones
    FOR INSERT TO jairoads_app_runtime WITH CHECK (true);
CREATE POLICY runtime_milestone_update ON jairoads_next.maintenance_milestones
    FOR UPDATE TO jairoads_app_runtime USING (true) WITH CHECK (true);
COMMIT;

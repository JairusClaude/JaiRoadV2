-- REVIEW PROPOSAL ONLY; NOT AN AUTOMATIC LARAVEL MIGRATION.
-- Owner approval required before any shared PostgreSQL deployment.
-- Intended for PostgreSQL 17 canonical jairoads_next.maintenance_records.
--
-- PROPOSED business rule: a project may have ONE record for each
-- maintenance_year + quarter. The Final Data Dictionary requires project_id
-- and managing_engineer_id NOT NULL, with ON DELETE RESTRICT foreign keys.
-- No records may be detached and no nullable-project design is approved.
-- This ordinary UNIQUE constraint is also recognized by
-- DuplicateMaintenancePeriod::matchesDatabaseConstraint().
--
-- Before deploying, independently check the actual project/year/quarter data
-- for duplicates; if any exist, STOP and obtain a data-owner disposition.
-- Never delete/rewrite records automatically to make this constraint fit.
DO $readiness$
BEGIN
 IF to_regclass('jairoads_next.maintenance_records') IS NULL THEN
    RAISE EXCEPTION 'Missing canonical maintenance_records table';
 END IF;
 IF EXISTS (
   SELECT 1 FROM jairoads_next.maintenance_records
   WHERE project_id IS NOT NULL
   GROUP BY project_id, maintenance_year, quarter
   HAVING count(*) > 1
 ) THEN
    RAISE EXCEPTION 'Existing duplicate project/year/quarter groups require owner review';
 END IF;
END;
$readiness$;

ALTER TABLE jairoads_next.maintenance_records
 ADD CONSTRAINT maintenance_records_project_year_quarter_unique
 UNIQUE (project_id, maintenance_year, quarter);

-- Does not relax the required NOT NULL relationships or RESTRICT foreign keys,
-- and does not replace application validation. Requires separate approval of
-- the proposed quarterly identity rule; it does not authorize project
-- detachment, manager unassignment, or preserve_project_history.php.

-- REVIEW PROPOSAL ONLY; NOT AN AUTOMATIC LARAVEL MIGRATION.
-- Owner approval required before any shared PostgreSQL deployment.
-- Intended for PostgreSQL 17 canonical jairoads_next.maintenance_records.
--
-- A project may have ONE record for each maintenance_year + quarter. A
-- preserved-history record detached from its deleted project has project_id
-- NULL, and must NOT block a different active project's quarter.
-- PostgreSQL's default UNIQUE semantics treat NULLs as DISTINCT; do NOT use
-- NULLS NOT DISTINCT here. This ordinary nonpartial UNIQUE constraint is
-- also recognized by DuplicateMaintenancePeriod::matchesDatabaseConstraint().
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

-- Does not relax current record write rules, change nullable columns or
-- replace application validation. If project_id is still NOT NULL on the
-- target schema, owner should separately approve preserved-history schema
-- work before assuming detached records are available.

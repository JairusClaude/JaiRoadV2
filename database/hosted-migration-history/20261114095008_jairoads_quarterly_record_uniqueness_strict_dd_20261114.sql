SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '15s';
DO $preflight$
BEGIN
  IF current_database() <> 'postgres' OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN
    RAISE EXCEPTION 'Wrong target database or PostgreSQL major version';
  END IF;
  IF to_regclass('jairoads_next.maintenance_records') IS NULL THEN
    RAISE EXCEPTION 'Canonical records missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='jairoads_next.maintenance_records'::regclass AND conname='maintenance_records_project_year_quarter_unique') THEN
    RAISE EXCEPTION 'Quarterly unique constraint already exists; no change applied';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='jairoads_next.maintenance_records'::regclass AND attname IN ('project_id','managing_engineer_id') AND attnotnull AND attnum>0 AND NOT attisdropped) <> 2 THEN
    RAISE EXCEPTION 'Required Final DD relationships are nullable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jairoads_next.maintenance_records
    GROUP BY project_id, maintenance_year, quarter HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION 'Existing duplicate maintenance periods need manual review';
  END IF;
END
$preflight$;
ALTER TABLE jairoads_next.maintenance_records
  ADD CONSTRAINT maintenance_records_project_year_quarter_unique
  UNIQUE (project_id,maintenance_year,quarter);

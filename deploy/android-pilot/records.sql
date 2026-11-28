WITH municipality AS (
    INSERT INTO jairoads_next.lgus (municipality_name, province, region, mayor_first_name, mayor_last_name)
    VALUES ('Pilot Municipality', 'Sample Province', 'Sample Region', 'Sample', 'Mayor')
    RETURNING id
)
INSERT INTO jairoads_next.engineer_lgus (engineer_id, lgu_id)
SELECT current_setting('jairoads.pilot_engineer')::bigint, id FROM municipality;

WITH roads AS (
    INSERT INTO jairoads_next.road_coverages (road_name, lgu_id, kilometers, pavement_type, state_category, geojson, created_by)
    SELECT 'Pilot Road ' || number, lgu_id, 1, 'Concrete', 'Good',
        '{"type":"LineString","coordinates":[[125.95,7.59],[125.96,7.60]]}'::jsonb, engineer_id
    FROM jairoads_next.engineer_lgus CROSS JOIN generate_series(1, 3) number
    RETURNING id, road_name, created_by
), projects AS (
    INSERT INTO jairoads_next.maintenance_projects (project_title, road_coverage_id, created_by)
    SELECT road_name || ' Maintenance', id, current_setting('jairoads.pilot_account')::bigint FROM roads
    RETURNING id, created_by
)
INSERT INTO jairoads_next.maintenance_records (
    project_id, managing_engineer_id, maintenance_year, quarter, start_date, estimated_duration_days, status, created_by
)
SELECT id, current_setting('jairoads.pilot_engineer')::bigint, extract(year FROM current_date),
    'Q' || extract(quarter FROM current_date),
    date_trunc('quarter', current_date)::date, 90, 'Ongoing', created_by
FROM projects;

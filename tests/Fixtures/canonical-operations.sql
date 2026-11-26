-- Used only after PasswordSyncTestCase verifies the named EMPTY loopback database.
ALTER TABLE jairoads_next.engineers
    ADD first_name varchar(100) DEFAULT 'Test',
    ADD middle_name varchar(100), ADD last_name varchar(100) DEFAULT 'Engineer',
    ADD rank varchar(100), ADD position varchar(100), ADD email varchar(255), ADD contact_no varchar(30);
CREATE TABLE jairoads_next.lgus (
    id bigserial PRIMARY KEY, municipality_name varchar(100), province varchar(100), region varchar(100),
    mayor_first_name varchar(100), mayor_middle_name varchar(100), mayor_last_name varchar(100)
);
CREATE TABLE jairoads_next.road_coverages (
    id bigserial PRIMARY KEY, lgu_id bigint NOT NULL REFERENCES jairoads_next.lgus(id) ON DELETE RESTRICT,
    road_name varchar(255), kilometers numeric(10,2), pavement_type varchar(20), state_category varchar(20),
    geojson jsonb, created_by bigint REFERENCES jairoads_next.engineers(id) ON DELETE RESTRICT,
    created_at timestamp, updated_at timestamp
);
CREATE TABLE jairoads_next.maintenance_projects (
    id bigserial PRIMARY KEY, project_title varchar(255), description text,
    road_coverage_id bigint NOT NULL UNIQUE REFERENCES jairoads_next.road_coverages(id) ON DELETE RESTRICT,
    created_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    created_at timestamp, updated_at timestamp
);
CREATE TABLE jairoads_next.maintenance_records (
    id bigserial PRIMARY KEY, project_id bigint NOT NULL REFERENCES jairoads_next.maintenance_projects(id) ON DELETE RESTRICT,
    managing_engineer_id bigint NOT NULL REFERENCES jairoads_next.engineers(id) ON DELETE RESTRICT,
    maintenance_year integer, quarter varchar(2), start_date date, estimated_duration_days integer,
    complete_date date, status varchar(20) CHECK (status IN ('Ongoing','Completed')),
    description text, created_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    created_at timestamp, updated_at timestamp,
    CHECK (status <> 'Completed' OR complete_date IS NOT NULL)
);
CREATE TABLE jairoads_next.monthly_updates (
    id bigserial PRIMARY KEY, maintenance_id bigint NOT NULL REFERENCES jairoads_next.maintenance_records(id) ON DELETE RESTRICT,
    update_month varchar(7), progress_percentage numeric(5,2) CHECK (progress_percentage BETWEEN 0 AND 100),
    summary_of_text_reports text, created_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    created_at timestamp, updated_at timestamp, UNIQUE(maintenance_id, update_month)
);
CREATE TABLE jairoads_next.maintenance_documents (
    id bigserial PRIMARY KEY, maintenance_id bigint NOT NULL REFERENCES jairoads_next.maintenance_records(id) ON DELETE RESTRICT,
    document_title varchar(255), description text, file_name varchar(255), file_path text, file_type varchar(100),
    uploaded_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    uploaded_at timestamp, created_at timestamp, updated_at timestamp
);
CREATE TABLE jairoads_next.media (
    id bigserial PRIMARY KEY, monthly_update_id bigint NOT NULL REFERENCES jairoads_next.monthly_updates(id) ON DELETE RESTRICT,
    file_name varchar(255), file_path text, file_type varchar(100),
    uploaded_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    uploaded_at timestamp, created_at timestamp, updated_at timestamp
);
ALTER TABLE jairoads_next.audit_logs
    ALTER actor_identifier SET NOT NULL,
    ADD FOREIGN KEY (user_id) REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT;
INSERT INTO jairoads_next.lgus(id, municipality_name) VALUES (17, 'Compostela'), (18, 'Nabunturan');
INSERT INTO jairoads_next.engineers(id, engineer_status) VALUES (99, 'Active');

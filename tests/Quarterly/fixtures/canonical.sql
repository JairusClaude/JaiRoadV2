-- Frozen test-only schema from source b2f041d, canonical baseline read as text.
-- Load only through PostgresTestSchema into an empty guarded disposable PostgreSQL 17 database.

CREATE SCHEMA jairoads_next;

CREATE TABLE jairoads_next."lgus" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "municipality_name" character varying(100) NOT NULL,
  "province" character varying(100) NOT NULL,
  "region" character varying(100) NOT NULL,
  "mayor_first_name" character varying(100) NOT NULL,
  "mayor_middle_name" character varying(100),
  "mayor_last_name" character varying(100) NOT NULL,
  CONSTRAINT "lgus_pkey" PRIMARY KEY (id)
);

CREATE TABLE jairoads_next."engineers" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "first_name" character varying(100) NOT NULL,
  "middle_name" character varying(100),
  "last_name" character varying(100) NOT NULL,
  "contact_no" character varying(30),
  "rank" character varying(100) NOT NULL,
  "engineer_status" character varying(20) DEFAULT 'Active'::character varying NOT NULL,
  CONSTRAINT "engineers_pkey" PRIMARY KEY (id),
  CONSTRAINT "engineers_status_ck" CHECK (((engineer_status)::text = ANY ((ARRAY['Active'::character varying, 'Retired'::character varying])::text[])))
);

CREATE TABLE jairoads_next."engineer_lgus" (
  "engineer_id" bigint NOT NULL,
  "lgu_id" bigint NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  CONSTRAINT "engineer_lgus_pkey" PRIMARY KEY (engineer_id, lgu_id)
);

CREATE TABLE jairoads_next."user_accounts" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "username" character varying(100) NOT NULL,
  "email" character varying(255) NOT NULL,
  "password" character varying(255) NOT NULL,
  "account_type" character varying(20) NOT NULL,
  "engineer_id" bigint,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "user_accounts_email_key" UNIQUE (email),
  CONSTRAINT "user_accounts_engineer_id_key" UNIQUE (engineer_id),
  CONSTRAINT "user_accounts_pkey" PRIMARY KEY (id),
  CONSTRAINT "user_accounts_role_ck" CHECK (((account_type)::text = ANY ((ARRAY['SuperAdmin'::character varying, 'Admin'::character varying, 'Engineer'::character varying, 'Viewer'::character varying])::text[]))),
  CONSTRAINT "user_accounts_username_key" UNIQUE (username)
);

CREATE TABLE jairoads_next."road_coverages" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "road_name" character varying(255) NOT NULL,
  "lgu_id" bigint NOT NULL,
  "kilometers" numeric(10,2) NOT NULL,
  "pavement_type" character varying(20) NOT NULL,
  "state_category" character varying(20) NOT NULL,
  "geojson" jsonb NOT NULL,
  "created_by" bigint NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "road_coverage_kilometers_ck" CHECK ((kilometers >= (0)::numeric)),
  CONSTRAINT "road_coverages_pkey" PRIMARY KEY (id),
  CONSTRAINT "road_geojson_object_ck" CHECK ((jsonb_typeof(geojson) = 'object'::text)),
  CONSTRAINT "road_pavement_ck" CHECK (((pavement_type)::text = ANY ((ARRAY['Concrete'::character varying, 'Asphalt'::character varying, 'Gravel'::character varying, 'Earth'::character varying])::text[]))),
  CONSTRAINT "road_state_ck" CHECK (((state_category)::text = ANY ((ARRAY['Good'::character varying, 'Fair'::character varying, 'Bad'::character varying])::text[])))
);

CREATE TABLE jairoads_next."maintenance_projects" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "project_title" character varying(255) NOT NULL,
  "road_coverage_id" bigint NOT NULL,
  "description" text,
  "created_by" bigint NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "maintenance_projects_pkey" PRIMARY KEY (id),
  CONSTRAINT "maintenance_projects_road_coverage_id_key" UNIQUE (road_coverage_id)
);

CREATE TABLE jairoads_next."maintenance_records" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "project_id" bigint NOT NULL,
  "managing_engineer_id" bigint NOT NULL,
  "maintenance_year" smallint NOT NULL,
  "quarter" character varying(2) NOT NULL,
  "start_date" date NOT NULL,
  "estimated_duration_days" integer NOT NULL,
  "complete_date" date,
  "status" character varying(20) NOT NULL,
  "description" text,
  "created_by" bigint NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "maintenance_completion_ck" CHECK (((((status)::text = 'Ongoing'::text) AND (complete_date IS NULL)) OR (((status)::text = 'Completed'::text) AND (complete_date IS NOT NULL) AND (complete_date >= start_date)))),
  CONSTRAINT "maintenance_duration_ck" CHECK ((estimated_duration_days > 0)),
  CONSTRAINT "maintenance_quarter_ck" CHECK (((quarter)::text = ANY ((ARRAY['Q1'::character varying, 'Q2'::character varying, 'Q3'::character varying, 'Q4'::character varying])::text[]))),
  CONSTRAINT "maintenance_records_pkey" PRIMARY KEY (id),
  CONSTRAINT "maintenance_status_ck" CHECK (((status)::text = ANY ((ARRAY['Ongoing'::character varying, 'Completed'::character varying])::text[])))
);

CREATE TABLE jairoads_next."monthly_updates" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "maintenance_id" bigint NOT NULL,
  "update_month" character varying(7) NOT NULL,
  "progress_percentage" numeric(5,2) NOT NULL,
  "summary_of_text_reports" text,
  "created_by" bigint NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "monthly_month_ck" CHECK (((update_month)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)),
  CONSTRAINT "monthly_progress_ck" CHECK (((progress_percentage >= (0)::numeric) AND (progress_percentage <= (100)::numeric))),
  CONSTRAINT "monthly_updates_maintenance_id_update_month_key" UNIQUE (maintenance_id, update_month),
  CONSTRAINT "monthly_updates_pkey" PRIMARY KEY (id)
);

CREATE TABLE jairoads_next."maintenance_documents" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "maintenance_id" bigint NOT NULL,
  "document_title" character varying(255) NOT NULL,
  "description" text,
  "file_name" character varying(255) NOT NULL,
  "file_path" character varying(500) NOT NULL,
  "uploaded_by" bigint NOT NULL,
  "uploaded_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "maintenance_documents_pkey" PRIMARY KEY (id)
);

CREATE TABLE jairoads_next."media" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "monthly_update_id" bigint NOT NULL,
  "file_name" character varying(255) NOT NULL,
  "file_path" character varying(500) NOT NULL,
  "file_type" character varying(100) NOT NULL,
  "uploaded_by" bigint NOT NULL,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "media_pkey" PRIMARY KEY (id),
  CONSTRAINT "media_type_ck" CHECK (((file_type)::text = ANY ((ARRAY['image/jpeg'::character varying, 'image/png'::character varying, 'image/webp'::character varying, 'video/mp4'::character varying, 'video/webm'::character varying])::text[])))
);

CREATE TABLE jairoads_next."audit_logs" (
  "id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  "user_id" bigint NOT NULL,
  "actor_identifier" character varying(255) NOT NULL,
  "action" character varying(50) NOT NULL,
  "entity_type" character varying(100) NOT NULL,
  "entity_id" bigint,
  "description" text NOT NULL,
  "old_value" jsonb,
  "new_value" jsonb,
  "recipient_user_id" bigint,
  "notification_message" text,
  "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY (id)
);

ALTER TABLE jairoads_next."engineer_lgus" ADD CONSTRAINT "engineer_lgus_engineer_id_fkey" FOREIGN KEY (engineer_id) REFERENCES jairoads_next.engineers(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."engineer_lgus" ADD CONSTRAINT "engineer_lgus_lgu_id_fkey" FOREIGN KEY (lgu_id) REFERENCES jairoads_next.lgus(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."user_accounts" ADD CONSTRAINT "user_accounts_engineer_id_fkey" FOREIGN KEY (engineer_id) REFERENCES jairoads_next.engineers(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."road_coverages" ADD CONSTRAINT "road_coverages_created_by_fkey" FOREIGN KEY (created_by) REFERENCES jairoads_next.engineers(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."road_coverages" ADD CONSTRAINT "road_coverages_lgu_id_fkey" FOREIGN KEY (lgu_id) REFERENCES jairoads_next.lgus(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."maintenance_projects" ADD CONSTRAINT "maintenance_projects_created_by_fkey" FOREIGN KEY (created_by) REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."maintenance_projects" ADD CONSTRAINT "maintenance_projects_road_coverage_id_fkey" FOREIGN KEY (road_coverage_id) REFERENCES jairoads_next.road_coverages(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."maintenance_records" ADD CONSTRAINT "maintenance_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."maintenance_records" ADD CONSTRAINT "maintenance_records_managing_engineer_id_fkey" FOREIGN KEY (managing_engineer_id) REFERENCES jairoads_next.engineers(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."maintenance_records" ADD CONSTRAINT "maintenance_records_project_id_fkey" FOREIGN KEY (project_id) REFERENCES jairoads_next.maintenance_projects(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."monthly_updates" ADD CONSTRAINT "monthly_updates_created_by_fkey" FOREIGN KEY (created_by) REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."monthly_updates" ADD CONSTRAINT "monthly_updates_maintenance_id_fkey" FOREIGN KEY (maintenance_id) REFERENCES jairoads_next.maintenance_records(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."maintenance_documents" ADD CONSTRAINT "maintenance_documents_maintenance_id_fkey" FOREIGN KEY (maintenance_id) REFERENCES jairoads_next.maintenance_records(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."maintenance_documents" ADD CONSTRAINT "maintenance_documents_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."media" ADD CONSTRAINT "media_monthly_update_id_fkey" FOREIGN KEY (monthly_update_id) REFERENCES jairoads_next.monthly_updates(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."media" ADD CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."audit_logs" ADD CONSTRAINT "audit_logs_recipient_user_id_fkey" FOREIGN KEY (recipient_user_id) REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT;

ALTER TABLE jairoads_next."audit_logs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."engineer_lgus" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."engineers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."lgus" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."maintenance_documents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."maintenance_projects" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."maintenance_records" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."media" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."monthly_updates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."road_coverages" ENABLE ROW LEVEL SECURITY;

ALTER TABLE jairoads_next."user_accounts" ENABLE ROW LEVEL SECURITY;

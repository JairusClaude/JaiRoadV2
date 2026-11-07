-- REVIEW PROPOSAL ONLY. Never automatically loaded by migrations or application startup.
-- Verified against the canonical tables in official Supabase PostgreSQL 17.6;
-- owner approval, real restricted app role, and reviewed account transition remain mandatory.
-- Schema owner must approve runtime-role grants and transition evidence before deployment.
-- No historical rows are inferred/backfilled. Existing canonical tables are unchanged.
CREATE SCHEMA jairoads_security;
REVOKE ALL ON SCHEMA jairoads_security FROM PUBLIC;

CREATE TABLE jairoads_security.account_provisioning (
    user_account_id bigint PRIMARY KEY REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    provisioned_by bigint NOT NULL REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT,
    provisioner_role varchar(20) NOT NULL CHECK (provisioner_role IN ('Admin', 'SuperAdmin')),
    provisioned_role varchar(20) NOT NULL CHECK (provisioned_role IN ('Admin', 'Engineer', 'Viewer')),
    engineer_id bigint NOT NULL REFERENCES jairoads_next.engineers(id) ON DELETE RESTRICT,
    provisioned_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    method varchar(30) NOT NULL CHECK (method IN ('administrator', 'reviewed_transition')),
    review_reference text,
    CHECK (user_account_id <> provisioned_by),
    CHECK ((method = 'administrator' AND review_reference IS NULL)
        OR (method = 'reviewed_transition' AND length(btrim(review_reference)) BETWEEN 8 AND 500))
);
ALTER TABLE jairoads_security.account_provisioning ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jairoads_security.account_provisioning FROM PUBLIC;
-- Supabase API roles do not need provenance access, even if other default
-- privileges or schema grants are later modified. This is defense in depth,
-- not a substitute for keeping jairoads_security out of exposed API schemas.
DO $api_acl$
DECLARE api_role text;
BEGIN
    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
            EXECUTE format('REVOKE ALL ON SCHEMA jairoads_security FROM %I', api_role);
            EXECUTE format('REVOKE ALL ON jairoads_security.account_provisioning FROM %I', api_role);
        END IF;
    END LOOP;
END;
$api_acl$;

CREATE FUNCTION jairoads_security.protect_provisioning() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE target record; actor record;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Provisioning evidence is immutable' USING ERRCODE = '42501';
    END IF;
    SELECT a.*, e.engineer_status INTO target
      FROM jairoads_next.user_accounts a
      JOIN jairoads_next.engineers e ON e.id = a.engineer_id
      WHERE a.id = NEW.user_account_id;
    IF NOT FOUND OR NOT target.is_active OR target.engineer_status <> 'Active'
       OR target.engineer_id <> NEW.engineer_id OR target.account_type <> NEW.provisioned_role
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.dd_user_account_id = target.id
                       AND lower(u.email) = lower(target.email) AND u.password = target.password) THEN
        RAISE EXCEPTION 'Invalid provisioned identity' USING ERRCODE = '23514';
    END IF;
    SELECT a.*, e.engineer_status INTO actor
      FROM jairoads_next.user_accounts a LEFT JOIN jairoads_next.engineers e ON e.id = a.engineer_id
      WHERE a.id = NEW.provisioned_by;
    IF NOT FOUND OR NOT actor.is_active OR actor.account_type <> NEW.provisioner_role
       OR actor.account_type NOT IN ('Admin', 'SuperAdmin')
       OR (actor.engineer_id IS NOT NULL AND actor.engineer_status IS DISTINCT FROM 'Active')
       OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.dd_user_account_id = actor.id
                       AND lower(u.email) = lower(actor.email) AND u.password = actor.password)
       OR (actor.account_type = 'Admin' AND (actor.engineer_id IS NULL OR NOT EXISTS (
           SELECT 1 FROM jairoads_security.account_provisioning p WHERE p.user_account_id = actor.id
             AND p.provisioned_role = 'Admin' AND p.engineer_id = actor.engineer_id))) THEN
        RAISE EXCEPTION 'Invalid provisioning administrator' USING ERRCODE = '23514';
    END IF;
    -- Callers cannot falsify a historical creation timestamp. A reviewed transition
    -- records the review time; it does not assert an unknown original creation time.
    NEW.provisioned_at := statement_timestamp();
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION jairoads_security.protect_provisioning() FROM PUBLIC;
CREATE TRIGGER immutable_provisioning BEFORE INSERT OR UPDATE OR DELETE
ON jairoads_security.account_provisioning FOR EACH ROW
EXECUTE FUNCTION jairoads_security.protect_provisioning();

CREATE FUNCTION jairoads_security.reject_provisioning_truncate() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
    RAISE EXCEPTION 'Provisioning evidence is immutable' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION jairoads_security.reject_provisioning_truncate() FROM PUBLIC;
CREATE TRIGGER immutable_provisioning_truncate BEFORE TRUNCATE
ON jairoads_security.account_provisioning FOR EACH STATEMENT
EXECUTE FUNCTION jairoads_security.reject_provisioning_truncate();

-- No anon/authenticated/service-role grants, Data API exposure, SECURITY DEFINER,
-- automatic backfill, role creation or changes to canonical migrations/models.
-- Owner-only rehearsal works as table owner. Before deployment the schema owner
-- must grant the actual Laravel DB role USAGE + SELECT + INSERT with a targeted
-- RLS policy (not PUBLIC); never UPDATE, DELETE, TRUNCATE or schema ownership.
-- reviewed_transition inserts are trusted-operator only operational procedures;
-- the application's sole writer always supplies method='administrator'.

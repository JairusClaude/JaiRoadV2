-- Synthetic-only data for a freshly created disposable PostgreSQL 17 scratch DB.
-- Never run against official Supabase.
CREATE TABLE public.users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email varchar(255) NOT NULL UNIQUE,
    password varchar(255) NOT NULL,
    dd_user_account_id bigint UNIQUE REFERENCES jairoads_next.user_accounts(id)
);
INSERT INTO jairoads_next.engineers (first_name,last_name,rank)
VALUES ('Synthetic','Admin Profile','Engineer'),('Synthetic','Writer Profile','Engineer');
INSERT INTO jairoads_next.user_accounts
(username,email,password,account_type,engineer_id,is_active)
VALUES
('staging_root','staging.root@example.invalid','not-a-real-hash','SuperAdmin',NULL,true),
('staging_admin','staging.admin@example.invalid','not-a-real-hash','Admin',1,true),
('staging_engineer','staging.eng@example.invalid','not-a-real-hash','Engineer',2,true);
INSERT INTO public.users (email,password,dd_user_account_id)
SELECT email,password,id FROM jairoads_next.user_accounts;
INSERT INTO jairoads_next.audit_logs
(user_id,actor_identifier,action,entity_type,entity_id,description)
VALUES (1,'synthetic-staging-root','CREATE','UserAccount',2,'Disposable rehearsal event');

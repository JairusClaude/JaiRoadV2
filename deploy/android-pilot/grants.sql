-- For the isolated Android pilot database only.
GRANT USAGE ON SCHEMA public, jairoads_next, jairoads_security TO jairoads_pilot_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public, jairoads_next TO jairoads_pilot_app;
GRANT SELECT, UPDATE ON public.users TO jairoads_pilot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passkeys, public.password_reset_tokens TO jairoads_pilot_app;

DO $$
DECLARE table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'lgus', 'engineers', 'engineer_lgus', 'user_accounts', 'road_coverages',
        'maintenance_projects', 'maintenance_records', 'maintenance_documents', 'media'
    ] LOOP
        EXECUTE format('GRANT SELECT ON jairoads_next.%I TO jairoads_pilot_app', table_name);
        EXECUTE format('CREATE POLICY pilot_read ON jairoads_next.%I FOR SELECT TO jairoads_pilot_app USING (true)', table_name);
    END LOOP;

    -- Row locking during report submission requires UPDATE privilege.
    -- Allow locking existing rows while disallowing the resulting writes.
    FOREACH table_name IN ARRAY ARRAY[
        'engineers', 'user_accounts', 'maintenance_projects', 'maintenance_records'
    ] LOOP
        EXECUTE format('GRANT UPDATE (id) ON jairoads_next.%I TO jairoads_pilot_app', table_name);
        EXECUTE format(
            'CREATE POLICY pilot_lock ON jairoads_next.%I FOR UPDATE TO jairoads_pilot_app USING (true) WITH CHECK (false)',
            table_name
        );
    END LOOP;
END
$$;

GRANT SELECT, INSERT ON
    jairoads_next.monthly_updates, jairoads_next.monthly_submission_receipts,
    jairoads_next.audit_logs, jairoads_next.audit_notification_recipients
TO jairoads_pilot_app;

CREATE POLICY pilot_read ON jairoads_next.monthly_updates FOR SELECT TO jairoads_pilot_app USING (true);
CREATE POLICY pilot_insert ON jairoads_next.monthly_updates FOR INSERT TO jairoads_pilot_app WITH CHECK (true);
CREATE POLICY pilot_read ON jairoads_next.monthly_submission_receipts FOR SELECT TO jairoads_pilot_app USING (true);
CREATE POLICY pilot_insert ON jairoads_next.monthly_submission_receipts FOR INSERT TO jairoads_pilot_app WITH CHECK (true);
CREATE POLICY pilot_read ON jairoads_next.audit_logs FOR SELECT TO jairoads_pilot_app USING (true);
CREATE POLICY pilot_insert ON jairoads_next.audit_logs FOR INSERT TO jairoads_pilot_app WITH CHECK (true);
CREATE POLICY pilot_read ON jairoads_next.audit_notification_recipients FOR SELECT TO jairoads_pilot_app USING (true);
CREATE POLICY pilot_insert ON jairoads_next.audit_notification_recipients FOR INSERT TO jairoads_pilot_app WITH CHECK (true);

GRANT SELECT ON jairoads_security.account_provisioning TO jairoads_pilot_app;
CREATE POLICY pilot_read ON jairoads_security.account_provisioning FOR SELECT TO jairoads_pilot_app USING (true);

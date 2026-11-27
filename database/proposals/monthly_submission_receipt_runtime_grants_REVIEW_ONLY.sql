-- REVIEW ONLY: separate schema-owner approval; backend only.
BEGIN;
GRANT SELECT, INSERT ON jairoads_next.monthly_submission_receipts TO jairoads_app_runtime;
CREATE POLICY runtime_receipt_read ON jairoads_next.monthly_submission_receipts
    FOR SELECT TO jairoads_app_runtime USING (true);
CREATE POLICY runtime_receipt_create ON jairoads_next.monthly_submission_receipts
    FOR INSERT TO jairoads_app_runtime WITH CHECK (true);
COMMIT;

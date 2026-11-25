-- Run once as the database owner, after reviewing with the JaiROADS team.
-- No existing application tables or data are altered.
BEGIN;
CREATE TABLE IF NOT EXISTS public.jairoads_password_recovery_requests (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id bigint NOT NULL,
    login_id bigint NOT NULL,
    state varchar(16) NOT NULL CHECK (state IN ('pending','issued','consumed','locked','invalidated')),
    attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    requested_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    approved_by bigint,
    approved_at timestamptz,
    consumed_at timestamptz,
    code_digest char(64),
    credential_digest char(64),
    CHECK (state <> 'issued' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND code_digest IS NOT NULL AND credential_digest IS NOT NULL)),
    CHECK (state NOT IN ('consumed','locked','invalidated') OR (code_digest IS NULL AND credential_digest IS NULL))
);
CREATE INDEX IF NOT EXISTS jr_recovery_account_idx ON public.jairoads_password_recovery_requests (account_id, state, expires_at);
CREATE INDEX IF NOT EXISTS jr_recovery_pending_idx ON public.jairoads_password_recovery_requests (state, expires_at, requested_at);
ALTER TABLE public.jairoads_password_recovery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jairoads_password_recovery_requests FROM PUBLIC;
-- If using Supabase, do not expose this table through the public API.
-- A dedicated server-only DB role needs SELECT, INSERT, UPDATE and USAGE on the identity sequence,
-- and an explicit RLS policy for that role if it is not the owner / cannot bypass RLS.
-- Do not grant these permissions to anon or authenticated API roles.
COMMIT;

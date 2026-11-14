-- ALREADY APPLIED to official Supabase project aeaaxwyytsagbacysvvx.
-- Hosted migration version: 20261114113439
-- Hosted migration name: jairoads_audit_actor_history_index_20261114
-- This file is a non-replayable review copy, NOT a new deployment instruction.
-- No canonical row, constraint, privilege, RLS policy, or audit trigger was changed.
CREATE INDEX IF NOT EXISTS audit_logs_user_id_created_at_id_idx ON jairoads_next.audit_logs USING btree (user_id, created_at DESC, id DESC);

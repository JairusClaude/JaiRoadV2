# Hosted Supabase migration history — audit copies, not a deployment plan

The seven SQL files record SQL already applied in the official Supabase project. The original six were retrieved read-only from Supabase migration history on 2026-11-14; the seventh was applied through the connected Supabase migration action on the same date and immediately catalog-verified. They are **non-replayable audit copies**, not a fresh migration queue.

Official project: `aeaaxwyytsagbacysvvx` (PostgreSQL 17); canonical business schema: `jairoads_next`. Names retain Supabase's original version and migration identifiers. **Do not rerun these files against production, invoke as Laravel migrations, or enable automatic replay.** Creating a separate staging baseline and deciding migration order require review and independently provisioned test identities.

The sixth migration originally created `jairoads_app_runtime` as **NOLOGIN**. The owner subsequently set a private password and enabled LOGIN outside migration history. **No database credentials or passwords are stored in these files.** Reproducing an environment requires its own private role credential, connectivity and RLS/HTTP acceptance tests.

This is a review-only source archive. No SQL was executed to apply/reapply migrations while creating these GitHub files.

The seventh migration `20261114113439_jairoads_audit_actor_history_index_20261114.sql` adds the non-unique btree index `jairoads_next.audit_logs_user_id_created_at_id_idx` on `audit_logs (user_id, created_at DESC, id DESC)`. It addresses the AuditLog actor foreign-key indexing advisory and supports history queries without changing canonical rows, permissions or constraints. At verification, the database still contained 7 canonical UserAccounts and 119 AuditLog records, and both immutable AuditLog guards were active. Do **not** reapply it automatically; the official hosted migration history already contains version `20261114113439`.

# Hosted Supabase migration history — audit copies, not a deployment plan

The six SQL files are exact SQL statements retrieved read-only from the official Supabase `supabase_migrations.schema_migrations` on 2026-11-14. They document **already-applied** migrations and must not be treated as a fresh migration queue.

Official project: `aeaaxwyytsagbacysvvx` (PostgreSQL 17); canonical business schema: `jairoads_next`. Names retain Supabase's original version and migration identifiers. **Do not rerun these files against production, invoke as Laravel migrations, or enable automatic replay.** Creating a separate staging baseline and deciding migration order require review and independently provisioned test identities.

The sixth migration originally created `jairoads_app_runtime` as **NOLOGIN**. The owner subsequently set a private password and enabled LOGIN outside migration history. **No database credentials or passwords are stored in these files.** Reproducing an environment requires its own private role credential, connectivity and RLS/HTTP acceptance tests.

This is a review-only source archive. No SQL was executed to apply/reapply migrations while creating these GitHub files.

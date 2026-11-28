-- This workflow runs only on its own disposable PostgreSQL database.
DO $$
BEGIN
  IF current_database() <> 'jairoads_scratch_unified_browser' THEN
    RAISE EXCEPTION 'Refusing non-disposable database';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jairoads_app_runtime') THEN CREATE ROLE jairoads_app_runtime; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
END
$$;

-- Expand the identity link while both application releases may be live.
-- No account, password, audit record, policy or existing constraint is removed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
LOCK TABLE public.users IN ACCESS EXCLUSIVE MODE;
DO $check$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='dd_user_account_id' AND data_type='bigint')
       OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='canonical_user_account_id')
       OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname IN ('users_dd_user_account_id_fk','users_dd_user_account_id_unique') AND convalidated) <> 2
       OR EXISTS (SELECT 1 FROM public.users u LEFT JOIN jairoads_next.user_accounts a ON a.id=u.dd_user_account_id WHERE u.dd_user_account_id IS NOT NULL AND a.id IS NULL)
    THEN RAISE EXCEPTION 'Unexpected login schema; abort expansion'; END IF;
END $check$;
ALTER TABLE public.users ADD COLUMN canonical_user_account_id bigint;
UPDATE public.users SET canonical_user_account_id=dd_user_account_id WHERE dd_user_account_id IS NOT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_canonical_user_account_id_fk FOREIGN KEY (canonical_user_account_id) REFERENCES jairoads_next.user_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.users ADD CONSTRAINT users_canonical_user_account_id_unique UNIQUE (canonical_user_account_id);
ALTER TABLE public.users ADD CONSTRAINT users_account_link_alias_consistent CHECK (canonical_user_account_id IS NOT DISTINCT FROM dd_user_account_id);
CREATE FUNCTION jairoads_security.sync_account_link_alias() RETURNS trigger LANGUAGE plpgsql SET search_path TO pg_catalog AS $sync$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.canonical_user_account_id IS NULL THEN
            NEW.canonical_user_account_id := NEW.dd_user_account_id;
        ELSIF NEW.dd_user_account_id IS NULL THEN
            NEW.dd_user_account_id := NEW.canonical_user_account_id;
        END IF;
    ELSIF NEW.canonical_user_account_id IS DISTINCT FROM OLD.canonical_user_account_id
          AND NEW.dd_user_account_id IS NOT DISTINCT FROM OLD.dd_user_account_id THEN
        NEW.dd_user_account_id := NEW.canonical_user_account_id;
    ELSIF NEW.dd_user_account_id IS DISTINCT FROM OLD.dd_user_account_id
          AND NEW.canonical_user_account_id IS NOT DISTINCT FROM OLD.canonical_user_account_id THEN
        NEW.canonical_user_account_id := NEW.dd_user_account_id;
    END IF;
    IF NEW.canonical_user_account_id IS DISTINCT FROM NEW.dd_user_account_id THEN
        RAISE EXCEPTION 'Conflicting account identity links' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $sync$;
REVOKE ALL ON FUNCTION jairoads_security.sync_account_link_alias() FROM PUBLIC;
CREATE TRIGGER sync_account_link_alias BEFORE INSERT OR UPDATE OF dd_user_account_id, canonical_user_account_id ON public.users FOR EACH ROW EXECUTE FUNCTION jairoads_security.sync_account_link_alias();

-- Exercise both write directions and the conflict guard using disposable rows,
-- not real login accounts. The same production trigger function is used.
CREATE TEMP TABLE naming_alias_test (dd_user_account_id bigint, canonical_user_account_id bigint) ON COMMIT DROP;
CREATE TRIGGER sync_account_link_alias BEFORE INSERT OR UPDATE ON naming_alias_test FOR EACH ROW EXECUTE FUNCTION jairoads_security.sync_account_link_alias();
DO $verify$
BEGIN
    INSERT INTO naming_alias_test(dd_user_account_id) VALUES (1);
    IF NOT EXISTS (SELECT 1 FROM naming_alias_test WHERE canonical_user_account_id=1 AND dd_user_account_id=1) THEN RAISE EXCEPTION 'Legacy insert failed'; END IF;
    UPDATE naming_alias_test SET canonical_user_account_id=2;
    IF NOT EXISTS (SELECT 1 FROM naming_alias_test WHERE canonical_user_account_id=2 AND dd_user_account_id=2) THEN RAISE EXCEPTION 'Canonical update failed'; END IF;
    UPDATE naming_alias_test SET dd_user_account_id=NULL;
    IF NOT EXISTS (SELECT 1 FROM naming_alias_test WHERE canonical_user_account_id IS NULL AND dd_user_account_id IS NULL) THEN RAISE EXCEPTION 'Legacy unlink failed'; END IF;
    DELETE FROM naming_alias_test;
    INSERT INTO naming_alias_test(canonical_user_account_id) VALUES (3);
    IF NOT EXISTS (SELECT 1 FROM naming_alias_test WHERE canonical_user_account_id=3 AND dd_user_account_id=3) THEN RAISE EXCEPTION 'Canonical insert failed'; END IF;
    BEGIN
        UPDATE naming_alias_test SET dd_user_account_id=4, canonical_user_account_id=5;
        RAISE EXCEPTION 'Conflicting write was not rejected';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    IF EXISTS (SELECT 1 FROM public.users WHERE canonical_user_account_id IS DISTINCT FROM dd_user_account_id)
       OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND conname IN ('users_canonical_user_account_id_fk','users_canonical_user_account_id_unique','users_account_link_alias_consistent') AND convalidated) <> 3
    THEN RAISE EXCEPTION 'Account link verification failed'; END IF;
END $verify$;
COMMIT;

# JaiROADS — free, persistent **local-only** staging

**Cost policy:** no paid Supabase branch, no extra paid Supabase project, no hosted VM, no CI minutes consumed by this setup. It uses **your own existing computer** with Docker Engine/Compose, PHP and Composer. Local CPU, disk, electricity and normal network downloads are not free of resource use, but no new cloud subscription or billable staging service is provisioned.

**State:** opt-in tooling prepared, **not yet executed on an operator's computer**. The assistant cannot control your local Docker daemon from GitHub. It does not perform manual UAT, owner approval or live cutover. Production **NO GO**, tracked in [Issue #19](https://github.com/JairusClaude/JaiRoadV2/issues/19).

## Isolation and safety design

- Only `postgres:17` and the repository's existing Laravel 13/PHP 8.4/Nginx Dockerfile. Docker Compose publishes the **database on 127.0.0.1:55432** and the **app on 127.0.0.1:10015**. Nothing is published on `0.0.0.0`.
- Synthetic database **`jairoads_scratch_staging_app`** on a named **persistent local Docker volume**. Running `stop` retains its data; running `up` again retains it. No official data is copied or restored.
- `scripts/staging/free-local.sh` refuses Docker contexts with remote endpoints (`tcp://` or `ssh://`) and requires a positively guarded localhost `APP_ENV=testing`, `JAIROADS_SCRATCH_APPROVAL=DISPOSABLE_LOCAL_ONLY`, `DB_URL=''`, test database name and PostgreSQL 17.
- The initial fixture uses the existing `tests/Browser/prepare-system.php` (synthetic SuperAdmin/Admin/Engineer/Viewer, fake work records and private *file metadata only*), plus existing **staging-only** RLS grants and reviewed SQL proposals. It refuses to seed a nonempty database.
- A randomly generated secret is stored **only** in `.free-staging/secrets.env` (mode 0600, directory mode 0700), along with fixture metadata in `.free-staging/fixture.json` (mode 0600). **Both `.gitignore` and `.dockerignore` exclude the entire directory.** Never upload these local files, share them or use them as production credentials.
- The browser app uses `jairoads_app_runtime` — non-superuser, `NOBYPASSRLS`, no DDL — on local PostgreSQL. The owner role `postgres` is used **only** for initial synthetic fixture setup on localhost, not for Laravel's runtime DB connection.
- Every Supabase service URL and secret is explicitly unset inside the app container. **Real Supabase Storage downloads/deletions and external SMTP are NOT available.** Map UI behavior may still request public map tiles/providers; use the browser mock tests for controlled no-provider CI. This is **not** a production replica or evidence of live Storage/mail/HTTPS WebAuthn.
- No new workflow or auto-trigger has been configured on this branch; no GitHub Actions or cloud staging minutes are required for local use.

## Prerequisites (all local / existing free tools)

- Local Docker Engine + **Compose v2**, using a **local** context (Docker Desktop or your own Linux Docker host).
- Host PHP **8.4** with `pdo_pgsql`, Composer v2 and project development dependencies (the test fixture classes are in Composer's autoload-dev namespace).
- `openssl`, `curl`, `python3`, `awk`, and an unused localhost TCP port **55432** (database) and **10015** (app).
- Git checkout of this review branch. Do **not** run this script in a production server, hosted runner, cloud Docker context, or a repo with genuine database credentials copied into fixture files.
- If you already have `vendor/`, check it was installed with dev dependencies. Otherwise run `composer install` on your **own machine** (this may fetch public packages using your normal connection, but provisions no paid service).

## Start and verify

```bash
git checkout docs/free-local-staging-no-cloud-cost
composer install --no-interaction --prefer-dist
bash scripts/staging/free-local.sh up
bash scripts/staging/free-local.sh status
bash scripts/staging/free-local.sh smoke
```

Then open **http://127.0.0.1:10015/login** on that computer. The synthetic role emails are in the locally ignored `.free-staging/fixture.json`. The disposable synthetic password from `PostgresTestCase` is `Disposable-Test!123`; it is **not** anyone's real password. Never deploy this sample credential, fixture database or APP_KEY.

The `up` command:
1. Confirms the local Docker daemon, generates ignored on-disk credentials, and starts a persistent PostgreSQL 17 volume.
2. Uses explicit localhost PHP environment overrides to seed the **empty** local fixture, then creates the test-only nonowner runtime account and narrowly retained-history grants. **Important:** broader business policies are intentionally marked `staging_backend_*` and are **not** production policy.
3. Builds the existing Docker application locally (no cloud deploy), connects it only to its synthetic PostgreSQL service, and runs localhost HTTP health/login + five guest authorization checks.

Startup may need Docker image/package downloads; installation/build duration depends on your device. If the fixture bootstrap fails partway through, **do not disable its safety checks or rerun a schema proposal on official Supabase**. Inspect the local logs, and only if you intend to throw away this *synthetic* fixture, use the explicit local destroy command below.

## Retain, inspect or deliberately delete the local staging DB

```bash
# Do not delete data; simply stop local containers:
bash scripts/staging/free-local.sh stop

# Reuse the same PostgreSQL volume and synthetic data:
bash scripts/staging/free-local.sh up

# Check the localhost app and guest denial again:
bash scripts/staging/free-local.sh smoke

# ONLY if you deliberately want to destroy the synthetic local fixture:
bash scripts/staging/free-local.sh destroy CONFIRM_LOCAL_SYNTHETIC_DESTROY
```

`destroy` removes the specifically namespaced local Docker Compose stack/volume and its ignored local secret files. It **does not touch Supabase or other Docker projects**, but will permanently delete this synthetic staging database. No script action targets a nonlocal database or the official Supabase project.

## What this advances — and what it does not

This is a **zero-new-cloud-cost option** for local persistence, role/privilege rehearsal, repeatable HTTP smoke and **human practice with test-only users**. It is a stepping stone toward QA-01–QA-25 and Task 13; the authorized team still needs to execute and record genuine manual UAT using the [UAT template](../qa/uat-execution-template.md).

It does **not** validate:
- Real owner-approved Admin-person-to-Engineer profile linkage or actual SuperAdmin recovery.
- Real external Storage credentials, real files/deletion recovery, SMTP delivery, HTTPS WebAuthn relying-party origin, or map-provider limits and CORS.
- Real production permissions and secure environment-specific deployment/backup/recovery.
- Human signoff from the Data Dictionary, schema owner, testers, application owner or release owner.

**Release status remains NO GO.** Any live migration or deployment must be a separately approved change, not the result of launching this local staging project.

<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;

/** Test fixtures only. No migration classes, migration commands, or shared databases. */
final class PostgresTestSchema
{
    private static bool $initialized = false;

    public static function prepare(): void
    {
        $db = DB::connection();
        if (getenv('JAIROADS_SCRATCH_APPROVAL') !== 'DISPOSABLE_LOCAL_ONLY'
            || ! app()->environment('testing') || getenv('RENDER') !== false
            || $db->getDriverName() !== 'pgsql'
            || ! in_array($db->getConfig('host'), ['127.0.0.1', 'localhost'], true)
            || $db->getConfig('url')
            || ! preg_match('/^jairoads_scratch_[a-z0-9_]+$/', (string) $db->getConfig('database'))) {
            throw new \RuntimeException('Refusing tests: explicit disposable local PostgreSQL configuration required.');
        }
        config(['database.connections.pgsql.sslmode' => 'disable']);
        DB::purge('pgsql');
        $db = DB::connection();
        $server = $db->selectOne("SELECT current_database() AS name, current_setting('server_version_num')::int AS version");
        if ($server->name !== $db->getConfig('database') || $server->version < 170000 || $server->version >= 180000) {
            throw new \RuntimeException('A disposable PostgreSQL 17 database is required.');
        }
        if (self::$initialized) {
            return;
        }
        if ((int) $db->selectOne("SELECT count(*) AS n FROM pg_namespace WHERE nspname='jairoads_next'")->n !== 0
            || (int) $db->selectOne("SELECT count(*) AS n FROM pg_tables WHERE schemaname='public'")->n !== 0) {
            throw new \RuntimeException('Refusing fixtures: a completely empty disposable database is required.');
        }
        $db->transaction(static function () use ($db): void {
            $db->unprepared(file_get_contents(__DIR__.'/fixtures/canonical.sql'));
            $db->unprepared(<<<'SQL'
CREATE TABLE public.users (
 id bigserial PRIMARY KEY, name varchar(255) NOT NULL, email varchar(255) UNIQUE NOT NULL,
 email_verified_at timestamp, password varchar(255) NOT NULL, remember_token varchar(100),
 dd_user_account_id bigint UNIQUE REFERENCES jairoads_next.user_accounts(id), user_account_id bigint,
 two_factor_secret text, two_factor_recovery_codes text, two_factor_confirmed_at timestamp,
 created_at timestamp, updated_at timestamp
);
CREATE TABLE public.password_reset_tokens (email varchar(255) PRIMARY KEY, token varchar(255), created_at timestamp);
CREATE TABLE public.passkeys (
 id bigserial PRIMARY KEY, user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 name varchar(255) NOT NULL, credential_id varchar(255) NOT NULL UNIQUE, credential json NOT NULL,
 last_used_at timestamp, created_at timestamp, updated_at timestamp
);
SQL);
        });
        self::$initialized = true;
    }
}

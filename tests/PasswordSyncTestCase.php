<?php

declare(strict_types=1);

namespace Tests;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/** No RefreshDatabase: fixture DDL is restricted to the named empty local test database. */
abstract class PasswordSyncTestCase extends TestCase
{
    private bool $fixturesReady = false;

    protected function setUp(): void
    {
        parent::setUp();
        if (getenv('JAIROADS_PASSWORD_TESTS') !== '1') {
            throw new \RuntimeException('Requires an explicitly enabled disposable local PostgreSQL instance.');
        }
        if (! app()->environment('testing') || getenv('RENDER') !== false) {
            throw new \RuntimeException('Password regression tests require APP_ENV=testing.');
        }
        $port = getenv('JAIROADS_PASSWORD_TEST_PORT') ?: '55432';
        if (! ctype_digit($port) || (int) $port < 1 || (int) $port > 65535) {
            throw new \RuntimeException('Password-test port must be a local numeric TCP port.');
        }
        config([
            'app.key' => 'base64:'.base64_encode(str_repeat('t', 32)),
            'database.default' => 'password_test',
            'database.connections.password_test' => [
                'driver' => 'pgsql', 'url' => null, 'host' => '127.0.0.1',
                'port' => (int) $port,
                'database' => 'jairoads_password_test', 'username' => 'jairoads_password_test',
                'password' => getenv('JAIROADS_PASSWORD_TEST_PASSWORD') ?: '', 'charset' => 'utf8', 'prefix' => '', 'search_path' => 'public', 'sslmode' => 'disable',
            ],
            'session.driver' => 'array', 'cache.default' => 'array', 'mail.default' => 'array',
            'hashing.bcrypt.rounds' => 4,
        ]);
        Hash::forgetDrivers();
        DB::purge('password_test');
        $target = DB::selectOne("SELECT current_database() AS name, current_user AS username, current_setting('server_version_num')::int AS version");
        if ($target->version < 170000 || $target->version >= 180000 || $target->name !== 'jairoads_password_test' || $target->username !== 'jairoads_password_test'
            || DB::selectOne("SELECT count(*) AS total FROM information_schema.tables WHERE table_schema IN ('public','jairoads_next')")->total != 0) {
            throw new \RuntimeException('Refusing fixture DDL: expected the named empty local password-test database/user.');
        }
        $this->fixturesReady = true;
        DB::unprepared(<<<'SQL'
            CREATE SCHEMA jairoads_next;
            CREATE TABLE public.users (
                id bigserial PRIMARY KEY, name varchar(255) NOT NULL, email varchar(255) UNIQUE NOT NULL,
                password varchar(255) NOT NULL, remember_token varchar(100), email_verified_at timestamp,
                user_account_id bigint, dd_user_account_id bigint, two_factor_secret text,
                two_factor_recovery_codes text, two_factor_confirmed_at timestamp,
                created_at timestamp, updated_at timestamp
            );
            CREATE TABLE public.password_reset_tokens (email varchar(255) PRIMARY KEY, token varchar(255) NOT NULL, created_at timestamp);
            CREATE TABLE public.sessions (id varchar(255) PRIMARY KEY, user_id bigint, ip_address varchar(45), user_agent text, payload text NOT NULL, last_activity integer NOT NULL);
            CREATE TABLE public.passkeys (id bigserial PRIMARY KEY, user_id bigint REFERENCES public.users(id), name varchar(255), credential_id varchar(255) UNIQUE, credential json NOT NULL, last_used_at timestamp, created_at timestamp, updated_at timestamp);
            CREATE TABLE jairoads_next.engineers (id bigint PRIMARY KEY, engineer_status varchar(20) NOT NULL);
            CREATE TABLE jairoads_next.user_accounts (
                id bigserial PRIMARY KEY, username varchar(100) UNIQUE NOT NULL, email varchar(255) UNIQUE NOT NULL,
                password varchar(255) NOT NULL, account_type varchar(20) NOT NULL, is_active boolean NOT NULL,
                engineer_id bigint, created_at timestamp, updated_at timestamp
            );
            CREATE TABLE jairoads_next.engineer_lgus (engineer_id bigint, lgu_id bigint, is_active boolean, PRIMARY KEY(engineer_id,lgu_id));
            CREATE TABLE jairoads_next.audit_logs (
                id bigserial PRIMARY KEY, user_id bigint NOT NULL, actor_identifier varchar(255), action varchar(40),
                entity_type varchar(80), entity_id bigint, description text, old_value jsonb, new_value jsonb,
                recipient_user_id bigint, notification_message text, created_at timestamp
            );
            SQL);
        // Missing/ambiguous-link cases deliberately use fixtures without the production FK/unique link constraint.
        $this->withoutVite();
    }

    protected function tearDown(): void
    {
        if ($this->app && $this->app->bound('db') && config('database.default') === 'password_test') {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            if ($this->fixturesReady) {
                DB::unprepared('DROP SCHEMA IF EXISTS jairoads_next CASCADE; DROP TABLE IF EXISTS public.passkeys, public.sessions, public.password_reset_tokens, public.users');
            }
            DB::purge('password_test');
        }
        parent::tearDown();
    }

    protected function linkedLogin(string $role = 'Admin', bool $active = true, bool $mismatch = false): User
    {
        $hash = Hash::make('old-password');
        $engineerId = $role === 'Engineer' ? 88 : null;
        if ($engineerId !== null) {
            DB::table('jairoads_next.engineers')->insert(['id' => 88, 'engineer_status' => 'Active']);
            DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => 88, 'lgu_id' => 17, 'is_active' => true]);
        }
        DB::table('jairoads_next.user_accounts')->insert([
            'id' => 77, 'username' => 'linked-account', 'email' => 'linked@example.test',
            'password' => $mismatch ? Hash::make('different-old-password') : $hash,
            'account_type' => $role, 'is_active' => $active, 'engineer_id' => $engineerId,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return User::forceCreate([
            'id' => 901, 'name' => 'Linked fixture', 'email' => 'linked@example.test', 'password' => $hash,
            'dd_user_account_id' => 77, 'user_account_id' => null,
            'remember_token' => str_repeat('r', 60), 'email_verified_at' => now(),
        ]);
    }

    protected function assertSynchronized(User $login, string $newPassword): void
    {
        $login->refresh();
        $ddHash = DB::table('jairoads_next.user_accounts')->where('id', $login->getAttribute('dd_user_account_id'))->value('password');
        $this->assertTrue(is_string($ddHash) && hash_equals($login->password, $ddHash));
        $this->assertTrue(Hash::check($newPassword, $login->password));
        $this->assertTrue(Hash::check($newPassword, $ddHash));
        $this->assertFalse(Hash::check('old-password', $login->password));
    }
}

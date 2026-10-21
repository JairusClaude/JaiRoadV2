<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

abstract class PostgresTestCase extends TestCase
{
    private static bool $initialized = false;

    protected function setUp(): void
    {
        parent::setUp();
        $db = DB::connection();
        if (getenv('JAIROADS_SCRATCH_APPROVAL') !== 'DISPOSABLE_LOCAL_ONLY'
            || ! app()->environment('testing') || getenv('RENDER') !== false
            || $db->getDriverName() !== 'pgsql'
            || ! in_array($db->getConfig('host'), ['127.0.0.1', 'localhost'], true)
            || $db->getConfig('url')
            || ! preg_match('/^jairoads_scratch_[a-z0-9_]+$/', (string) $db->getConfig('database'))) {
            throw new \RuntimeException('Refusing tests: explicit disposable local PostgreSQL configuration required.');
        }
        // Only after the local-target guard: this disposable server has no TLS.
        config(['database.connections.pgsql.sslmode' => 'disable']);
        DB::purge('pgsql');
        $db = DB::connection();
        $server = $db->selectOne("SELECT current_database() AS name, current_setting('server_version_num')::int AS version");
        if ($server->name !== $db->getConfig('database') || $server->version < 170000 || $server->version >= 180000) {
            throw new \RuntimeException('A disposable PostgreSQL 17 database is required.');
        }
        if (! self::$initialized) {
            // Use the existing authoritative baseline unchanged. It refuses existing schemas/tables.
            $migration = require database_path('jairoads_fresh_migrations/2026_10_20_220000_create_jairoads_next_baseline_scratch_only.php');
            $migration->up();
            DB::unprepared(<<<'SQL'
CREATE TABLE public.users (
 id bigserial PRIMARY KEY, name varchar(255) NOT NULL, email varchar(255) UNIQUE NOT NULL,
 email_verified_at timestamp, password varchar(255) NOT NULL, remember_token varchar(100),
 dd_user_account_id bigint UNIQUE REFERENCES jairoads_next.user_accounts(id), user_account_id bigint,
 two_factor_secret text, two_factor_recovery_codes text, two_factor_confirmed_at timestamp,
 created_at timestamp, updated_at timestamp
);
CREATE TABLE public.password_reset_tokens (email varchar(255) PRIMARY KEY, token varchar(255), created_at timestamp);
SQL);
            self::$initialized = true;
        }
        DB::beginTransaction();
        $this->withoutVite();
    }

    protected function tearDown(): void
    {
        while (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
        parent::tearDown();
    }

    protected function engineer(string $status = 'Active'): int
    {
        return (int) DB::table('jairoads_next.engineers')->insertGetId([
            'first_name' => 'Test', 'last_name' => 'Engineer', 'rank' => 'Engineer II', 'engineer_status' => $status,
        ]);
    }

    protected function account(string $type = 'Admin', ?int $engineerId = null, bool $active = true): User
    {
        $email = 'fixture-'.bin2hex(random_bytes(8)).'@example.test';
        $hash = Hash::make('Disposable-Test!123');
        $id = DB::table('jairoads_next.user_accounts')->insertGetId([
            'username' => explode('@', $email)[0], 'email' => $email, 'password' => $hash,
            'account_type' => $type, 'engineer_id' => $engineerId, 'is_active' => $active,
        ]);

        return User::forceCreate(['name' => 'Test account', 'email' => $email, 'email_verified_at' => now(),
            'password' => $hash, 'dd_user_account_id' => $id]);
    }

    protected function road(?int $engineer = null): int
    {
        $lgu = DB::table('jairoads_next.lgus')->insertGetId(['municipality_name' => 'Test municipality',
            'province' => 'Test province', 'region' => 'Test region', 'mayor_first_name' => 'Test', 'mayor_last_name' => 'Mayor']);
        $engineer ??= $this->engineer();
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $engineer, 'lgu_id' => $lgu, 'is_active' => true]);

        return (int) DB::table('jairoads_next.road_coverages')->insertGetId(['road_name' => 'Test road', 'lgu_id' => $lgu,
            'kilometers' => 1, 'pavement_type' => 'Concrete', 'state_category' => 'Good', 'created_by' => $engineer,
            'geojson' => '{"type":"LineString","coordinates":[[123,10],[123.1,10.1]]}']);
    }

    /** @return array{user:User, engineer:int, project:int, road:int} */
    protected function fixture(string $type = 'Admin', bool $self = false): array
    {
        $engineer = $this->engineer();
        $user = $this->account($type, ($type === 'Engineer' || $self) ? $engineer : null);
        if ($type !== 'Engineer' && ! $self) {
            $this->account('Engineer', $engineer);
        }
        $road = $this->road($engineer);
        $project = (int) DB::table('jairoads_next.maintenance_projects')->insertGetId(['project_title' => 'Test project',
            'road_coverage_id' => $road, 'created_by' => $user->getAttribute('dd_user_account_id')]);
        $this->actingAs($user);

        return compact('user', 'engineer', 'project', 'road');
    }

    /** @return array<string, int|string|null> */
    protected function recordData(int $project, int $engineer, string $quarter = 'Q1', int $year = 2026): array
    {
        return ['project_id' => $project, 'managing_engineer_id' => $engineer, 'maintenance_year' => $year,
            'quarter' => $quarter, 'start_date' => sprintf('%04d-%02d-01', $year, ((int) $quarter[1] - 1) * 3 + 1),
            'estimated_duration_days' => 5, 'status' => 'Ongoing', 'complete_date' => null, 'description' => null];
    }
}

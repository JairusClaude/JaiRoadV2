<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

abstract class PostgresTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        PostgresTestSchema::prepare();
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

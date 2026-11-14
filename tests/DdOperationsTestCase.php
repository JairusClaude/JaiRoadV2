<?php

declare(strict_types=1);

namespace Tests;

use Illuminate\Support\Facades\DB;

abstract class DdOperationsTestCase extends PasswordSyncTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        DB::unprepared(file_get_contents(base_path('tests/Fixtures/dd-operations.sql')));
    }

    protected function road(int $lguId = 17): int
    {
        return (int) DB::table('jairoads_next.road_coverages')->insertGetId([
            'lgu_id' => $lguId, 'road_name' => 'Fixture road', 'kilometers' => 1,
            'pavement_type' => 'Concrete', 'state_category' => 'Good', 'created_by' => 99,
            'geojson' => '{"type":"LineString","coordinates":[[125.9,7.6],[125.91,7.61]]}',
        ]);
    }

    protected function project(int $accountId, int $lguId = 17): int
    {
        return (int) DB::table('jairoads_next.maintenance_projects')->insertGetId([
            'project_title' => 'Fixture project', 'road_coverage_id' => $this->road($lguId), 'created_by' => $accountId,
        ]);
    }

    protected function record(int $accountId, int $manager = 88, int $lguId = 17): int
    {
        return (int) DB::table('jairoads_next.maintenance_records')->insertGetId([
            'project_id' => $this->project($accountId, $lguId), 'managing_engineer_id' => $manager,
            'maintenance_year' => 2026, 'quarter' => 'Q1', 'start_date' => '2026-01-01',
            'estimated_duration_days' => 90, 'status' => 'Ongoing', 'created_by' => $accountId,
        ]);
    }

    /** @return array<string, mixed> */
    protected function recordPayload(int $recordId): array
    {
        $record = DB::table('jairoads_next.maintenance_records')->find($recordId);

        return [
            'project_id' => $record->project_id, 'managing_engineer_id' => $record->managing_engineer_id,
            'maintenance_year' => 2026, 'quarter' => 'Q1', 'start_date' => '2026-01-01',
            'estimated_duration_days' => 90, 'status' => 'Ongoing', 'description' => 'Updated report',
        ];
    }
}

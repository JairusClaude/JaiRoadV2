<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\DataDictionary\TwiceYearlyMaintenance;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;

final class MaintenanceBehaviorTest extends PostgresTestCase
{
    /** @return iterable<string,array{string}> */
    public static function quarters(): iterable
    {
        foreach (['Q1', 'Q2', 'Q3', 'Q4'] as $quarter) {
            yield $quarter => [$quarter];
        }
    }

    #[DataProvider('quarters')]
    public function test_engineer_can_choose_any_first_quarter_and_reuse_it_next_year(string $quarter): void
    {
        $f = $this->fixture('Engineer');
        foreach ([2026, 2027] as $year) {
            $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], $quarter, $year))->assertRedirect();
            $this->assertDatabaseHas('jairoads_next.maintenance_records', ['project_id' => $f['project'], 'maintenance_year' => $year, 'quarter' => $quarter]);
        }
        $this->assertSame(2, DB::table('jairoads_next.maintenance_records')->count());
        $this->assertSame(2, DB::table('jairoads_next.audit_logs')->where('entity_type', 'MaintenanceRecord')->whereNull('recipient_user_id')->count());
    }

    /** @return iterable<string,array{array<string,mixed>,string}> */
    public static function invalidRecords(): iterable
    {
        yield 'different quarter date' => [['start_date' => '2026-04-01'], 'start_date'];
        yield 'different year date' => [['start_date' => '2027-01-01'], 'start_date'];
        yield 'invalid date' => [['start_date' => '2026-02-30'], 'start_date'];
        yield 'zero duration' => [['estimated_duration_days' => 0], 'estimated_duration_days'];
        yield 'negative duration' => [['estimated_duration_days' => -1], 'estimated_duration_days'];
        yield 'fractional duration' => [['estimated_duration_days' => 1.5], 'estimated_duration_days'];
        yield 'completion missing' => [['status' => 'Completed'], 'complete_date'];
        yield 'ongoing completion set' => [['complete_date' => '2026-01-10'], 'complete_date'];
        yield 'completion before start' => [['status' => 'Completed', 'complete_date' => '2025-12-31'], 'complete_date'];
        yield 'planned status' => [['status' => 'Planned'], 'status'];
        yield 'manager missing' => [['managing_engineer_id' => null], 'managing_engineer_id'];
        yield 'invalid quarter' => [['quarter' => 'Q5'], 'quarter'];
    }

    #[DataProvider('invalidRecords')]
    public function test_invalid_record_never_writes_business_or_audit(array $changes, string $field): void
    {
        $f = $this->fixture();
        $this->postJson('/dd-phase3/ops/records', array_replace($this->recordData($f['project'], $f['engineer']), $changes))
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertSame(0, DB::table('jairoads_next.maintenance_records')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_all_four_distinct_quarters_are_allowed_but_each_duplicate_is_rejected(): void
    {
        $f = $this->fixture('Engineer');
        foreach (['Q4', 'Q1', 'Q2', 'Q3'] as $quarter) {
            $data = $this->recordData($f['project'], $f['engineer'], $quarter);
            $this->postJson('/dd-phase3/ops/records', $data)->assertRedirect();
            $auditCount = DB::table('jairoads_next.audit_logs')->count();
            $this->postJson('/dd-phase3/ops/records', $data)->assertUnprocessable()->assertJsonValidationErrors('quarter');
            $this->assertSame($auditCount, DB::table('jairoads_next.audit_logs')->count());
        }
        $this->assertSame(4, DB::table('jairoads_next.maintenance_records')->count());
        $this->assertSame([], $this->summary($f['project'])['years'][0]['available']);
        $this->assertFalse($this->summary($f['project'])['conflict']);
    }

    public function test_different_projects_can_use_the_same_year_and_quarter(): void
    {
        $first = $this->fixture();
        $second = $this->fixture();
        foreach ([$first, $second] as $f) {
            $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q3'))->assertRedirect();
        }
        $this->assertSame(2, DB::table('jairoads_next.maintenance_records')->where('quarter', 'Q3')->count());
    }

    public function test_mixed_history_is_preserved_and_does_not_block_available_quarters(): void
    {
        $f = $this->fixture();
        foreach (['Q1', 'Q4'] as $quarter) {
            DB::table('jairoads_next.maintenance_records')->insert($this->recordData($f['project'], $f['engineer'], $quarter) + ['created_by' => $f['user']->dd_user_account_id]);
        }
        $history = DB::table('jairoads_next.maintenance_records')->orderBy('id')->get();
        $this->assertFalse($this->summary($f['project'])['conflict']);
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q2'))->assertRedirect();
        $this->assertSame($history->toJson(), DB::table('jairoads_next.maintenance_records')->whereIn('id', $history->pluck('id'))->orderBy('id')->get()->toJson());
    }

    public function test_historical_duplicates_are_flagged_preserved_and_not_duplicated_again(): void
    {
        $f = $this->fixture();
        for ($i = 0; $i < 2; $i++) {
            DB::table('jairoads_next.maintenance_records')->insert($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        }
        $this->assertTrue($this->summary($f['project'])['conflict']);
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertUnprocessable();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q3'))->assertRedirect();
        $this->assertSame(3, DB::table('jairoads_next.maintenance_records')->count());
    }

    public function test_details_expose_existing_and_available_quarters_without_an_enforced_pair(): void
    {
        $f = $this->fixture();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q2'))->assertRedirect();
        $this->get('/dd-phase3/projects?view=show&project='.$f['project'])->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('maintenanceHistory', 1)->where('maintenanceSchedule.years.0.available', ['Q1', 'Q3', 'Q4'])
            ->missing('maintenanceSchedule.pattern')->missing('maintenanceSchedule.next'));
    }

    public function test_duplicate_detection_and_details_use_history_beyond_the_listing_limit(): void
    {
        $f = $this->fixture();
        DB::table('jairoads_next.maintenance_records')->insert($this->recordData($f['project'], $f['engineer'], 'Q2', 1900) + ['created_by' => $f['user']->dd_user_account_id]);
        $rows = [];
        for ($year = 1901; $year <= 2050; $year++) {
            foreach (['Q1', 'Q3'] as $quarter) {
                $rows[] = $this->recordData($f['project'], $f['engineer'], $quarter, $year) + ['created_by' => $f['user']->dd_user_account_id];
            }
        }
        DB::table('jairoads_next.maintenance_records')->insert($rows);
        $this->get('/dd-phase3/projects?view=show&project='.$f['project'])->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->has('records', 300)->has('maintenanceHistory', 301)->where('maintenanceSchedule.conflict', false));
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q2', 1900))->assertUnprocessable();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q4', 2051))->assertRedirect();
        $this->assertSame(302, DB::table('jairoads_next.maintenance_records')->count());
    }

    public function test_ordinary_detail_edits_preserve_project_manager_and_period(): void
    {
        $f = $this->fixture();
        $data = $this->recordData($f['project'], $f['engineer']);
        $this->postJson('/dd-phase3/ops/records', $data)->assertRedirect();
        $id = DB::table('jairoads_next.maintenance_records')->value('id');
        $this->putJson('/dd-phase3/ops/records/'.$id, array_replace($data, ['start_date' => '2026-02-10', 'estimated_duration_days' => 9]))->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'start_date' => '2026-02-10', 'estimated_duration_days' => 9]);
        $this->putJson('/dd-phase3/ops/records/'.$id, $this->recordData($f['project'], $f['engineer'], 'Q3'))->assertUnprocessable()->assertJsonValidationErrors('quarter');
        $this->putJson('/dd-phase3/ops/records/'.$id, array_replace($data, ['managing_engineer_id' => $this->engineer()]))->assertUnprocessable();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'quarter' => 'Q1', 'managing_engineer_id' => $f['engineer']]);
    }

    private function summary(int $project): array
    {
        return app(TwiceYearlyMaintenance::class)->summarize(DB::table('jairoads_next.maintenance_records')->where('project_id', $project)->get());
    }
}

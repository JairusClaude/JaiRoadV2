<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\DataDictionary\TwiceYearlyMaintenance;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia;
use PHPUnit\Framework\Attributes\DataProvider;

final class MaintenanceBehaviorTest extends PostgresTestCase
{
    /** @return iterable<string,array{string,string}> */
    public static function patterns(): iterable
    {
        yield 'Q1 Q3' => ['Q1', 'Q3'];
        yield 'Q2 Q4' => ['Q2', 'Q4'];
    }

    #[DataProvider('patterns')]
    public function test_pattern_repeats_across_years(string $first, string $second): void
    {
        $f = $this->fixture();
        $this->assertSame([], $this->summary($f['project'])['years']);
        foreach ([[2026, $first, 2026, $second], [2026, $second, 2027, $first], [2027, $first, 2027, $second], [2027, $second, 2028, $first]] as [$year, $quarter, $nextYear, $nextQuarter]) {
            $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], $quarter, $year))
                ->assertRedirect('/dd-phase3/projects?view=show&project='.$f['project']);
            $summary = $this->summary($f['project']);
            $this->assertSame(['year' => $nextYear, 'quarter' => $nextQuarter], $summary['next']);
            $this->assertSame([$first, $second], $summary['pattern']);
        }
        $this->assertSame('complete', $summary['years'][0]['state']);
        $this->assertSame('complete', $summary['years'][1]['state']);
        $this->assertSame(4, DB::table('jairoads_next.maintenance_records')->where('project_id', $f['project'])->count());
        $this->assertSame(4, DB::table('jairoads_next.audit_logs')->where('entity_type', 'MaintenanceRecord')->whereNull('recipient_user_id')->count());
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
        yield 'start in second half' => [['quarter' => 'Q3', 'start_date' => '2026-07-01'], 'quarter'];
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

    #[DataProvider('patterns')]
    public function test_duplicate_mixed_pattern_and_third_period_are_rejected(string $first, string $second): void
    {
        $f = $this->fixture();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], $first))->assertRedirect();
        $before = DB::table('jairoads_next.audit_logs')->count();
        foreach (['Q1', 'Q2', 'Q3', 'Q4'] as $quarter) {
            if ($quarter === $second) {
                continue;
            }
            $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], $quarter))
                ->assertUnprocessable()->assertJsonValidationErrors('quarter');
        }
        $this->assertSame($before, DB::table('jairoads_next.audit_logs')->count());
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], $second))->assertRedirect();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], $first === 'Q1' ? 'Q4' : 'Q3'))->assertUnprocessable();
        $this->assertSame(2, DB::table('jairoads_next.maintenance_records')->count());
    }

    public function test_partial_year_and_second_half_without_first_are_distinct(): void
    {
        $f = $this->fixture();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertRedirect();
        $this->assertSame(['Q3'], $this->summary($f['project'])['years'][0]['missing']);
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q3', 2027))->assertUnprocessable();
        $this->assertSame(1, DB::table('jairoads_next.maintenance_records')->count());
    }

    public function test_conflicting_history_is_retained_and_blocks_new_records(): void
    {
        $f = $this->fixture();
        foreach (['Q1', 'Q4'] as $quarter) {
            DB::table('jairoads_next.maintenance_records')->insert($this->recordData($f['project'], $f['engineer'], $quarter) + ['created_by' => $f['user']->dd_user_account_id]);
        }
        $history = DB::table('jairoads_next.maintenance_records')->orderBy('id')->get()->toJson();
        $this->assertTrue($this->summary($f['project'])['conflict']);
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q1', 2027))->assertUnprocessable();
        $this->assertSame($history, DB::table('jairoads_next.maintenance_records')->orderBy('id')->get()->toJson());
    }

    public function test_history_duplicate_is_not_silently_repaired(): void
    {
        $f = $this->fixture();
        for ($i = 0; $i < 2; $i++) {
            DB::table('jairoads_next.maintenance_records')->insert($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        }
        $this->assertTrue($this->summary($f['project'])['conflict']);
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q3'))->assertUnprocessable();
        $this->assertSame(2, DB::table('jairoads_next.maintenance_records')->count());
    }

    public function test_details_expose_complete_schedule_and_next_period(): void
    {
        $f = $this->fixture();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q2'))->assertRedirect();
        $this->get('/dd-phase3/projects?view=show&project='.$f['project'])->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dd-phase3/Operations')->has('maintenanceHistory', 1)
            ->where('maintenanceSchedule.pattern', ['Q2', 'Q4'])
            ->where('maintenanceSchedule.next', ['year' => 2026, 'quarter' => 'Q4']));
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q4'))->assertRedirect();
        $this->get('/dd-phase3/projects?view=show&project='.$f['project'])->assertOk()->assertInertia(fn (AssertableInertia $page) => $page
            ->where('maintenanceSchedule.next', ['year' => 2027, 'quarter' => 'Q2'])
            ->where('maintenanceSchedule.years.0.state', 'complete'));
    }

    public function test_inference_checks_history_beyond_the_general_listing_limit(): void
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
            ->has('records', 300)->has('maintenanceHistory', 301)->where('maintenanceSchedule.conflict', true));
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q1', 2051))->assertUnprocessable();
        $this->assertSame(301, DB::table('jairoads_next.maintenance_records')->count());
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

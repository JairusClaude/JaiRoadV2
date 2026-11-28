<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\Files\FileRecoverySchedule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

final class SuperAdminDashboardDesignTest extends PostgresTestCase
{
    public function test_command_center_shows_observed_recovery_batch_without_claiming_scheduler_activation(): void
    {
        $this->fixture('SuperAdmin');
        config(['cache.default' => 'array', 'jairoads_file_deletion.scheduled_reconciliation' => false]);
        FileRecoverySchedule::recordRun(3, 2, true);
        $this->get('/superadmin-home')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('health.recovery.registration_allowed', false)
            ->where('health.lastRecoveryRun.attempted', 3)
            ->where('health.lastRecoveryRun.completed', 2)
            ->where('health.lastRecoveryRun.pending', 1)
            ->where('health.lastRecoveryRun.budget_reached', true)
            ->where('health.lastRecoveryRun.stale', false)
            ->has('health.lastRecoveryRun.age_seconds')
            ->has('health.lastRecoveryRun.finished_at')
            ->missing('health.lastRecoveryRun.object_path'));
    }

    public function test_intelligence_reports_exact_review_counts_and_does_not_multiply_factors(): void
    {
        $f = $this->fixture('SuperAdmin');
        $this->travelTo(Carbon::parse('2026-11-27 12:00:00', 'Asia/Manila'));
        $account = $f['user']->canonical_user_account_id;
        DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['state_category' => 'Bad']);
        foreach (['Q1', 'Q2'] as $quarter) {
            DB::table('jairoads_next.maintenance_records')->insert(
                $this->recordData($f['project'], $f['engineer'], $quarter) + ['created_by' => $account]
            );
        }
        // Future records should not be reported overdue or missing the current month.
        DB::table('jairoads_next.maintenance_records')->insert(
            $this->recordData($f['project'], $f['engineer'], 'Q1', 2027) + ['created_by' => $account]
        );
        for ($i = 0; $i < 12; $i++) {
            $road = $this->road($f['engineer']);
            DB::table('jairoads_next.road_coverages')->where('id', $road)->update(['state_category' => 'Fair']);
        }

        $this->get('/superadmin-home')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('maintenanceIntelligence.asOf', '2026-11-27')
            ->where('maintenanceIntelligence.noCurrentReport', 2)
            ->where('maintenanceIntelligence.pastEstimate', 2)
            ->where('maintenanceIntelligence.ongoingCount', 3)
            ->where('maintenanceIntelligence.priorityTotal', 13)
            ->has('maintenanceIntelligence.priority', 12)
            ->where('maintenanceIntelligence.priority.0.id', $f['road'])
            ->where('maintenanceIntelligence.priority.0.score', 100)
            ->where('maintenanceIntelligence.priority.0.overdueScore', 25)
            ->where('maintenanceIntelligence.priority.0.reportScore', 15)
            ->where('maintenanceIntelligence.priority.1.score', 30));
    }

    public function test_command_center_shows_real_latest_monthly_progress_without_private_media_fields(): void
    {
        $fixture = $this->fixture('SuperAdmin');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($fixture['project'], $fixture['engineer'])
                + ['created_by' => $fixture['user']->canonical_user_account_id]
        );
        $updateId = (int) DB::table('jairoads_next.monthly_updates')->insertGetId([
            'maintenance_id' => $record,
            'update_month' => '2026-11',
            'progress_percentage' => 22,
            'created_by' => $fixture['user']->canonical_user_account_id,
        ]);

        $this->get('/superadmin-home')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('SuperAdminDashboard/CommandCenter')
            ->has('recentMonthlyUpdates', 1)
            ->where('recentMonthlyUpdates.0.id', $updateId)
            ->where('recentMonthlyUpdates.0.projectTitle', 'Test project')
            ->where('recentMonthlyUpdates.0.period', 'Q1 2026')
            ->where('recentMonthlyUpdates.0.progress', 22)
            ->missing('recentMonthlyUpdates.0.file_path')
            ->missing('recentMonthlyUpdates.0.uploaded_by'));
    }
}

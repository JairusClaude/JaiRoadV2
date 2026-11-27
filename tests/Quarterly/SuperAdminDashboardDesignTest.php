<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\Files\FileRecoverySchedule;
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
            ->has('health.lastRecoveryRun.finished_at')
            ->missing('health.lastRecoveryRun.object_path'));
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

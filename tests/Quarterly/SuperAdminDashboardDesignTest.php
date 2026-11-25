<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

final class SuperAdminDashboardDesignTest extends PostgresTestCase
{
    public function test_command_center_shows_real_latest_monthly_progress_without_private_media_fields(): void
    {
        $fixture = $this->fixture('SuperAdmin');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($fixture['project'], $fixture['engineer'])
                + ['created_by' => $fixture['user']->dd_user_account_id]
        );
        $updateId = (int) DB::table('jairoads_next.monthly_updates')->insertGetId([
            'maintenance_id' => $record,
            'update_month' => '2026-11',
            'progress_percentage' => 22,
            'created_by' => $fixture['user']->dd_user_account_id,
        ]);

        $this->get('/dd-superadmin-landing')->assertOk()->assertInertia(fn (Assert $page) => $page
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

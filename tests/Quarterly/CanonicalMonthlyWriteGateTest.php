<?php

declare(strict_types=1);

use App\Services\MonthlyUpdates\CanonicalMonthlyWriteGate;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('pauses both canonical monthly updates and media writes while preserving read-only access', function (): void {
    $f = $this->fixture('Admin');
    $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
        $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]
    );
    $update = (int) DB::table('jairoads_next.monthly_updates')->insertGetId([
        'maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 10,
        'created_by' => $f['user']->dd_user_account_id,
    ]);
    config()->set('jairoads_monthly_updates.canonical_writes_enabled', false);
    config()->set('jairoads_monthly_updates.writes_enabled', true);
    expect(app(\App\Services\MonthlyUpdates\MonthlyUpdatesReadiness::class)->canWrite())->toBeFalse();

    expect(CanonicalMonthlyWriteGate::enabled())->toBeFalse();
    $this->get('/dd-phase3/ui/monthly-updates')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('canWrite', false)->has('updates.data', 1));
    $this->get('/dd-phase3/ui/monthly-updates/'.$update)->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('canWrite', false)->where('canUploadMedia', false));
    $this->get('/dd-phase3/ui/monthly-updates/create')->assertStatus(503);
    $this->postJson('/dd-phase3/ui/monthly-updates', [
        'maintenance_id' => $record, 'update_month' => '2026-02', 'progress_percentage' => 20,
    ])->assertStatus(503);
    $this->postJson('/dd-phase3/ops/updates', [
        'maintenance_id' => $record, 'update_month' => '2026-02', 'progress_percentage' => 20,
    ])->assertStatus(503);
    $this->putJson('/dd-phase3/ops/updates/'.$update, [
        'maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 15,
    ])->assertStatus(503);
    $this->postJson('/dd-phase3/ui/monthly-updates/'.$update.'/media', [])->assertStatus(503);
    $this->postJson('/dd-phase3/ops/media', [])->assertStatus(503);
    $this->deleteJson('/dd-phase3/ops/updates/'.$update)->assertStatus(503);
    $this->deleteJson('/dd-phase3/files/media/1')->assertStatus(503);
    expect(DB::table('jairoads_next.monthly_updates')->count())->toBe(1)
        ->and(DB::table('jairoads_next.media')->count())->toBe(0)
        ->and(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
});

<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\Files\FileRecoverySchedule;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

final class FileRecoveryScheduleTest extends PostgresTestCase
{
    public function test_scheduler_fails_closed_without_both_flags_and_a_shared_cache(): void
    {
        Http::fake();
        foreach ([
            [false, false, 'database'],
            [true, false, 'database'],
            [false, true, 'database'],
            [true, true, 'file'],
            [true, true, 'array'],
            [true, true, 'failover'],
        ] as [$deletion, $scheduled, $store]) {
            config([
                'jairoads_file_deletion.operationally_enabled' => $deletion,
                'jairoads_file_deletion.scheduled_reconciliation' => $scheduled,
                'cache.default' => $store,
            ]);
            $schedule = new Schedule;
            FileRecoverySchedule::register($schedule);
            $this->assertCount(0, $schedule->events());
            $this->assertFalse(FileRecoverySchedule::readiness()['registration_allowed']);
        }
        $this->artisan('jairoads:file-recovery-readiness')->assertFailed();
        Http::assertNothingSent();
    }

    public function test_batch_evidence_expires_and_rejects_impossible_counts(): void
    {
        config(['cache.default' => 'array']);
        FileRecoverySchedule::recordRun(3, 2, true, scheduled: true);
        $this->assertSame('scheduled', FileRecoverySchedule::lastRun()['trigger']);
        $this->assertFalse(FileRecoverySchedule::lastRun()['stale']);
        FileRecoverySchedule::recordRun(1, 2, false);
        $this->assertSame(3, FileRecoverySchedule::lastRun()['attempted']);
        $this->travel(16)->minutes();
        $this->assertTrue(FileRecoverySchedule::lastRun()['stale']);
        $this->assertGreaterThanOrEqual(960, FileRecoverySchedule::lastRun()['age_seconds']);
        $this->travel(8)->days();
        $this->assertNull(FileRecoverySchedule::lastRun());
    }

    public function test_batch_evidence_rejects_normalized_invalid_dates_and_future_timestamps(): void
    {
        config(['cache.default' => 'array']);
        $this->travelTo(now()->setDate(2026, 3, 3)->setTime(12, 0)->utc());
        $key = 'jairoads:recovery:last-finished-batch:v1';
        FileRecoverySchedule::recordRun(2, 1, false);
        $evidence = Cache::get($key);
        $this->assertSame('manual', FileRecoverySchedule::lastRun()['trigger']);
        unset($evidence['trigger']);
        Cache::put($key, $evidence);
        $this->assertSame('unknown', FileRecoverySchedule::lastRun()['trigger']);
        foreach (['2026-02-30T12:00:00+00:00', '2026-03-02T24:00:00+00:00', now()->addSecond()->toIso8601String()] as $timestamp) {
            Cache::put($key, array_replace($evidence, ['finished_at' => $timestamp]));
            $this->assertNull(FileRecoverySchedule::lastRun());
        }
        Cache::put($key, array_replace($evidence, ['finished_at' => now()->utc()->format('Y-m-d\TH:i:s\Z')]));
        $this->assertNotNull(FileRecoverySchedule::lastRun());
    }

    public function test_scheduler_registers_only_the_approved_bounded_command_with_locks(): void
    {
        Http::fake();
        config([
            'jairoads_file_deletion.operationally_enabled' => true,
            'jairoads_file_deletion.scheduled_reconciliation' => true,
            'cache.default' => 'database',
        ]);
        $schedule = new Schedule;
        FileRecoverySchedule::register($schedule);
        $this->assertCount(1, $schedule->events());
        $event = $schedule->events()[0];
        $this->assertStringContainsString(FileRecoverySchedule::COMMAND.' --scheduled', $event->command);
        $this->assertSame('*/5 * * * *', $event->expression);
        $this->assertTrue($event->withoutOverlapping);
        $this->assertTrue($event->onOneServer);
        $this->assertSame(30, $event->expiresAt);
        $this->artisan('jairoads:file-recovery-readiness')->assertSuccessful();
        Http::assertNothingSent();
    }
}

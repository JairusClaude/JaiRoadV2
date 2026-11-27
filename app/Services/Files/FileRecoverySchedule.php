<?php

declare(strict_types=1);

namespace App\Services\Files;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Cache;

final class FileRecoverySchedule
{
    public const COMMAND = 'jairoads:resume-file-deletions --limit=20 --budget=240';

    private const RUN_EVIDENCE_KEY = 'jairoads:recovery:last-finished-batch:v1';

    /** @return array{deletion_enabled:bool,schedule_enabled:bool,shared_cache_configured:bool,registration_allowed:bool} */
    public static function readiness(): array
    {
        $deletionEnabled = config('jairoads_file_deletion.operationally_enabled') === true;
        $scheduleEnabled = config('jairoads_file_deletion.scheduled_reconciliation') === true;
        $store = config('cache.default');
        $driver = is_string($store) ? config('cache.stores.'.$store.'.driver') : null;
        $sharedCache = in_array($driver, ['database', 'redis', 'memcached', 'dynamodb'], true);

        return [
            'deletion_enabled' => $deletionEnabled,
            'schedule_enabled' => $scheduleEnabled,
            'shared_cache_configured' => $sharedCache,
            'registration_allowed' => $deletionEnabled && $scheduleEnabled && $sharedCache,
        ];
    }

    /** @return array{finished_at:string,attempted:int,completed:int,pending:int,budget_reached:bool}|null */
    public static function lastRun(): ?array
    {
        try {
            $evidence = Cache::get(self::RUN_EVIDENCE_KEY);
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($evidence)
            || ! is_string($evidence['finished_at'] ?? null)
            || ! is_int($evidence['attempted'] ?? null)
            || ! is_int($evidence['completed'] ?? null)
            || ! is_int($evidence['pending'] ?? null)
            || ! is_bool($evidence['budget_reached'] ?? null)) {
            return null;
        }

        return [
            'finished_at' => $evidence['finished_at'],
            'attempted' => $evidence['attempted'],
            'completed' => $evidence['completed'],
            'pending' => $evidence['pending'],
            'budget_reached' => $evidence['budget_reached'],
        ];
    }

    public static function recordRun(int $attempted, int $completed, bool $budgetReached): void
    {
        try {
            Cache::put(self::RUN_EVIDENCE_KEY, [
                'finished_at' => now()->utc()->toIso8601String(),
                'attempted' => $attempted,
                'completed' => $completed,
                'pending' => $attempted - $completed,
                'budget_reached' => $budgetReached,
            ], now()->addDays(7));
        } catch (\Throwable) {
            // Optional aggregate telemetry must not alter the recovery result.
        }
    }

    public static function register(Schedule $schedule): void
    {
        if (! self::readiness()['registration_allowed']) {
            return;
        }

        $schedule->command(self::COMMAND)->everyFiveMinutes()->withoutOverlapping(30)->onOneServer();
    }
}

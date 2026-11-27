<?php

declare(strict_types=1);

namespace App\Services\Files;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Carbon;
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

    /** @return array{finished_at:string,attempted:int,completed:int,pending:int,budget_reached:bool,age_seconds:int,stale:bool}|null */
    public static function lastRun(): ?array
    {
        try {
            $evidence = Cache::get(self::RUN_EVIDENCE_KEY);
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($evidence)
            || ! is_string($evidence['finished_at'] ?? null)
            || preg_match('/\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:Z|[+-][0-9]{2}:[0-9]{2})\z/', $evidence['finished_at']) !== 1
            || ! is_int($evidence['attempted'] ?? null)
            || ! is_int($evidence['completed'] ?? null)
            || ! is_int($evidence['pending'] ?? null)
            || ! is_bool($evidence['budget_reached'] ?? null)
            || $evidence['attempted'] < 0
            || $evidence['completed'] < 0
            || $evidence['pending'] < 0
            || $evidence['completed'] + $evidence['pending'] !== $evidence['attempted']) {
            return null;
        }

        try {
            $finishedAt = Carbon::parse($evidence['finished_at']);
            $age = (int) $finishedAt->diffInSeconds(now(), false);
        } catch (\Throwable) {
            return null;
        }
        if ($age < 0 || $age > 7 * 24 * 60 * 60) {
            return null;
        }

        return [
            'finished_at' => $evidence['finished_at'],
            'attempted' => $evidence['attempted'],
            'completed' => $evidence['completed'],
            'pending' => $evidence['pending'],
            'budget_reached' => $evidence['budget_reached'],
            'age_seconds' => $age,
            'stale' => $age > 15 * 60,
        ];
    }

    public static function recordRun(int $attempted, int $completed, bool $budgetReached): void
    {
        if ($attempted < 0 || $completed < 0 || $completed > $attempted) {
            return;
        }
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

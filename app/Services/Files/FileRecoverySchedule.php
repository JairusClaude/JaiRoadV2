<?php

declare(strict_types=1);

namespace App\Services\Files;

use Illuminate\Console\Scheduling\Schedule;

final class FileRecoverySchedule
{
    public const COMMAND = 'jairoads:resume-file-deletions --limit=20 --budget=240';

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

    public static function register(Schedule $schedule): void
    {
        if (! self::readiness()['registration_allowed']) {
            return;
        }

        $schedule->command(self::COMMAND)->everyFiveMinutes()->withoutOverlapping(30)->onOneServer();
    }
}

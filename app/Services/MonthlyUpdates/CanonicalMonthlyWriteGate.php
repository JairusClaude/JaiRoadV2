<?php

declare(strict_types=1);

namespace App\Services\MonthlyUpdates;

/**
 * Explicit emergency write switch for both canonical MonthlyUpdate and Media
 * endpoints. This does not change read-only access or the legacy preview module.
 */
final class CanonicalMonthlyWriteGate
{
    public static function enabled(): bool
    {
        return config('jairoads_monthly_updates.canonical_writes_enabled', true) === true;
    }

    public static function enforce(): void
    {
        abort_unless(self::enabled(), 503, 'MonthlyUpdate and Media writes are paused for this environment.');
    }
}

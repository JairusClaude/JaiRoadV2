<?php

declare(strict_types=1);

namespace App\Services;

/** Keep historical audit snapshots immutable while presenting official account names. */
final class AuditActorIdentifier
{
    public static function format(int $accountId, string $username): string
    {
        return 'User Account #'.$accountId.' ('.$username.')';
    }

    public static function display(?string $identifier): ?string
    {
        return $identifier === null ? null : preg_replace('/^DD-UserAccount#/i', 'User Account #', $identifier);
    }

    public static function description(string $description): string
    {
        return preg_replace('/\bDD\s+(?=user\b|account\b)/i', '', $description) ?? $description;
    }
}

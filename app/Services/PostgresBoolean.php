<?php

declare(strict_types=1);

namespace App\Services;

/** Normalize PDO PostgreSQL boolean results without PHP's truthy-string traps. */
final class PostgresBoolean
{
    public static function isTrue(mixed $value): bool
    {
        return in_array($value, [true, 1, '1', 't', 'true'], true);
    }
}

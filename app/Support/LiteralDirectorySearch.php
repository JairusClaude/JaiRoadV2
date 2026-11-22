<?php

declare(strict_types=1);

namespace App\Support;

/** Bounded literal-search input; SQL wildcard characters are ordinary text. */
final class LiteralDirectorySearch
{
    public static function normalize(mixed $value): string
    {
        return is_string($value) ? mb_substr(trim($value), 0, 150) : '';
    }

    /** Select/filter values must remain scalar strings in Inertia page props. */
    public static function option(mixed $value, string $fallback = 'all'): string
    {
        return is_string($value) ? mb_substr(trim($value), 0, 150) : $fallback;
    }

    public static function pattern(string $value): string
    {
        return '%'.addcslashes($value, '%_\\').'%';
    }
}

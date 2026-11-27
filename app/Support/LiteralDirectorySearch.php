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

    /** Normalize numeric directory filters before comparing against PostgreSQL integers. */
    public static function numericOption(mixed $value, int $maximum = PHP_INT_MAX): string
    {
        if (! is_string($value)) {
            return 'all';
        }
        $value = trim($value);
        if (! ctype_digit($value) || strlen($value) > 150) {
            return 'all';
        }
        $digits = ltrim($value, '0');
        $limit = (string) $maximum;
        if ($digits === '' || strlen($digits) > strlen($limit) || (strlen($digits) === strlen($limit) && strcmp($digits, $limit) > 0)) {
            return 'all';
        }

        return $digits;
    }

    public static function pattern(string $value): string
    {
        return '%'.addcslashes($value, '%_\\').'%';
    }
}

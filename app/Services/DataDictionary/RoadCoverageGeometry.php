<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

/**
 * Checks GeoJSON road-line geometry without creating a new business entity,
 * mutating coordinates or making assumptions about road fragmentation.
 * Compatible with the existing DD road tracing/import component.
 */
final class RoadCoverageGeometry
{
    public static function valid(mixed $geometry): bool
    {
        return self::roadLines($geometry, 0);
    }

    private static function roadLines(mixed $value, int $depth): bool
    {
        // Bound nested Feature/GeometryCollection depth, guarding CPU/stack use.
        if ($depth > 12 || ! is_array($value) || array_is_list($value)) {
            return false;
        }

        $type = $value['type'] ?? null;
        if (! is_string($type)) {
            return false;
        }

        return match ($type) {
            'LineString' => self::line($value['coordinates'] ?? null),
            'MultiLineString' => self::lineList($value['coordinates'] ?? null),
            'Feature' => self::roadLines($value['geometry'] ?? null, $depth + 1),
            'FeatureCollection' => self::children($value['features'] ?? null, $depth, 'Feature'),
            'GeometryCollection' => self::children($value['geometries'] ?? null, $depth, null),
            default => false,
        };
    }

    private static function children(mixed $items, int $depth, ?string $requiredType): bool
    {
        if (! is_array($items) || ! array_is_list($items) || $items === []) {
            return false;
        }
        foreach ($items as $item) {
            if ($requiredType !== null && (! is_array($item) || ($item['type'] ?? null) !== $requiredType)) {
                return false;
            }
            if (! self::roadLines($item, $depth + 1)) {
                return false;
            }
        }
        return true;
    }

    private static function lineList(mixed $lines): bool
    {
        if (! is_array($lines) || ! array_is_list($lines) || $lines === []) {
            return false;
        }
        foreach ($lines as $line) {
            if (! self::line($line)) {
                return false;
            }
        }
        return true;
    }

    private static function line(mixed $points): bool
    {
        if (! is_array($points) || ! array_is_list($points) || count($points) < 2) {
            return false;
        }
        foreach ($points as $position) {
            if (! is_array($position) || ! array_is_list($position) || count($position) < 2) {
                return false;
            }
            foreach ($position as $ordinate) {
                if ((! is_int($ordinate) && ! is_float($ordinate)) || ! is_finite((float) $ordinate)) {
                    return false;
                }
            }
            if (abs((float) $position[0]) > 180 || abs((float) $position[1]) > 90) {
                return false;
            }
        }
        return true;
    }
}

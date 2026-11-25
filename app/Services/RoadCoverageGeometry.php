<?php

declare(strict_types=1);

namespace App\Services;

/**
 * Checks GeoJSON road-line geometry without creating a new business entity,
 * mutating coordinates or making assumptions about road fragmentation.
 * Compatible with the canonical road tracing and import component.
 */
final class RoadCoverageGeometry
{
    // Bound total positions across nested lines/collections, not only depth.
    public const MAX_POSITIONS = 50000;

    public static function valid(mixed $geometry): bool
    {
        $positions = 0;

        return self::roadLines($geometry, 0, $positions);
    }

    private static function roadLines(mixed $value, int $depth, int &$positions): bool
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
            'LineString' => self::line($value['coordinates'] ?? null, $positions),
            'MultiLineString' => self::lineList($value['coordinates'] ?? null, $positions),
            'Feature' => self::roadLines($value['geometry'] ?? null, $depth + 1, $positions),
            'FeatureCollection' => self::children($value['features'] ?? null, $depth, 'Feature', $positions),
            'GeometryCollection' => self::children($value['geometries'] ?? null, $depth, null, $positions),
            default => false,
        };
    }

    private static function children(mixed $items, int $depth, ?string $requiredType, int &$positions): bool
    {
        if (! is_array($items) || ! array_is_list($items) || $items === []) {
            return false;
        }
        foreach ($items as $item) {
            if ($requiredType !== null && (! is_array($item) || ($item['type'] ?? null) !== $requiredType)) {
                return false;
            }
            if (! self::roadLines($item, $depth + 1, $positions)) {
                return false;
            }
        }

        return true;
    }

    private static function lineList(mixed $lines, int &$positions): bool
    {
        if (! is_array($lines) || ! array_is_list($lines) || $lines === []) {
            return false;
        }
        foreach ($lines as $line) {
            if (! self::line($line, $positions)) {
                return false;
            }
        }

        return true;
    }

    private static function line(mixed $points, int &$positions): bool
    {
        if (! is_array($points) || ! array_is_list($points) || count($points) < 2) {
            return false;
        }
        if (count($points) > self::MAX_POSITIONS - $positions) {
            return false;
        }
        $positions += count($points);
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

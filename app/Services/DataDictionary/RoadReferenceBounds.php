<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Database\Query\Builder;

/** Read-only bounding-box prefilter; it never simplifies or rewrites GeoJSON. */
final class RoadReferenceBounds
{
    public static function apply(Builder $query, float $west, float $south, float $east, float $north): void
    {
        // PostgreSQL JSONB, without requiring PostGIS or a new schema/index.
        // Recursive descent covers Features and both collection wrappers. A
        // bounding-box overlap may include extra lines, but must not lose a line
        // crossing the viewport just because its endpoints are outside it.
        $query->whereRaw(<<<'SQL'
            EXISTS (
                SELECT 1 FROM (
                    SELECT min(CASE WHEN jsonb_typeof(point->0) = 'number' THEN (point->>0)::numeric END) AS west,
                           max(CASE WHEN jsonb_typeof(point->0) = 'number' THEN (point->>0)::numeric END) AS east,
                           min(CASE WHEN jsonb_typeof(point->1) = 'number' THEN (point->>1)::numeric END) AS south,
                           max(CASE WHEN jsonb_typeof(point->1) = 'number' THEN (point->>1)::numeric END) AS north
                    FROM jsonb_array_elements(
                        CASE
                            WHEN rc.geojson->>'type' = 'LineString' AND jsonb_typeof(rc.geojson->'coordinates') = 'array'
                                THEN rc.geojson->'coordinates'
                            WHEN rc.geojson->>'type' = 'Feature' AND rc.geojson->'geometry'->>'type' = 'LineString'
                                AND jsonb_typeof(rc.geojson->'geometry'->'coordinates') = 'array'
                                THEN rc.geojson->'geometry'->'coordinates'
                            ELSE jsonb_path_query_array(rc.geojson, ?::jsonpath, '{}'::jsonb, true)
                                || jsonb_path_query_array(rc.geojson, ?::jsonpath, '{}'::jsonb, true)
                        END
                    ) AS positions(point)
                ) AS bounds
                WHERE bounds.east >= ? AND bounds.west <= ? AND bounds.north >= ? AND bounds.south <= ?
            )
            SQL, [
            'strict $.** ? (@.type == "LineString").coordinates[*]',
            'strict $.** ? (@.type == "MultiLineString").coordinates[*][*]',
            $west, $east, $south, $north,
        ]);
    }
}

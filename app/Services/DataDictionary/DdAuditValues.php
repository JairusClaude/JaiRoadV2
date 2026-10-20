<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Brick\Math\BigDecimal;

/** Explicit business fields only: never serialize a request, credentials or file paths. */
final class DdAuditValues
{
    public const TABLES = [
        'LGU' => 'lgus', 'Engineer' => 'engineers', 'EngineerLGU' => 'engineer_lgus',
        'UserAccount' => 'user_accounts', 'RoadCoverage' => 'road_coverages',
        'MaintenanceProject' => 'maintenance_projects', 'MaintenanceRecord' => 'maintenance_records',
        'MonthlyUpdate' => 'monthly_updates', 'MaintenanceDocument' => 'maintenance_documents', 'Media' => 'media',
    ];

    private const FIELDS = [
        'LGU' => ['id', 'municipality_name', 'province', 'region', 'mayor_first_name', 'mayor_middle_name', 'mayor_last_name'],
        'Engineer' => ['id', 'first_name', 'middle_name', 'last_name', 'rank', 'contact_no', 'engineer_status'],
        'EngineerLGU' => ['engineer_id', 'lgu_id', 'is_active'],
        'UserAccount' => ['id', 'username', 'account_type', 'engineer_id', 'is_active'],
        'RoadCoverage' => ['id', 'road_name', 'lgu_id', 'kilometers', 'pavement_type', 'state_category', 'geojson', 'created_by'],
        'MaintenanceProject' => ['id', 'project_title', 'road_coverage_id', 'description', 'created_by'],
        'MaintenanceRecord' => ['id', 'project_id', 'managing_engineer_id', 'maintenance_year', 'quarter', 'start_date', 'estimated_duration_days', 'complete_date', 'status', 'description', 'created_by'],
        'MonthlyUpdate' => ['id', 'maintenance_id', 'update_month', 'progress_percentage', 'summary_of_text_reports', 'created_by'],
        'MaintenanceDocument' => ['id', 'maintenance_id', 'document_title', 'description', 'uploaded_by'],
        'Media' => ['id', 'monthly_update_id', 'file_type', 'uploaded_by'],
    ];

    /** @return list<string> */
    public static function fields(string $entity): array
    {
        return self::FIELDS[$entity] ?? throw new \InvalidArgumentException('Unsupported audit entity.');
    }

    /** @param array<string, mixed> $values
     * @return array<string, mixed>
     */
    public static function snapshot(string $entity, array $values): array
    {
        $safe = array_intersect_key($values, array_flip(self::fields($entity)));
        foreach ($safe as $field => $value) {
            if ($value === null || $value === '') {
                $safe[$field] = null;
            } elseif ($field === 'is_active') {
                $safe[$field] = in_array($value, [true, 1, '1', 't', 'true'], true);
            } elseif (in_array($field, ['kilometers', 'progress_percentage'], true)) {
                // Exact decimal equality, including scientific notation, without float rounding.
                $safe[$field] = (string) BigDecimal::of((string) $value)->strippedOfTrailingZeros();
            } elseif ($field === 'id' || str_ends_with($field, '_id') || in_array($field, ['created_by', 'uploaded_by', 'maintenance_year', 'estimated_duration_days'], true)) {
                $safe[$field] = (int) $value;
            } elseif (in_array($field, ['start_date', 'complete_date'], true)) {
                $safe[$field] = (new \DateTimeImmutable((string) $value))->format('Y-m-d');
            } elseif ($field === 'geojson') {
                $geometry = is_string($value) ? json_decode($value, false, 512, JSON_THROW_ON_ERROR) : $value;
                // Fingerprint all structured changes without leaking arbitrary properties.
                $safe[$field] = ['sha256' => hash('sha256', json_encode(self::ordered($geometry), JSON_THROW_ON_ERROR))];
            }
        }
        ksort($safe);

        return $safe;
    }

    private static function ordered(mixed $value): mixed
    {
        if ($value instanceof \stdClass) {
            $properties = get_object_vars($value);
            ksort($properties);

            return (object) array_map(self::ordered(...), $properties);
        }
        if (! is_array($value)) {
            return $value;
        }
        if (! array_is_list($value)) {
            ksort($value);
        }

        return array_map(self::ordered(...), $value);
    }

    /** @param array<string, mixed> $before
     * @param  array<string, mixed>  $after
     * @return array{array<string, mixed>, array<string, mixed>}
     */
    public static function changes(array $before, array $after): array
    {
        $old = $new = [];
        foreach ($after as $field => $value) {
            // GeoJSON numbers 1 and 1.0 describe the same geometry.
            if (($before[$field] ?? null) !== $value && ! (is_array($value) && ($before[$field] ?? null) == $value)) {
                $old[$field] = $before[$field] ?? null;
                $new[$field] = $value;
            }
        }

        return [$old, $new];
    }
}

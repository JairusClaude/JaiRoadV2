<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Explicit business allowlists. No model/request serialization into history. */
final class AuditValues
{
    public const TABLES = ['LGU' => 'lgus', 'Engineer' => 'engineers', 'EngineerLGU' => 'engineer_lgus',
        'UserAccount' => 'user_accounts', 'RoadCoverage' => 'road_coverages', 'MaintenanceProject' => 'maintenance_projects',
        'MaintenanceRecord' => 'maintenance_records', 'MonthlyUpdate' => 'monthly_updates',
        'MaintenanceDocument' => 'maintenance_documents', 'Media' => 'media'];

    /** @return list<string> */
    public static function fields(string $entity): array
    {
        return match ($entity) {
            'LGU' => ['id', 'municipality_name', 'province', 'region', 'mayor_first_name', 'mayor_middle_name', 'mayor_last_name'],
            'Engineer' => ['id', 'first_name', 'middle_name', 'last_name', 'contact_no', 'rank', 'engineer_status'],
            'EngineerLGU' => ['engineer_id', 'lgu_id', 'is_active'],
            'UserAccount' => ['id', 'username', 'account_type', 'engineer_id', 'is_active'],
            'RoadCoverage' => ['id', 'road_name', 'lgu_id', 'kilometers', 'pavement_type', 'state_category', 'geojson', 'created_by'],
            'MaintenanceProject' => ['id', 'project_title', 'road_coverage_id', 'description', 'created_by'],
            'MaintenanceRecord' => ['id', 'project_id', 'managing_engineer_id', 'maintenance_year', 'quarter', 'start_date', 'estimated_duration_days', 'complete_date', 'status', 'description', 'created_by'],
            'MonthlyUpdate' => ['id', 'maintenance_id', 'update_month', 'progress_percentage', 'summary_of_text_reports', 'created_by'],
            'MaintenanceDocument' => ['id', 'maintenance_id', 'document_title', 'description', 'file_name', 'uploaded_by'],
            'Media' => ['id', 'monthly_update_id', 'file_name', 'file_type', 'uploaded_by'],
            default => throw new \InvalidArgumentException('Unknown canonical audit entity.'),
        };
    }

    /** @return array<string,mixed> */
    public function persisted(string $entity, int $id): array
    {
        return (array) DB::table('jairoads_next.'.self::TABLES[$entity])->where('id', $id)->first(self::fields($entity));
    }

    /** @param array<string,mixed> $values
     * @return array<string,mixed>
     */
    public function safe(string $entity, array $values): array
    {
        $result = [];
        $extra = ['municipality_name', 'municipality', 'managing_engineer_name', 'correction_reason', 'geometry_sha256', 'created_by_engineer_id', 'initiated_by'];
        foreach (array_intersect_key($values, array_flip([...self::fields($entity), ...$extra])) as $key => $value) {
            if ($key === 'geojson') {
                try {
                    $result['geometry_sha256'] = $this->geometryDigest($value);
                } catch (\JsonException) {
                    // An old audit payload can be malformed without poisoning history reads.
                    // Real road writes still pass their existing geometry validation first.
                    $result['geometry_sha256'] = hash('sha256', is_string($value) ? $value : 'unparseable-geometry');
                }
            } elseif ($value === null) {
                $result[$key] = null;
            } elseif ($key === 'is_active') {
                $result[$key] = in_array($value, [true, 1, '1', 'true', 't'], true);
            } elseif (in_array($key, ['kilometers', 'progress_percentage'], true)) {
                $result[$key] = number_format((float) $value, 2, '.', '');
            } elseif ($key === 'id' || str_ends_with($key, '_id') || in_array($key, ['maintenance_year', 'estimated_duration_days', 'created_by', 'uploaded_by', 'initiated_by', 'created_by_engineer_id'], true)) {
                $result[$key] = (int) $value;
            } elseif ($key === 'file_name') {
                $result[$key] = basename(str_replace('\\', '/', (string) $value));
            } elseif (is_scalar($value)) {
                $result[$key] = (string) $value;
            }
        }
        foreach (['affected_maintenance_record_ids', 'preserved_record_ids', 'project_ids', 'maintenance_record_ids'] as $key) {
            if (isset($values[$key]) && is_array($values[$key])) {
                $result[$key] = array_values(array_unique(array_map('intval', $values[$key])));
            }
        }
        ksort($result);

        return $result;
    }

    /** @param array<string,mixed> $before
     * @param  array<string,mixed>  $after
     * @return array{array<string,mixed>,array<string,mixed>}
     */
    public function changes(string $entity, array $before, array $after): array
    {
        $old = $this->safe($entity, $before);
        $new = $this->safe($entity, $after);
        $changed = [];
        foreach (array_unique([...array_keys($old), ...array_keys($new)]) as $key) {
            if (($old[$key] ?? null) !== ($new[$key] ?? null)) {
                $changed[$key] = true;
            }
        }

        return [array_intersect_key($old, $changed), array_intersect_key($new, $changed)];
    }

    /** JSON objects are unordered; coordinate/list order and dimensions remain meaningful. */
    public function geometryDigest(mixed $value): string
    {
        $decoded = is_string($value) ? json_decode($value, false, 512, JSON_THROW_ON_ERROR) : json_decode(json_encode($value, JSON_THROW_ON_ERROR), false, 512, JSON_THROW_ON_ERROR);

        return hash('sha256', json_encode($this->ordered($decoded), JSON_THROW_ON_ERROR));
    }

    private function ordered(mixed $value): mixed
    {
        if ($value instanceof \stdClass) {
            $fields = get_object_vars($value);
            ksort($fields);

            return (object) array_map(fn (mixed $item): mixed => $this->ordered($item), $fields);
        }
        if (is_array($value)) {
            return array_map(fn (mixed $item): mixed => $this->ordered($item), $value);
        }

        return $value;
    }
}

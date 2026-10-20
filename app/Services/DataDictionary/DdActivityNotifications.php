<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use Illuminate\Support\Facades\DB;

/**
 * Provisional DD Workflows matrix, enabled by the AuditLog correction approval.
 * Pending final client validation. Resolves ONE recipient; never writes events.
 *
 * @phpstan-import-type Identity from DataDictionaryIdentityResolver
 */
final class DdActivityNotifications
{
    public static function qualifies(string $role, string $action, string $entity): bool
    {
        if ($entity === 'MaintenanceRecord' && $action === 'CREATE') {
            return true;
        }

        return in_array($role, ['Admin', 'SuperAdmin'], true)
            && (($entity === 'MaintenanceRecord' && in_array($action, ['UPDATE', 'REASSIGN'], true))
                || (in_array($entity, ['MonthlyUpdate', 'MaintenanceDocument', 'Media'], true)
                    && in_array($action, ['CREATE', 'UPDATE', 'DELETE'], true)));
    }

    /** @param Identity $actor
     * @param  array<string, mixed>  $record  Persisted affected entity, before deletion when applicable.
     */
    public function recipient(array $actor, string $action, string $entity, array $record): ?int
    {
        if (! self::qualifies($actor['role'], $action, $entity)) {
            return null;
        }
        $maintenanceId = match ($entity) {
            'MaintenanceRecord' => $record['id'] ?? null,
            'MonthlyUpdate', 'MaintenanceDocument' => $record['maintenance_id'] ?? null,
            'Media' => DB::table('jairoads_next.monthly_updates')->where('id', $record['monthly_update_id'] ?? null)->value('maintenance_id'),
            default => null,
        };
        if ($maintenanceId === null) {
            return null;
        }
        $recipients = DB::table('jairoads_next.maintenance_records as mr')
            ->join('jairoads_next.maintenance_projects as p', 'p.id', '=', 'mr.project_id')
            ->join('jairoads_next.road_coverages as r', 'r.id', '=', 'p.road_coverage_id')
            ->join('jairoads_next.engineers as e', 'e.id', '=', 'mr.managing_engineer_id')
            ->join('jairoads_next.user_accounts as u', 'u.engineer_id', '=', 'e.id')
            ->join('jairoads_next.engineer_lgus as el', function ($join): void {
                $join->on('el.engineer_id', '=', 'e.id')->on('el.lgu_id', '=', 'r.lgu_id');
            })
            ->where('mr.id', $maintenanceId)->where('e.engineer_status', 'Active')
            ->where('u.is_active', true)->where('u.account_type', 'Engineer')
            ->where('el.is_active', true)->pluck('u.id')->unique();
        // Fail closed for an ambiguous profile/account link, including self.
        if ($recipients->count() !== 1 || (int) $recipients->first() === $actor['account_id']) {
            return null;
        }

        return (int) $recipients->first();
    }
}

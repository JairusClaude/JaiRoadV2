<?php

declare(strict_types=1);

namespace App\Services\MaintenanceProjects;

use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * Read-only query scope for EXISTING sidebar previews. This deliberately
 * does not grant create/update/delete permissions or introduce any page.
 */
final class ScopedMaintenanceRecordReader
{
    public function __construct(private VerifiedProjectAccount $accounts) {}

    public function visibleQuery(User $user): Builder
    {
        $query = DB::table('maintenance_records');
        $role = $this->accounts->role($user);
        if ($role === null) {
            return $query->whereRaw('1 = 0');
        }
        if ($role !== 'engineer') {
            // Viewer read-only; Admin/SuperAdmin may read every record.
            return $query;
        }
        $account = $this->accounts->resolve($user);
        $engineerId = (int) ($account?->engineers_id ?? 0);
        if ($engineerId < 1) {
            return $query->whereRaw('1 = 0');
        }
        try {
            if (! Schema::hasTable('engineer_lgus')
                || ! Schema::hasColumns('engineer_lgus', ['engineers_id', 'lgus_id', 'is_active'])) {
                return $query->whereRaw('1 = 0');
            }
        } catch (Throwable) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where('maintenance_records.engineers_id', $engineerId)
            ->whereExists(static function (Builder $scope) use ($engineerId): void {
                $scope->selectRaw('1')
                    ->from('maintenance_projects as scoped_project')
                    ->join('road_coverages as scoped_road', 'scoped_road.id', '=', 'scoped_project.road_coverage_id')
                    ->join('engineer_lgus as scoped_assignment', static function ($join) use ($engineerId): void {
                        $join->on('scoped_assignment.lgus_id', '=', 'scoped_road.lgu_id')
                            ->where('scoped_assignment.engineers_id', $engineerId)
                            ->where('scoped_assignment.is_active', true);
                    })
                    ->whereColumn('scoped_project.id', 'maintenance_records.maintenance_projects_id');
            });
    }
}

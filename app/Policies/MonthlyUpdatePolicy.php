<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\MaintenanceRecord;
use App\Models\MonthlyUpdate;
use App\Models\User;
use App\Services\MaintenanceProjects\SidebarMaintenanceRecordScope;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Deny by default. Engineer operations require BOTH active LGU and current ManagingEngineer. */
class MonthlyUpdatePolicy
{
    public function __construct(private VerifiedProjectAccount $accounts) {}

    public function viewAny(User $user): bool
    {
        return $this->accounts->role($user) !== null;
    }

    public function view(User $user, MonthlyUpdate $update): bool
    {
        $role = $this->accounts->role($user);
        if ($role === null) {
            return false;
        }
        // Admin / SuperAdmin / Viewer retain their permitted read access.
        if ($role !== 'engineer') {
            return true;
        }
        $record = $update->maintenanceRecord;
        if (! $record instanceof MaintenanceRecord) {
            return false;
        }

        // Read visibility and mutation authority are deliberately different.
        // Reuse the EXACT record visibility scope already used by the Monthly
        // Updates index route. Do not demand current ManagingEngineer merely
        // to read an otherwise-visible historical monthly report.
        try {
            return app(SidebarMaintenanceRecordScope::class)
                ->visibleQuery($user)
                ->where('maintenance_records.id', (int) $record->getKey())
                ->exists();
        } catch (\Throwable) {
            // Missing scope/schema or a database error must deny, never grant.
            return false;
        }
    }

    public function create(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin', 'engineer'], true);
    }

    public function createForRecord(User $user, MaintenanceRecord $record): bool
    {
        $role = $this->accounts->role($user);
        if (in_array($role, ['admin', 'superadmin'], true)) {
            return true;
        }

        return $role === 'engineer' && $this->engineerManages($user, $record);
    }

    public function update(User $user, MonthlyUpdate $update): bool
    {
        $record = $update->maintenanceRecord;

        return $record instanceof MaintenanceRecord && $this->createForRecord($user, $record);
    }

    private function engineerManages(User $user, MaintenanceRecord $record): bool
    {
        $account = $this->accounts->resolve($user);
        if (! $account?->engineers_id || (int) $account->engineers_id !== (int) $record->engineers_id) {
            return false;
        }
        // Missing status enforcement cannot silently grant write access.
        if (! Schema::hasColumn('engineers', 'engineer_status')) {
            return false;
        }
        if (! DB::table('engineers')->where('id', $account->engineers_id)
            ->where('engineer_status', 'Active')->exists()) {
            return false;
        }
        $coverage = $record->maintenanceProject?->roadCoverage;

        return $coverage !== null && $this->accounts->assignedTo($account, $coverage);
    }

    // Deliberately not enabling deletion here: the final DD permits Admin /
    // SuperAdmin ordinary CRUD, but this release lacks a tested media-retention,
    // restrictive-FK and AuditLog delete workflow. Keep HTTP deletion blocked
    // until that separate implementation is reviewed and approved.
    public function delete(User $user, MonthlyUpdate $update): bool
    {
        return false;
    }

    public function restore(User $user, MonthlyUpdate $update): bool
    {
        return false;
    }

    public function forceDelete(User $user, MonthlyUpdate $update): bool
    {
        return false;
    }
}

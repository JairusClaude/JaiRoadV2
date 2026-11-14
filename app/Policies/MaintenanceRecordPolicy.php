<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\MaintenanceRecord;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;

/**
 * Temporary fail-closed role policy until EngineerLGU and controller schema
 * are aligned with the approved JaiROADS data dictionary.
 *
 * Active verified users may read records. Only active Admin / SuperAdmin
 * accounts may mutate records. Engineer writes must remain disabled until
 * assignment and current ManagingEngineer authorization can be enforced.
 */
class MaintenanceRecordPolicy
{
    public function __construct(private VerifiedProjectAccount $accounts) {}

    public function viewAny(User $user): bool
    {
        return $this->accounts->role($user) !== null;
    }

    public function view(User $user, MaintenanceRecord $maintenanceRecord): bool
    {
        if (! $this->viewAny($user)) {
            return false;
        }
        if ($this->accounts->role($user) !== 'engineer') {
            return true;
        }

        return $this->isManagingEngineerInAssignedLgu($user, $maintenanceRecord);
    }

    public function viewAll(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin', 'viewer'], true);
    }

    public function create(User $user): bool
    {
        return $this->isAdministrator($user);
    }

    public function update(User $user, MaintenanceRecord $maintenanceRecord): bool
    {
        return $this->isAdministrator($user)
            || $this->isManagingEngineerInAssignedLgu($user, $maintenanceRecord);
    }

    private function isManagingEngineerInAssignedLgu(User $user, MaintenanceRecord $record): bool
    {
        if ($this->accounts->role($user) !== 'engineer') {
            return false;
        }
        $account = $this->accounts->resolve($user);
        if (! $account?->engineers_id
            || (int) $account->engineers_id !== (int) $record->engineers_id) {
            return false;
        }
        $coverage = $record->maintenanceProject?->roadCoverage;

        return $coverage !== null && $this->accounts->assignedTo($account, $coverage);
    }

    public function delete(User $user, MaintenanceRecord $maintenanceRecord): bool
    {
        return $this->isAdministrator($user);
    }

    public function restore(User $user, MaintenanceRecord $maintenanceRecord): bool
    {
        return false;
    }

    public function forceDelete(User $user, MaintenanceRecord $maintenanceRecord): bool
    {
        return false;
    }

    private function isAdministrator(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin'], true);
    }
}

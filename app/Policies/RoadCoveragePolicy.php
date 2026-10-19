<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Lgu;
use App\Models\RoadCoverage;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;

/**
 * Phase B1: Engineer writes require active LGU assignments.
 * RoadCoverage.CreatedBy is an Engineer FK, so unlinked administrators
 * cannot create new coverage until a separately approved attribution model exists.
 */
final class RoadCoveragePolicy
{
    public function __construct(private VerifiedProjectAccount $accounts)
    {
    }

    public function viewAny(User $user): bool
    {
        return $this->accounts->role($user) !== null;
    }

    public function view(User $user, RoadCoverage $coverage): bool
    {
        if (! $this->viewAny($user)) {
            return false;
        }
        if ($this->accounts->role($user) !== 'engineer') {
            return true;
        }
        $account = $this->accounts->resolve($user);
        return $account !== null && $this->accounts->assignedTo($account, $coverage);
    }

    /** Admin, SuperAdmin and Viewer can read every coverage; Engineer is LGU scoped. */
    public function viewAll(User $user): bool
    {
        return $this->viewAny($user) && $this->accounts->role($user) !== 'engineer';
    }

    /** RoadCoverage.CreatedBy must reference an actual Engineer, even for administrators. */
    public function create(User $user): bool
    {
        $role = $this->accounts->role($user);
        $account = $this->accounts->resolve($user);
        return in_array($role, ['admin', 'superadmin', 'engineer'], true)
            && $account !== null && $account->engineers_id !== null;
    }

    public function createForLgu(User $user, Lgu $lgu): bool
    {
        if (! $this->create($user)) {
            return false;
        }
        if ($this->isAdministrator($user)) {
            return true;
        }
        $account = $this->accounts->resolve($user);
        return $account !== null && $this->accounts->assignedToLgu($account, (int) $lgu->getKey());
    }

    public function update(User $user, RoadCoverage $coverage): bool
    {
        if ($this->isAdministrator($user)) {
            return true;
        }
        $account = $this->accounts->resolve($user);
        return $this->accounts->role($user) === 'engineer'
            && $account !== null && $this->accounts->assignedTo($account, $coverage);
    }

    public function updateForLgu(User $user, RoadCoverage $coverage, Lgu $targetLgu): bool
    {
        if (! $this->update($user, $coverage)) {
            return false;
        }
        if ($this->isAdministrator($user)) {
            return true;
        }
        $account = $this->accounts->resolve($user);
        return $account !== null && $this->accounts->assignedToLgu($account, (int) $targetLgu->getKey());
    }

    public function delete(User $user, RoadCoverage $coverage): bool
    {
        return $this->isAdministrator($user);
    }

    public function restore(User $user, RoadCoverage $coverage): bool
    {
        return false;
    }

    public function forceDelete(User $user, RoadCoverage $coverage): bool
    {
        return false;
    }

    private function isAdministrator(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin'], true);
    }
}
<?php

namespace App\Policies;

use App\Models\MaintenanceProject;
use App\Models\RoadCoverage;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;

class MaintenanceProjectPolicy
{
    public function __construct(private VerifiedProjectAccount $accounts) {}

    public function viewAny(User $user): bool
    {
        return $this->accounts->role($user) !== null;
    }

    public function view(User $user, MaintenanceProject $project): bool
    {
        if (! $this->viewAny($user)) {
            return false;
        }
        if ($this->accounts->role($user) !== 'engineer') {
            return true;
        }
        $account = $this->accounts->resolve($user);
        $coverage = $project->roadCoverage;

        return $account !== null && $coverage !== null
            && $this->accounts->assignedTo($account, $coverage);
    }

    public function create(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin', 'engineer'], true);
    }

    public function assignCoverage(User $user, RoadCoverage $coverage): bool
    {
        $role = $this->accounts->role($user);

        return in_array($role, ['admin', 'superadmin'], true)
            || ($role === 'engineer' && $this->accounts->assignedTo($this->accounts->require($user), $coverage));
    }

    public function update(User $user, MaintenanceProject $project): bool
    {
        if (in_array($this->accounts->role($user), ['admin', 'superadmin'], true)) {
            return true;
        }

        return $this->accounts->role($user) === 'engineer' && $project->roadCoverage
            && $this->assignCoverage($user, $project->roadCoverage);
    }

    // History eligibility is rechecked under a row lock, separately from role
    // permission, so an ineligible bulk selection gets an actionable explanation.
    public function delete(User $user, MaintenanceProject $project): bool
    {
        return $this->deleteAny($user);
    }

    public function deleteAny(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin'], true);
    }

    public function restore(User $user, MaintenanceProject $project): bool
    {
        return false;
    }

    public function forceDelete(User $user, MaintenanceProject $project): bool
    {
        return false;
    }
}

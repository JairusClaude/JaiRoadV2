<?php

namespace App\Policies;

use App\Models\Lgu;
use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;

class LguPolicy
{
    public function __construct(private VerifiedProjectAccount $accounts) {}

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $this->accounts->role($user) !== null;
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user, Lgu $lgu): bool
    {
        return $this->viewAny($user);
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin'], true);
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Lgu $lgu): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin'], true);
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Lgu $lgu): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin'], true);
    }

    public function deleteAny(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin'], true);
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Lgu $lgu): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Lgu $lgu): bool
    {
        return false;
    }
}

// Authorization policy definitions.

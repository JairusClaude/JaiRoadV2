<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;
use App\Models\UserAccount;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;

/** Only creation is authorized for verified administrators. All other mutations remain denied. */
final class UserAccountPolicy
{
    public function __construct(private VerifiedProjectAccount $accounts) {}

    public function viewAny(User $user): bool
    {
        return false;
    }

    public function view(User $user, UserAccount $userAccount): bool
    {
        return false;
    }

    public function create(User $user): bool
    {
        return in_array($this->accounts->role($user), ['admin', 'superadmin'], true);
    }

    public function update(User $user, UserAccount $userAccount): bool
    {
        return false;
    }

    public function delete(User $user, UserAccount $userAccount): bool
    {
        return false;
    }

    public function restore(User $user, UserAccount $userAccount): bool
    {
        return false;
    }

    public function forceDelete(User $user, UserAccount $userAccount): bool
    {
        return false;
    }
}

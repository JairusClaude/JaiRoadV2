<?php

namespace App\Services\MaintenanceProjects;

use App\Models\RoadCoverage;
use App\Models\User;
use App\Models\UserAccount;
use Illuminate\Auth\Access\AuthorizationException;

/** Module boundary, not an alternate login provider. */
class VerifiedProjectAccount
{
    public function resolve(User $user): ?UserAccount
    {
        // No verified identity link exists. Implement only after separate approval.
        // Never match numerical IDs, email, usernames, or submitted account IDs.
        return null;
    }

    public function require(User $user): UserAccount
    {
        $account = $this->resolve($user);
        if (! $account || ! $account->exists || ! $account->is_active) {
            throw new AuthorizationException('A verified active project account is required.');
        }

        return $account;
    }

    public function role(User $user): ?string
    {
        $account = $this->resolve($user);
        if (! $account || ! $account->exists || ! $account->is_active) {
            return null;
        }
        // Legacy "user" is NOT assumed to mean Engineer.
        $role = strtolower((string) $account->accountType);

        return in_array($role, ['admin', 'superadmin', 'engineer', 'viewer'], true) ? $role : null;
    }

    public function assignedTo(UserAccount $account, RoadCoverage $coverage): bool
    {
        // EngineerLGU is not implemented/verified. Do not substitute the legacy
        // engineers.lgus_id column for an approved active assignment.
        return false;
    }
}

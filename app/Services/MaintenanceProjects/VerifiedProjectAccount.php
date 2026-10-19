<?php

namespace App\Services\MaintenanceProjects;

use App\Models\RoadCoverage;
use App\Models\User;
use App\Models\UserAccount;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class VerifiedProjectAccount
{
    public function resolve(User $user): ?UserAccount
    {
        // Use only an explicit, administrator-approved identity link.
        // Never match accounts by numerical ID, email, or username.
        if (! $user->exists) {
            return null;
        }

        $linkedAccountId = $user->fresh()?->getAttribute('user_account_id');

        if (! $linkedAccountId) {
            return null;
        }

        return UserAccount::query()
            ->whereKey($linkedAccountId)
            ->where('is_active', true)
            ->first();
    }

    public function require(User $user): UserAccount
    {
        $account = $this->resolve($user);

        if (! $account || ! $account->exists || ! $account->is_active) {
            throw new AuthorizationException(
                'A verified active project account is required.'
            );
        }

        return $account;
    }

    public function role(User $user): ?string
    {
        $account = $this->resolve($user);

        // Inactive or invalid accounts must have no permissions.
        if (! $account || ! $account->exists || ! $account->is_active) {
            return null;
        }

        $role = strtolower((string) $account->accountType);

        return in_array(
            $role,
            ['admin', 'superadmin', 'engineer', 'viewer'],
            true
        ) ? $role : null;
    }

    public function assignedTo(
        UserAccount $account,
        RoadCoverage $coverage
    ): bool {
        return $this->assignedToLgu($account, (int) $coverage->lgu_id);
    }

    /** Only the approved Phase A pivot is authoritative; never infer from engineers.lgus_id. */
    public function assignedToLgu(UserAccount $account, int $lguId): bool
    {
        if (! $account->is_active || ! $account->engineers_id || $lguId < 1) {
            return false;
        }
        // Restrict the helper to legitimate linked Engineer/Admin identities.
        if (! in_array(strtolower((string) $account->accountType), ['engineer', 'admin'], true)) {
            return false;
        }
        try {
            // Deny Engineer-scoped access when the current personnel profile is
            // Retired (or when the status column is missing). Do not infer
            // eligibility from legacy engineers.lgus_id.
            if (! Schema::hasTable('engineer_lgus')
                || ! Schema::hasColumns('engineer_lgus', ['engineers_id', 'lgus_id', 'is_active'])
                || ! Schema::hasTable('engineers')
                || ! Schema::hasColumns('engineers', ['id', 'engineer_status'])) {
                return false;
            }
            // One DB lookup enforces BOTH the EngineerStatus lifecycle and the
            // active EngineerLGU assignment; no alternate legacy fallback.
            return DB::table('engineer_lgus as assignment')
                ->join('engineers as engineer', 'engineer.id', '=', 'assignment.engineers_id')
                ->where('assignment.engineers_id', (int) $account->engineers_id)
                ->where('assignment.lgus_id', $lguId)
                ->where('assignment.is_active', true)
                ->where('engineer.engineer_status', 'Active')
                ->exists();
        } catch (\Throwable) {
            // Unexpected schema/connectivity failures must never grant permissions.
            return false;
        }
    }
}

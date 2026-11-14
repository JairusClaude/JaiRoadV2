<?php

declare(strict_types=1);

namespace App\Services\UserManagement;

use App\Models\User;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Account provisioning policy chosen for this release:
 * SuperAdmin -> Admin, Engineer, Viewer; Admin -> Engineer, Viewer.
 * This creator matrix is a conservative implementation choice, not an
 * explicit creator-by-role matrix in the Data Dictionary.
 * Never bootstrap or create SuperAdmin through public UI.
 */
final class AccountProvisioningRoles
{
    public function __construct(private VerifiedProjectAccount $accounts) {}

    /** @return list<'viewer'|'engineer'|'admin'> */
    public function for(User $user): array
    {
        $role = $this->accounts->role($user);
        if (! in_array($role, ['admin', 'superadmin'], true)) {
            return [];
        }

        $allowed = ['viewer'];
        if ($this->engineerRoleSupported()) {
            $allowed[] = 'engineer';
        }
        if ($role === 'superadmin') {
            $allowed[] = 'admin';
        }

        return $allowed;
    }

    /**
     * Fail closed until the actual Postgres check is approved for Engineer.
     * This is a readiness check, not a replacement for database constraints.
     */
    public function engineerRoleSupported(): bool
    {
        try {
            if (DB::connection()->getDriverName() !== 'pgsql') {
                return false;
            }
            $rows = DB::select(<<<'SQL'
                SELECT pg_get_constraintdef(c.oid) AS definition
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                JOIN pg_namespace n ON n.oid = t.relnamespace
                WHERE n.nspname = current_schema()
                  AND t.relname = 'user_accounts'
                  AND c.contype = 'c'
                  AND lower(pg_get_constraintdef(c.oid)) LIKE '%accounttype%'
            SQL);
            if ($rows === []) {
                return false;
            }
            foreach ($rows as $row) {
                $constraint = strtolower((string) $row->definition);
                if (! str_contains($constraint, "'engineer'")) {
                    return false;
                }
                // Do not mistake an explicit deny constraint for permission.
                if (preg_match('/(?:<>|!=)\s*\'engineer\'|not\s+in\s*\([^)]*\'engineer\'/i', $constraint)) {
                    return false;
                }
            }

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}

<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Strict, READ-ONLY resolver for an explicitly linked new DD identity.
 * This does not replace Fortify, issue roles, authorize endpoints or make writes.
 * Data Dictionary: UserAccount(AccountType, IsActive, EngineerID) and
 * Engineer(EngineerStatus). public.users is separate login infrastructure.
 */
final class DataDictionaryIdentityResolver
{
    /**
     * Historical compatibility only: existing unlinked Admin accounts remain active.
     * New Admin/Engineer provisioning requires a profile in DdPhase3Controller.
     * Any historical unlinked Engineer receives NO LGU/manager authorization.
     */
    public static function roleLinkValid(string $role, ?int $engineerId): bool
    {
        return match ($role) {
            'SuperAdmin', 'Viewer' => $engineerId === null,
            'Admin', 'Engineer' => $engineerId === null || $engineerId > 0,
            default => false,
        };
    }

    private static function pgTrue(mixed $value): bool
    {
        return in_array($value, [true, 1, '1', 't', 'true'], true);
    }

    /**
     * @return array{account_id: int, role: string, engineer_id: ?int}|null
     */
    public function resolve(User $login): ?array
    {
        if (! $login->exists || ! $login->getKey()) {
            return null;
        }

        // Never map by matching an old ID, username or email. The ONLY join is
        // the Phase 2C explicit FK: public.users.dd_user_account_id.
        // SELECT a password *comparison boolean*, never either password hash.
        $row = DB::table('public.users as login')
            ->join('jairoads_next.user_accounts as account', 'login.dd_user_account_id', '=', 'account.id')
            ->leftJoin('jairoads_next.engineers as engineer', 'account.engineer_id', '=', 'engineer.id')
            ->where('login.id', $login->getKey())
            ->select([
                'account.id',
                'account.account_type',
                'account.engineer_id',
                'account.is_active',
                'account.email as account_email',
                'login.email as login_email',
                'engineer.engineer_status',
            ])
            ->selectRaw('(login.password = account.password) AS credential_hash_matches')
            ->first();

        if ($row === null || ! self::pgTrue($row->is_active)) {
            return null;
        }
        $role = (string) $row->account_type;
        $engineerId = $row->engineer_id === null ? null : (int) $row->engineer_id;
        if (! self::roleLinkValid($role, $engineerId)) {
            return null;
        }
        if (strtolower((string) $row->account_email) !== strtolower((string) $row->login_email)) {
            return null;
        }
        // Two password columns currently exist. Prevent contradictory identity
        // credentials from being treated as a verified bridge after password reset.
        if (! self::pgTrue($row->credential_hash_matches)) {
            return null;
        }
        if ($engineerId !== null && (string) $row->engineer_status !== 'Active') {
            return null;
        }

        return ['account_id' => (int) $row->id, 'role' => $role, 'engineer_id' => $engineerId];
    }
}

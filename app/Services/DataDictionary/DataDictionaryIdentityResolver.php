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
    /** Canonical role controls permissions; profile linkage never grants a role. */
    public static function roleLinkValid(string $role, ?int $engineerId): bool
    {
        return match ($role) {
            'SuperAdmin' => $engineerId === null || $engineerId > 0,
            'Admin', 'Engineer', 'Viewer' => $engineerId !== null && $engineerId > 0,
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
        return $this->identity($login, false);
    }

    /**
     * Token-verified recovery may repair hash drift, never identity or provenance.
     *
     * @return array{account_id:int,role:string,engineer_id:?int}|null
     */
    public function resolveForRecovery(User $login): ?array
    {
        return $this->identity($login, true);
    }

    /** Administration only: test all eligibility requirements except current activation. */
    public function canReactivate(User $login): bool
    {
        return $this->identity($login, false, true) !== null;
    }

    /** @return array{account_id: int, role: string, engineer_id: ?int}|null */
    private function identity(User $login, bool $recovery, bool $reactivation = false): ?array
    {
        if (! $login->exists || ! $login->getKey() || $login->getAttribute('dd_user_account_id') === null
            || $login->getConnection()->getDriverName() !== 'pgsql') {
            return null;
        }

        // Never map by matching an old ID, username or email. The ONLY join is
        // the Phase 2C explicit FK: public.users.dd_user_account_id.
        // SELECT a password *comparison boolean*, never either password hash.
        $evidenceAvailable = app(AccountProvisioning::class)->available();
        $query = DB::table('public.users as login')
            ->join('jairoads_next.user_accounts as account', 'login.dd_user_account_id', '=', 'account.id')
            ->leftJoin('jairoads_next.engineers as engineer', 'account.engineer_id', '=', 'engineer.id')
            ->where('login.id', $login->getKey())
            ->where('login.dd_user_account_id', $login->getAttribute('dd_user_account_id'))
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
            ->selectRaw('(SELECT count(*) FROM public.users AS bridge WHERE bridge.dd_user_account_id = account.id) AS bridge_count');
        if ($evidenceAvailable) {
            $query->leftJoin(AccountProvisioning::TABLE.' as provenance', 'provenance.user_account_id', '=', 'account.id')
                ->addSelect(['provenance.provisioned_role', 'provenance.engineer_id as provisioned_engineer_id']);
        }
        $row = $query->first();

        if ($row === null || (! $reactivation && ! self::pgTrue($row->is_active))) {
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
        if (! $recovery && ! self::pgTrue($row->credential_hash_matches)) {
            return null;
        }
        if ($engineerId !== null && (string) $row->engineer_status !== 'Active') {
            return null;
        }

        if ((int) $row->bridge_count !== 1) {
            return null;
        }
        if ($role !== 'SuperAdmin' && (! $evidenceAvailable || $row->provisioned_role !== $role
            || (int) $row->provisioned_engineer_id !== $engineerId)) {
            return null;
        }

        return ['account_id' => (int) $row->id, 'role' => $role, 'engineer_id' => $engineerId];
    }
}

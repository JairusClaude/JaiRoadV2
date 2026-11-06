<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use App\Models\User;
use Illuminate\Database\Query\Builder;
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

        $row = $this->eligibleLinks($recovery, $reactivation)
            ->where('login.id', $login->getKey())
            ->where('login.dd_user_account_id', $login->getAttribute('dd_user_account_id'))
            ->first(['account.id', 'account.account_type', 'account.engineer_id']);

        return $row === null ? null : ['account_id' => (int) $row->id,
            'role' => (string) $row->account_type,
            'engineer_id' => $row->engineer_id === null ? null : (int) $row->engineer_id];
    }

    /** Same SQL eligibility as authentication; one audience query, no per-user resolver loop. */
    public function notificationRecipients(?int $engineerActor): Builder
    {
        return $this->eligibleLinks(false)->where(function (Builder $query) use ($engineerActor): void {
            $query->whereIn('account.account_type', DdActivityNotifications::ADMINISTRATIVE_AUDIENCE);
            if ($engineerActor !== null) {
                $query->orWhere(function (Builder $engineer) use ($engineerActor): void {
                    $engineer->where('account.account_type', 'Engineer')->where('account.id', $engineerActor);
                });
            }
        });
    }

    /** Shared SQL authority for identity and new delivery eligibility. No credentials projected. */
    private function eligibleLinks(bool $recovery, bool $reactivation = false): Builder
    {
        $query = DB::table('public.users as login')
            ->join('jairoads_next.user_accounts as account', 'login.dd_user_account_id', '=', 'account.id')
            ->leftJoin('jairoads_next.engineers as engineer', 'account.engineer_id', '=', 'engineer.id')
            ->whereIn('account.account_type', ['SuperAdmin', 'Admin', 'Engineer', 'Viewer'])
            ->whereRaw('LOWER(account.email) = LOWER(login.email)')
            ->whereRaw('(SELECT count(*) FROM public.users AS bridge WHERE bridge.dd_user_account_id = account.id) = 1')
            ->where(function (Builder $q): void {
                $q->where(function (Builder $root): void {
                    $root->where('account.account_type', 'SuperAdmin')->whereNull('account.engineer_id');
                })->orWhere(function (Builder $linked): void {
                    $linked->where('account.engineer_id', '>', 0)->where('engineer.engineer_status', 'Active');
                });
            });
        if (! $reactivation) {
            $query->where('account.is_active', true);
        }
        if (! $recovery) {
            $query->whereRaw('login.password = account.password');
        }
        if (app(AccountProvisioning::class)->available()) {
            $query->leftJoin(AccountProvisioning::TABLE.' as provenance', 'provenance.user_account_id', '=', 'account.id')
                ->where(function (Builder $q): void {
                    $q->where('account.account_type', 'SuperAdmin')->orWhere(function (Builder $ordinary): void {
                        $ordinary->whereColumn('provenance.provisioned_role', 'account.account_type')
                            ->whereColumn('provenance.engineer_id', 'account.engineer_id');
                    });
                });
        } else {
            $query->where('account.account_type', 'SuperAdmin');
        }

        return $query;
    }
}

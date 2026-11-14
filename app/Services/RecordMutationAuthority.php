<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Final authority pins for the two reproduced record/monthly mutation paths. */
final class RecordMutationAuthority
{
    public function __construct(private AccountIdentityResolver $identities) {}

    /**
     * Called after the project/record locks, before business writes. Do not wait
     * for exclusive lifecycle work while holding its potentially needed parents.
     *
     * @param  array{account_id:int,role:string,engineer_id:?int}  $expected
     */
    public function lock(User $login, array $expected, int $lguId): void
    {
        if (DB::transactionLevel() < 1) {
            throw new \LogicException('Record authorization requires the mutation transaction.');
        }
        $guard = DB::selectOne('SELECT pg_try_advisory_xact_lock_shared(1927710916) AS acquired');
        abort_unless(PostgresBoolean::isTrue($guard?->acquired), 409, 'Account authorization is changing. Retry the record operation.');

        // Same bridge -> account -> profile -> membership order as credential
        // and lifecycle coordination. These pins survive later creator/audit FK
        // waits; a plain recheck alone would leave that commit window open.
        DB::table('public.users')->where('id', $login->getKey())->sharedLock()->first(['id']);
        $account = DB::table('jairoads_next.user_accounts')->where('id', $expected['account_id'])->sharedLock()->first(['engineer_id']);
        abort_unless($account !== null, 403);
        if ($account->engineer_id !== null) {
            DB::table('jairoads_next.engineers')->where('id', $account->engineer_id)->sharedLock()->first(['id']);
        }
        $membership = $expected['role'] === 'Engineer' ? DB::table('jairoads_next.engineer_lgus')
            ->where('engineer_id', $account->engineer_id)->where('lgu_id', $lguId)->sharedLock()->first(['is_active']) : null;
        abort_unless($this->identities->resolve($login) === $expected && RoleAccess::canWriteOperations($expected['role']), 403, 'Your current account is unavailable.');
        if ($expected['role'] === 'Engineer') {
            abort_unless(PostgresBoolean::isTrue($membership?->is_active), 403, 'Current EngineerLGU authorization is required.');
        }
    }
}

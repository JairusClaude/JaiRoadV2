<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\ResetsUserPasswords;

class ResetUserPassword implements ResetsUserPasswords
{
    use PasswordValidationRules;

    /**
     * Reset the Fortify password. DD-linked identities use a single hash and
     * one PostgreSQL transaction for public.users and jairoads_next.user_accounts.
     * Legacy-only users retain the existing Fortify reset behavior.
     *
     * @param array<string, string> $input
     */
    public function reset(User $user, array $input): void
    {
        Validator::make($input, [
            'password' => $this->passwordRules(),
        ])->validate();

        $linkedId = $user->getAttribute('dd_user_account_id');
        if ($linkedId === null) {
            $user->forceFill(['password' => $input['password']])->save();
            return;
        }

        $accountId = filter_var($linkedId, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($accountId === false || ! $user->exists || ! $user->getKey()) {
            throw ValidationException::withMessages(['email' => 'Password reset is unavailable for this account.']);
        }

        DB::transaction(function () use ($user, $input, $accountId): void {
            // Match DD workspace settings lock order: DD account, then Fortify user.
            // An invalid/inactive bridge fails closed, never resets a legacy account.
            $account = DB::table('jairoads_next.user_accounts')
                ->where('id', $accountId)->lockForUpdate()
                ->first(['id', 'email', 'is_active']);
            $login = DB::table('public.users')
                ->where('id', $user->getKey())->lockForUpdate()
                ->first(['id', 'email', 'dd_user_account_id']);

            $active = $account !== null
                && in_array($account->is_active, [true, 1, '1', 't', 'true'], true);
            $validLink = $login !== null && (string) $login->dd_user_account_id === (string) $accountId;
            $sameEmail = $login !== null && $account !== null
                && strtolower((string) $login->email) === strtolower((string) $account->email);
            if (! $active || ! $validLink || ! $sameEmail) {
                throw ValidationException::withMessages(['email' => 'Password reset is unavailable for this account.']);
            }

            // Hash exactly once; Eloquent's hashed cast recognizes an already
            // hashed value. Keep model events on the Fortify User update.
            $hash = Hash::make($input['password']);
            $user->forceFill(['password' => $hash])->save();
            $affected = DB::table('jairoads_next.user_accounts')
                ->where('id', $accountId)
                ->update(['password' => $hash, 'updated_at' => now()]);
            if ($affected !== 1) {
                throw ValidationException::withMessages(['email' => 'Password reset could not be completed.']);
            }
        }, 2);
    }
}

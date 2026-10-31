<?php

declare(strict_types=1);

namespace App\Services\DataDictionary;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use SensitiveParameter;

/** Password writes only; never provisions identities or changes account permissions. */
final class LinkedPasswordUpdater
{
    /** Called only after Fortify's password broker has verified the reset token. */
    public function reset(User $login, #[SensitiveParameter] string $password): void
    {
        $this->write($login, $password, null, recover: true);
    }

    public function change(User $login, #[SensitiveParameter] string $currentPassword, #[SensitiveParameter] string $password): void
    {
        $this->write($login, $password, $currentPassword);
    }

    /** Preserve Laravel's configured hash upgrades without splitting the two credentials. */
    public function rehash(User $login, #[SensitiveParameter] string $password, bool $force = false): void
    {
        $this->write($login, $password, $password, rehash: true, force: $force);
    }

    private function write(
        User $login,
        #[SensitiveParameter] string $password,
        #[SensitiveParameter] ?string $currentPassword,
        bool $recover = false,
        bool $rehash = false,
        bool $force = false,
    ): void {
        if (! $login->exists || ! $login->getKey()) {
            $this->unavailable();
        }
        $connection = $login->getConnection();

        try {
            $credentials = $connection->transaction(function () use ($connection, $login, $password, $currentPassword, $recover, $rehash, $force): ?array {
                // Always lock login first, then its explicit DD target. Never join by email/ID equality.
                $fresh = User::on($connection->getName())->whereKey($login->getKey())->lockForUpdate()->first();
                if (! $fresh || (string) $fresh->getAttribute('dd_user_account_id') !== (string) $login->getAttribute('dd_user_account_id')
                    || strcasecmp($fresh->email, $login->email) !== 0) {
                    $this->unavailable();
                }

                $accountId = $fresh->getAttribute('dd_user_account_id');
                $account = null;
                if ($accountId !== null) {
                    if ($connection->getDriverName() !== 'pgsql' || ! is_numeric($accountId) || (int) $accountId < 1) {
                        $this->unavailable();
                    }
                    $account = $connection->table('jairoads_next.user_accounts')->where('id', $accountId)->lockForUpdate()->first();
                    if (! $account || ! in_array($account->is_active, [true, 1, '1', 't', 'true'], true)
                        || strcasecmp((string) $account->email, $fresh->email) !== 0
                        || ! DataDictionaryIdentityResolver::roleLinkValid((string) $account->account_type, $account->engineer_id === null ? null : (int) $account->engineer_id)
                        || $connection->table('public.users')->where('dd_user_account_id', $accountId)->where('id', '!=', $fresh->getKey())->exists()) {
                        $this->unavailable();
                    }
                    if ($account->engineer_id !== null) {
                        $engineer = $connection->table('jairoads_next.engineers')->where('id', $account->engineer_id)->sharedLock()->first(['engineer_status']);
                        if (! $engineer || $engineer->engineer_status !== 'Active') {
                            $this->unavailable();
                        }
                    }
                    // Only token-verified recovery may repair previously desynchronized hashes.
                    if (! $recover && ! hash_equals($fresh->password, (string) $account->password)) {
                        $this->unavailable();
                    }
                }

                if ($currentPassword !== null && ! Hash::check($currentPassword, $fresh->password)) {
                    throw ValidationException::withMessages(['current_password' => __('auth.password')]);
                }
                if ($rehash && ! $force && ! Hash::needsRehash($fresh->password)) {
                    return null;
                }

                // Generate once. The hashed model cast preserves an already-current hash.
                $hash = Hash::make($password);
                $rememberToken = $rehash ? $fresh->getRememberToken() : Str::random(60);
                $fresh->forceFill(['password' => $hash, 'remember_token' => $rememberToken])->save();
                if ($account !== null && $connection->table('jairoads_next.user_accounts')->where('id', $accountId)
                    ->update(['password' => $hash, 'updated_at' => now()]) !== 1) {
                    $this->unavailable();
                }
                if (! $rehash && config('session.driver') === 'database'
                    && (config('session.connection') === null || config('session.connection') === $connection->getName())) {
                    $connection->table(config('session.table', 'sessions'))->where('user_id', $fresh->getKey())->delete();
                }

                return ['password' => $hash, 'remember_token' => $rememberToken];
            }, 3);
        } catch (QueryException) {
            // A SQL exception can embed credential bindings. Do not expose/report it or chain it.
            $this->unavailable();
        }

        if ($credentials !== null) {
            // Respect an enclosing Settings/audit transaction as well as our own transaction.
            $connection->afterCommit(function () use ($login, $credentials): void {
                $login->forceFill($credentials)->syncOriginalAttributes(['password', 'remember_token']);
            });
        }
    }

    private function unavailable(): never
    {
        // Match the broker's generic unavailable-account response, including during recovery.
        throw ValidationException::withMessages(['email' => __('passwords.user')]);
    }
}

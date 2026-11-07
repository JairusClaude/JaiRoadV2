<?php

declare(strict_types=1);

namespace App\Auth;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\LinkedPasswordUpdater;
use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Fortify;
use SensitiveParameter;

/** Retains Eloquent/Fortify behavior; synchronizes only explicitly DD-linked rehashes. */
final class LinkedPasswordUserProvider extends EloquentUserProvider
{
    /** @param array<string, mixed> $credentials */
    public function validateCredentials(Authenticatable $user, #[SensitiveParameter] array $credentials): bool
    {
        // A current hash still needs canonical active-account/link verification.
        // No legacy-only identity may establish an accepted session.
        if (! $user instanceof User || app(AccountIdentityResolver::class)->resolve($user) === null) {
            return false;
        }

        return parent::validateCredentials($user, $credentials);
    }

    /** @param array<string, mixed> $credentials */
    public function retrieveByCredentials(#[SensitiveParameter] array $credentials)
    {
        $user = parent::retrieveByCredentials($credentials);

        return $user instanceof User && app(AccountIdentityResolver::class)->resolveForRecovery($user) !== null ? $user : null;
    }

    public function retrieveByToken($identifier, #[SensitiveParameter] $token)
    {
        $user = parent::retrieveByToken($identifier, $token);

        return $user instanceof User && app(AccountIdentityResolver::class)->resolve($user) !== null ? $user : null;
    }

    /** @param array<string, mixed> $credentials */
    public function rehashPasswordIfRequired(Authenticatable $user, #[SensitiveParameter] array $credentials, bool $force = false): void
    {
        if (! $user instanceof User || app(AccountIdentityResolver::class)->resolve($user) === null) {
            throw ValidationException::withMessages([Fortify::username() => __('auth.failed')]);
        }
        if (! $force && ! $this->hasher->needsRehash($user->getAuthPassword())) {
            return;
        }

        try {
            app(LinkedPasswordUpdater::class)->rehash($user, $credentials['password'], $force);
        } catch (ValidationException) {
            throw ValidationException::withMessages([Fortify::username() => __('auth.failed')]);
        }
    }
}

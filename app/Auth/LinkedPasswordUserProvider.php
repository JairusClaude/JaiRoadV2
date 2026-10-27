<?php

declare(strict_types=1);

namespace App\Auth;

use App\Models\User;
use App\Services\DataDictionary\LinkedPasswordUpdater;
use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Fortify;
use SensitiveParameter;

/** Retains Eloquent/Fortify behavior; synchronizes only explicitly DD-linked rehashes. */
final class LinkedPasswordUserProvider extends EloquentUserProvider
{
    /** @param array<string, mixed> $credentials */
    public function rehashPasswordIfRequired(Authenticatable $user, #[SensitiveParameter] array $credentials, bool $force = false): void
    {
        if (! $user instanceof User || $user->getAttribute('dd_user_account_id') === null) {
            parent::rehashPasswordIfRequired($user, $credentials, $force);

            return;
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

<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use Illuminate\Auth\Middleware\Authenticate;

/** Fortify credential management must not retain revoked canonical authority. */
final class AuthenticateEligibleAccount extends Authenticate
{
    /** @param list<string|null> $guards */
    protected function authenticate($request, array $guards): void
    {
        parent::authenticate($request, $guards);
        $user = $request->user();
        // A revoked user must still be able to invalidate their real session.
        if (! $request->routeIs('logout') && $user instanceof User && $user->getAttribute('dd_user_account_id') !== null) {
            abort_unless(app(DataDictionaryIdentityResolver::class)->resolve($user) !== null, 403);
        }
    }
}

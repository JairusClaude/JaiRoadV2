<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/** Block retired authentication entry points even if a stale route cache exists. */
final class EnsurePasswordRecoveryDelivery
{
    public static function retired(string $uri, ?string $name = null): bool
    {
        return Str::is(['register', 'register.*', 'password.request', 'password.email', 'password.reset', 'password.update',
            'passkey.*', 'passkeys.*', 'well-known.passkeys', 'two-factor.*'], $name ?? '')
            || Str::is(['register', 'register/*', 'forgot-password', 'reset-password', 'reset-password/*', 'passkeys', 'passkeys/*',
                'user/passkeys', 'user/passkeys/*', 'two-factor-challenge', 'two-factor-challenge/*', 'user/two-factor-*',
                'user/confirmed-two-factor-authentication', 'internal-recovery', 'internal-recovery/*',
                'workspace/password-recovery', 'workspace/password-recovery/*', '.well-known/passkey-endpoints'], trim($uri, '/'));
    }

    public function handle(Request $request, Closure $next): Response
    {
        abort_if(self::retired($request->path(), $request->route()?->getName()), 404);

        return $next($request);
    }
}

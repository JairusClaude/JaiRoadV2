<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Block retired authentication entry points even if a stale route cache exists. */
final class EnsurePasswordRecoveryDelivery
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->routeIs('password.request', 'password.email', 'password.reset', 'password.update', 'passkey.*', 'passkeys.*', 'well-known.passkeys')
            || $request->is('forgot-password', 'reset-password', 'reset-password/*', 'passkeys', 'passkeys/*',
                'internal-recovery', 'internal-recovery/*', 'dd-phase3/password-recovery', 'dd-phase3/password-recovery/*', '.well-known/passkey-endpoints')) {
            abort(404);
        }

        return $next($request);
    }
}

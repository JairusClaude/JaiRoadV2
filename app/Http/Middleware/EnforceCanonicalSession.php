<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/** Runs before Inertia shares a user or any legacy/protected route executes. */
final class EnforceCanonicalSession
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->routeIs('logout')) {
            return $next($request);
        }
        $resolver = app(DataDictionaryIdentityResolver::class);
        $user = $request->user();
        if ($user !== null && $resolver->resolve($user) === null) {
            $this->revoke($request);
            abort(403, 'Your account is unavailable. Please contact your administrator.');
        }
        // Fortify loads MFA challenges directly by model ID, bypassing providers.
        if ($request->routeIs('two-factor.*') && $request->session()->has('login.id')) {
            $challenged = User::query()->whereKey($request->session()->get('login.id'))->first();
            if (! $challenged || $resolver->resolve($challenged) === null) {
                $this->revoke($request);
                throw ValidationException::withMessages(['code' => __('auth.failed')]);
            }
        }

        $response = $next($request);
        // Includes the request establishing a new password/MFA/passkey session.
        $user = $request->user();
        if ($request->routeIs('login.store', 'two-factor.login.store', 'passkey.login')
            && $user !== null && $resolver->resolve($user) === null) {
            $this->revoke($request);
            abort(403, 'Your account is unavailable. Please contact your administrator.');
        }

        return $response;
    }

    private function revoke(Request $request): void
    {
        Auth::guard()->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}

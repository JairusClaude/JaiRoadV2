<?php

use App\Http\Middleware\GuardLegacyRoutesForCanonicalAccounts;
use App\Http\Middleware\EnforceCanonicalSession;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\AuthenticateSession;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;
use Webauthn\Exception\AuthenticatorResponseVerificationException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        $middleware->prependToPriorityList(AuthenticatesRequests::class, EnforceCanonicalSession::class);
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);

        $middleware->web(append: [
            HandleAppearance::class,
            EnforceCanonicalSession::class,
            AuthenticateSession::class,
            HandleInertiaRequests::class,
            GuardLegacyRoutesForCanonicalAccounts::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticatorResponseVerificationException $exception, Request $request): ?Response {
            if (! $request->routeIs('passkey.*')) {
                return null;
            }
            // Expected invalid WebAuthn proof is a credential error, never a
            // successful login or a response exposing verification internals.
            $errors = ['credential' => ['Unable to verify this passkey. Please try again.']];

            return $request->expectsJson()
                ? response()->json(['message' => $errors['credential'][0], 'errors' => $errors], 422)
                : back()->withErrors($errors);
        });
        $exceptions->render(function (AuthenticationException $exception, Request $request): ?Response {
            if ($request->isMethod('GET') && $request->header('X-Inertia') && ! $request->expectsJson() && ! $request->is('api/*')) {
                // A missing encrypted history entry can resolve to an identical
                // cached login page. Use Inertia's location protocol so both the
                // document and address bar leave the protected URL together.
                Inertia::clearHistory();

                return Inertia::location(redirect()->guest(route('login')));
            }

            return null;
        });
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();

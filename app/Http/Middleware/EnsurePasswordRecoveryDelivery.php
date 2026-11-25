<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

/** Prevent silent log-only password resets and rate-limit anonymous mail requests. */
final class EnsurePasswordRecoveryDelivery
{
    public function handle(Request $request, Closure $next): Response
    {
        // Keep the existing Fortify route names for generated frontend routes,
        // but make email-based recovery an explicit deployment opt-in.
        if ($request->isMethod('POST') && $request->routeIs('password.email', 'password.update')
            && ! config('app.email_password_recovery')) {
            throw ValidationException::withMessages(['email' => 'Use internal account recovery on the Forgot Password page.']);
        }
        if (! $request->isMethod('POST') || ! $request->routeIs('password.email')) {
            return $next($request);
        }

        $key = 'jairoads:password-recovery:'.hash('sha256', (string) $request->ip());
        if (RateLimiter::tooManyAttempts($key, 10)) {
            throw ValidationException::withMessages(['email' => 'Too many reset requests. Please wait a minute and try again.']);
        }
        RateLimiter::hit($key, 60);

        // Log/array transports intentionally exist in local tests. Never send
        // production reset tokens to application logs or claim those were mailed.
        if (app()->isProduction()) {
            $mailer = (string) config('mail.default');
            if (! $this->delivers($mailer) || parse_url((string) config('app.url'), PHP_URL_SCHEME) !== 'https') {
                $this->unavailable();
            }
        }

        try {
            return $next($request);
        } catch (TransportExceptionInterface|\InvalidArgumentException $error) {
            // Transport exceptions can include provider credentials or message
            // content. Do not expose them or report raw exceptions.
            $this->unavailable();
        }
    }

    /** @param list<string> $seen */
    private function delivers(string $mailer, array $seen = []): bool
    {
        if (in_array($mailer, $seen, true)) {
            return false;
        }
        $configuration = config('mail.mailers.'.$mailer);
        if (! is_array($configuration)) {
            return false;
        }
        $transport = $configuration['transport'] ?? null;
        if (in_array($transport, ['failover', 'roundrobin'], true)) {
            $children = $configuration['mailers'] ?? [];

            return is_array($children) && $children !== [] && collect($children)
                ->every(fn ($child) => is_string($child) && $this->delivers($child, [...$seen, $mailer]));
        }

        return in_array($transport, ['smtp', 'sendmail', 'resend', 'postmark', 'ses', 'ses-v2', 'mailgun'], true);
    }

    private function unavailable(): never
    {
        throw ValidationException::withMessages(['email' => 'Password recovery email is temporarily unavailable. Please try again later or contact your system administrator.']);
    }
}

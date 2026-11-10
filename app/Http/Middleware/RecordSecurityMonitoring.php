<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Services\SecurityMonitoring\AuthenticationTelemetry;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Outer web middleware: record only after StartSession has saved successfully. */
final class RecordSecurityMonitoring
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        app(AuthenticationTelemetry::class)->record($request, $response->getStatusCode());

        return $response;
    }
}

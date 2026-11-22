<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keep redirects and generated routes on the configured HTTPS site.
 *
 * A Render TLS proxy talks HTTP to Nginx/PHP-FPM. Without an explicitly
 * configured trusted-proxy CIDR, Laravel sees HTTP and can generate http://
 * Location headers. Browsers block those cross-origin redirects during
 * Inertia fetch navigation even though ordinary refreshes still work.
 *
 * Do not trust caller-supplied X-Forwarded-* headers or wildcard proxies:
 * pin URL generation to the server-configured origin instead.
 */
final class EnforceCanonicalPublicOrigin
{
    public function handle(Request $request, Closure $next): Response
    {
        $root = (string) config('app.url', '');

        if (parse_url($root, PHP_URL_SCHEME) === 'https'
            && is_string(parse_url($root, PHP_URL_HOST))
            && parse_url($root, PHP_URL_HOST) !== '') {
            URL::forceRootUrl(rtrim($root, '/'));
            URL::forceScheme('https');
        }

        return $next($request);
    }
}

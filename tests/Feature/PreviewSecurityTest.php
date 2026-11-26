<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Http\Controllers\OperationsFrontendController;
use App\Http\Middleware\EnforceCanonicalSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use Tests\TestCase;

final class PreviewSecurityTest extends TestCase
{
    public function test_client_headers_and_ports_cannot_activate_preview_or_log_in_synthetic_user(): void
    {
        // Even when the feature flag is mistakenly enabled outside preview,
        // a requester cannot select the synthetic SuperAdmin identity.
        config(['app.preview_mode' => true]);

        $request = Request::create('http://localhost:8080/workspace/ui/road-coverages', 'GET', [], [], [], [
            'SERVER_PORT' => '8080',
            'HTTP_X_PREVIEW_MODE' => 'true',
            'HTTP_X_FORWARDED_PORT' => '8080',
        ]);
        $this->assertFalse(OperationsFrontendController::isPreview($request));
        $this->assertSame('not preview', (new EnforceCanonicalSession)->handle(
            $request,
            static fn (): Response => new Response('not preview'),
        )->getContent());
        $this->assertFalse(Auth::check());
    }

    public function test_canonical_routes_have_no_global_csrf_bypass_or_wildcard_proxy_trust(): void
    {
        // Laravel disables CSRF verification during unit tests. Verify that
        // deployment middleware does not exempt the canonical mutation URLs.
        $bootstrap = file_get_contents(base_path('bootstrap/app.php'));
        $this->assertIsString($bootstrap);
        $this->assertStringNotContainsString('validateCsrfTokens(except:', $bootstrap);
        $this->assertStringNotContainsString("trustProxies(at: '*')", $bootstrap);
        $this->assertStringNotContainsString('trustProxies(at: config(', $bootstrap);
        $this->assertStringContainsString("['trusted_proxies']", $bootstrap);
        $this->assertStringContainsString('bootstrap/cache/config.php', $bootstrap);
    }
}

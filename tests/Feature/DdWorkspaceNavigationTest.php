<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Http\Middleware\DenyLegacyBusinessRoutesForDd;
use App\Models\User;
use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/** No database access: verifies only the legacy-route boundary and redirects. */
final class DdWorkspaceNavigationTest extends TestCase
{
    private function requestFor(string $path, string $method = 'GET', bool $linked = true): Request
    {
        $user = new User;
        $user->forceFill(['id' => 901, 'dd_user_account_id' => $linked ? 77 : null]);
        $request = Request::create($path, $method);
        $request->setUserResolver(static fn () => $user);
        return $request;
    }

    private function bindIdentity(?array $identity): void
    {
        $this->app->instance(DataDictionaryIdentityResolver::class, new class($identity)
        {
            public function __construct(private ?array $identity) {}
            public function resolve(User $user): ?array { return $this->identity; }
        });
    }

    public function test_exact_module_entries_redirect_to_dd_modules(): void
    {
        $this->bindIdentity(['role' => 'Engineer', 'account_id' => 77]);
        foreach ([
            '/maintenance-projects' => 'projects', '/monthly-updates-preview' => 'updates',
            '/project-documents-preview' => 'documents', '/road-sections-preview' => 'roads',
            '/lgus-preview' => 'lgus', '/settings-preview' => 'settings',
            '/user-management' => 'users', '/admin-dashboard' => 'dashboard',
        ] as $old => $section) {
            $response = (new DenyLegacyBusinessRoutesForDd)->handle($this->requestFor($old), static fn () => new Response('unexpected'));
            $this->assertSame(302, $response->getStatusCode());
            $this->assertSame('/dd-phase3/'.$section, parse_url($response->headers->get('Location'), PHP_URL_PATH));
        }
    }

    public function test_legacy_ids_and_mutations_stay_blocked(): void
    {
        foreach ([['/maintenance-projects/42', 'GET'], ['/maintenance-projects', 'POST'], ['/monthly-updates-preview/save', 'POST'], ['/settings/profile', 'PATCH']] as [$path, $method]) {
            try {
                (new DenyLegacyBusinessRoutesForDd)->handle($this->requestFor($path, $method), static fn () => new Response('unexpected'));
                $this->fail('A legacy entity request crossed the boundary.');
            } catch (HttpException $failure) {
                $this->assertSame(403, $failure->getStatusCode());
            }
        }
    }

    public function test_invalid_dd_identity_cannot_use_a_redirect_as_fallback(): void
    {
        $this->bindIdentity(null);
        $this->expectException(HttpException::class);
        (new DenyLegacyBusinessRoutesForDd)->handle($this->requestFor('/maintenance-projects'), static fn () => new Response('unexpected'));
    }

    public function test_unlinked_and_dd_native_requests_continue_to_their_own_controllers(): void
    {
        $next = static fn () => new Response('passed');
        $middleware = new DenyLegacyBusinessRoutesForDd;
        $this->assertSame('passed', $middleware->handle($this->requestFor('/maintenance-projects', 'GET', false), $next)->getContent());
        $this->assertSame('passed', $middleware->handle($this->requestFor('/dd-phase3/ops/updates', 'POST'), $next)->getContent());
    }
}

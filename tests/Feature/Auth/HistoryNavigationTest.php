<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('unauthenticated Inertia page navigation leaves the protected URL through the location protocol', function () {
    $url = '/dd-phase3/ui/monthly-updates?year=2026';
    $this->withHeaders(['X-Inertia' => 'true', 'Accept' => 'text/html'])->get($url)
        ->assertStatus(409)->assertHeader('X-Inertia-Location', route('login'))
        ->assertSessionHas('url.intended', url($url));
    $this->flushHeaders()->get(route('login'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('auth/login')->where('auth.user', null))
        ->assertViewHas('page', fn (array $page): bool => ($page['clearHistory'] ?? false) === true && ($page['encryptHistory'] ?? false) === true);
});

test('ordinary guest navigation and JSON authentication failures keep their response contracts', function () {
    $this->get('/dd-phase3/ui/monthly-updates')->assertRedirect(route('login'));
    $this->withHeaders(['X-Inertia' => 'true'])->getJson('/dd-phase3/ui/monthly-updates')
        ->assertUnauthorized()->assertHeaderMissing('X-Inertia-Location');
});

test('the navigation response does not change unauthenticated mutation handling', function () {
    $this->withHeaders(['X-Inertia' => 'true', 'Accept' => 'text/html'])
        ->post('/dd-phase3/ui/monthly-updates', [])->assertRedirect(route('login'));
});

test('real Fortify logout invalidates the session before subsequent history requests', function () {
    $user = $this->canonicalUser(User::factory()->create());
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect();
    $this->assertAuthenticatedAs($user);
    $session = session()->getId();
    $this->post(route('logout'))->assertRedirect(route('home'));
    $this->assertGuest();
    expect(session()->getId())->not->toBe($session);
    $this->withHeaders(['X-Inertia' => 'true', 'Accept' => 'text/html'])
        ->get('/dd-phase3/ui/monthly-updates')->assertStatus(409)->assertHeader('X-Inertia-Location', route('login'));
});

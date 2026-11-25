<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

test('login screen can be rendered', function () {
    $response = $this->get(route('login'));

    $response->assertOk()->assertInertia(fn (Assert $page) => $page->component('auth/login')->has('passkeyReady'));
});

test('HTTPS public origin preserves client-side login and canonical workspace redirects', function () {
    $originalUrl = config('app.url');
    config(['app.url' => 'https://jairoads.example.test']);
    $this->withServerVariables(['HTTP_HOST' => 'jairoads.example.test', 'HTTPS' => 'off']);

    try {
        // The TLS proxy talks HTTP to PHP-FPM. Redirects still have to remain
        // same-origin HTTPS for browser fetch/Inertia to follow them.
        $this->get('/')->assertRedirect('https://jairoads.example.test/login');

        $user = $this->canonicalUser(User::factory()->create());
        $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertRedirect('https://jairoads.example.test/dashboard');
        $this->assertAuthenticatedAs($user);

        $this->get('/dashboard')->assertRedirect('https://jairoads.example.test/dd-superadmin-landing');
        $this->get('/maintenance-projects')->assertRedirect('https://jairoads.example.test/workspace/ui/maintenance-projects');
        $this->get('/user-management')->assertRedirect('https://jairoads.example.test/workspace/users');
    } finally {
        // In-process test requests share configuration and the URL generator.
        // Restore both before unrelated tests and password-recovery flows.
        config(['app.url' => $originalUrl]);
        URL::forceRootUrl(null);
        URL::forceScheme(null);
    }
});

test('users can authenticate using the login screen', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});

test('users with two factor enabled are redirected to two factor challenge', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $user = $this->canonicalUser(User::factory()->withTwoFactor()->create());

    $response = $this->post(route('login'), [
        'email' => $user->email,
        'password' => 'password',
    ]);

    $response->assertRedirect(route('two-factor.login'));
    $response->assertSessionHas('login.id', $user->id);
    $this->assertGuest();
});

test('users can not authenticate with invalid password', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $this->assertGuest();
});

test('users can logout', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this->actingAs($user)->post(route('logout'));

    $response->assertRedirect(route('home'));

    $this->assertGuest();
});

test('users are rate limited', function () {
    $user = $this->canonicalUser(User::factory()->create());

    RateLimiter::increment(md5('login'.implode('|', [$user->email, '127.0.0.1'])), amount: 5);

    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertTooManyRequests();
});

test('remember checkbox issues a persistent cookie only when selected', function (string $remember) {
    $user = $this->canonicalUser(User::factory()->create());
    $cookie = Auth::guard('web')->getRecallerName();
    $response = $this->post(route('login.store'), [
        'email' => $user->email,
        'password' => 'password',
        'remember' => $remember,
    ]);
    $this->assertAuthenticatedAs($user);
    if ($remember === '1') {
        $response->assertCookie($cookie);
    } else {
        $response->assertCookieMissing($cookie);
    }
})->with(['0', '1']);

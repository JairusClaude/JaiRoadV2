<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

test('login screen can be rendered', function () {
    $response = $this->get(route('login'));

    $response->assertOk()->assertInertia(fn (Assert $page) => $page->component('auth/login')->has('passkeyReady'));
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

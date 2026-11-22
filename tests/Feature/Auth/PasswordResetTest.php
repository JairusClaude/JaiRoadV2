<?php

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::resetPasswords());
});

test('reset password link screen can be rendered', function () {
    $response = $this->get(route('password.request'));

    $response->assertOk()->assertInertia(fn (Assert $page) => $page->component('auth/forgot-password'));
});

test('reset password link can be requested', function () {
    Notification::fake();

    $user = $this->canonicalUser(User::factory()->create());

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        $mail = $notification->toMail($user);
        expect($mail->subject)->toBe('Reset your JaiROADS password')
            ->and($mail->actionUrl)->toStartWith(rtrim((string) config('app.url'), '/').'/reset-password/');

        return true;
    });
});

test('reset password screen can be rendered', function () {
    Notification::fake();

    $user = $this->canonicalUser(User::factory()->create());

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        $response = $this->get(route('password.reset', ['token' => $notification->token, 'email' => $user->email]));

        $response->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('auth/reset-password')->where('email', $user->email)->where('token', $notification->token));

        return true;
    });
});

test('password can be reset with valid token', function () {
    Notification::fake();

    $user = $this->canonicalUser(User::factory()->create());

    $this->post(route('password.email'), ['email' => $user->email]);

    Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
        $response = $this->post(route('password.update'), [
            'token' => $notification->token,
            'email' => $user->email,
            'password' => 'New-Disposable-Password!123',
            'password_confirmation' => 'New-Disposable-Password!123',
        ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('login'));
        expect(Hash::check('New-Disposable-Password!123', $user->fresh()->password))->toBeTrue()
            ->and(Hash::check('password', $user->fresh()->password))->toBeFalse();
        $this->post(route('password.update'), [
            'token' => $notification->token,
            'email' => $user->email,
            'password' => 'Another-Disposable!456',
            'password_confirmation' => 'Another-Disposable!456',
        ])->assertSessionHasErrors('email');

        return true;
    });
});

test('password cannot be reset with invalid token', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this->post(route('password.update'), [
        'token' => 'invalid-token',
        'email' => $user->email,
        'password' => 'newpassword123',
        'password_confirmation' => 'newpassword123',
    ]);

    $response->assertSessionHasErrors('email');
});

test('production recovery refuses log-only delivery rather than exposing reset tokens', function () {
    Notification::fake();
    $user = $this->canonicalUser(User::factory()->create());
    config(['mail.default' => 'log', 'app.url' => 'https://jairoads.example.test']);
    $this->app->detectEnvironment(fn () => 'production');
    $this->withSession(['_token' => 'valid-recovery-test-token'])
        ->from(route('password.request'))
        ->post(route('password.email'), ['email' => $user->email, '_token' => 'valid-recovery-test-token'])
        ->assertRedirect(route('password.request'))
        ->assertSessionHasErrors('email');
    Notification::assertNothingSent();
});

test('production recovery rejects a failover that could log private reset links', function () {
    Notification::fake();
    $user = $this->canonicalUser(User::factory()->create());
    config(['mail.default' => 'failover', 'mail.mailers.failover.mailers' => ['smtp', 'log'], 'app.url' => 'https://jairoads.example.test']);
    $this->app->detectEnvironment(fn () => 'production');
    $this->withSession(['_token' => 'valid-recovery-test-token'])
        ->post(route('password.email'), ['email' => $user->email, '_token' => 'valid-recovery-test-token'])
        ->assertSessionHasErrors('email');
    Notification::assertNothingSent();
});

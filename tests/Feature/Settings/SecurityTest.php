<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

test('security page is displayed', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);
    Features::passkeys([
        'confirmPassword' => true,
    ]);

    $user = $this->canonicalUser(User::factory()->create());

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canManagePasskeys', true)
            ->where('passkeys', [])
            ->where('canManageTwoFactor', true)
            ->where('twoFactorEnabled', false),
        );
});

test('security page requires password confirmation when enabled', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    $user = $this->canonicalUser(User::factory()->create());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $response = $this->actingAs($user)
        ->get(route('security.edit'));

    $response->assertRedirect(route('password.confirm'));
});

test('security page renders without two factor when feature is disabled', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    config(['fortify.features' => []]);

    $user = $this->canonicalUser(User::factory()->create());

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canManagePasskeys', false)
            ->where('passkeys', [])
            ->where('canManageTwoFactor', false)
            ->missing('twoFactorEnabled')
            ->missing('requiresConfirmation'),
        );
});

test('password can be updated', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this
        ->actingAs($user)
        ->from(route('security.edit'))
        ->put('/dd-phase3/ops/settings', [
            'username' => 'safe-settings-user',
            'current_password' => 'password',
            'password' => 'New-Password!123',
            'password_confirmation' => 'New-Password!123',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect('/dd-phase3/settings');

    expect(Hash::check('New-Password!123', $user->refresh()->password))->toBeTrue();
});

test('correct password must be provided to update password', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this
        ->actingAs($user)
        ->from(route('security.edit'))
        ->put('/dd-phase3/ops/settings', [
            'username' => 'safe-settings-user',
            'current_password' => 'wrong-password',
            'password' => 'New-Password!123',
            'password_confirmation' => 'New-Password!123',
        ]);

    $response->assertStatus(422);
    expect(Hash::check('password', $user->fresh()->password))->toBeTrue();
    expect(Hash::check('New-Password!123', $user->fresh()->password))->toBeFalse();
});

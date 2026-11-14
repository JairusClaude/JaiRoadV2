<?php

use App\Models\User;

test('profile page is displayed', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this
        ->actingAs($user)
        ->get(route('profile.edit'));

    $response->assertRedirect('/dd-phase3/settings');
});

test('legacy profile cannot rewrite canonical identity', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

    $response
        ->assertForbidden();

    $user->refresh();

    expect($user->name)->not->toBe('Test User');
    expect($user->email)->not->toBe('test@example.com');
    expect($user->email_verified_at)->not->toBeNull();
});

test('email verification status is unchanged when the email address is unchanged', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this
        ->actingAs($user)
        ->patch(route('profile.update'), [
            'name' => 'Test User',
            'email' => $user->email,
        ]);

    $response
        ->assertForbidden();

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

test('legacy self deletion cannot remove canonical history', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this
        ->actingAs($user)
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ]);

    $response
        ->assertForbidden();

    $this->assertAuthenticatedAs($user);
    expect($user->fresh())->not->toBeNull();
});

test('correct password must be provided to delete account', function () {
    $user = $this->canonicalUser(User::factory()->create());

    $response = $this
        ->actingAs($user)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), [
            'password' => 'wrong-password',
        ]);

    $response
        ->assertForbidden();

    expect($user->fresh())->not->toBeNull();
});

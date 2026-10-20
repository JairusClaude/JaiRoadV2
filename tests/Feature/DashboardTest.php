<?php

use App\Models\User;
use App\Models\UserAccount;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('unlinked authenticated users cannot enter an operational dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertForbidden();
});

test('active explicitly linked legacy accounts reach their role dashboard', function (string $role, string $destination) {
    $account = UserAccount::factory()->create(['accountType' => $role, 'is_active' => true]);
    $user = User::factory()->create(['user_account_id' => $account->getKey()]);
    $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route($destination));
})->with([
    ['admin', 'jairoads.admin-dashboard'],
    ['viewer', 'jairoads.role-dashboard'],
]);

test('deactivated linked legacy accounts cannot enter an operational dashboard', function () {
    $account = UserAccount::factory()->create(['accountType' => 'admin', 'is_active' => false]);
    $user = User::factory()->create(['user_account_id' => $account->getKey()]);
    $this->actingAs($user)->get(route('dashboard'))->assertForbidden();
});

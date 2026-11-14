<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('guests are redirected to the login page', function () {
    $this->get(route('dashboard'))->assertRedirect(route('login'));
});

test('an authenticated login without an approved account receives no dashboard access', function () {
    $this->actingAs(User::factory()->create())->get(route('dashboard'))->assertForbidden();
});

test('a verified active viewer is routed to and can read their role dashboard', function () {
    $user = $this->canonicalUser(User::factory()->create(), 'Viewer');
    $target = route('jairoads.dd-phase3.show', ['section' => 'dashboard']);
    $this->actingAs($user)->get(route('dashboard'))->assertRedirect($target);
    $this->get($target)->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('dd-phase3/RoleDashboard'));
});

<?php

use Laravel\Fortify\Features;

test('registration screen follows the configured availability', function () {
    if (! Features::enabled(Features::registration())) {
        $this->get('/register')->assertNotFound();

        return;
    }

    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register', function () {
    if (! Features::enabled(Features::registration())) {
        $this->post('/register', [
            'name' => 'Unapproved account', 'email' => 'unapproved@example.test',
            'password' => 'password', 'password_confirmation' => 'password',
            'account_type' => 'SuperAdmin',
        ])->assertNotFound();
        $this->assertGuest();
        $this->assertDatabaseCount('users', 0);

        return;
    }

    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $this->assertAuthenticated();
    $response->assertRedirect(route('dashboard', absolute: false));
});

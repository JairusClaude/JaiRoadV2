<?php

use Inertia\Testing\AssertableInertia;

test('the public entry redirects to the working Fortify login form', function () {
    $this->get(route('home'))->assertRedirect(route('login'));
    $this->get(route('login'))->assertOk()->assertInertia(fn (AssertableInertia $page) => $page->component('auth/login'));
});

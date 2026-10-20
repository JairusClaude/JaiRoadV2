<?php

test('home redirects to the approved login entry', function () {
    $response = $this->get(route('home'));

    $response->assertRedirect(route('login'));
});

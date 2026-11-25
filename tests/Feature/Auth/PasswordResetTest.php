<?php

use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

test('public password recovery and passkey authentication are disabled', function () {
    expect(Features::enabled(Features::resetPasswords()))->toBeFalse();
    expect(Features::canManagePasskeys())->toBeFalse();
    $this->get('/login')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('auth/login')->missing('canResetPassword')->missing('passkeyReady'));

    foreach (['/forgot-password', '/reset-password/retired-token', '/passkeys/login/options', '/.well-known/passkey-endpoints'] as $url) {
        $this->getJson($url)->assertNotFound();
    }
    foreach (['/forgot-password', '/reset-password', '/passkeys/login', '/internal-recovery/request', '/internal-recovery/redeem'] as $url) {
        $this->postJson($url, [])->assertNotFound();
    }
});

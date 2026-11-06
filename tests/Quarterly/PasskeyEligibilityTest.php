<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Passkeys\Passkey;
use Laravel\Passkeys\Passkeys;
use PHPUnit\Framework\Attributes\DataProvider;

final class PasskeyEligibilityTest extends PostgresTestCase
{
    /** @return iterable<string,array{string}> */
    public static function roles(): iterable
    {
        foreach (['SuperAdmin', 'Admin', 'Engineer', 'Viewer'] as $role) {
            yield $role => [$role];
        }
    }

    #[DataProvider('roles')]
    public function test_canonical_passkey_gate_and_management_follow_current_lifecycle(string $role): void
    {
        $f = $this->fixture($role);
        $passkey = new Passkey(['credential' => []]);
        $passkey->user_id = $f['user']->id;
        $passkey->setRelation('user', $f['user']);
        $this->assertTrue(Passkeys::allowsLogin(Request::create('/passkeys/login'), $passkey));
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
        $this->assertFalse(Passkeys::allowsLogin(Request::create('/passkeys/login'), $passkey));
        foreach (['/user/passkeys/options', '/passkeys/confirm/options', '/settings/security'] as $path) {
            $this->getJson($path)->assertForbidden();
        }
        $this->postJson('/logout')->assertNoContent();
        $this->assertGuest();
    }
}

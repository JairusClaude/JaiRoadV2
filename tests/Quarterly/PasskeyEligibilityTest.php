<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
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
    public function test_retired_passkey_endpoints_cannot_bypass_current_lifecycle(string $role): void
    {
        $f = $this->fixture($role);
        $this->getJson('/passkeys/login/options')->assertNotFound();
        $this->postJson('/user/passkeys/options', [])->assertNotFound();
        $this->postJson('/passkeys/login', ['credential' => []])->assertNotFound();
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->canonical_user_account_id)->update(['is_active' => false]);
        $this->getJson('/settings/security')->assertForbidden();
        $this->assertGuest();
        $this->postJson('/passkeys/login', ['credential' => []])->assertNotFound();
        $this->postJson('/login', ['email' => $f['user']->email, 'password' => 'Disposable-Test!123'])->assertUnprocessable();
        $this->assertGuest();
    }
}

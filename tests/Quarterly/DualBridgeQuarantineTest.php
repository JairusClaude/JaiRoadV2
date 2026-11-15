<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\AccountIdentityResolver;
use App\Services\MaintenanceProjects\VerifiedProjectAccount;
use Illuminate\Support\Facades\DB;

final class DualBridgeQuarantineTest extends PostgresTestCase
{
    public function test_canonical_login_with_stale_legacy_link_never_gets_legacy_authority(): void
    {
        $root = $this->account('SuperAdmin');
        // The production inventory contains a dual-linked Fortify row. This
        // synthetic fixture needs no legacy account and never touches production.
        DB::table('public.users')->where('id', $root->getKey())
            ->update(['user_account_id' => 123]);

        $root->refresh();
        $legacy = app(VerifiedProjectAccount::class);

        $this->assertNull($legacy->resolve($root));
        $this->assertNull($legacy->role($root));
        $this->assertSame('SuperAdmin', app(AccountIdentityResolver::class)->resolve($root)['role']);

        $this->actingAs($root)->get('/dd-phase3/users')->assertOk();
        $this->getJson('/user-management')->assertForbidden();
    }
}

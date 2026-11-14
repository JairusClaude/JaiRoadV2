<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\AccountIdentityResolver;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

final class CanonicalAccessInventoryExpandedTest extends PostgresTestCase
{
    public function test_summary_flags_dual_legacy_bridge_and_inactive_lgu_scope_without_changing_identity(): void
    {
        $user = $this->account('Engineer');
        DB::table('public.users')->where('id', $user->id)->update(['user_account_id' => 1]);
        $this->assertNotNull(app(AccountIdentityResolver::class)->resolve($user));
        $before = DB::table('public.users')->where('id', $user->id)->first();
        // The command uses SET TRANSACTION READ ONLY and must not be nested.
        DB::commit();

        try {
            $this->assertSame(0, Artisan::call('jairoads:canonical-access-preflight', ['--summary' => true]));
            $result = json_decode(Artisan::output(), true, 512, JSON_THROW_ON_ERROR);
            $this->assertSame(1, $result['roles']['Engineer']['dual_legacy_bridge_review']);
            $this->assertSame(1, $result['roles']['Engineer']['no_active_lgu_assignment']);
            $this->assertSame(1, $result['roles']['Engineer']['eligible']);
            $this->assertStringNotContainsString($user->email, Artisan::output());
            $this->assertEquals($before, DB::table('public.users')->where('id', $user->id)->first());
        } finally {
            PostgresTestSchema::clearCommittedFixtures();
        }
    }
}

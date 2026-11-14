<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\AccountIdentityResolver;
use Illuminate\Support\Facades\DB;

final class ViewerNoEngineerLinkTest extends PostgresTestCase
{
    public function test_viewer_account_is_unlinked_but_evidenced_read_only_and_login_eligible(): void
    {
        $viewer = $this->account('Viewer');
        $accountId = (int) $viewer->dd_user_account_id;

        $this->assertNull(DB::table('jairoads_next.user_accounts')->where('id', $accountId)->value('engineer_id'));
        $this->assertDatabaseHas('jairoads_security.account_provisioning', [
            'user_account_id' => $accountId, 'provisioned_role' => 'Viewer',
            'engineer_id' => null, 'method' => 'administrator',
        ]);
        $this->assertSame('Viewer', app(AccountIdentityResolver::class)->resolve($viewer)['role']);
        $this->actingAs($viewer)->get('/dd-phase3/projects')->assertOk();
        $this->postJson('/dd-phase3/ops/projects', [])->assertForbidden();
    }

    public function test_viewer_with_an_engineer_id_fails_closed_even_with_previous_evidence(): void
    {
        $viewer = $this->account('Viewer');
        $engineer = $this->engineer();
        DB::table('jairoads_next.user_accounts')->where('id', $viewer->dd_user_account_id)
            ->update(['engineer_id' => $engineer]);

        $this->assertFalse(AccountIdentityResolver::roleLinkValid('Viewer', $engineer));
        $this->assertNull(app(AccountIdentityResolver::class)->resolve($viewer));
        $this->actingAs($viewer)->getJson('/dd-phase3/projects')->assertForbidden();
    }
}

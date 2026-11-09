<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\AccountIdentityResolver;
use Illuminate\Support\Facades\DB;

/** Final DD: optional Viewer link and reviewed existing-Admin compatibility. */
final class SuperAdminLinkagePolicyTest extends PostgresTestCase
{
    public function test_role_link_validation_enforces_unlinked_superadmin_and_linked_ordinary_roles(): void
    {
        $this->assertTrue(AccountIdentityResolver::roleLinkValid('SuperAdmin', null));
        $this->assertFalse(AccountIdentityResolver::roleLinkValid('SuperAdmin', 1));
        $this->assertFalse(AccountIdentityResolver::roleLinkValid('SuperAdmin', 999));
        foreach (['Admin', 'Viewer'] as $role) {
            $this->assertTrue(AccountIdentityResolver::roleLinkValid($role, null));
            $this->assertFalse(AccountIdentityResolver::roleLinkValid($role, 0));
            $this->assertTrue(AccountIdentityResolver::roleLinkValid($role, 1));
        }
        $this->assertFalse(AccountIdentityResolver::roleLinkValid('Engineer', null));
        $this->assertFalse(AccountIdentityResolver::roleLinkValid('Engineer', 0));
        $this->assertTrue(AccountIdentityResolver::roleLinkValid('Engineer', 1));
        $this->assertFalse(AccountIdentityResolver::roleLinkValid('Unknown', null));
    }

    public function test_engineer_linked_superadmin_is_ineligible_but_valid_root_remains_authorized(): void
    {
        $resolver = app(AccountIdentityResolver::class);
        $validRoot = $this->account('SuperAdmin');
        $invalidRoot = $this->account('SuperAdmin');
        $engineerId = $this->engineer();

        $this->assertNotNull($resolver->resolve($validRoot));
        $this->assertNotNull($resolver->resolve($invalidRoot));
        // Simulate pre-existing malformed DD identity in disposable scratch DB only.
        DB::table('jairoads_next.user_accounts')->where('id', $invalidRoot->dd_user_account_id)
            ->update(['engineer_id' => $engineerId]);
        $this->assertDatabaseHas('jairoads_next.user_accounts', [
            'id' => $invalidRoot->dd_user_account_id,
            'account_type' => 'SuperAdmin',
            'engineer_id' => $engineerId,
            'is_active' => true,
        ]);

        $this->assertNull($resolver->resolve($invalidRoot));
        $this->assertNull($resolver->resolveForRecovery($invalidRoot));
        $this->assertFalse($resolver->canReactivate($invalidRoot));
        $this->assertFalse($resolver->notificationRecipients(null)
            ->where('account.id', $invalidRoot->dd_user_account_id)->exists());

        $this->assertNotNull($resolver->resolve($validRoot));
        $this->assertTrue($resolver->notificationRecipients(null)
            ->where('account.id', $validRoot->dd_user_account_id)->exists());
        $this->withSession(['password_hash_web' => null])->actingAs($invalidRoot)
            ->getJson('/dd-phase3/users')->assertForbidden();
        $this->assertGuest();
        $this->withSession(['password_hash_web' => null])->actingAs($validRoot)
            ->getJson('/dd-phase3/users')->assertOk();
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_other_role_identity_links_remain_eligible(): void
    {
        $resolver = app(AccountIdentityResolver::class);
        foreach (['Admin', 'Engineer', 'Viewer'] as $role) {
            $login = $this->account($role, $this->engineer());
            $actor = $resolver->resolve($login);
            $this->assertNotNull($actor);
            $this->assertSame($role, $actor['role']);
            $this->assertNotNull($actor['engineer_id']);
        }
    }
}

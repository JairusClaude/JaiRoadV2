<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\LinkedPasswordUpdater;
use App\Services\TrustedSuperAdminBootstrap;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Task 5: disaster-recovery gates on synthetic, strictly guarded PostgreSQL 17.
 *
 * This never runs against the official Supabase project or any real identity.
 */
final class SuperAdminRecoveryReadinessTest extends PostgresTestCase
{
    public function test_initial_root_with_no_engineer_can_recover_a_desynchronized_password_without_fabricating_a_new_root(): void
    {
        $id = app(TrustedSuperAdminBootstrap::class)->create(
            'synthetic-root', 'synthetic.root@example.test', 'Synthetic Root', 'Disposable-Root!123'
        );
        $root = User::where('canonical_user_account_id', $id)->firstOrFail();

        $this->assertSame(0, DB::table('jairoads_next.engineers')->count());
        $this->postJson('/login', ['email' => $root->email, 'password' => 'Disposable-Root!123'])->assertOk();
        $this->getJson('/workspace/users')->assertOk();
        $this->postJson('/logout')->assertNoContent();

        // Simulate canonical/Fortify credential drift; only a valid broker token
        // may repair the hashes, never a second privileged bootstrap.
        DB::table('jairoads_next.user_accounts')->where('id', $id)
            ->update(['password' => Hash::make('Stale-Synthetic!123')]);
        $this->postJson('/login', ['email' => $root->email, 'password' => 'Disposable-Root!123'])
            ->assertUnprocessable();
        $this->assertGuest();

        $token = Password::broker()->createToken($root);
        $this->postJson('/reset-password', [
            'email' => $root->email,
            'token' => $token,
            'password' => 'Recovered-Synthetic!123',
            'password_confirmation' => 'Recovered-Synthetic!123',
        ])->assertNotFound();
        $this->assertGuest();
        app(LinkedPasswordUpdater::class)->reset($root, 'Recovered-Synthetic!123');

        $this->assertSame(
            $root->fresh()->password,
            DB::table('jairoads_next.user_accounts')->where('id', $id)->value('password')
        );
        $this->postJson('/login', ['email' => $root->email, 'password' => 'Recovered-Synthetic!123'])->assertOk();
        $this->assertAuthenticatedAs($root);
        $this->getJson('/workspace/users')->assertOk();
        $this->assertNull(app(AccountIdentityResolver::class)->resolve($root)['engineer_id']);
        $this->assertSame(1, DB::table('jairoads_next.user_accounts')->where('account_type', 'SuperAdmin')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    /** @return iterable<string, array{string}> */
    public static function invalidRootRecoveryStates(): iterable
    {
        yield 'deactivated' => ['inactive'];
        yield 'missing canonical bridge' => ['bridge'];
        yield 'mismatched email' => ['email'];
        yield 'retired linked profile' => ['retired'];
    }

    #[DataProvider('invalidRootRecoveryStates')]
    public function test_broker_token_cannot_repair_an_ineligible_superadmin_identity(string $state): void
    {
        $engineer = $state === 'retired' ? $this->engineer() : null;
        $root = $this->account('SuperAdmin', $engineer);
        $token = Password::broker()->createToken($root);
        $oldHash = DB::table('jairoads_next.user_accounts')
            ->where('id', $root->canonical_user_account_id)->value('password');

        match ($state) {
            'inactive' => DB::table('jairoads_next.user_accounts')->where('id', $root->canonical_user_account_id)
                ->update(['is_active' => false]),
            'bridge' => DB::table('public.users')->where('id', $root->id)
                ->update(['canonical_user_account_id' => null]),
            'email' => DB::table('jairoads_next.user_accounts')->where('id', $root->canonical_user_account_id)
                ->update(['email' => 'different.root@example.test']),
            'retired' => DB::table('jairoads_next.engineers')->where('id', $engineer)
                ->update(['engineer_status' => 'Retired']),
        };

        $this->postJson('/reset-password', [
            'email' => $root->email,
            'token' => $token,
            'password' => 'Unauthorized-Recovery!123',
            'password_confirmation' => 'Unauthorized-Recovery!123',
        ])->assertNotFound();
        $this->postJson('/login', [
            'email' => $root->email, 'password' => 'Disposable-Test!123',
        ])->assertUnprocessable();
        $this->assertGuest();
        $this->assertSame($oldHash, DB::table('jairoads_next.user_accounts')
            ->where('id', $root->canonical_user_account_id)->value('password'));
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_administrator_cannot_deactivate_the_last_eligible_root_and_can_restore_an_approved_root(): void
    {
        $root = $this->account('SuperAdmin');
        $second = $this->account('SuperAdmin');
        $admin = $this->account('Admin');
        $id = (int) $root->canonical_user_account_id;
        $password = $root->password;

        DB::table('public.users')->where('id', $second->id)->update(['canonical_user_account_id' => null]);
        $this->withSession(['password_hash_web' => null])->actingAs($admin);
        $this->patchJson('/workspace/accounts/'.$id.'/status', ['is_active' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('is_active');
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $id, 'is_active' => true]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());

        // The second root must actually be eligible, not merely active in a row.
        DB::table('public.users')->where('id', $second->id)
            ->update(['canonical_user_account_id' => $second->canonical_user_account_id]);
        $this->patchJson('/workspace/accounts/'.$id.'/status', ['is_active' => false])
            ->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $id, 'is_active' => false]);
        $this->assertNull(app(AccountIdentityResolver::class)->resolve($root));
        $this->patchJson('/workspace/accounts/'.$id.'/status', ['is_active' => true])
            ->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $id, 'is_active' => true]);
        $this->assertSame($password, $root->fresh()->password);
        $this->assertNotNull(app(AccountIdentityResolver::class)->resolve($root));
        $this->assertSame(2, DB::table('jairoads_next.audit_logs')
            ->where('entity_type', 'UserAccount')->where('entity_id', $id)->count());

        // Explicit self-lockout is still forbidden, even with a backup root.
        $this->withSession(['password_hash_web' => null])->actingAs($root);
        $this->patchJson('/workspace/accounts/'.$id.'/status', ['is_active' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('is_active');
        $this->assertSame(2, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_pending_superadmin_mfa_challenge_cannot_consume_recovery_code_after_revocation(): void
    {
        $root = $this->account('SuperAdmin');
        $root->forceFill(['two_factor_recovery_codes' => encrypt(json_encode(['recovery-only-in-disposable-test'], JSON_THROW_ON_ERROR))])->save();
        $originalCodes = $root->fresh()->two_factor_recovery_codes;
        DB::table('jairoads_next.user_accounts')->where('id', $root->canonical_user_account_id)->update(['is_active' => false]);
        $this->postJson('/two-factor-challenge', ['recovery_code' => 'recovery-only-in-disposable-test'])->assertNotFound();
        $this->postJson('/passkeys/login', ['credential' => []])->assertNotFound();
        $this->postJson('/login', ['email' => $root->email, 'password' => 'Disposable-Test!123'])->assertUnprocessable();
        $this->assertGuest();
        $this->assertSame($originalCodes, $root->fresh()->two_factor_recovery_codes);
        $this->getJson('/settings/security')->assertUnauthorized();
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_superadmin_password_login_preserves_permissions_and_retired_mfa_is_unavailable(): void
    {
        $root = $this->account('SuperAdmin');
        $this->postJson('/login', ['email' => $root->email, 'password' => 'Disposable-Test!123'])->assertOk()->assertJson(['two_factor' => false]);
        $this->assertAuthenticatedAs($root);
        $this->getJson('/workspace/users')->assertOk();
        $this->assertSame('SuperAdmin', app(AccountIdentityResolver::class)->resolve($root)['role']);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
        $this->postJson('/logout')->assertNoContent();
        $this->postJson('/two-factor-challenge', ['recovery_code' => 'valid-disposable-recovery'])->assertNotFound();
    }
}

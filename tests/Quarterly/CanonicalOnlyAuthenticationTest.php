<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\User;
use App\Services\AccountIdentityResolver;
use App\Services\AccountProvisioning;
use App\Services\TrustedSuperAdminBootstrap;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Laravel\Passkeys\Passkey;
use Laravel\Passkeys\Passkeys;
use PHPUnit\Framework\Attributes\DataProvider;
use PragmaRX\Google2FA\Google2FA;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class CanonicalOnlyAuthenticationTest extends PostgresTestCase
{
    public function test_privileged_bootstrap_is_atomic_and_works_without_engineers_or_lgus(): void
    {
        $id = app(TrustedSuperAdminBootstrap::class)->create('trusted-root', 'root@example.test', 'Trusted operator', 'Disposable-Root!123');
        $login = User::where('dd_user_account_id', $id)->firstOrFail();
        $this->assertSame(0, DB::table('jairoads_next.engineers')->count());
        $this->assertSame(0, DB::table('jairoads_next.lgus')->count());
        $this->assertSame(0, DB::table(AccountProvisioning::TABLE)->count());
        $this->assertNull($login->email_verified_at);
        $this->postJson('/login', ['email' => $login->email, 'password' => 'Disposable-Root!123'])->assertOk();
        $this->get('/dd-phase3/users')->assertOk();
        $this->postJson('/dd-phase3/engineers', ['first_name' => 'New', 'last_name' => 'Profile', 'contact_no' => '09000000000', 'rank' => 'Engineer I'])->assertRedirect();
        $engineer = DB::table('jairoads_next.engineers')->value('id');
        $this->postJson('/dd-phase3/accounts', $this->provision('Viewer', (int) $engineer))->assertRedirect();
        $account = DB::table('jairoads_next.user_accounts')->where('username', 'ordinary')->first();
        $this->assertDatabaseHas(AccountProvisioning::TABLE, ['user_account_id' => $account->id, 'provisioned_by' => $id, 'method' => 'administrator']);
        $this->assertSame('Viewer', $account->account_type);
        $this->postJson('/dd-phase3/accounts', array_replace($this->provision('SuperAdmin', (int) $engineer), ['username' => 'fake-root']))->assertUnprocessable();
        try {
            app(TrustedSuperAdminBootstrap::class)->create('second-root', 'second@example.test', 'Second', 'Disposable-Root!123');
            $this->fail('Bootstrap may not create additional SuperAdmins.');
        } catch (HttpException $e) {
            $this->assertSame(409, $e->getStatusCode());
        }
        $this->assertSame(1, DB::table('jairoads_next.user_accounts')->where('account_type', 'SuperAdmin')->count());
    }

    public static function roles(): iterable
    {
        foreach (['SuperAdmin', 'Admin', 'Engineer', 'Viewer'] as $role) {
            yield $role => [$role];
        }
    }

    #[DataProvider('roles')]
    public function test_eligible_accounts_with_optional_verification_can_login_reset_and_use_settings(string $role): void
    {
        $login = $this->account($role);
        $login->forceFill(['email_verified_at' => null])->save();
        $this->postJson('/login', ['email' => $login->email, 'password' => 'Disposable-Test!123'])->assertOk();
        $this->postJson('/user/confirm-password', ['password' => 'Disposable-Test!123'])->assertCreated();
        $this->getJson('/settings/security')->assertOk();
        $this->postJson('/logout')->assertNoContent();
        $token = Password::broker()->createToken($login);
        $this->postJson('/reset-password', ['email' => $login->email, 'token' => $token,
            'password' => 'Replacement-Test!123', 'password_confirmation' => 'Replacement-Test!123'])->assertOk();
        $this->postJson('/login', ['email' => $login->email, 'password' => 'Replacement-Test!123'])->assertOk();
        $this->assertAuthenticatedAs($login);
        $this->assertSame($login->fresh()->password, DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->value('password'));
        $this->assertNull($login->fresh()->email_verified_at);
    }

    public static function failures(): iterable
    {
        foreach (['legacy', 'missing_link', 'inactive', 'retired', 'unlinked_Admin', 'unlinked_Engineer', 'unlinked_Viewer',
            'no_evidence', 'email', 'hash', 'wrong_link', 'forged_role'] as $case) {
            yield $case => [$case];
        }
    }

    #[DataProvider('failures')]
    public function test_invalid_identity_cannot_login_reset_or_use_a_passkey_callback(string $case): void
    {
        if ($case === 'legacy') {
            $login = User::forceCreate(['name' => 'Legacy', 'email' => 'legacy@example.test', 'password' => Hash::make('Disposable-Test!123')]);
        } elseif (str_starts_with($case, 'unlinked_')) {
            $login = $this->account(substr($case, 9), linked: false);
        } elseif ($case === 'no_evidence') {
            $login = $this->account('Viewer', $this->engineer(), linked: false);
        } else {
            $login = $this->account('Engineer');
            match ($case) {
                'missing_link' => DB::table('public.users')->where('id', $login->id)->update(['dd_user_account_id' => null]),
                'inactive' => DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->update(['is_active' => false]),
                'retired' => DB::table('jairoads_next.engineers')->where('id', $this->identity($login)['engineer_id'])->update(['engineer_status' => 'Retired']),
                'email' => DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->update(['email' => 'wrong@example.test']),
                'hash' => DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->update(['password' => Hash::make('wrong-password')]),
                'wrong_link' => DB::table('public.users')->where('id', $login->id)->update(['dd_user_account_id' => null]),
                'forged_role' => DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->update(['account_type' => 'Admin']),
            };
            $login->refresh();
        }
        $before = DB::table('jairoads_next.user_accounts')->orderBy('id')->get()->toJson();
        $this->postJson('/login', ['email' => $login->email, 'password' => 'Disposable-Test!123', 'account_type' => 'SuperAdmin', 'dd_user_account_id' => 1])->assertUnprocessable();
        $this->assertGuest();
        $passkey = new Passkey(['credential' => []]);
        $passkey->user_id = $login->id;
        $passkey->setRelation('user', $login);
        $this->assertFalse(Passkeys::allowsLogin(Request::create('/passkeys/login'), $passkey));
        if ($case !== 'hash') {
            $token = Password::broker()->createToken($login);
            $this->postJson('/reset-password', ['email' => $login->email, 'token' => $token,
                'password' => 'Invalid-Reset!123', 'password_confirmation' => 'Invalid-Reset!123'])->assertUnprocessable();
        }
        $this->assertSame($before, DB::table('jairoads_next.user_accounts')->orderBy('id')->get()->toJson());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    #[DataProvider('roles')]
    public function test_existing_session_is_invalidated_after_account_revocation(string $role): void
    {
        $login = $this->account($role);
        $this->actingAs($login)->withSession(['sentinel' => 'must disappear', 'auth.password_confirmed_at' => time()])->getJson('/settings/security')->assertOk();
        DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->update(['is_active' => false]);
        $this->getJson('/settings/security')->assertForbidden()->assertSessionMissing('sentinel');
        $this->assertGuest();
        $this->getJson('/settings/security')->assertUnauthorized();
    }

    public function test_remember_tokens_and_pending_mfa_cannot_bypass_revocation(): void
    {
        $login = $this->account('Admin');
        $login->forceFill(['remember_token' => 'synthetic-remember', 'two_factor_secret' => encrypt('fixture-secret'),
            'two_factor_recovery_codes' => encrypt(json_encode(['fixture-recovery'])), 'two_factor_confirmed_at' => now()])->save();
        $provider = Auth::getProvider();
        $this->assertNotNull($provider->retrieveByToken($login->id, 'synthetic-remember'));
        $this->postJson('/login', ['email' => $login->email, 'password' => 'Disposable-Test!123'])->assertOk()->assertJson(['two_factor' => true]);
        $secret = $login->two_factor_recovery_codes;
        DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->update(['is_active' => false]);
        $this->assertNull($provider->retrieveByToken($login->id, 'synthetic-remember'));
        $this->postJson('/two-factor-challenge', ['recovery_code' => 'fixture-recovery'])->assertUnprocessable()->assertSessionMissing('login.id');
        $this->assertGuest();
        $this->assertSame($secret, $login->fresh()->two_factor_recovery_codes);
    }

    public function test_provisioning_evidence_failure_rolls_back_both_account_rows_and_audit(): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $before = DB::table('public.users')->count();
        DB::connection()->beforeExecuting(static function (string $sql): void {
            if (str_starts_with($sql, 'insert into "jairoads_security"."account_provisioning"')) {
                throw new \RuntimeException('Isolated provenance failure');
            }
        });
        $this->postJson('/dd-phase3/accounts', $this->provision('Viewer', $this->engineer()))->assertServerError();
        $this->assertSame($before, DB::table('public.users')->count());
        $this->assertSame($before, DB::table('jairoads_next.user_accounts')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_no_schema_evidence_fails_closed_but_bootstrap_superadmin_survives(): void
    {
        $login = $this->account('Viewer');
        $root = User::where('dd_user_account_id', DB::table('jairoads_next.user_accounts')->where('account_type', 'SuperAdmin')->value('id'))->firstOrFail();
        DB::statement('ALTER TABLE jairoads_security.account_provisioning RENAME TO offline_evidence');
        $this->assertNull(app(AccountIdentityResolver::class)->resolve($login));
        $this->assertNotNull(app(AccountIdentityResolver::class)->resolve($root));
        $this->actingAs($root)->postJson('/dd-phase3/accounts', $this->provision('Viewer', $this->engineer()))->assertStatus(503);
    }

    public function test_last_eligible_superadmin_is_protected_when_another_active_root_has_no_bridge(): void
    {
        $root = $this->account('SuperAdmin');
        $broken = $this->account('SuperAdmin');
        DB::table('public.users')->where('id', $broken->id)->update(['dd_user_account_id' => null]);
        $admin = $this->account('Admin');
        $this->actingAs($admin)->patchJson('/dd-phase3/accounts/'.$root->dd_user_account_id.'/status', ['is_active' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('is_active');
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $root->dd_user_account_id, 'is_active' => true]);
    }

    public function test_ineligible_principal_can_explicitly_logout_before_any_other_protected_request(): void
    {
        $login = $this->account('Engineer');
        $this->actingAs($login);
        DB::table('jairoads_next.user_accounts')->where('id', $login->dd_user_account_id)->update(['is_active' => false]);
        $this->postJson('/logout')->assertNoContent();
        $this->assertGuest();
    }

    public function test_legacy_business_routes_have_no_authenticated_fallback(): void
    {
        $login = User::forceCreate(['name' => 'Legacy only', 'email' => 'legacy-business@example.test', 'password' => 'Disposable-Test!123', 'user_account_id' => 1]);
        foreach (['/maintenance-projects', '/road-coverages', '/monthly-updates', '/maintenance-documents', '/settings/security'] as $path) {
            $this->actingAs($login)->getJson($path)->assertForbidden();
            $this->assertGuest();
            if ($path !== '/settings/security') {
                $this->actingAs($login)->postJson($path, ['created_by' => 1, 'account_type' => 'SuperAdmin'])->assertForbidden();
                $this->assertGuest();
            }
        }
        $this->assertSame(0, DB::table('jairoads_next.user_accounts')->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_valid_mfa_totp_completes_without_changing_canonical_role_or_link(): void
    {
        $login = $this->account('Viewer');
        $secret = 'JBSWY3DPEHPK3PXP';
        $login->forceFill(['two_factor_secret' => encrypt($secret), 'two_factor_recovery_codes' => encrypt(json_encode(['fixture-recovery'])),
            'two_factor_confirmed_at' => now()])->save();
        $this->postJson('/login', ['email' => $login->email, 'password' => 'Disposable-Test!123'])->assertOk()->assertJson(['two_factor' => true]);
        $this->assertGuest();
        $this->postJson('/two-factor-challenge', ['code' => (new Google2FA)->getCurrentOtp($secret)])->assertNoContent();
        $this->assertAuthenticatedAs($login);
        $this->assertSame('Viewer', $this->identity($login)['role']);
        $this->postJson('/dd-phase3/ops/projects', [])->assertForbidden();
    }

    private function identity(User $user): array
    {
        return app(AccountIdentityResolver::class)->resolve($user);
    }

    private function provision(string $role, int $engineer): array
    {
        return ['username' => 'ordinary', 'name' => 'Ordinary account', 'email' => 'ordinary@example.test',
            'account_type' => $role, 'engineer_id' => $engineer, 'password' => 'Disposable-User!123',
            'password_confirmation' => 'Disposable-User!123', 'provisioned_by' => 999999, 'created_by' => 999999];
    }
}

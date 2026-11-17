<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Services\AccountIdentityResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

final class AdministratorPasswordRecoveryTest extends PostgresTestCase
{
    public function test_trusted_operator_recovers_another_root_but_web_route_remains_forbidden(): void
    {
        $root = $this->account('SuperAdmin');
        $target = $this->account('SuperAdmin');
        $this->actingAs($root)->postJson('/dd-phase3/accounts/'.$target->dd_user_account_id.'/password-reset', [
            'current_password' => 'Disposable-Test!123',
            'password' => 'New-Root-Disposable!456',
            'password_confirmation' => 'New-Root-Disposable!456',
        ])->assertForbidden();

        $this->artisan('jairoads:recover-superadmin')
            ->expectsQuestion('Type TRUSTED DATABASE OPERATOR to proceed', 'TRUSTED DATABASE OPERATOR')
            ->expectsQuestion('Working SuperAdmin canonical account ID', (string) $root->dd_user_account_id)
            ->expectsQuestion('Reviewed target SuperAdmin canonical account ID', (string) $target->dd_user_account_id)
            ->expectsQuestion('Private approved recovery reference', 'synthetic-review-001')
            ->expectsConfirmation('I have independently verified the target SuperAdmin identity and authorization, and have a tested recovery plan.', 'yes')
            ->expectsQuestion('Working SuperAdmin password', 'Disposable-Test!123')
            ->expectsQuestion('New target password', 'New-Root-Disposable!456')
            ->expectsQuestion('Confirm new target password', 'New-Root-Disposable!456')
            ->assertSuccessful();
        $this->assertTrue(Hash::check('New-Root-Disposable!456', $target->fresh()->password));
        $this->assertSame($root->password, $root->fresh()->password);
        $this->assertSame($target->fresh()->password, DB::table('jairoads_next.user_accounts')->where('id', $target->dd_user_account_id)->value('password'));
    }

    public function test_superadmin_can_reset_eligible_account_without_email_and_preserve_identity(): void
    {
        $root = $this->account('SuperAdmin');
        $target = $this->account('Engineer');
        $id = (int) $target->dd_user_account_id;
        $before = app(AccountIdentityResolver::class)->resolve($target);
        $target->forceFill(['remember_token' => 'old-remember-token'])->save();
        DB::table('public.password_reset_tokens')->insert(['email' => $target->email, 'token' => Hash::make('old-token'), 'created_at' => now()]);
        $this->actingAs($root);
        $this->getJson('/dd-phase3/accounts/'.$id)->assertOk()->assertJsonPath('can_reset_password', true)->assertJsonPath('password_reset_blocker', null);
        $this->postJson('/dd-phase3/accounts/'.$id.'/password-reset', [
            'current_password' => 'Disposable-Test!123',
            'password' => 'Replacement-Disposable!456',
            'password_confirmation' => 'Replacement-Disposable!456',
        ])->assertOk();
        $fresh = $target->fresh();
        $this->assertTrue(Hash::check('Replacement-Disposable!456', $fresh->password));
        $this->assertFalse(Hash::check('Disposable-Test!123', $fresh->password));
        $this->assertSame($fresh->password, DB::table('jairoads_next.user_accounts')->where('id', $id)->value('password'));
        $this->assertSame($before, app(AccountIdentityResolver::class)->resolve($fresh));
        $this->assertNotSame('old-remember-token', $fresh->remember_token);
        $this->assertDatabaseMissing('public.password_reset_tokens', ['email' => $target->email]);
        $audit = DB::table('jairoads_next.audit_logs')->where('entity_type', 'UserAccount')->where('entity_id', $id)->sole();
        $this->assertStringContainsString('SuperAdmin reset account password', $audit->description);
        $this->assertStringNotContainsString('Replacement-Disposable', json_encode($audit));
        $this->assertStringNotContainsString($fresh->password, json_encode($audit));
    }

    public function test_unapproved_account_explains_recovery_blocker_without_changing_eligibility(): void
    {
        $root = $this->account('SuperAdmin');
        // An existing active Viewer without reviewed provenance is not a valid login.
        $target = $this->account('Viewer', null, true, false);
        $id = (int) $target->dd_user_account_id;
        $this->actingAs($root)->getJson('/dd-phase3/accounts/'.$id)
            ->assertOk()->assertJsonPath('can_reset_password', false)
            ->assertJsonPath('password_reset_blocker', 'This existing account lacks matching administrator provisioning approval. A database administrator must complete the approved account review before password recovery.');
        $this->postJson('/dd-phase3/accounts/'.$id.'/password-reset', [
            'current_password' => 'Disposable-Test!123',
            'password' => 'Replacement-Disposable!456',
            'password_confirmation' => 'Replacement-Disposable!456',
        ])->assertUnprocessable();
        $this->assertSame($target->password, $target->fresh()->password);
    }

    public function test_recovery_requires_superadmin_reauthentication_and_eligible_target(): void
    {
        $root = $this->account('SuperAdmin');
        $admin = $this->account('Admin');
        $target = $this->account('Viewer');
        $otherRoot = $this->account('SuperAdmin');
        $inactive = $this->account('Engineer', null, false);
        $id = (int) $target->dd_user_account_id;
        $url = fn ($u) => '/dd-phase3/accounts/'.$u->dd_user_account_id.'/password-reset';
        $data = ['current_password' => 'Disposable-Test!123', 'password' => 'Replacement-Disposable!456', 'password_confirmation' => 'Replacement-Disposable!456'];
        $this->actingAs($admin)->getJson('/dd-phase3/accounts/'.$id)->assertOk()->assertJsonPath('can_reset_password', false);
        $this->postJson($url($target), $data)->assertForbidden();
        $this->actingAs($root)->postJson($url($target), array_replace($data, ['current_password' => 'wrong']))->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->postJson($url($otherRoot), $data)->assertForbidden();
        $this->postJson($url($root), $data)->assertForbidden();
        $this->postJson($url($inactive), $data)->assertUnprocessable();
        $this->assertSame($target->password, $target->fresh()->password);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }
}

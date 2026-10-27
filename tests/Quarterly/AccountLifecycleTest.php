<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;

final class AccountLifecycleTest extends PostgresTestCase
{
    public static function types(): iterable
    {
        foreach (['Admin', 'Engineer', 'Viewer', 'SuperAdmin'] as $type) {
            yield $type => [$type];
        }
    }

    #[DataProvider('types')]
    public function test_deactivate_reactivate_preserves_credentials_identity_and_history(string $type): void
    {
        $target = $this->account($type, $type === 'Engineer' ? $this->engineer() : null);
        if ($type === 'SuperAdmin') {
            $this->account('SuperAdmin');
        }
        $admin = $this->account();
        $this->withSession(['password_hash_web' => null])->actingAs($admin);
        $before = DB::table('jairoads_next.user_accounts')->where('id', $target->dd_user_account_id)->first();
        $this->getJson('/dd-phase3/accounts/'.$target->dd_user_account_id)->assertOk()->assertJsonPath('account.account_type', $type)->assertJsonMissingPath('account.password')->assertJsonMissingPath('account.remember_token')->assertHeader('Cache-Control', 'no-store, private');
        foreach ([false, true] as $active) {
            $this->patchJson('/dd-phase3/accounts/'.$target->dd_user_account_id.'/status', ['is_active' => $active])->assertRedirect();
            $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $target->dd_user_account_id, 'is_active' => $active]);
        }
        $after = DB::table('jairoads_next.user_accounts')->where('id', $target->dd_user_account_id)->first();
        foreach (['username', 'email', 'account_type', 'engineer_id', 'password'] as $field) {
            $this->assertSame($before->$field, $after->$field);
        }
        $this->assertTrue(hash_equals($target->password, $target->fresh()->password));
        $events = DB::table('jairoads_next.audit_logs')->where('entity_type', 'UserAccount')->where('entity_id', $target->dd_user_account_id)->whereNull('recipient_user_id')->orderBy('id')->get();
        $this->assertCount(2, $events);
        $this->assertFalse(json_decode($events[0]->new_value, true)['is_active']);
        $this->assertTrue(json_decode($events[1]->new_value, true)['is_active']);
        $this->assertStringNotContainsString($target->password, $events->toJson());
    }

    public function test_account_status_changes_preserve_creator_uploader_and_audit_history(): void
    {
        $f = $this->fixture('Engineer');
        $id = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->dd_user_account_id]);
        $document = DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $id, 'document_title' => 'Retained', 'file_name' => 'retained.pdf', 'file_path' => 'private/retained.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
        $before = DB::table('jairoads_next.maintenance_records')->where('id', $id)->first();
        $this->withSession(['password_hash_web' => null])->actingAs($this->account());
        $this->patchJson('/dd-phase3/accounts/'.$f['user']->dd_user_account_id.'/status', ['is_active' => false])->assertRedirect();
        $history = DB::table('jairoads_next.audit_logs')->orderBy('id')->get();
        $this->patchJson('/dd-phase3/accounts/'.$f['user']->dd_user_account_id.'/status', ['is_active' => true])->assertRedirect();
        $this->assertEquals($before, DB::table('jairoads_next.maintenance_records')->where('id', $id)->first());
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project'], 'created_by' => $f['user']->dd_user_account_id]);
        $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $document, 'uploaded_by' => $f['user']->dd_user_account_id, 'file_path' => 'private/retained.pdf']);
        foreach ($history as $event) {
            $this->assertEquals($event, DB::table('jairoads_next.audit_logs')->where('id', $event->id)->first());
        }
    }

    public function test_self_lockout_last_superadmin_and_privilege_changes_are_blocked(): void
    {
        $admin = $this->account();
        $super = $this->account('SuperAdmin');
        $this->withSession(['password_hash_web' => null])->actingAs($admin);
        $this->patchJson('/dd-phase3/accounts/'.$admin->dd_user_account_id.'/status', ['is_active' => false])->assertUnprocessable();
        $this->patchJson('/dd-phase3/accounts/'.$super->dd_user_account_id.'/status', ['is_active' => false])->assertUnprocessable();
        $target = $this->account('Viewer');
        $this->patchJson('/dd-phase3/accounts/'.$target->dd_user_account_id.'/status', ['is_active' => false, 'account_type' => 'SuperAdmin', 'password' => 'attempted-secret'])->assertUnprocessable();
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $target->dd_user_account_id, 'account_type' => 'Viewer', 'is_active' => true]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public static function invalid(): iterable
    {
        foreach (['retired', 'unlinked_engineer', 'invalid_viewer', 'mismatched_hash', 'missing_bridge'] as $case) {
            yield $case => [$case];
        }
    }

    #[DataProvider('invalid')]
    public function test_ineligible_reactivation_fails_without_changing_credentials(string $case): void
    {
        $engineer = $this->engineer($case === 'retired' ? 'Retired' : 'Active');
        $target = $this->account($case === 'invalid_viewer' ? 'Viewer' : 'Engineer', $case === 'unlinked_engineer' ? null : $engineer, false);
        if ($case === 'mismatched_hash') {
            DB::table('jairoads_next.user_accounts')->where('id', $target->dd_user_account_id)->update(['password' => Hash::make('Different-Disposable!123')]);
        }
        if ($case === 'missing_bridge') {
            DB::table('public.users')->where('id', $target->id)->update(['dd_user_account_id' => null]);
        }
        $this->withSession(['password_hash_web' => null])->actingAs($this->account())->patchJson('/dd-phase3/accounts/'.$target->dd_user_account_id.'/status', ['is_active' => true])->assertUnprocessable()->assertJsonValidationErrors('is_active');
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $target->dd_user_account_id, 'is_active' => false]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_existing_session_is_denied_after_deactivation_and_administration_requires_active_admin(): void
    {
        $f = $this->fixture('Engineer');
        $admin = $this->account();
        $this->withSession(['password_hash_web' => null])->actingAs($admin)->patchJson('/dd-phase3/accounts/'.$f['user']->dd_user_account_id.'/status', ['is_active' => false])->assertRedirect();
        $this->withSession(['password_hash_web' => null])->actingAs($f['user'])->getJson('/dd-phase3/dashboard')->assertForbidden();
        $this->postJson('/dd-phase3/ops/projects', ['project_title' => 'Denied', 'road_coverage_id' => $f['road']])->assertForbidden();
        foreach (['Engineer', 'Viewer'] as $type) {
            $this->withSession(['password_hash_web' => null])->actingAs($this->account($type, $type === 'Engineer' ? $this->engineer() : null));
            $this->getJson('/dd-phase3/accounts/'.$admin->dd_user_account_id)->assertForbidden();
            $this->patchJson('/dd-phase3/accounts/'.$admin->dd_user_account_id.'/status', ['is_active' => false])->assertForbidden();
        }
    }

    public function test_status_rolls_back_on_audit_failure_and_unknown_account_is_not_found(): void
    {
        $target = $this->account('Viewer');
        $this->withSession(['password_hash_web' => null])->actingAs($this->account());
        $this->getJson('/dd-phase3/accounts/999999')->assertNotFound();
        $this->patchJson('/dd-phase3/accounts/999999/status', ['is_active' => false])->assertNotFound();
        DB::connection()->beforeExecuting(static function (string $sql): void {
            if (str_starts_with($sql, 'insert into "jairoads_next"."audit_logs"')) {
                throw new \RuntimeException('Disposable audit failure');
            }
        });
        $this->patchJson('/dd-phase3/accounts/'.$target->dd_user_account_id.'/status', ['is_active' => false])->assertServerError();
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $target->dd_user_account_id, 'is_active' => true]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }
}

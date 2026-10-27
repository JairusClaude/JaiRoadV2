<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;

final class EngineerLifecycleTest extends PostgresTestCase
{
    public static function admins(): iterable
    {
        yield ['Admin'];
        yield ['SuperAdmin'];
    }

    #[DataProvider('admins')]
    public function test_profile_edit_changes_only_professional_fields(string $role): void
    {
        $f = $this->fixture('Engineer');
        $this->withSession(['password_hash_web' => null])->actingAs($this->account($role));
        $this->putJson('/dd-phase3/engineers/'.$f['engineer'], $this->profile())->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.engineers', ['id' => $f['engineer'], 'first_name' => 'Updated', 'rank' => 'SuperAdmin', 'engineer_status' => 'Active']);
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $f['user']->dd_user_account_id, 'account_type' => 'Engineer', 'engineer_id' => $f['engineer']]);
        $event = DB::table('jairoads_next.audit_logs')->where('entity_type', 'Engineer')->whereNull('recipient_user_id')->first();
        $this->assertSame('Test', json_decode($event->old_value, true)['first_name']);
        $this->assertSame('Updated', json_decode($event->new_value, true)['first_name']);
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('entity_type', 'Engineer')->whereNull('recipient_user_id')->count());
        $this->putJson('/dd-phase3/engineers/'.$f['engineer'], $this->profile())->assertRedirect();
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('entity_type', 'Engineer')->whereNull('recipient_user_id')->count());
    }

    public function test_retirement_deactivates_links_preserves_history_and_revokes_existing_access(): void
    {
        $f = $this->fixture('Engineer');
        $this->road($f['engineer']);
        $id = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->dd_user_account_id]);
        $record = DB::table('jairoads_next.maintenance_records')->where('id', $id)->first();
        $hash = $f['user']->password;
        $admin = $this->account();
        $this->withSession(['password_hash_web' => null])->actingAs($admin)->postJson('/dd-phase3/engineers/'.$f['engineer'].'/retirement')->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.engineers', ['id' => $f['engineer'], 'engineer_status' => 'Retired']);
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $f['user']->dd_user_account_id, 'is_active' => false]);
        $this->assertSame(2, DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->count());
        $this->assertSame(0, DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('is_active', true)->count());
        $this->assertEquals($record, DB::table('jairoads_next.maintenance_records')->where('id', $id)->first());
        $this->assertTrue(hash_equals($hash, $f['user']->fresh()->password));
        $this->assertTrue(hash_equals($hash, DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->value('password')));
        $count = DB::table('jairoads_next.audit_logs')->count();
        $this->postJson('/dd-phase3/engineers/'.$f['engineer'].'/retirement')->assertRedirect();
        $this->assertSame($count, DB::table('jairoads_next.audit_logs')->count());
        $this->withSession(['password_hash_web' => null])->actingAs($f['user'])->getJson('/dd-phase3/dashboard')->assertForbidden();
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer'], 'Q1'))->assertForbidden();
        $this->putJson('/dd-phase3/ops/records/'.$id, $this->recordData($f['project'], $f['engineer'], 'Q4'))->assertForbidden();
    }

    public function test_linked_admin_retirement_is_atomic_and_self_retirement_is_blocked(): void
    {
        $f = $this->fixture('Admin', true);
        $this->postJson('/dd-phase3/engineers/'.$f['engineer'].'/retirement')->assertUnprocessable()->assertJsonValidationErrors('retirement');
        $other = $this->account();
        $this->withSession(['password_hash_web' => null])->actingAs($other);
        DB::connection()->beforeExecuting(static function (string $sql): void {
            if (str_starts_with($sql, 'insert into "jairoads_next"."audit_logs"')) {
                throw new \RuntimeException('Disposable audit failure');
            }
        });
        $this->postJson('/dd-phase3/engineers/'.$f['engineer'].'/retirement')->assertServerError();
        $this->assertDatabaseHas('jairoads_next.engineers', ['id' => $f['engineer'], 'engineer_status' => 'Active']);
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $f['user']->dd_user_account_id, 'is_active' => true]);
        $this->assertSame(1, DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->where('is_active', true)->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_another_admin_can_retire_a_linked_admin_without_removing_their_identity(): void
    {
        $f = $this->fixture('Admin', true);
        $hash = $f['user']->password;
        $this->withSession(['password_hash_web' => null])->actingAs($this->account());
        $this->postJson('/dd-phase3/engineers/'.$f['engineer'].'/retirement')->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.engineers', ['id' => $f['engineer'], 'engineer_status' => 'Retired']);
        $this->assertDatabaseHas('jairoads_next.user_accounts', ['id' => $f['user']->dd_user_account_id, 'account_type' => 'Admin', 'engineer_id' => $f['engineer'], 'is_active' => false, 'password' => $hash]);
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project'], 'created_by' => $f['user']->dd_user_account_id]);
        $this->withSession(['password_hash_web' => null])->actingAs($f['user'])->getJson('/dd-phase3/users')->assertForbidden();
    }

    public function test_nonadministrators_and_invalid_profiles_cannot_mutate(): void
    {
        $id = $this->engineer();
        foreach (['Engineer', 'Viewer'] as $role) {
            $this->withSession(['password_hash_web' => null])->actingAs($this->account($role, $role === 'Engineer' ? $this->engineer() : null));
            $this->putJson('/dd-phase3/engineers/'.$id, $this->profile())->assertForbidden();
            $this->postJson('/dd-phase3/engineers/'.$id.'/retirement')->assertForbidden();
        }
        $this->withSession(['password_hash_web' => null])->actingAs($this->account());
        $this->putJson('/dd-phase3/engineers/999999', $this->profile())->assertNotFound();
        $this->postJson('/dd-phase3/engineers/999999/retirement')->assertNotFound();
        $this->putJson('/dd-phase3/engineers/'.$id, $this->profile() + ['position' => 'Engineer'])->assertUnprocessable();
        $this->putJson('/dd-phase3/engineers/'.$id, $this->profile() + ['engineer_status' => 'Retired'])->assertUnprocessable();
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    private function profile(): array
    {
        return ['first_name' => 'Updated', 'middle_name' => null, 'last_name' => 'Engineer', 'contact_no' => '09123456789', 'rank' => 'SuperAdmin'];
    }
}

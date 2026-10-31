<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;

final class ManagingEngineerReassignmentTest extends PostgresTestCase
{
    public function test_explicit_reassignment_preserves_creator_history_and_changes_only_record_edit_access(): void
    {
        [$f,$id,$replacement,$login] = $this->setupRecord();
        $admin = $this->account();
        $update = DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $id, 'update_month' => '2026-10', 'progress_percentage' => 20, 'created_by' => $f['user']->dd_user_account_id]);
        $document = DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $id, 'document_title' => 'Original title', 'file_name' => 'retained.pdf', 'file_path' => 'private/retained.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
        $other = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q2') + ['created_by' => $f['user']->dd_user_account_id]);
        $this->withSession(['password_hash_web' => null])->actingAs($admin)->postJson('/dd-phase3/ops/records/'.$id.'/reassignment', ['managing_engineer_id' => $replacement, 'expected_current_manager_id' => $f['engineer'], 'created_by' => 999999])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'managing_engineer_id' => $replacement, 'created_by' => $f['user']->dd_user_account_id, 'quarter' => 'Q4']);
        $event = DB::table('jairoads_next.audit_logs')->where('entity_type', 'MaintenanceRecord')->where('entity_id', $id)->whereNull('recipient_user_id')->first();
        $this->assertSame((int) $admin->dd_user_account_id, (int) $event->user_id);
        $this->assertSame($f['engineer'], json_decode($event->old_value, true)['managing_engineer_id']);
        $this->assertSame($replacement, json_decode($event->new_value, true)['managing_engineer_id']);
        $this->withSession(['password_hash_web' => null])->actingAs($f['user'])->putJson('/dd-phase3/ops/records/'.$id, $this->recordData($f['project'], $f['engineer'], 'Q4'))->assertForbidden();
        $this->putJson('/dd-phase3/ops/documents/'.$document, ['document_title' => 'Unauthorized edit'])->assertForbidden();
        $this->putJson('/dd-phase3/ops/records/'.$other, $this->recordData($f['project'], $f['engineer'], 'Q2'))->assertRedirect();
        $this->withSession(['password_hash_web' => null])->actingAs($login)->putJson('/dd-phase3/ops/records/'.$id, array_replace($this->recordData($f['project'], $replacement, 'Q4'), ['description' => 'New manager work']))->assertRedirect();
        $this->putJson('/dd-phase3/ops/records/'.$other, $this->recordData($f['project'], $replacement, 'Q2'))->assertForbidden();
        $this->putJson('/dd-phase3/ops/documents/'.$document, ['document_title' => 'Authorized edit'])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $document, 'document_title' => 'Authorized edit', 'uploaded_by' => $f['user']->dd_user_account_id, 'file_path' => 'private/retained.pdf']);
        $this->assertDatabaseHas('jairoads_next.monthly_updates', ['id' => $update, 'maintenance_id' => $id, 'created_by' => $f['user']->dd_user_account_id]);
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $other, 'managing_engineer_id' => $f['engineer']]);
    }

    public static function invalid(): iterable
    {
        foreach (['retired', 'inactive_account', 'unassigned', 'inactive_assignment', 'no_account', 'other_admin'] as $case) {
            yield $case => [$case];
        }
    }

    #[DataProvider('invalid')]
    public function test_invalid_manager_choice_is_rejected_without_history_changes(string $case): void
    {
        [$f,$id] = $this->setupRecord();
        $replacement = $this->engineer($case === 'retired' ? 'Retired' : 'Active');
        if ($case !== 'no_account') {
            $this->account($case === 'other_admin' ? 'Admin' : 'Engineer', $replacement, $case !== 'inactive_account');
        }
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        if ($case !== 'unassigned') {
            DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $replacement, 'lgu_id' => $lgu, 'is_active' => $case !== 'inactive_assignment']);
        }
        $this->withSession(['password_hash_web' => null])->actingAs($this->account())->postJson('/dd-phase3/ops/records/'.$id.'/reassignment', ['managing_engineer_id' => $replacement, 'expected_current_manager_id' => $f['engineer']])->assertUnprocessable()->assertJsonValidationErrors('managing_engineer_id');
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'managing_engineer_id' => $f['engineer']]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_unauthorized_stale_missing_and_noop_reassignments_cannot_change_history(): void
    {
        [$f,$id,$replacement] = $this->setupRecord();
        $data = ['managing_engineer_id' => $replacement, 'expected_current_manager_id' => $f['engineer']];
        $this->postJson('/dd-phase3/ops/records/'.$id.'/reassignment', $data)->assertForbidden();
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'))->postJson('/dd-phase3/ops/records/'.$id.'/reassignment', $data)->assertForbidden();
        $this->withSession(['password_hash_web' => null])->actingAs($this->account());
        $this->postJson('/dd-phase3/ops/records/999999/reassignment', $data)->assertNotFound();
        $this->postJson('/dd-phase3/ops/records/'.$id.'/reassignment', array_replace($data, ['expected_current_manager_id' => 999999]))->assertUnprocessable();
        $this->postJson('/dd-phase3/ops/records/'.$id.'/reassignment', array_replace($data, ['managing_engineer_id' => $f['engineer']]))->assertRedirect();
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_linked_admin_can_self_manage_and_audit_failure_rolls_back_reassignment(): void
    {
        [$f,$id] = $this->setupRecord();
        $profile = $this->engineer();
        $admin = $this->account('Admin', $profile);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $profile, 'lgu_id' => $lgu, 'is_active' => true]);
        $data = ['managing_engineer_id' => $profile, 'expected_current_manager_id' => $f['engineer']];
        $this->withSession(['password_hash_web' => null])->actingAs($admin)->postJson('/dd-phase3/ops/records/'.$id.'/reassignment', $data)->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'managing_engineer_id' => $profile]);
        $history = DB::table('jairoads_next.audit_logs')->get()->toJson();
        DB::connection()->beforeExecuting(static function (string $sql): void {
            if (str_starts_with($sql, 'insert into "jairoads_next"."audit_logs"')) {
                throw new \RuntimeException('Disposable audit failure');
            }
        });
        $this->postJson('/dd-phase3/ops/records/'.$id.'/reassignment', ['managing_engineer_id' => $f['engineer'], 'expected_current_manager_id' => $profile])->assertServerError();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'managing_engineer_id' => $profile]);
        $this->assertSame($history, DB::table('jairoads_next.audit_logs')->get()->toJson());
    }

    private function setupRecord(): array
    {
        $f = $this->fixture('Engineer');
        $replacement = $this->engineer();
        $login = $this->account('Engineer', $replacement);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $replacement, 'lgu_id' => $lgu, 'is_active' => true]);
        $id = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->dd_user_account_id]);

        return [$f, (int) $id, $replacement, $login];
    }
}

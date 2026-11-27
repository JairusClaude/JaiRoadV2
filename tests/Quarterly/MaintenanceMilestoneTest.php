<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

final class MaintenanceMilestoneTest extends PostgresTestCase
{
    private const TABLE = 'jairoads_next.maintenance_milestones';

    private function applyProposal(string $name): void
    {
        // The outer test transaction owns this disposable schema.
        $sql = file_get_contents(base_path('database/proposals/'.$name.'_REVIEW_ONLY.sql'));
        $this->assertIsString($sql);
        DB::unprepared(str_replace(["\nBEGIN;\n", "\nCOMMIT;\n"], "\n", $sql));
    }

    public function test_pilot_requires_explicit_enablement_and_retains_audited_changes(): void
    {
        $f = $this->fixture('Engineer');
        $id = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->canonical_user_account_id]
        );
        $url = '/workspace/ui/maintenance-projects/'.$f['project'].'/records/'.$id.'/milestones';
        $values = ['title' => 'Drainage inspection', 'planned_date' => '2026-02-01', 'status' => 'planned'];
        $this->postJson($url, $values)->assertNotFound();
        $this->applyProposal('maintenance_milestones');
        config(['jairoads_milestones.enabled' => true, 'jairoads_file_deletion.operationally_enabled' => false]);
        $this->postJson($url, $values)->assertRedirect();
        $milestone = DB::table('jairoads_next.maintenance_milestones')->where('maintenance_id', $id)->first();
        $this->assertNotNull($milestone);
        $this->assertSame(1, (int) $milestone->version);
        $this->putJson($url.'/'.$milestone->id, array_replace($values, ['status' => 'completed', 'version' => 1]))->assertUnprocessable();
        $this->putJson($url.'/'.$milestone->id, array_replace($values, ['status' => 'completed', 'completed_date' => '2026-02-02', 'version' => 1]))->assertRedirect();
        $this->putJson($url.'/'.$milestone->id, $values + ['version' => 1])->assertUnprocessable()->assertJsonValidationErrors('version');
        $this->assertDatabaseHas('jairoads_next.maintenance_milestones', ['id' => $milestone->id, 'status' => 'completed', 'version' => 2]);
        $this->assertSame(2, DB::table('jairoads_next.audit_logs')->where('entity_type', 'MaintenanceMilestone')->count());
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'));
        $this->postJson($url, $values)->assertForbidden();
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Engineer'));
        $this->postJson($url, $values)->assertForbidden();
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Admin'));
        $this->getJson('/workspace/ui/maintenance-projects/'.$f['project'].'/deletion-preview')->assertUnprocessable();
        config(['jairoads_file_deletion.operationally_enabled' => true]);
        $this->postJson($url, $values)->assertStatus(409);
    }

    public function test_proposed_runtime_grants_support_retained_milestones_under_rls(): void
    {
        DB::statement('CREATE ROLE jairoads_app_runtime NOLOGIN');
        DB::statement('GRANT USAGE ON SCHEMA jairoads_next TO jairoads_app_runtime');
        $this->applyProposal('maintenance_milestones');
        $this->applyProposal('maintenance_milestone_runtime_grants');

        $f = $this->fixture('Engineer');
        $account = (int) $f['user']->canonical_user_account_id;
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $account]
        );

        DB::statement('SET LOCAL ROLE jairoads_app_runtime');
        $this->assertTrue(DB::selectOne("select row_security_active('jairoads_next.maintenance_milestones') as active")->active);
        $milestone = DB::table(self::TABLE)->insertGetId([
            'maintenance_id' => $record, 'title' => 'Retained milestone', 'planned_date' => '2026-02-01',
            'created_by' => $account, 'updated_by' => $account,
        ]);
        $this->assertSame(1, DB::table(self::TABLE)->where('id', $milestone)->update(['status' => 'cancelled', 'version' => 2]));
        $this->assertSame('cancelled', DB::table(self::TABLE)->where('id', $milestone)->value('status'));

        try {
            DB::transaction(fn () => DB::table(self::TABLE)->where('id', $milestone)->delete());
            $this->fail('The milestone runtime role must not delete retained history.');
        } catch (QueryException $e) {
            $this->assertSame('42501', $e->errorInfo[0]);
        } finally {
            DB::statement('RESET ROLE');
        }

        $this->assertDatabaseHas(self::TABLE, ['id' => $milestone, 'version' => 2]);
    }
}

<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Support\Facades\DB;

final class MaintenanceMilestoneTest extends PostgresTestCase
{
    public function test_pilot_requires_explicit_enablement_and_retains_audited_changes(): void
    {
        $f = $this->fixture('Engineer');
        $id = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->canonical_user_account_id]
        );
        $url = '/workspace/ui/maintenance-projects/'.$f['project'].'/records/'.$id.'/milestones';
        $values = ['title' => 'Drainage inspection', 'planned_date' => '2026-02-01', 'status' => 'planned'];
        $this->postJson($url, $values)->assertNotFound();
        // The outer test transaction owns this disposable schema; omit SQL transaction markers.
        $sql = file_get_contents(base_path('database/proposals/maintenance_milestones_REVIEW_ONLY.sql'));
        DB::unprepared(str_replace(["\nBEGIN;\n", "\nCOMMIT;\n"], "\n", $sql));
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
}

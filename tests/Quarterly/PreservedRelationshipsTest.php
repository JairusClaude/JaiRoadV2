<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;

/** Final-DD relationship protection; replaces the unapproved detachment proposal tests. */
final class PreservedRelationshipsTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    private function withChildren(string $role = 'Admin'): array
    {
        $f = $this->fixture($role);
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]
        );
        $update = (int) DB::table('jairoads_next.monthly_updates')->insertGetId([
            'maintenance_id' => $record, 'update_month' => '2027-12',
            'progress_percentage' => 35, 'created_by' => $f['user']->dd_user_account_id,
        ]);
        $document = (int) DB::table('jairoads_next.maintenance_documents')->insertGetId([
            'maintenance_id' => $record, 'document_title' => 'Retained document', 'file_name' => 'retained.pdf',
            'file_path' => 'maintenance-records/'.$record.'/00000000-0000-4000-8000-000000000001.pdf',
            'uploaded_by' => $f['user']->dd_user_account_id,
        ]);
        $media = (int) DB::table('jairoads_next.media')->insertGetId([
            'monthly_update_id' => $update, 'file_name' => 'retained.png',
            'file_path' => 'monthly-updates/'.$update.'/00000000-0000-4000-8000-000000000001.png',
            'file_type' => 'image/png', 'uploaded_by' => $f['user']->dd_user_account_id,
        ]);

        return $f + compact('record', 'update', 'document', 'media');
    }

    public static function admins(): iterable
    {
        yield ['Admin'];
        yield ['SuperAdmin'];
    }

    #[DataProvider('admins')]
    public function test_empty_project_requires_confirmation_but_can_be_deleted(string $role): void
    {
        $f = $this->fixture($role);
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'];
        $this->deleteJson($url)->assertUnprocessable();
        $preview = $this->getJson($url.'/deletion-preview')->assertOk()
            ->assertJsonPath('counts.maintenance_records', 0)->json();
        $this->deleteJson($url, ['confirmation_token' => $preview['confirmation_token']])
            ->assertOk()->assertJsonPath('state', 'completed');
        $this->assertDatabaseMissing('jairoads_next.maintenance_projects', ['id' => $f['project']]);
        $this->assertDatabaseHas('jairoads_next.road_coverages', ['id' => $f['road']]);
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')
            ->where('action', 'DELETE')->where('entity_type', 'MaintenanceProject')->count());
        Http::assertNothingSent();
    }

    #[DataProvider('admins')]
    public function test_project_with_dependents_cannot_be_previewed_or_deleted(string $role): void
    {
        $f = $this->withChildren($role);
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'];
        $this->getJson($url.'/deletion-preview')->assertStatus(409);
        $this->deleteJson($url, ['confirmation_token' => 'invalid'])->assertUnprocessable();
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
        $this->assertDatabaseHas('jairoads_next.maintenance_records', [
            'id' => $f['record'], 'project_id' => $f['project'], 'managing_engineer_id' => $f['engineer'],
        ]);
        foreach (['monthly_updates' => $f['update'], 'maintenance_documents' => $f['document'], 'media' => $f['media']] as $table => $id) {
            $this->assertDatabaseHas('jairoads_next.'.$table, ['id' => $id]);
        }
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
        Http::assertNothingSent();
    }

    public function test_new_record_after_empty_project_preview_blocks_confirmation(): void
    {
        $f = $this->fixture();
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'];
        $token = $this->getJson($url.'/deletion-preview')->assertOk()->json('confirmation_token');
        $record = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]
        );
        $this->deleteJson($url, ['confirmation_token' => $token])->assertStatus(409);
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $record, 'project_id' => $f['project']]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
    }

    #[DataProvider('admins')]
    public function test_managing_engineer_unassignment_is_forbidden_even_for_admins(string $role): void
    {
        $f = $this->withChildren($role);
        $this->postJson('/dd-phase3/ops/records/'.$f['record'].'/unassignment', [
            'expected_current_manager_id' => $f['engineer'],
        ])->assertForbidden();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', [
            'id' => $f['record'], 'managing_engineer_id' => $f['engineer'],
        ]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'REASSIGN')->count());
    }

    public function test_invalid_and_stale_tokens_cannot_delete_empty_project(): void
    {
        $f = $this->fixture();
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'];
        $token = $this->getJson($url.'/deletion-preview')->assertOk()->json('confirmation_token');
        $this->deleteJson($url, ['confirmation_token' => 'corrupt'])->assertUnprocessable();
        DB::table('jairoads_next.maintenance_projects')->where('id', $f['project'])->update(['project_title' => 'Changed']);
        $this->deleteJson($url, ['confirmation_token' => $token])->assertUnprocessable();
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
    }

    public function test_engineer_and_viewer_cannot_access_admin_delete_endpoint(): void
    {
        $f = $this->fixture();
        $url = '/dd-phase3/ui/maintenance-projects/'.$f['project'];
        $token = $this->getJson($url.'/deletion-preview')->assertOk()->json('confirmation_token');
        foreach (['Engineer', 'Viewer'] as $role) {
            $this->withSession(['password_hash_web' => null])->actingAs($this->account($role));
            $this->getJson($url.'/deletion-preview')->assertForbidden();
            $this->deleteJson($url, ['confirmation_token' => $token])->assertForbidden();
        }
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
    }

    public function test_required_database_links_reject_null_values(): void
    {
        $f = $this->withChildren();
        foreach (['project_id', 'managing_engineer_id'] as $column) {
            try {
                DB::transaction(fn () => DB::table('jairoads_next.maintenance_records')
                    ->where('id', $f['record'])->update([$column => null]));
                $this->fail('Required relationship unexpectedly became nullable: '.$column);
            } catch (QueryException $e) {
                $this->assertSame('23502', $e->errorInfo[0]);
            }
        }
        $this->assertDatabaseHas('jairoads_next.maintenance_records', [
            'id' => $f['record'], 'project_id' => $f['project'], 'managing_engineer_id' => $f['engineer'],
        ]);
    }

    public function test_database_restricts_direct_parent_deletion(): void
    {
        $f = $this->withChildren();
        try {
            DB::transaction(fn () => DB::table('jairoads_next.maintenance_projects')->where('id', $f['project'])->delete());
            $this->fail('Referenced project was deleted despite ON DELETE RESTRICT.');
        } catch (QueryException $e) {
            $this->assertSame('23503', $e->errorInfo[0]);
        }
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
    }

    public function test_optional_old_schema_cannot_enable_new_detachment(): void
    {
        // Disposable test schema only; confirm backward compatibility is fail-closed.
        (require base_path('database/proposals/preserve_project_history.php'))->up();
        $f = $this->withChildren();
        $this->getJson('/dd-phase3/ui/maintenance-projects/'.$f['project'].'/deletion-preview')->assertStatus(409);
        $this->postJson('/dd-phase3/ops/records/'.$f['record'].'/unassignment', [
            'expected_current_manager_id' => $f['engineer'],
        ])->assertForbidden();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', [
            'id' => $f['record'], 'project_id' => $f['project'], 'managing_engineer_id' => $f['engineer'],
        ]);
        $this->assertSame(0, DB::table('jairoads_next.maintenance_record_contexts')->count());
    }
}

<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use App\Models\DataDictionary\Canonical\MaintenanceRecord;
use App\Models\User;
use App\Services\DataDictionary\PreservedProjectDeletion;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Process\Process;

final class PreservedRelationshipsTest extends PostgresTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        (require base_path('database/proposals/preserve_project_history.php'))->up();
        config(['jairoads_documents.supabase_url' => 'https://disposable-storage.test', 'jairoads_documents.service_role_key' => 'sb_secret_disposable',
            'jairoads_monthly_updates.supabase_url' => 'https://disposable-storage.test', 'jairoads_monthly_updates.service_role_key' => 'sb_secret_disposable']);
        Http::preventStrayRequests();
    }

    private function history(string $role = 'Admin'): array
    {
        $f = $this->fixture($role);
        $records = $updates = $docs = $media = [];
        foreach (['Q1', 'Q2'] as $q) {
            $r = $records[] = (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], $q) + ['created_by' => $f['user']->dd_user_account_id]);
            $u = $updates[] = (int) DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $r, 'update_month' => '2027-12', 'progress_percentage' => 35, 'summary_of_text_reports' => 'Preserved report', 'created_by' => $f['user']->dd_user_account_id]);
            $docs[] = (int) DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $r, 'document_title' => 'Retained document', 'file_name' => 'retained.pdf', 'file_path' => 'maintenance-records/'.$r.'/00000000-0000-4000-8000-000000000001.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
            $media[] = (int) DB::table('jairoads_next.media')->insertGetId(['monthly_update_id' => $u, 'file_name' => 'retained.png', 'file_path' => 'monthly-updates/'.$u.'/00000000-0000-4000-8000-000000000001.png', 'file_type' => 'image/png', 'uploaded_by' => $f['user']->dd_user_account_id]);
        }
        DB::table('jairoads_next.audit_logs')->insert(['user_id' => $f['user']->dd_user_account_id, 'actor_identifier' => 'Historical actor snapshot', 'action' => 'CREATE', 'entity_type' => 'MaintenanceProject', 'entity_id' => $f['project'], 'description' => 'Immutable historical event']);

        return $f + compact('records', 'updates', 'docs', 'media');
    }

    private function preview(int $id): string
    {
        return $this->getJson('/dd-phase3/ui/maintenance-projects/'.$id.'/deletion-preview')->assertOk()->json('confirmation_token');
    }

    private function remove(array $f, ?string $token = null): TestResponse
    {
        return $this->deleteJson('/dd-phase3/ui/maintenance-projects/'.$f['project'], ['confirmation_token' => $token ?? $this->preview($f['project'])]);
    }

    public static function admins(): iterable
    {
        yield ['Admin'];
        yield ['SuperAdmin'];
    }

    #[DataProvider('admins')]
    public function test_one_project_is_deleted_and_all_related_history_storage_and_attribution_are_preserved(string $role): void
    {
        $f = $this->history($role);
        $other = (int) DB::table('jairoads_next.maintenance_projects')->insertGetId(['road_coverage_id' => $this->road(), 'project_title' => 'Other', 'created_by' => $f['user']->dd_user_account_id]);
        DB::table('jairoads_next.maintenance_records')->insert($this->recordData($other, $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
        $snapshots = [];
        foreach (['road_coverages', 'monthly_updates', 'maintenance_documents', 'media', 'audit_logs', 'engineers', 'user_accounts'] as $table) {
            $snapshots[$table] = DB::table('jairoads_next.'.$table)->orderBy('id')->get()->toJson();
        }
        $recordSnapshots = DB::table('jairoads_next.maintenance_records')->where('project_id', $f['project'])->orderBy('id')->get()->map(fn ($r) => (array) $r)->all();
        $token = $this->preview($f['project']);
        // Opening/Cancel is read-only and records the current server-side impact.
        $this->assertSame(0, DB::table(PreservedProjectDeletion::CONTEXT)->count());
        $this->getJson('/dd-phase3/ui/maintenance-projects/'.$f['project'].'/deletion-preview')->assertJsonPath('counts.maintenance_records', 2)->assertJsonPath('counts.monthly_updates', 2)->assertJsonPath('counts.maintenance_documents', 2)->assertJsonPath('counts.media', 2);
        $this->remove($f, $token)->assertOk()->assertJsonPath('state', 'completed');
        Http::assertNothingSent(); // No Storage removal/listing/upload is part of project deletion.
        $this->assertDatabaseMissing('jairoads_next.maintenance_projects', ['id' => $f['project']]);
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $other]);
        foreach ($recordSnapshots as $row) {
            $row['project_id'] = null;
            $this->assertSame($row, (array) DB::table('jairoads_next.maintenance_records')->where('id', $row['id'])->first());
        }
        foreach ($snapshots as $table => $before) {
            $q = DB::table('jairoads_next.'.$table)->orderBy('id');
            if ($table === 'audit_logs') {
                $q->whereIn('id', array_column(json_decode($before, true), 'id'));
            }
            $this->assertSame($before, $q->get()->toJson());
        }
        $event = DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->sole();
        $this->assertSame((int) $f['user']->dd_user_account_id, (int) $event->user_id);
        $this->assertNull($event->new_value);
        $this->assertSame($f['records'], json_decode($event->old_value, true)['preserved_record_ids']);
        $this->assertSame($f['project'], json_decode($event->old_value, true)['id']);
        $changes = DB::table('jairoads_next.audit_logs')->where('entity_type', 'MaintenanceRecord')->where('action', 'UPDATE')->orderBy('entity_id')->get();
        $this->assertSame($f['records'], $changes->pluck('entity_id')->all());
        foreach ($changes as $change) {
            $this->assertSame(['project_id' => $f['project']], json_decode($change->old_value, true));
            $this->assertSame(['project_id' => null], json_decode($change->new_value, true));
        }
        $this->assertNull($event->recipient_user_id);
        $context = DB::table(PreservedProjectDeletion::CONTEXT)->where('maintenance_id', $f['records'][0])->sole();
        $this->assertSame($f['project'], json_decode($context->snapshot, true)['previous_project']['id']);
        $this->assertNull(MaintenanceRecord::findOrFail($f['records'][0])->project);
        $this->get('/dd-phase3/history/records')->assertInertia(fn (Assert $p) => $p->has('records.data', 2)->where('records.data.0.project_id', null));
        $this->get('/dd-phase3/history/records/'.$f['records'][0])->assertInertia(fn (Assert $p) => $p->where('record.project_id', null)->where('record.previous_project_id', $f['project'])->has('updates.data', 1)->has('documents.data', 1)->has('media.data', 1));
        Http::fake(['*' => Http::response('retained private bytes')]);
        $this->get('/dd-phase3/files/document/'.$f['docs'][0])->assertOk()->assertContent('retained private bytes');
        $this->get('/dd-phase3/files/media/'.$f['media'][0])->assertOk()->assertContent('retained private bytes');
        $this->get('/dd-phase3/ui/maintenance-records')->assertInertia(fn (Assert $p) => $p->has('records.data', 1)->where('historyUrl', '/dd-phase3/history/records'));
        $this->get('/dd-phase3/users')->assertInertia(fn (Assert $p) => $p->where('counts.maintenanceRecords', 3));
    }

    public static function forbidden(): iterable
    {
        yield ['Engineer'];
        yield ['Viewer'];
    }

    #[DataProvider('forbidden')]
    public function test_non_administrators_cannot_delete_unassign_or_gain_scope_from_null_project(string $role): void
    {
        $f = $this->history();
        $user = $role === 'Engineer' ? User::where('dd_user_account_id', DB::table('jairoads_next.user_accounts')->where('engineer_id', $f['engineer'])->value('id'))->sole() : $this->account($role);
        $token = $this->preview($f['project']);
        $this->withSession(['password_hash_web' => null])->actingAs($user);
        $this->remove($f, $token)->assertForbidden();
        $this->deleteJson('/dd-phase3/ops/projects/'.$f['project'], ['confirmation_token' => $token])->assertForbidden();
        $this->getJson('/dd-phase3/ui/maintenance-projects/'.$f['project'].'/deletion-preview')->assertForbidden();
        $this->postJson('/dd-phase3/ops/records/'.$f['records'][0].'/unassignment', ['expected_current_manager_id' => $f['engineer']])->assertForbidden();
        $this->withSession(['password_hash_web' => null])->actingAs($f['user']);
        $this->remove($f, $token)->assertOk();
        $this->withSession(['password_hash_web' => null])->actingAs($user);
        $this->getJson('/dd-phase3/history/records')->assertForbidden();
        $this->getJson('/dd-phase3/history/records/'.$f['records'][0])->assertForbidden();
        $this->get('/dd-phase3/files/document/'.$f['docs'][0])->assertForbidden();
        $this->get('/dd-phase3/files/media/'.$f['media'][0])->assertForbidden();
        $this->get('/dd-phase3/ui/monthly-updates/'.$f['updates'][0])->assertNotFound();
        $this->get('/dd-phase3/ui/maintenance-records')->assertInertia(fn (Assert $p) => $p->has('records.data', 0));
        $this->get('/dd-phase3/dashboard')->assertInertia(fn (Assert $p) => $p->where('analytics.metrics.records', 0)->where('stats.managedRecords', 0));
    }

    public static function staleChanges(): iterable
    {
        foreach (['manager', 'report', 'document', 'project', 'road', 'token', 'actor', 'expired'] as $case) {
            yield [$case];
        }
    }

    #[DataProvider('staleChanges')]
    public function test_material_changes_wrong_actor_and_invalid_previews_fail_without_detaching(string $case): void
    {
        $f = $this->history();
        $token = $this->preview($f['project']);
        match ($case) {
            'manager' => DB::table('jairoads_next.maintenance_records')->where('id', $f['records'][0])->update(['managing_engineer_id' => null]),
            'report' => DB::table('jairoads_next.monthly_updates')->where('id', $f['updates'][0])->update(['progress_percentage' => 45]),
            'document' => DB::table('jairoads_next.maintenance_documents')->where('id', $f['docs'][0])->update(['document_title' => 'Changed']),
            'project' => DB::table('jairoads_next.maintenance_projects')->where('id', $f['project'])->update(['project_title' => 'Changed']),
            'road' => DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['kilometers' => 4]),
            'actor' => $this->withSession(['password_hash_web' => null])->actingAs($this->account()),
            default => null,
        };
        if ($case === 'token') {
            $token .= 'corrupted';
        }
        if ($case === 'expired') {
            $claim = json_decode(Crypt::decryptString($token), true);
            $claim['expires'] = time() - 1;
            $token = Crypt::encryptString(json_encode($claim));
        }
        $this->remove($f, $token)->assertUnprocessable()->assertJsonValidationErrors('confirmation_token');
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
        $this->assertSame(0, DB::table(PreservedProjectDeletion::CONTEXT)->count());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
        Http::assertNothingSent();
    }

    public static function failures(): iterable
    {
        yield ['audit'];
        yield ['project'];
    }

    #[DataProvider('failures')]
    public function test_database_failures_roll_back_context_detachment_deletion_and_new_audit(string $case): void
    {
        $f = $this->history();
        $token = $this->preview($f['project']);
        $table = $case === 'audit' ? 'audit_logs' : 'maintenance_projects';
        $operation = $case === 'audit' ? 'INSERT' : 'DELETE';
        DB::unprepared("CREATE FUNCTION jairoads_next.reject_history_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Disposable rollback test'; END $$; CREATE TRIGGER reject_history_test BEFORE $operation ON jairoads_next.$table FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_history_test()");
        $this->remove($f, $token)->assertServerError();
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
        $this->assertSame(2, DB::table('jairoads_next.maintenance_records')->where('project_id', $f['project'])->count());
        $this->assertSame(0, DB::table(PreservedProjectDeletion::CONTEXT)->count());
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
        Http::assertNothingSent();
    }

    #[DataProvider('admins')]
    public function test_manager_unassignment_and_subsequent_reassignment_preserve_history_and_edit_permissions(string $role): void
    {
        $f = $this->history($role);
        // Fixture already has the active manager account; locate its public login.
        $account = DB::table('jairoads_next.user_accounts')->where('engineer_id', $f['engineer'])->value('id');
        $oldLogin = User::where('dd_user_account_id', $account)->sole();
        $id = $f['records'][0];
        $r = '/dd-phase3/ops/records/'.$id;
        $this->postJson($r.'/unassignment', ['expected_current_manager_id' => $f['engineer']])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'managing_engineer_id' => null]);
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $f['records'][1], 'managing_engineer_id' => $f['engineer']]);
        $this->assertNull(MaintenanceRecord::findOrFail($id)->managingEngineer);
        $this->get('/dd-phase3/ui/maintenance-projects/'.$f['project'].'/records/'.$id)->assertInertia(fn (Assert $p) => $p->where('record.engineers_id', null)->where('record.managing_engineer', null)->where('canUnassign', true));
        $this->postJson($r.'/reassignment', ['managing_engineer_id' => $f['engineer']])->assertUnprocessable(); // Missing expected current manager is not implicit NULL.
        $this->withSession(['password_hash_web' => null])->actingAs($oldLogin);
        $this->putJson($r, $this->recordData($f['project'], $f['engineer']))->assertForbidden();
        $this->postJson('/dd-phase3/ops/updates', ['maintenance_id' => $id, 'update_month' => '2028-01', 'progress_percentage' => 1])->assertForbidden();
        $this->putJson('/dd-phase3/ops/documents/'.$f['docs'][0], ['document_title' => 'Forbidden'])->assertForbidden();
        $new = $this->engineer();
        $newLogin = $this->account('Engineer', $new);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $new, 'lgu_id' => $lgu, 'is_active' => true]);
        $this->withSession(['password_hash_web' => null])->actingAs($f['user']);
        $this->postJson($r.'/reassignment', ['managing_engineer_id' => $new, 'expected_current_manager_id' => null])->assertRedirect();
        $event = DB::table('jairoads_next.audit_logs')->where('entity_type', 'MaintenanceRecord')->where('entity_id', $id)->whereNull('recipient_user_id')->orderByDesc('id')->first();
        $this->assertNull(json_decode($event->old_value, true)['managing_engineer_id']);
        $this->assertSame($new, json_decode($event->new_value, true)['managing_engineer_id']);
        $this->withSession(['password_hash_web' => null])->actingAs($newLogin);
        $this->putJson($r, array_replace($this->recordData($f['project'], $new), ['description' => 'New manager']))->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'description' => 'New manager', 'created_by' => $f['user']->dd_user_account_id]);
    }

    public function test_unassigned_existing_record_can_be_edited_without_assigning_a_fake_manager_and_stale_unassignment_fails(): void
    {
        $f = $this->history();
        $id = $f['records'][0];
        $url = '/dd-phase3/ops/records/'.$id.'/unassignment';
        $this->postJson($url, ['expected_current_manager_id' => $f['engineer']])->assertRedirect();
        $event = DB::table('jairoads_next.audit_logs')->where('action', 'UPDATE')->sole();
        $this->assertSame(['managing_engineer_id' => null], json_decode($event->new_value, true));
        $this->assertSame(['managing_engineer_id' => $f['engineer']], json_decode($event->old_value, true));
        $this->postJson($url, ['expected_current_manager_id' => $f['engineer']])->assertUnprocessable();
        $this->postJson($url, ['expected_current_manager_id' => null])->assertRedirect();
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('action', 'UPDATE')->count());
        $ineligible = $this->engineer();
        $this->account('Engineer', $ineligible);
        $this->postJson('/dd-phase3/ops/records/'.$id.'/reassignment', ['managing_engineer_id' => $ineligible, 'expected_current_manager_id' => null])->assertUnprocessable()->assertJsonValidationErrors('managing_engineer_id');
        $values = $this->recordData($f['project'], $f['engineer']);
        $values['engineers_id'] = null;
        $values['managing_engineer_id'] = null;
        $values['description'] = 'Metadata with no current manager';
        $this->putJson('/dd-phase3/ui/maintenance-projects/'.$f['project'].'/records/'.$id, $values)->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $id, 'managing_engineer_id' => null, 'description' => $values['description']]);
        $this->get('/dd-phase3/ui/maintenance-projects/'.$f['project'])->assertInertia(fn (Assert $p) => $p->has('records', 2));
        $this->postJson('/dd-phase3/ops/records', $this->recordData($f['project'], $f['engineer']))->assertUnprocessable();
    }

    public function test_unassignment_audit_failure_rolls_back_and_inactive_admin_cannot_confirm(): void
    {
        $f = $this->history();
        $token = $this->preview($f['project']);
        DB::unprepared("CREATE FUNCTION jairoads_next.reject_unassign_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='UPDATE' THEN RAISE EXCEPTION 'Disposable audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_unassign_test BEFORE INSERT ON jairoads_next.audit_logs FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_unassign_test()");
        $this->postJson('/dd-phase3/ops/records/'.$f['records'][0].'/unassignment', ['expected_current_manager_id' => $f['engineer']])->assertServerError();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $f['records'][0], 'managing_engineer_id' => $f['engineer']]);
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
        $this->remove($f, $token)->assertForbidden();
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_municipality_confirmation_preserves_geometry_with_explicitly_unassigned_records(): void
    {
        $f = $this->history();
        foreach ($f['records'] as $id) {
            $this->postJson('/dd-phase3/ops/records/'.$id.'/unassignment', ['expected_current_manager_id' => $f['engineer']])->assertRedirect();
        }
        $geometry = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('geojson');
        $destination = (int) DB::table('jairoads_next.lgus')->insertGetId(['municipality_name' => 'New municipality', 'province' => 'Test', 'region' => 'Test', 'mayor_first_name' => 'Test', 'mayor_last_name' => 'Mayor']);
        $base = '/dd-phase3/ops/roads/'.$f['road'].'/municipality';
        $token = $this->postJson($base.'/preview', ['lgu_id' => $destination])->assertOk()->assertJsonPath('can_confirm', true)->assertJsonPath('managers.0.engineer_id', null)->json('confirmation_token');
        $this->postJson($base.'/confirm', ['confirmation_token' => $token])->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.road_coverages', ['id' => $f['road'], 'lgu_id' => $destination]);
        $this->assertSame($geometry, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('geojson'));
        $this->assertSame(2, DB::table('jairoads_next.maintenance_records')->where('project_id', $f['project'])->whereNull('managing_engineer_id')->count());
    }

    public function test_explicit_individual_file_deletion_remains_available_to_admin_after_project_detachment(): void
    {
        $f = $this->history();
        $this->remove($f)->assertOk();
        (require base_path('database/proposals/create_file_deletions.php'))->up();
        Http::fake(function ($request) {
            return str_contains($request->url(), '/bucket/')
                ? Http::response(['id' => basename($request->url()), 'public' => false, 'versioning_status' => 'DISABLED'])
                : Http::response(['message' => 'Successfully deleted']);
        });
        $this->deleteJson('/dd-phase3/files/document/'.$f['docs'][0])->assertOk()->assertJsonPath('state', 'completed');
        $this->assertDatabaseMissing('jairoads_next.maintenance_documents', ['id' => $f['docs'][0]]);
        $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $f['docs'][1]]);
        $this->assertSame(1, DB::table('jairoads_next.audit_logs')->where('entity_type', 'MaintenanceDocument')->where('action', 'DELETE')->count());
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $f['records'][0], 'project_id' => null]);
    }

    public static function immutableMutations(): iterable
    {
        yield ['UPDATE jairoads_next.maintenance_record_contexts SET previous_project_id = 999'];
        yield ['DELETE FROM jairoads_next.maintenance_record_contexts'];
        yield ['TRUNCATE jairoads_next.maintenance_record_contexts'];
    }

    #[DataProvider('immutableMutations')]
    public function test_historical_context_cannot_be_rewritten_or_removed(string $sql): void
    {
        $f = $this->history();
        $this->remove($f)->assertOk();
        $this->expectException(QueryException::class);
        DB::statement($sql);
    }

    public function test_orphan_without_historical_context_is_rejected_by_deferred_constraint(): void
    {
        $f = $this->history();
        $this->expectException(QueryException::class);
        DB::table('jairoads_next.maintenance_records')->where('id', $f['records'][0])->update(['project_id' => null]);
        DB::statement('SET CONSTRAINTS ALL IMMEDIATE');
    }

    public function test_context_table_is_private_and_unapproved_schema_disables_new_operations(): void
    {
        $f = $this->history();
        $this->assertTrue(DB::selectOne("SELECT relrowsecurity AS enabled FROM pg_class WHERE oid='jairoads_next.maintenance_record_contexts'::regclass")->enabled);
        $this->assertSame(0, (int) DB::selectOne("SELECT count(*) AS n FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid='jairoads_next.maintenance_record_contexts'::regclass AND a.grantee=0")->n);
        DB::unprepared('SET CONSTRAINTS ALL IMMEDIATE; DROP TRIGGER require_maintenance_record_context ON jairoads_next.maintenance_records; DROP TABLE jairoads_next.maintenance_record_contexts; ALTER TABLE jairoads_next.maintenance_records ALTER COLUMN project_id SET NOT NULL, ALTER COLUMN managing_engineer_id SET NOT NULL');
        $this->getJson('/dd-phase3/ui/maintenance-projects/'.$f['project'].'/deletion-preview')->assertStatus(503);
        $this->postJson('/dd-phase3/ops/records/'.$f['records'][0].'/unassignment', ['expected_current_manager_id' => $f['engineer']])->assertStatus(503);
        $this->get('/dd-phase3/ui/maintenance-projects/'.$f['project'])->assertInertia(fn (Assert $p) => $p->where('project.can_delete', false));
    }

    public static function races(): iterable
    {
        yield 'manager changes while delete waits' => ['manager'];
        yield 'actor deactivates while delete waits' => ['actor'];
        yield 'delete commits while reassignment waits' => ['delete'];
        yield 'delete commits while document edit waits' => ['document'];
    }

    #[DataProvider('races')]
    public function test_two_connections_cannot_leave_stale_or_invalid_relationships(string $case): void
    {
        $f = $this->history();
        $token = $this->preview($f['project']);
        DB::commit();
        $worker = null;
        try {
            DB::beginTransaction();
            DB::table('jairoads_next.maintenance_projects')->where('id', $f['project'])->lockForUpdate()->first();
            $path = match ($case) {
                'delete' => '/dd-phase3/ops/records/'.$f['records'][0].'/reassignment', 'document' => '/dd-phase3/ops/documents/'.$f['docs'][0], default => '/dd-phase3/ui/maintenance-projects/'.$f['project']
            };
            $data = match ($case) {
                'delete' => ['managing_engineer_id' => $f['engineer'], 'expected_current_manager_id' => $f['engineer']], 'document' => ['document_title' => 'Must not change detached history'], default => ['confirmation_token' => $token]
            };
            $worker = new Process([PHP_BINARY, __DIR__.'/preserved-history-worker.php', (string) $f['user']->id, $path, base64_encode(json_encode($data)), match ($case) {
                'delete' => 'POST', 'document' => 'PUT', default => 'DELETE'
            }]);
            $worker->setTimeout(20);
            $worker->start();
            $deadline = microtime(true) + 8;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = DB::selectOne("SELECT query FROM pg_stat_activity WHERE application_name='preserved_history_worker' AND wait_event_type='Lock'");
                if ($waiting !== null) {
                    break;
                }
                usleep(20000);
            } while (microtime(true) < $deadline);
            $this->assertNotNull($waiting, $worker->getErrorOutput().$worker->getOutput());
            $this->assertStringContainsString('maintenance_projects', $waiting->query);
            if ($case === 'manager') {
                DB::table('jairoads_next.maintenance_records')->where('id', $f['records'][0])->update(['managing_engineer_id' => null]);
            }
            if ($case === 'actor') {
                DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
            }
            if (in_array($case, ['delete', 'document'], true)) {
                $this->remove($f, $token)->assertOk();
            }
            DB::commit();
            $worker->wait();
            $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput());
            $this->assertSame(match ($case) {
                'manager' => 422, 'actor' => 403, 'delete', 'document' => 404
            }, json_decode($worker->getOutput(), true)['status']);
            if (in_array($case, ['delete', 'document'], true)) {
                $this->assertSame(2, DB::table('jairoads_next.maintenance_records')->whereNull('project_id')->count());
                $this->assertSame(2, DB::table(PreservedProjectDeletion::CONTEXT)->count());
                $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $f['docs'][0], 'document_title' => 'Retained document']);
            } else {
                $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
                $this->assertSame(0, DB::table(PreservedProjectDeletion::CONTEXT)->count());
            }
            Http::assertNothingSent();
        } finally {
            $worker?->stop();
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            // Only this already-guarded disposable cluster: restore shared fixture shape.
            DB::unprepared('DROP TRIGGER require_maintenance_record_context ON jairoads_next.maintenance_records; DROP FUNCTION jairoads_next.require_maintenance_record_context(); DROP TABLE jairoads_next.maintenance_record_contexts; DROP FUNCTION jairoads_next.protect_maintenance_record_context()');
            PostgresTestSchema::clearCommittedFixtures();
            DB::unprepared('ALTER TABLE jairoads_next.maintenance_records ALTER COLUMN project_id SET NOT NULL, ALTER COLUMN managing_engineer_id SET NOT NULL');
        }
    }

    public function test_new_records_still_require_valid_project_and_manager_and_no_unreviewed_delete_bypasses_preview(): void
    {
        $f = $this->history();
        $data = $this->recordData($f['project'], $f['engineer'], 'Q3');
        foreach (['project_id', 'managing_engineer_id'] as $field) {
            $this->postJson('/dd-phase3/ops/records', array_replace($data, [$field => null]))->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->deleteJson('/dd-phase3/ops/projects/'.$f['project'])->assertUnprocessable();
        $this->deleteJson('/dd-phase3/ops/records/'.$f['records'][0])->assertUnprocessable();
        $this->deleteJson('/dd-phase3/ops/updates/'.$f['updates'][0])->assertUnprocessable();
        $this->assertSame(2, DB::table('jairoads_next.maintenance_records')->count());
    }
}

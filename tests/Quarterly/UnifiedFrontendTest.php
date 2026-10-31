<?php

declare(strict_types=1);

namespace Tests\Quarterly;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\DataProvider;

final class UnifiedFrontendTest extends PostgresTestCase
{
    private const UI = '/dd-phase3/ui';

    public static function roles(): iterable
    {
        foreach (['SuperAdmin', 'Admin', 'Engineer', 'Viewer'] as $role) {
            yield $role => [$role];
        }
    }

    #[DataProvider('roles')]
    public function test_real_role_reads_use_canonical_frontend_without_preview_identity(string $role): void
    {
        $f = $this->fixture($role);
        $record = $this->record($f);
        $update = $this->monthly($f, $record);
        $document = $this->document($f, $record);
        foreach ([
            '/road-coverages' => 'RoadCoverages/Index',
            '/road-coverages/'.$f['road'] => 'RoadCoverages/Show',
            '/maintenance-projects' => 'MaintenanceProjects/Index',
            '/maintenance-projects/'.$f['project'] => 'MaintenanceProjects/Show',
            '/maintenance-projects/'.$f['project'].'/records/'.$record => 'MaintenanceProjects/Records/Show',
            '/maintenance-records' => 'MaintenanceRecords/Index',
            '/monthly-updates' => 'MonthlyUpdates/Index',
            '/monthly-updates/'.$update => 'MonthlyUpdates/Show',
            '/maintenance-documents' => 'MaintenanceDocuments/Index',
            '/maintenance-documents/'.$document => 'MaintenanceDocuments/Show',
        ] as $path => $component) {
            $this->get(self::UI.$path)->assertOk()->assertInertia(fn (Assert $page) => $page
                ->component($component)->where('canonicalFrontend', true)->missing('previewOnly')->missing('demoAccounts'));
        }
    }

    public function test_engineer_roads_projects_and_parent_choices_are_lgu_scoped(): void
    {
        $f = $this->fixture('Engineer');
        $other = $this->road();
        $project = DB::table('jairoads_next.maintenance_projects')->insertGetId(['project_title' => 'Outside scope',
            'road_coverage_id' => $other, 'created_by' => $f['user']->dd_user_account_id]);
        $this->get(self::UI.'/road-coverages')->assertInertia(fn (Assert $page) => $page->has('coverages.data', 1)->where('coverages.data.0.id', $f['road']));
        $this->get(self::UI.'/maintenance-projects')->assertInertia(fn (Assert $page) => $page->has('projects.data', 1));
        $this->get(self::UI.'/road-coverages/'.$other)->assertNotFound();
        $this->get(self::UI.'/maintenance-projects/'.$project)->assertNotFound();
        $this->get(self::UI.'/maintenance-projects/'.$project.'/records/create')->assertNotFound();
    }

    public function test_new_frontend_payload_persists_road_geometry_and_canonical_project_creator(): void
    {
        $f = $this->fixture('Engineer');
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        $geometry = ['type' => 'Feature', 'properties' => ['jairoads_mapping' => ['version' => 1]],
            'geometry' => ['type' => 'LineString', 'coordinates' => [[125.95, 7.59], [125.96, 7.6], [125.97, 7.61]]]];
        $this->post(self::UI.'/road-coverages', ['road_name' => 'Integrated geometry', 'lgus_id' => $lgu,
            'pavement_type' => 'Concrete', 'state_category' => 'Good', 'kilometers' => '2.75', 'geojson' => $geometry,
            'created_by' => 99999])->assertSessionHasNoErrors()->assertRedirect(self::UI.'/road-coverages');
        $road = DB::table('jairoads_next.road_coverages')->where('road_name', 'Integrated geometry')->first();
        $this->assertEquals($geometry, json_decode($road->geojson, true));
        $this->assertSame($f['engineer'], (int) $road->created_by);
        $this->post(self::UI.'/maintenance-projects', ['road_coverage_id' => $road->id, 'project_title' => 'Integrated project', 'created_by' => 99999])
            ->assertSessionHasNoErrors()->assertRedirect(self::UI.'/maintenance-projects');
        $project = DB::table('jairoads_next.maintenance_projects')->where('road_coverage_id', $road->id)->first();
        $this->assertSame((int) $f['user']->dd_user_account_id, (int) $project->created_by);
        $this->get(self::UI.'/road-coverages/'.$road->id)->assertInertia(fn (Assert $page) => $page
            ->where('coverage.geojson.geometry.coordinates', $geometry['geometry']['coordinates'])
            ->where('associatedProject.id', (int) $project->id));
    }

    public function test_ordinary_information_edit_preserves_complex_saved_geometry_exactly(): void
    {
        $f = $this->fixture();
        $geometry = '{"type":"GeometryCollection","geometries":[{"type":"MultiLineString","coordinates":[[[125,7,3],[125.1,7.1,4]],[[125.2,7.2],[125.3,7.3]]]}]}';
        DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['geojson' => $geometry]);
        $before = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $this->put(self::UI.'/road-coverages/'.$f['road'], ['road_name' => 'Updated name', 'lgus_id' => $before->lgu_id,
            'pavement_type' => $before->pavement_type, 'state_category' => $before->state_category, 'kilometers' => $before->kilometers])
            ->assertSessionHasNoErrors()->assertRedirect(self::UI.'/road-coverages/'.$f['road']);
        $after = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        $this->assertSame($before->geojson, $after->geojson);
        $this->assertSame($before->kilometers, $after->kilometers);
        $this->assertSame('Updated name', $after->road_name);
        $this->assertSame(1, DB::table('jairoads_next.maintenance_projects')->count());
    }

    public function test_independent_quarters_and_monthly_updates_persist_and_duplicates_fail(): void
    {
        $f = $this->fixture('Engineer');
        foreach (['Q1', 'Q2', 'Q3', 'Q4'] as $quarter) {
            $payload = $this->recordData($f['project'], $f['engineer'], $quarter);
            $payload['engineers_id'] = $f['engineer'];
            $this->post(self::UI.'/maintenance-projects/'.$f['project'].'/records', $payload)->assertSessionHasNoErrors()->assertRedirect();
            $this->postJson(self::UI.'/maintenance-projects/'.$f['project'].'/records', $payload)->assertUnprocessable()->assertJsonValidationErrors('quarter');
        }
        $this->assertSame(4, DB::table('jairoads_next.maintenance_records')->count());
        $record = (int) DB::table('jairoads_next.maintenance_records')->where('quarter', 'Q4')->value('id');
        $data = ['maintenance_id' => $record, 'update_month' => '2026-10', 'progress_percentage' => '43.50', 'summary_of_text_reports' => 'Real persisted progress'];
        $this->post(self::UI.'/monthly-updates', $data)->assertSessionHasNoErrors()->assertRedirect();
        $this->assertSame('43.50', DB::table('jairoads_next.monthly_updates')->value('progress_percentage'));
        $this->postJson(self::UI.'/monthly-updates', $data)->assertUnprocessable()->assertJsonValidationErrors('update_month');
        $this->postJson(self::UI.'/monthly-updates', array_replace($data, ['update_month' => '2026-11', 'progress_percentage' => 101]))->assertUnprocessable();
        $this->postJson(self::UI.'/monthly-updates', array_replace($data, ['update_month' => '2026-11', 'removed_media_ids' => [1]]))->assertUnprocessable();
        $this->assertSame(1, DB::table('jairoads_next.monthly_updates')->count());
    }

    public function test_viewer_cannot_enter_forms_or_mutate_through_new_routes(): void
    {
        $f = $this->fixture('Viewer');
        foreach (['/road-coverages/create', '/maintenance-projects/create', '/maintenance-records/create', '/monthly-updates/create', '/maintenance-documents/create'] as $path) {
            $this->get(self::UI.$path)->assertForbidden();
        }
        foreach (['/road-coverages', '/maintenance-projects', '/monthly-updates', '/maintenance-documents', '/maintenance-projects/'.$f['project'].'/records'] as $path) {
            $this->postJson(self::UI.$path, [])->assertForbidden();
        }
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    public function test_inactive_and_retired_accounts_lose_existing_frontend_access(): void
    {
        $f = $this->fixture('Engineer');
        DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['engineer_status' => 'Retired']);
        $this->get(self::UI.'/maintenance-projects')->assertForbidden();
        DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['engineer_status' => 'Active']);
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->dd_user_account_id)->update(['is_active' => false]);
        $this->get(self::UI.'/road-coverages')->assertForbidden();
    }

    public function test_document_upload_uses_private_storage_and_never_exposes_path_in_props(): void
    {
        $f = $this->fixture('Engineer');
        $record = $this->record($f);
        config(['jairoads_documents.supabase_url' => 'http://127.0.0.1:5799', 'jairoads_documents.service_role_key' => 'disposable-mock-only']);
        Http::preventStrayRequests();
        Http::fake(['http://127.0.0.1:5799/*' => Http::response('', 200)]);
        $this->post(self::UI.'/maintenance-documents', ['maintenance_id' => $record, 'document_title' => 'Private integrated document',
            'attachment' => UploadedFile::fake()->createWithContent('inspection.pdf', "%PDF-1.4\nDisposable\n%%EOF")])->assertSessionHasNoErrors()->assertRedirect();
        $doc = DB::table('jairoads_next.maintenance_documents')->first();
        $this->get(self::UI.'/maintenance-documents/'.$doc->id)->assertInertia(fn (Assert $page) => $page
            ->where('document.download_url', '/dd-phase3/files/document/'.$doc->id)->missing('document.file_path')->missing('document.password'));
        Http::assertSentCount(1);
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Engineer', $this->engineer()));
        $this->get(self::UI.'/maintenance-documents/'.$doc->id)->assertNotFound();
        $this->get('/dd-phase3/files/document/'.$doc->id)->assertForbidden();
        Http::assertSentCount(1);
    }

    public function test_frontend_reassignment_preserves_creator_and_transfers_editing_rights(): void
    {
        $f = $this->fixture('Engineer');
        $record = $this->record($f);
        $replacement = $this->engineer();
        $newUser = $this->account('Engineer', $replacement);
        $lgu = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
        DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $replacement, 'lgu_id' => $lgu, 'is_active' => true]);
        $url = self::UI.'/maintenance-projects/'.$f['project'].'/records/'.$record;
        $this->postJson($url.'/reassignment', ['managing_engineer_id' => $replacement])->assertForbidden();
        $this->withSession(['password_hash_web' => null])->actingAs($this->account());
        $this->post($url.'/reassignment', ['managing_engineer_id' => $replacement, 'expected_current_manager_id' => $f['engineer']])->assertSessionHasNoErrors()->assertRedirect($url);
        $this->assertSame((int) $f['user']->dd_user_account_id, (int) DB::table('jairoads_next.maintenance_records')->value('created_by'));
        $this->withSession(['password_hash_web' => null])->actingAs($f['user'])->get($url.'/edit')->assertForbidden();
        $this->withSession(['password_hash_web' => null])->actingAs($newUser)->get($url.'/edit')->assertOk();
    }

    public function test_mutation_audit_failure_remains_atomic_through_adapter(): void
    {
        $f = $this->fixture();
        $before = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
        DB::statement("CREATE FUNCTION jairoads_next.reject_adapter_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Disposable audit failure'; END $$");
        DB::statement('CREATE TRIGGER reject_adapter_audit BEFORE INSERT ON jairoads_next.audit_logs FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_adapter_audit()');
        $this->put(self::UI.'/road-coverages/'.$f['road'], ['road_name' => 'Must roll back', 'lgus_id' => $before->lgu_id,
            'pavement_type' => $before->pavement_type, 'state_category' => $before->state_category, 'kilometers' => $before->kilometers])->assertServerError();
        $this->assertEquals($before, DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first());
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->count());
    }

    private function record(array $f): int
    {
        return (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->dd_user_account_id]);
    }

    private function monthly(array $f, int $record): int
    {
        return (int) DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-10', 'progress_percentage' => 20, 'created_by' => $f['user']->dd_user_account_id]);
    }

    private function document(array $f, int $record): int
    {
        return (int) DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $record, 'document_title' => 'Private fixture', 'file_name' => 'seed.pdf', 'file_path' => 'maintenance-records/'.$record.'/00000000-0000-4000-8000-000000000001.pdf', 'uploaded_by' => $f['user']->dd_user_account_id]);
    }
}

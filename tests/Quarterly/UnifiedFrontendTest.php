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
    private const UI = '/workspace/ui';

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

    public function test_project_history_paginates_whole_years_and_preserves_direct_year_links(): void
    {
        $f = $this->fixture('Admin');
        for ($year = 2014; $year <= 2026; $year++) {
            foreach (['Q1', 'Q4'] as $quarter) {
                DB::table('jairoads_next.maintenance_records')->insert(
                    $this->recordData($f['project'], $f['engineer'], $quarter, $year)
                        + ['created_by' => $f['user']->canonical_user_account_id]
                );
            }
        }
        $url = self::UI.'/maintenance-projects/'.$f['project'];
        $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('historyPagination.page', 1)->where('historyPagination.pages', 3)
            ->where('historyPagination.totalYears', 13)->has('records', 10)
            ->where('records.0.year', 2026)->where('records.9.year', 2022));
        $this->get($url.'?history_page=999999999')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('historyPagination.page', 3)->has('records', 6)->where('records.5.year', 2014));
        $this->get($url.'?record_year=2017&history_page=1')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('historyPagination.page', 2)->where('expandedYear', 2017)->has('records', 10));
        $this->get($url.'?record_year%5B%5D=invalid')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('historyPagination.page', 1)->where('expandedYear', 2026));
    }

    public function test_record_history_paginates_documents_and_preserves_totals_and_checkpoints(): void
    {
        $f = $this->fixture('Admin');
        $record = $this->record($f);
        $update = $this->monthly($f, $record);
        DB::table('jairoads_next.monthly_updates')->where('id', $update)->update(['progress_percentage' => 75]);
        for ($i = 1; $i <= 24; $i++) {
            DB::table('jairoads_next.monthly_updates')->insert([
                'maintenance_id' => $record,
                'update_month' => sprintf('%04d-%02d', 2027 + intdiv($i - 1, 12), ($i - 1) % 12 + 1),
                'progress_percentage' => 80,
                'summary_of_text_reports' => str_repeat('Synthetic history. ', 100),
                'created_by' => $f['user']->canonical_user_account_id,
            ]);
        }
        for ($i = 1; $i <= 13; $i++) {
            DB::table('jairoads_next.maintenance_documents')->insert([
                'maintenance_id' => $record,
                'document_title' => 'History '.$i,
                'description' => str_repeat('Synthetic document. ', 100),
                'file_name' => 'seed.pdf',
                'file_path' => 'maintenance-records/'.$record.'/00000000-0000-4000-8000-'.str_pad((string) $i, 12, '0', STR_PAD_LEFT).'.pdf',
                'uploaded_by' => $f['user']->canonical_user_account_id,
            ]);
        }

        $url = self::UI.'/maintenance-projects/'.$f['project'].'/records/'.$record;
        $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('documents', 12)->where('documentPagination.total', 13)
            ->where('documentPagination.page', 1)->where('updatePagination.total', 25)
            ->has('updates', 12)->where('updates.0.update_month', '2028-12')
            ->missing('updates.0.summary_of_text_reports')->missing('documents.0.description')
            ->where('checkpointMonths.0', '2026-10')->where('checkpointMonths.2', '2026-10')
            ->where('checkpointMonths.3', null));
        $this->get($url.'?document_page=999&update_page=999')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('documents', 1)->where('documentPagination.total', 13)
            ->where('documentPagination.page', 2)->where('documents.0.document_title', 'History 1')
            ->has('updates', 1)->where('updatePagination.page', 3)
            ->where('updates.0.update_month', '2026-10')
            ->where('checkpointMonths.2', '2026-10'));
        $this->get(self::UI.'/monthly-updates')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('updates.data', 12)->missing('updates.data.0.summary_of_text_reports')
            ->has('updates.data.0.media_count')->has('updates.data.0.project'));
        $this->get(self::UI.'/maintenance-documents')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('documents.data', 12)->missing('documents.data.0.description')
            ->has('documents.data.0.document_title')->has('documents.data.0.available'));
        $this->get(self::UI.'/monthly-updates/'.$update)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('update.summary_of_text_reports'));
        $document = (int) DB::table('jairoads_next.maintenance_documents')->where('maintenance_id', $record)->orderBy('id')->value('id');
        $this->get(self::UI.'/maintenance-documents/'.$document)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('document.description', str_repeat('Synthetic document. ', 100)));
    }

    public function test_dashboard_map_distinguishes_project_creator_and_record_assignment(): void
    {
        $f = $this->fixture('Engineer');
        $this->record($f);
        $other = $this->engineer();
        $otherLogin = $this->account('Engineer', $other);
        $road = $this->road($f['engineer']);
        $project = (int) DB::table('jairoads_next.maintenance_projects')->insertGetId([
            'project_title' => 'Other project', 'road_coverage_id' => $road,
            'created_by' => $f['user']->canonical_user_account_id,
        ]);
        $unassigned = $this->road($f['engineer']);
        DB::table('jairoads_next.maintenance_records')->insert([
            $this->recordData($f['project'], $f['engineer'], 'Q2') + ['created_by' => $f['user']->canonical_user_account_id],
            $this->recordData($project, $other) + ['created_by' => $f['user']->canonical_user_account_id],
        ]);
        $this->get('/workspace/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('RoleDashboard/Canonical')->where('role', 'engineer')->missing('mapCoverages'));
        $url = '/workspace/dashboard/map-roads';
        $this->getJson($url.'?engineer_id='.$other)->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.id', $unassigned)->assertJsonPath('data.0.my_project', false)
            ->assertJsonPath('data.0.project_id', null)
            ->assertJsonPath('data.1.id', $road)->assertJsonPath('data.1.my_project', true)
            ->assertJsonPath('data.1.created_by_me', true)->assertJsonPath('data.1.assigned_to_me', false)
            ->assertJsonPath('data.2.id', $f['road'])->assertJsonPath('data.2.my_project', true)
            ->assertJsonPath('data.2.created_by_me', true)->assertJsonPath('data.2.assigned_to_me', true)
            ->assertJsonPath('data.2.my_record_count', 2)->assertJsonPath('data.2.project_id', $f['project']);
        $this->flushSession();
        $this->actingAs($otherLogin)->getJson($url)->assertOk()
            ->assertJsonPath('data.0.my_project', false)->assertJsonPath('data.1.my_project', true)
            ->assertJsonPath('data.1.created_by_me', false)->assertJsonPath('data.1.assigned_to_me', true)
            ->assertJsonPath('data.2.my_project', false);
        $this->getJson($url.'?before=0')->assertUnprocessable();
        $this->flushSession();
        $this->actingAs($this->account('Viewer'))->get('/workspace/dashboard')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('RoleDashboard/Canonical')->where('role', 'viewer')->missing('mapCoverages'));
        $this->getJson($url)->assertForbidden();
        $this->getJson($url.'?before='.$unassigned)->assertForbidden();
    }

    public function test_engineer_road_inspector_returns_only_related_summary_and_no_private_paths(): void
    {
        $f = $this->fixture('Engineer');
        $record = $this->record($f);
        $update = $this->monthly($f, $record);
        $document = $this->document($f, $record);
        $unassigned = $this->road();
        $url = '/workspace/dashboard/roads/';
        $this->getJson($url.$f['road'])->assertOk()
            ->assertJsonPath('id', $f['road'])
            ->assertJsonPath('project.id', $f['project'])
            ->assertJsonPath('project.my_project', true)
            ->assertJsonPath('project.created_by_me', true)
            ->assertJsonPath('project.assigned_to_me', true)
            ->assertJsonPath('project.record_count', 1)
            ->assertJsonPath('project.recent_records.0.id', $record)
            ->assertJsonPath('project.update_count', 1)
            ->assertJsonPath('project.latest_update.id', $update)
            ->assertJsonPath('project.document_count', 1)
            ->assertJsonPath('project.latest_document.id', $document)
            ->assertJsonMissingPath('project.latest_document.file_path');
        $this->getJson($url.$unassigned)->assertOk()->assertJsonPath('project', null);
        $this->getJson($url.'99999999')->assertNotFound();
        $other = $this->account('Engineer');
        $this->withSession(['password_hash_web' => null])->actingAs($other)->getJson($url.$f['road'])->assertOk()->assertJsonPath('project.my_project', false);
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'))->getJson($url.$f['road'])->assertOk()
            ->assertJsonPath('project.my_project', false)->assertJsonPath('project.created_by_me', false)
            ->assertJsonPath('project.assigned_to_me', false)->assertJsonPath('project.my_record_count', 0)
            ->assertJsonMissingPath('project.latest_document.file_path');
    }

    public function test_record_search_by_engineer_and_document_form_source_context(): void
    {
        $f = $this->fixture('SuperAdmin');
        $record = $this->record($f);
        $name = 'UniqueSearchEngineer';
        DB::table('jairoads_next.engineers')->where('id', $f['engineer'])->update(['first_name' => $name]);
        $this->get(self::UI.'/maintenance-records?search='.$name.'&quarter=Q4')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('records.data', 1)->where('records.data.0.id', $record)->where('filters.search', $name));
        foreach (['maintenance_id', 'record'] as $key) {
            $this->get(self::UI.'/maintenance-documents/create?'.$key.'='.$record)->assertOk()->assertInertia(fn (Assert $page) => $page
                ->component('MaintenanceDocuments/Form')->where('contextRecordId', $record)->has('records', 1)
                ->where('records.0.id', $record)->where('projects.0.id', $f['project']));
        }
        $this->get(self::UI.'/maintenance-projects/'.$f['project'])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('records.0.delete_url', self::UI.'/maintenance-records/'.$record));
    }

    public function test_engineer_roads_projects_and_parent_choices_are_available_across_municipalities(): void
    {
        $f = $this->fixture('Engineer');
        $other = $this->road();
        $project = DB::table('jairoads_next.maintenance_projects')->insertGetId(['project_title' => 'Outside scope',
            'road_coverage_id' => $other, 'created_by' => $f['user']->canonical_user_account_id]);
        $this->get(self::UI.'/road-coverages')->assertInertia(fn (Assert $page) => $page->has('coverages.data', 2));
        $this->get(self::UI.'/maintenance-projects')->assertInertia(fn (Assert $page) => $page->has('projects.data', 2));
        $this->get(self::UI.'/road-coverages/'.$other)->assertOk();
        $this->get(self::UI.'/maintenance-projects/'.$project)->assertOk();
        DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $f['engineer'])->update(['is_active' => false]);
        $this->get(self::UI.'/maintenance-projects/'.$project.'/records/create')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->has('engineers', 1)->where('engineers.0.id', $f['engineer']));
        $this->post(self::UI.'/maintenance-projects/'.$project.'/records', $this->recordData((int) $project, $f['engineer']) + ['engineers_id' => $f['engineer']])
            ->assertSessionHasNoErrors()->assertRedirect();
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['project_id' => $project, 'managing_engineer_id' => $f['engineer']]);
    }

    public function test_directory_create_returns_eligible_managers_across_municipalities(): void
    {
        $f = $this->fixture('SuperAdmin');
        $otherEngineer = $this->engineer();
        $otherRoad = $this->road($otherEngineer);
        $otherProject = (int) DB::table('jairoads_next.maintenance_projects')->insertGetId([
            'project_title' => 'Project without an eligible account',
            'road_coverage_id' => $otherRoad,
            'created_by' => $f['user']->canonical_user_account_id,
        ]);

        $this->get(self::UI.'/maintenance-records/create')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('MaintenanceProjects/Records/Create')
            ->has('engineers', 1)->where('engineers.0.id', $f['engineer'])
            ->missing('managerChoicesByProject')->has('projects', 0)->where('projectChoiceUrl', '/workspace/ui/project-filter-choices'));
        $this->getJson(self::UI.'/project-filter-choices')->assertOk()->assertJsonCount(2, 'data');

        $this->account('Engineer', $otherEngineer);
        DB::table('jairoads_next.engineer_lgus')->where('engineer_id', $otherEngineer)->update(['is_active' => false]);
        $this->get(self::UI.'/maintenance-records/create')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('engineers', 2)->missing('managerChoicesByProject'));
    }

    public function test_empty_record_deletion_preserves_parent_siblings_and_audits(): void
    {
        $f = $this->fixture('SuperAdmin');
        $record = $this->record($f);
        $sibling = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer'], 'Q2') + ['created_by' => $f['user']->canonical_user_account_id]
        );

        $this->delete(self::UI.'/maintenance-records/'.$record, $this->deletionVerification('record'))->assertSessionHasNoErrors()
            ->assertRedirect(self::UI.'/maintenance-records');
        $this->assertDatabaseMissing('jairoads_next.maintenance_records', ['id' => $record]);
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $sibling]);
        $this->assertDatabaseHas('jairoads_next.maintenance_projects', ['id' => $f['project']]);
        $this->assertDatabaseHas('jairoads_next.audit_logs', ['action' => 'DELETE', 'entity_type' => 'MaintenanceRecord', 'entity_id' => $record]);
    }

    public function test_record_deletion_rejects_dependencies_and_bulk_is_atomic(): void
    {
        $f = $this->fixture('SuperAdmin');
        $record = $this->record($f);
        $update = $this->monthly($f, $record);
        $document = $this->document($f, $record);
        $empty = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
            $this->recordData($f['project'], $f['engineer'], 'Q2') + ['created_by' => $f['user']->canonical_user_account_id]
        );
        Http::preventStrayRequests();

        $this->deleteJson(self::UI.'/maintenance-records/'.$record, $this->deletionVerification('record'))->assertUnprocessable()->assertJsonValidationErrors('delete');
        $this->deleteJson(self::UI.'/maintenance-records/bulk', $this->deletionVerification('record') + ['record_ids' => [$empty, $record]])
            ->assertUnprocessable()->assertJsonValidationErrors('delete');
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $record]);
        $this->assertDatabaseHas('jairoads_next.maintenance_records', ['id' => $empty]);
        $this->assertDatabaseHas('jairoads_next.monthly_updates', ['id' => $update]);
        $this->assertDatabaseHas('jairoads_next.maintenance_documents', ['id' => $document]);
        $this->assertSame(0, DB::table('jairoads_next.audit_logs')->where('action', 'DELETE')->count());
        Http::assertNothingSent();

        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'))
            ->deleteJson(self::UI.'/maintenance-records/'.$empty)->assertForbidden();
    }

    public function test_road_directory_omits_geometry_without_changing_detail_or_map_geometry(): void
    {
        $f = $this->fixture('Engineer');
        $points = [];
        for ($i = 0; $i < 1000; $i++) {
            $points[] = [125.95 + $i * 0.00001, 7.59 + $i * 0.00001];
        }
        $geometry = ['type' => 'LineString', 'coordinates' => $points];
        DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['geojson' => json_encode($geometry, JSON_THROW_ON_ERROR)]);
        $this->get(self::UI.'/road-coverages')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('coverages.data', 1)->missing('coverages.data.0.geojson')
            ->where('coverages.data.0.id', $f['road'])->where('mapDeferred', true));
        $this->get(self::UI.'/road-coverages/'.$f['road'])->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('coverage.geojson.coordinates', $points));
        $this->getJson(self::UI.'/map/road-index')->assertOk()
            ->assertJsonPath('data.0.geojson.coordinates', $points);
    }

    public function test_project_form_includes_assigned_roads_as_reference_only_and_preserves_current_edit_selection(): void
    {
        $f = $this->fixture('Admin');
        $available = $this->road();
        $other = $this->road();
        DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['road_name' => 'A assigned road']);
        DB::table('jairoads_next.road_coverages')->where('id', $available)->update(['road_name' => 'B available road']);
        DB::table('jairoads_next.road_coverages')->where('id', $other)->update(['road_name' => 'C assigned road']);
        DB::table('jairoads_next.maintenance_projects')->insert([
            'project_title' => 'Other project', 'road_coverage_id' => $other,
            'created_by' => $f['user']->canonical_user_account_id,
        ]);

        $this->get(self::UI.'/maintenance-projects/create')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('MaintenanceProjects/Create')->has('coverages', 1)
            ->where('coverages.0.id', $available)->where('coverages.0.assigned', false)
            ->where('coverages.0.geojson', null)->where('coveragePagination.assigned', 2));
        $this->getJson(self::UI.'/project-road-choices?show_assigned=1')->assertOk()
            ->assertJsonCount(3, 'data')->assertJsonPath('data.0.id', $f['road'])
            ->assertJsonPath('data.0.assigned', true)->assertJsonPath('data.0.assigned_project_title', 'Test project')
            ->assertJsonPath('data.0.geojson', null);
        $this->getJson(self::UI.'/project-road-choices/'.$available.'/geometry')->assertOk()
            ->assertJsonPath('geojson.type', 'LineString')->assertHeader('Cache-Control', 'no-store, private');
        $this->get(self::UI.'/maintenance-projects/'.$f['project'].'/edit')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('MaintenanceProjects/Edit')->has('coverages', 3)
            ->where('coverages.0.id', $f['road'])->where('coverages.0.assigned', false)
            ->where('coverages.2.assigned', true)->where('selectedCoverage.id', $f['road']));

        $this->postJson(self::UI.'/maintenance-projects', ['road_coverage_id' => $f['road'], 'project_title' => 'Duplicate'])
            ->assertUnprocessable()->assertJsonValidationErrors('road_coverage_id');
        $this->assertSame(2, DB::table('jairoads_next.maintenance_projects')->count());
    }

    public function test_project_road_choices_are_paginated_searchable_and_private(): void
    {
        $f = $this->fixture('Engineer');
        for ($i = 0; $i < 35; $i++) {
            $road = $this->road($f['engineer']);
            DB::table('jairoads_next.road_coverages')->where('id', $road)->update(['road_name' => sprintf('Choice %02d', $i)]);
        }
        $this->get(self::UI.'/maintenance-projects/create')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->has('coverages', 30)->where('coveragePagination.available', 35)->where('coveragePagination.last_page', 2)
            ->where('coverages.0.geojson', null));
        $this->getJson(self::UI.'/project-road-choices?page=2')->assertOk()->assertJsonCount(5, 'data')->assertJsonPath('page', 2);
        $this->getJson(self::UI.'/project-road-choices?search=Choice%2034')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.road_name', 'Choice 34');
        $this->getJson(self::UI.'/project-road-choices?search=%25')->assertOk()->assertJsonCount(0, 'data');
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'));
        $this->getJson(self::UI.'/project-road-choices')->assertForbidden();
        $this->getJson(self::UI.'/project-road-choices/'.$f['road'].'/geometry')->assertForbidden();
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
        $this->assertSame((int) $f['user']->canonical_user_account_id, (int) $project->created_by);
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
        $this->postJson(self::UI.'/monthly-updates', array_replace($data, ['update_month' => '2026-11', 'removed_media_ids' => [1]]))->assertForbidden();
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
        DB::table('jairoads_next.user_accounts')->where('id', $f['user']->canonical_user_account_id)->update(['is_active' => false]);
        $this->actingAs($f['user'])->get(self::UI.'/road-coverages')->assertForbidden();
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
        $this->assertMatchesRegularExpression('/^maintenance-records\\/'.$record.'\\/[0-9a-f-]+\\.pdf$/', (string) $doc->file_path);

        // A valid PDF renamed with an unsupported extension is a validation
        // error, never a storage exception or a second remote upload.
        $this->post(self::UI.'/maintenance-documents', ['maintenance_id' => $record, 'document_title' => 'Mismatched extension',
            'attachment' => UploadedFile::fake()->createWithContent('inspection.txt', "%PDF-1.4\nDisposable\n%%EOF")])->assertSessionHasErrors(['attachment']);
        $this->get(self::UI.'/maintenance-documents/'.$doc->id)->assertInertia(fn (Assert $page) => $page
            ->where('document.download_url', '/workspace/files/document/'.$doc->id)->missing('document.file_path')->missing('document.password'));
        Http::assertSentCount(1);
        $this->withSession(['password_hash_web' => null])->actingAs($this->account('Engineer', $this->engineer()));
        // Verified Engineer reads remain cross-municipality, without write or
        // file-path disclosure privileges.
        $this->get(self::UI.'/maintenance-documents/'.$doc->id)->assertOk();
        $this->get('/workspace/files/document/'.$doc->id)->assertOk();
        Http::assertSentCount(2);
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
        $this->assertSame((int) $f['user']->canonical_user_account_id, (int) DB::table('jairoads_next.maintenance_records')->value('created_by'));
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

    public function test_combined_account_provisioning_preserves_role_and_profile_link(): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $payload = [
            'username' => 'combined-fixture', 'email' => 'combined-fixture@example.test',
            'name' => 'Combined Fixture', 'account_type' => 'Engineer',
            'password' => 'Disposable-Test!123', 'password_confirmation' => 'Disposable-Test!123',
            'profile' => ['first_name' => 'Combined', 'last_name' => 'Fixture',
                'contact_no' => '09123456789', 'rank' => 'Engineer II'],
        ];
        $this->post('/workspace/accounts', $payload)->assertSessionHasNoErrors()->assertRedirect();
        $account = DB::table('jairoads_next.user_accounts')->where('username', 'combined-fixture')->first();
        $this->assertNotNull($account);
        $this->assertSame('Engineer', $account->account_type);
        $this->assertDatabaseHas('jairoads_next.engineers', ['id' => $account->engineer_id,
            'first_name' => 'Combined', 'last_name' => 'Fixture', 'engineer_status' => 'Active']);
        $this->assertDatabaseHas('public.users', ['canonical_user_account_id' => $account->id, 'email' => $payload['email']]);
        $this->assertDatabaseHas('jairoads_security.account_provisioning', ['user_account_id' => $account->id,
            'engineer_id' => $account->engineer_id, 'provisioned_role' => 'Engineer']);
        $this->assertDatabaseHas('jairoads_next.audit_logs', ['entity_type' => 'Engineer', 'entity_id' => $account->engineer_id, 'action' => 'CREATE']);
        $this->assertDatabaseHas('jairoads_next.audit_logs', ['entity_type' => 'UserAccount', 'entity_id' => $account->id, 'action' => 'CREATE']);

        $before = DB::table('jairoads_next.engineers')->count();
        $this->postJson('/workspace/accounts', array_replace($payload, [
            'username' => 'combined-invalid', 'email' => 'combined-invalid@example.test',
            'account_type' => 'SuperAdmin',
        ]))->assertUnprocessable()->assertJsonValidationErrors('account_type');
        $this->postJson('/workspace/accounts', array_replace($payload, [
            'username' => 'combined-conflict', 'email' => 'combined-conflict@example.test',
            'engineer_id' => $account->engineer_id,
        ]))->assertUnprocessable()->assertJsonValidationErrors('engineer_id');
        $this->assertSame($before, DB::table('jairoads_next.engineers')->count());
    }

    public function test_combined_account_rolls_back_new_profile_on_audit_failure(): void
    {
        $this->actingAs($this->account('SuperAdmin'));
        $before = DB::table('jairoads_next.engineers')->count();
        DB::statement("CREATE FUNCTION jairoads_next.reject_combined_audit() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN IF NEW.entity_type = 'UserAccount' THEN RAISE EXCEPTION 'Disposable audit failure'; END IF; RETURN NEW; END; \$\$");
        DB::statement('CREATE TRIGGER reject_combined_audit BEFORE INSERT ON jairoads_next.audit_logs FOR EACH ROW EXECUTE FUNCTION jairoads_next.reject_combined_audit()');
        $this->postJson('/workspace/accounts', [
            'username' => 'combined-rollback', 'email' => 'combined-rollback@example.test',
            'name' => 'Rollback Fixture', 'account_type' => 'Viewer',
            'password' => 'Disposable-Test!123', 'password_confirmation' => 'Disposable-Test!123',
            'profile' => ['first_name' => 'Rollback', 'last_name' => 'Fixture',
                'contact_no' => '09123456789', 'rank' => 'Engineer II'],
        ])->assertUnprocessable();
        $this->assertSame($before, DB::table('jairoads_next.engineers')->count());
        $this->assertDatabaseMissing('jairoads_next.user_accounts', ['username' => 'combined-rollback']);
        $this->assertDatabaseMissing('public.users', ['email' => 'combined-rollback@example.test']);
    }

    private function record(array $f): int
    {
        return (int) DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q4') + ['created_by' => $f['user']->canonical_user_account_id]);
    }

    private function monthly(array $f, int $record): int
    {
        return (int) DB::table('jairoads_next.monthly_updates')->insertGetId(['maintenance_id' => $record, 'update_month' => '2026-10', 'progress_percentage' => 20, 'created_by' => $f['user']->canonical_user_account_id]);
    }

    private function document(array $f, int $record): int
    {
        return (int) DB::table('jairoads_next.maintenance_documents')->insertGetId(['maintenance_id' => $record, 'document_title' => 'Private fixture', 'file_name' => 'seed.pdf', 'file_path' => 'maintenance-records/'.$record.'/00000000-0000-4000-8000-000000000001.pdf', 'uploaded_by' => $f['user']->canonical_user_account_id]);
    }
}

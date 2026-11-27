<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('matches percent signs literally in every canonical operational directory', function (): void {
    $f = $this->fixture('SuperAdmin');
    $account = (int) $f['user']->canonical_user_account_id;
    $originalLgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
    $otherRoad = $this->road($f['engineer']);
    $otherLgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $otherRoad)->value('lgu_id');

    DB::table('jairoads_next.lgus')->where('id', $originalLgu)->update(['municipality_name' => 'Borough%Alpha']);
    DB::table('jairoads_next.lgus')->where('id', $otherLgu)->update(['municipality_name' => 'BoroughXAlpha']);
    DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->update(['road_name' => 'Road%Alpha']);
    DB::table('jairoads_next.road_coverages')->where('id', $otherRoad)->update(['road_name' => 'RoadXAlpha']);
    DB::table('jairoads_next.maintenance_projects')->where('id', $f['project'])->update(['project_title' => 'Project%Alpha']);
    $otherProject = (int) DB::table('jairoads_next.maintenance_projects')->insertGetId([
        'project_title' => 'ProjectXAlpha', 'road_coverage_id' => $otherRoad, 'created_by' => $account,
    ]);
    $recordA = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
        $this->recordData($f['project'], $f['engineer']) + ['created_by' => $account]
    );
    $recordB = (int) DB::table('jairoads_next.maintenance_records')->insertGetId(
        $this->recordData($otherProject, $f['engineer'], 'Q2') + ['created_by' => $account]
    );
    $updateA = (int) DB::table('jairoads_next.monthly_updates')->insertGetId([
        'maintenance_id' => $recordA, 'update_month' => '2026-01', 'progress_percentage' => 10, 'created_by' => $account,
    ]);
    DB::table('jairoads_next.monthly_updates')->insert([
        'maintenance_id' => $recordB, 'update_month' => '2026-01', 'progress_percentage' => 20, 'created_by' => $account,
    ]);
    $documentA = (int) DB::table('jairoads_next.maintenance_documents')->insertGetId([
        'maintenance_id' => $recordA, 'document_title' => 'Document%Alpha', 'file_name' => '', 'file_path' => '', 'uploaded_by' => $account,
    ]);
    DB::table('jairoads_next.maintenance_documents')->insert([
        'maintenance_id' => $recordB, 'document_title' => 'DocumentXAlpha', 'file_name' => '', 'file_path' => '', 'uploaded_by' => $account,
    ]);
    $auditA = (int) DB::table('jairoads_next.audit_logs')->insertGetId([
        'user_id' => $account, 'actor_identifier' => 'Fixture Administrator',
        'action' => 'UPDATE', 'entity_type' => 'RoadCoverage', 'entity_id' => $f['road'], 'description' => 'Audit%Alpha',
    ]);
    DB::table('jairoads_next.audit_logs')->insert([
        'user_id' => $account, 'actor_identifier' => 'Fixture Administrator',
        'action' => 'UPDATE', 'entity_type' => 'RoadCoverage', 'entity_id' => $otherRoad, 'description' => 'AuditXAlpha',
    ]);

    foreach ([
        ['lgus', 'Borough%Alpha', 'lgus.data', $originalLgu],
        ['road-coverages', 'Road%Alpha', 'coverages.data', $f['road']],
        ['maintenance-projects', 'Project%Alpha', 'projects.data', $f['project']],
        ['maintenance-records', 'Project%Alpha', 'records.data', $recordA],
        ['monthly-updates', 'Project%Alpha', 'updates.data', $updateA],
        ['maintenance-documents', 'Document%Alpha', 'documents.data', $documentA],
    ] as [$path, $search, $dataKey, $expectedId]) {
        foreach ([['search' => $search], ['search' => $search, 'page' => '999999999999999999999999'], ['search' => $search, 'page' => ['invalid']]] as $params) {
            $paginationKey = substr($dataKey, 0, -5);
            $this->get('/workspace/ui/'.$path.'?'.http_build_query($params))->assertOk()->assertInertia(fn (Assert $page) => $page
                ->has($dataKey, 1)->where($dataKey.'.0.id', $expectedId)
                ->where($paginationKey.'.current_page', 1)->where($paginationKey.'.last_page', 1));
        }
    }

    $this->get('/workspace/ui/audit-logs?'.http_build_query(['search' => 'Audit%Alpha']))
        ->assertRedirect(route('jairoads.workspace.audit.index', ['activity_search' => 'Audit%Alpha']));
    $this->get('/workspace/audit-logs?'.http_build_query(['activity_search' => 'Audit%Alpha']))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('events.data', 1)->where('events.data.0.id', $auditA));
    $this->get('/workspace/audit-logs?'.http_build_query(['activity_search' => 'Audit%Alpha', 'page' => '99999999999999999999999', 'auth_page' => '99999999999999999999999']))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('events.data', 1)->where('events.data.0.id', $auditA)
            ->where('events.current_page', 1)->where('authentication.current_page', 1));
});

it('normalizes malformed and unicode search inputs instead of interpolating patterns', function (): void {
    $this->fixture('Admin');

    foreach (['lgus', 'road-coverages', 'maintenance-projects', 'maintenance-records',
        'monthly-updates', 'maintenance-documents'] as $path) {
        $this->get('/workspace/ui/'.$path.'?'.http_build_query(['search' => ['unexpected']]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('filters.search', ''));
    }

    $this->get('/workspace/ui/audit-logs?'.http_build_query(['search' => ['unexpected']]))->assertRedirect(route('jairoads.workspace.audit.index'));

    $this->get('/workspace/ui/lgus?'.http_build_query([
        'province' => ['untrusted'], 'region' => ['untrusted'], 'sort' => ['desc'],
        'search' => '  '.str_repeat('é', 151).'  ',
    ]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('filters.search', str_repeat('é', 150))->where('filters.province', '')->where('filters.region', '')->where('filters.sort', 'asc'));
});

it('normalizes structured directory filters to safe scalar options and preserves descending LGU sorting', function (): void {
    $this->fixture('Admin');

    $this->get('/workspace/ui/road-coverages?'.http_build_query([
        'municipality' => ['invalid'], 'condition' => ['invalid'], 'pavement' => ['invalid'], 'sort' => ['name-asc'],
    ]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('filters.municipality', 'all')->where('filters.condition', 'all')->where('filters.pavement', 'all')->where('filters.sort', 'newest'));
    $this->get('/workspace/ui/maintenance-records?'.http_build_query([
        'municipality' => ['invalid'], 'year' => ['invalid'], 'quarter' => ['Q4'], 'status' => ['Completed'], 'sort' => ['oldest'],
    ]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('filters.municipality', 'all')->where('filters.year', 'all')->where('filters.quarter', 'all')->where('filters.status', 'all')->where('filters.sort', 'newest'));

    foreach (['maintenance-projects', 'maintenance-documents', 'monthly-updates'] as $module) {
        $this->get('/workspace/ui/'.$module.'?'.http_build_query(['project' => ['invalid'], 'municipality' => ['invalid']]))->assertOk();
    }
    $this->get('/workspace/ui/maintenance-projects?'.http_build_query(['municipality' => ['invalid']]))->assertInertia(fn (Assert $page) => $page->where('filters.municipality', 'all'));
    $this->get('/workspace/ui/maintenance-documents?'.http_build_query(['project' => ['invalid']]))->assertInertia(fn (Assert $page) => $page->where('filters.project', 'all'));
    $this->get('/workspace/ui/monthly-updates?'.http_build_query(['project' => ['invalid'], 'year' => ['invalid']]))->assertInertia(fn (Assert $page) => $page->where('filters.project', 'all')->where('filters.year', 'all'));
    $this->get('/workspace/ui/audit-logs?'.http_build_query(['action' => ['invalid']]))->assertRedirect(route('jairoads.workspace.audit.index'));
    $this->get('/workspace/ui/audit-logs?action=UPDATE&sort=oldest')->assertRedirect(route('jairoads.workspace.audit.index', ['activity_action' => 'UPDATE', 'activity_order' => 'oldest']));
    $this->get('/workspace/ui/lgus?sort=DESC')->assertInertia(fn (Assert $page) => $page->where('filters.sort', 'desc'));
});

it('uses server-paginated canonical modules from ordinary workspace aliases', function (): void {
    $this->fixture('Admin');
    foreach ([
        'roads' => ['RoadCoverages/Index', 'coverages'],
        'projects' => ['MaintenanceProjects/Index', 'projects'],
        'updates' => ['MonthlyUpdates/Index', 'updates'],
        'documents' => ['MaintenanceDocuments/Index', 'documents'],
    ] as $section => [$component, $collection]) {
        foreach (['/workspace/', '/workspace/ops/'] as $prefix) {
            $this->get($prefix.$section)->assertOk()->assertInertia(fn (Assert $page) => $page
                ->component($component)->has($collection.'.data')->has($collection.'.total'));
        }
    }
});

it('does not load operational directory payloads in settings', function (): void {
    $this->fixture('Admin');
    DB::enableQueryLog();
    DB::flushQueryLog();
    try {
        $this->get('/workspace/settings')->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Workspace/Operations')->where('section', 'settings')->has('roads', 0)
            ->has('projects', 0)->has('records', 0)->has('updates', 0)->has('documents', 0)->has('media', 0));
        $queries = DB::getQueryLog();
    } finally {
        DB::disableQueryLog();
        DB::flushQueryLog();
    }
    $operationalReads = collect($queries)->filter(static function (array $entry): bool {
        return preg_match('/"jairoads_next"\."(?:road_coverages|maintenance_projects|maintenance_records|monthly_updates|maintenance_documents|media)"/', $entry['query']) === 1;
    });
    expect($operationalReads)->toHaveCount(0);
});

it('keeps LGU dependency counts correct without a per-row SQL query and paginates ties stably', function (): void {
    $f = $this->fixture('Admin');
    $lgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
    $this->get('/workspace/ui/lgus')->assertOk()->assertInertia(fn (Assert $page) => $page->where('lgus.data.0.id', $lgu)->where('lgus.data.0.deletion_check.road_coverages', 1)->where('lgus.data.0.deletion_check.engineer_assignments', 1));

    $ids = [];
    for ($i = 0; $i < 12; $i++) {
        $ids[] = (int) DB::table('jairoads_next.lgus')->insertGetId([
            'municipality_name' => 'Repeated LGU', 'province' => 'Test province',
            'region' => 'Test region', 'mayor_first_name' => 'Test', 'mayor_last_name' => 'Mayor',
        ]);
    }
    DB::enableQueryLog();
    DB::flushQueryLog();
    try {
        $this->get('/workspace/ui/lgus?'.http_build_query(['search' => 'Repeated LGU']))->assertOk()->assertInertia(fn (Assert $page) => $page->where('lgus.data', fn ($rows): bool => collect($rows)->pluck('id')->all() === array_slice($ids, 0, 10)));
        $queries = DB::getQueryLog();
    } finally {
        DB::disableQueryLog();
        DB::flushQueryLog();
    }
    $singleRowCounts = collect($queries)->filter(static function (array $entry): bool {
        return str_contains($entry['query'], 'count(*)')
            && str_contains($entry['query'], '"lgu_id" = ?');
    });
    expect($singleRowCounts)->toHaveCount(0);

    $this->get('/workspace/ui/lgus?'.http_build_query(['search' => 'Repeated LGU', 'page' => 2]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('lgus.data', fn ($rows): bool => collect($rows)->pluck('id')->all() === array_slice($ids, 10)));
});

it('clamps the final page of a multi-page directory and returns page one for empty results', function (): void {
    $f = $this->fixture('Admin');
    for ($i = 0; $i < 12; $i++) {
        $this->road($f['engineer']);
    }
    $this->get('/workspace/ui/road-coverages?page=999999999&sort=oldest')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('coverages.current_page', 2)
            ->where('coverages.last_page', 2)->where('coverages.total', 13)->has('coverages.data', 1));
    $this->get('/workspace/ui/road-coverages?page=999999999&search=NoSuchFixture')->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('coverages.current_page', 1)
            ->where('coverages.last_page', 1)->where('coverages.total', 0)->has('coverages.data', 0));
});

it('normalizes out of range numeric filters without database conversion errors', function (): void {
    $f = $this->fixture('Admin');
    $invalid = '9223372036854775808';
    foreach ([
        ['road-coverages', 'municipality'],
        ['maintenance-projects', 'municipality'],
        ['maintenance-records', 'municipality'],
        ['maintenance-records', 'year'],
        ['monthly-updates', 'project'],
        ['maintenance-documents', 'project'],
    ] as [$module, $filter]) {
        $this->get('/workspace/ui/'.$module.'?'.http_build_query([$filter => $invalid]))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('filters.'.$filter, 'all'));
    }
    $this->get('/workspace/ui/monthly-updates?project=000'.$f['project'])->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('filters.project', (string) $f['project'])->has('projects', 1));
});


it('bounds administrative directories and honors direct engineer profiles despite old filters', function (): void {
    $f = $this->fixture('SuperAdmin');
    for ($i = 0; $i < 20; $i++) {
        $this->engineer();
    }
    $url = '/workspace/users?';
    $this->get($url.http_build_query(['directory_tab' => 'engineers', 'directory_page' => '999999999999999999999999']))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('directory.page', 2)->where('directory.pages', 2)
            ->where('directory.total', 21)->has('engineers', 6));
    $this->get($url.http_build_query(['engineer_id' => $f['engineer'], 'directory_page' => 2,
        'directory_search' => 'NoSuchFixture', 'directory_state' => 'inactive']))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('directory.tab', 'engineers')->where('directory.page', 1)
            ->where('directory.search', '')->where('directory.state', 'all')
            ->where('initialEngineerId', $f['engineer'])->where('engineers.0.id', $f['engineer']));
    $this->get($url.http_build_query(['engineer_id' => ['invalid'], 'directory_page' => ['invalid']]))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('directory.tab', 'accounts')->where('directory.page', 1)
            ->where('initialEngineerId', null));
});

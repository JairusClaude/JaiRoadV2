<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('matches percent signs literally in every canonical operational directory', function (): void {
    $f = $this->fixture('SuperAdmin');
    $account = (int) $f['user']->dd_user_account_id;
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
        ['audit-logs', 'Audit%Alpha', 'events.data', $auditA],
    ] as [$path, $search, $dataKey, $expectedId]) {
        $this->get('/dd-phase3/ui/'.$path.'?'.http_build_query(['search' => $search]))->assertOk()->assertInertia(fn (Assert $page) => $page->has($dataKey, 1)->where($dataKey.'.0.id', $expectedId));
    }
});

it('normalizes malformed and unicode search inputs instead of interpolating patterns', function (): void {
    $this->fixture('Admin');

    foreach (['lgus', 'road-coverages', 'maintenance-projects', 'maintenance-records',
        'monthly-updates', 'maintenance-documents', 'audit-logs'] as $path) {
        $this->get('/dd-phase3/ui/'.$path.'?'.http_build_query(['search' => ['unexpected']]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('filters.search', ''));
    }

    $this->get('/dd-phase3/ui/lgus?'.http_build_query([
        'province' => ['untrusted'], 'region' => ['untrusted'], 'sort' => ['desc'],
        'search' => '  '.str_repeat('é', 151).'  ',
    ]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('filters.search', str_repeat('é', 150))->where('filters.province', '')->where('filters.region', '')->where('filters.sort', 'asc'));
});


it('normalizes structured directory filters to safe scalar options and preserves descending LGU sorting', function (): void {
    $this->fixture('Admin');

    $this->get('/dd-phase3/ui/road-coverages?'.http_build_query([
        'municipality' => ['invalid'], 'condition' => ['invalid'], 'pavement' => ['invalid'], 'sort' => ['name-asc'],
    ]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('filters.municipality', 'all')->where('filters.condition', 'all')->where('filters.pavement', 'all')->where('filters.sort', 'newest'));
    $this->get('/dd-phase3/ui/maintenance-records?'.http_build_query([
        'municipality' => ['invalid'], 'year' => ['invalid'], 'quarter' => ['Q4'], 'status' => ['Completed'], 'sort' => ['oldest'],
    ]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('filters.municipality', 'all')->where('filters.year', 'all')->where('filters.quarter', 'all')->where('filters.status', 'all')->where('filters.sort', 'newest'));

    foreach (['maintenance-projects', 'maintenance-documents', 'monthly-updates'] as $module) {
        $this->get('/dd-phase3/ui/'.$module.'?'.http_build_query(['project' => ['invalid'], 'municipality' => ['invalid']]))->assertOk();
    }
    $this->get('/dd-phase3/ui/maintenance-projects?'.http_build_query(['municipality' => ['invalid']]))->assertInertia(fn (Assert $page) => $page->where('filters.municipality', 'all'));
    $this->get('/dd-phase3/ui/maintenance-documents?'.http_build_query(['project' => ['invalid']]))->assertInertia(fn (Assert $page) => $page->where('filters.project', 'all'));
    $this->get('/dd-phase3/ui/monthly-updates?'.http_build_query(['project' => ['invalid'], 'year' => ['invalid']]))->assertInertia(fn (Assert $page) => $page->where('filters.project', 'all')->where('filters.year', 'all'));
    $this->get('/dd-phase3/ui/audit-logs?'.http_build_query(['action' => ['invalid']]))->assertInertia(fn (Assert $page) => $page->where('filters.action', 'all'));
    $this->get('/dd-phase3/ui/lgus?sort=DESC')->assertInertia(fn (Assert $page) => $page->where('filters.sort', 'desc'));
});

it('keeps LGU dependency counts correct without a per-row SQL query and paginates ties stably', function (): void {
    $f = $this->fixture('Admin');
    $lgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->value('lgu_id');
    $this->get('/dd-phase3/ui/lgus')->assertOk()->assertInertia(fn (Assert $page) => $page->where('lgus.data.0.id', $lgu)->where('lgus.data.0.deletion_check.road_coverages', 1)->where('lgus.data.0.deletion_check.engineer_assignments', 1));

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
        $this->get('/dd-phase3/ui/lgus?'.http_build_query(['search' => 'Repeated LGU']))->assertOk()->assertInertia(fn (Assert $page) => $page->where('lgus.data', fn ($rows): bool => collect($rows)->pluck('id')->all() === array_slice($ids, 0, 10)));
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

    $this->get('/dd-phase3/ui/lgus?'.http_build_query(['search' => 'Repeated LGU', 'page' => 2]))->assertOk()->assertInertia(fn (Assert $page) => $page->where('lgus.data', fn ($rows): bool => collect($rows)->pluck('id')->all() === array_slice($ids, 10)));
});

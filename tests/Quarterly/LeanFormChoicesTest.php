<?php

declare(strict_types=1);

use App\Services\DataDictionary\DataDictionaryIdentityResolver;
use App\Services\DataDictionary\ManagingEngineerEligibility;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('keeps all authorized choices without geometry or full record payloads', function (): void {
    $f = $this->fixture('Engineer');
    $records = [];
    for ($i = 0; $i < 110; $i++) {
        $road = $i === 0 ? $f['road'] : $this->road($f['engineer']);
        $project = $i === 0 ? $f['project'] : (int) DB::table('jairoads_next.maintenance_projects')->insertGetId(['road_coverage_id' => $road, 'project_title' => 'Choice '.$i, 'created_by' => $f['user']->dd_user_account_id]);
        $records[] = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($project, $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
    }
    DB::enableQueryLog();
    DB::flushQueryLog();
    $this->get('/dd-phase3/ui/maintenance-records/create')->assertInertia(fn (Assert $page) => $page
        ->has('projects', 110)->has('records', 110)->missing('projects.0.geojson')->missing('projects.0.description')
        ->missing('records.0.description')->missing('records.0.created_by'));
    expect(count(DB::getQueryLog()))->toBeLessThanOrEqual(12); // 110 LGUs must not cause 110 eligibility queries.
    DB::disableQueryLog();
    $this->get('/dd-phase3/ui/monthly-updates/create')->assertInertia(fn (Assert $page) => $page
        ->has('projects', 110)->has('records', 110)->missing('projects.0.geojson')->missing('records.0.created_by'));
    $last = end($records);
    $this->get('/dd-phase3/ui/monthly-updates/create?maintenance_id='.$last)->assertInertia(fn (Assert $page) => $page
        ->has('projects', 1)->has('records', 1)->where('records.0.id', (int) $last)->where('contextRecordId', (int) $last));
});

it('preserves fixed context authorization and only relevant report uniqueness data', function (): void {
    $f = $this->fixture('Engineer');
    $first = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->dd_user_account_id]);
    $second = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q2') + ['created_by' => $f['user']->dd_user_account_id]);
    foreach ([$first, $second] as $record) {
        DB::table('jairoads_next.monthly_updates')->insert(['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 10, 'created_by' => $f['user']->dd_user_account_id]);
    }
    $this->get('/dd-phase3/ui/monthly-updates/create?maintenance_id='.$second)->assertInertia(fn (Assert $page) => $page
        ->has('records', 1)->has('existingUpdates', 1)->where('existingUpdates.0.maintenance_id', (int) $second));
    $this->get('/dd-phase3/ui/maintenance-documents/create?maintenance_id='.$first)->assertInertia(fn (Assert $page) => $page->has('records', 1));
    DB::table('jairoads_next.maintenance_records')->where('id', $second)->update(['managing_engineer_id' => $this->engineer()]);
    $this->get('/dd-phase3/ui/monthly-updates/create?maintenance_id='.$second)->assertForbidden();
    $this->get('/dd-phase3/ui/maintenance-documents/create?maintenance_id='.$second)->assertForbidden();
});

it('batches manager choices with exactly the same eligibility as individual LGU lookups', function (string $role): void {
    $f = $this->fixture($role, $role === 'Admin');
    $otherRoad = $this->road($f['engineer']);
    $lgus = DB::table('jairoads_next.road_coverages')->whereIn('id', [$f['road'], $otherRoad])->pluck('lgu_id')->map(fn ($id): int => (int) $id)->all();
    $actor = app(DataDictionaryIdentityResolver::class)->resolve($f['user']);
    $service = app(ManagingEngineerEligibility::class);
    $batch = $service->choicesForLgus($actor, $lgus)->get()->groupBy('lgu_id');
    foreach ($lgus as $lgu) {
        expect($batch->get($lgu, collect())->pluck('id')->all())->toBe($service->choices($actor, $lgu)->get()->pluck('id')->all());
    }
})->with(['Engineer', 'Admin', 'SuperAdmin']);

it('retains every project history entry while deferring unrendered details to its detail route', function (): void {
    $f = $this->fixture('Engineer');
    $description = str_repeat('Retained historical description. ', 80);
    $last = null;
    for ($i = 0; $i < 300; $i++) {
        $data = $this->recordData($f['project'], $f['engineer'], 'Q'.($i % 4 + 1), 2000 + intdiv($i, 4));
        $data['description'] = $description;
        $last = DB::table('jairoads_next.maintenance_records')->insertGetId($data + ['created_by' => $f['user']->dd_user_account_id]);
    }
    $this->get('/dd-phase3/ui/maintenance-projects/'.$f['project'])->assertInertia(fn (Assert $page) => $page
        ->has('records', 300)->missing('records.0.description')->has('records.0.details_url')->has('records.0.managing_engineer')
        ->has('project.geojson'));
    $this->get('/dd-phase3/ui/maintenance-projects/'.$f['project'].'/records/'.$last)->assertInertia(fn (Assert $page) => $page
        ->where('record.description', $description));
    expect(DB::table('jairoads_next.maintenance_records')->count())->toBe(300);
});

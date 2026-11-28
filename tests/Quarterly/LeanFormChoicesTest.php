<?php

declare(strict_types=1);

use App\Services\AccountIdentityResolver;
use App\Services\ManagingEngineerEligibility;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('keeps all authorized choices without geometry or full record payloads', function (): void {
    $f = $this->fixture('Engineer');
    $records = [];
    for ($i = 0; $i < 110; $i++) {
        $road = $i === 0 ? $f['road'] : $this->road($f['engineer']);
        $project = $i === 0 ? $f['project'] : (int) DB::table('jairoads_next.maintenance_projects')->insertGetId(['road_coverage_id' => $road, 'project_title' => 'Choice '.$i, 'created_by' => $f['user']->canonical_user_account_id]);
        $records[] = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($project, $f['engineer']) + ['created_by' => $f['user']->canonical_user_account_id]);
    }
    DB::enableQueryLog();
    DB::flushQueryLog();
    $this->get('/workspace/ui/maintenance-records/create')->assertInertia(fn (Assert $page) => $page
        ->has('projects', 0)->has('records', 0)->has('engineers')->missing('managerChoicesByProject')
        ->where('projectChoiceUrl', '/workspace/ui/project-filter-choices')->where('periodChoiceUrl', '/workspace/ui/record-period-choices'));
    expect(count(DB::getQueryLog()))->toBeLessThanOrEqual(12); // 110 LGUs must not cause 110 eligibility queries.
    DB::disableQueryLog();
    $this->getJson('/workspace/ui/record-period-choices?project='.$f['project'].'&year=2026')->assertOk()
        ->assertJsonCount(1, 'data')->assertJsonMissingPath('data.0.description')->assertHeader('Cache-Control', 'no-store, private');
    $this->getJson('/workspace/ui/record-period-choices?project='.$f['project'].'&year=1999')->assertUnprocessable();
    $this->getJson('/workspace/ui/record-period-choices?project='.$f['project'].'&year=2027')->assertOk()->assertJsonCount(0, 'data');
    foreach (['monthly-updates', 'maintenance-documents'] as $directory) {
        $this->get('/workspace/ui/'.$directory)->assertInertia(fn (Assert $page) => $page
            ->has('projects', 0)->where('projectFilterUrl', '/workspace/ui/project-filter-choices'));
        $this->get('/workspace/ui/'.$directory.'?project='.$f['project'])->assertInertia(fn (Assert $page) => $page
            ->has('projects', 1)->where('projects.0.id', $f['project']));
    }
    $this->get('/workspace/ui/maintenance-records')->assertInertia(fn (Assert $page) => $page
        ->has('projects', 0)->where('totalProjects', 110));
    $this->getJson('/workspace/ui/project-filter-choices')->assertOk()->assertJsonCount(30, 'data')
        ->assertJsonPath('last_page', 4)->assertHeader('Cache-Control', 'no-store, private');
    $this->getJson('/workspace/ui/project-filter-choices?page=4')->assertOk()->assertJsonCount(20, 'data');
    $this->getJson('/workspace/ui/project-filter-choices?search=Choice%20109')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.project_title', 'Choice 109')->assertJsonMissingPath('data.0.geojson');
    $this->getJson('/workspace/ui/project-filter-choices?search=%25')->assertOk()->assertJsonCount(0, 'data');
    $this->get('/workspace/ui/monthly-updates/create')->assertInertia(fn (Assert $page) => $page
        ->has('projects', 0)->has('records', 0)->has('existingUpdates', 0));
    $this->get('/workspace/ui/maintenance-documents/create')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('projects', 0)->has('records', 0)->where('formChoicesUrl', '/workspace/ui/monthly-updates/form-choices'));
    $choices = '/workspace/ui/monthly-updates/form-choices';
    $seen = [];
    for ($page = 1; $page <= 6; $page++) {
        $rows = $this->getJson($choices.'?page='.$page)->assertOk()->assertJsonPath('last_page', 6)
            ->assertJsonMissingPath('data.0.geojson')->json('data');
        array_push($seen, ...array_column($rows, 'id'));
    }
    $this->assertCount(110, array_unique($seen));
    $lastProject = $this->getJson($choices.'?search=Choice%20109')->assertOk()->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.project_title', 'Choice 109')->json('data.0.id');
    $last = end($records);
    $this->getJson($choices.'?project='.$lastProject)->assertOk()->assertJsonCount(1, 'records')
        ->assertJsonPath('records.0.id', (int) $last)->assertJsonMissingPath('records.0.created_by');
    $this->get('/workspace/ui/monthly-updates/create?maintenance_id='.$last)->assertInertia(fn (Assert $page) => $page
        ->has('projects', 1)->has('records', 1)->where('records.0.id', (int) $last)->where('contextRecordId', (int) $last));
    $this->get('/workspace/ui/maintenance-documents/create?maintenance_id='.$last)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->has('projects', 1)->has('records', 1)->where('records.0.id', (int) $last)->where('contextRecordId', (int) $last));
});

it('preserves fixed context authorization and only relevant report uniqueness data', function (): void {
    $f = $this->fixture('Engineer');
    $first = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer']) + ['created_by' => $f['user']->canonical_user_account_id]);
    $second = DB::table('jairoads_next.maintenance_records')->insertGetId($this->recordData($f['project'], $f['engineer'], 'Q2') + ['created_by' => $f['user']->canonical_user_account_id]);
    foreach ([$first, $second] as $record) {
        DB::table('jairoads_next.monthly_updates')->insert(['maintenance_id' => $record, 'update_month' => '2026-01', 'progress_percentage' => 10, 'created_by' => $f['user']->canonical_user_account_id]);
    }
    $this->get('/workspace/ui/monthly-updates/create?maintenance_id='.$second)->assertInertia(fn (Assert $page) => $page
        ->has('records', 1)->has('existingUpdates', 0)
        ->where('occupiedMonths.recordId', (int) $second)->where('occupiedMonths.years.2026', 1));
    $this->get('/workspace/ui/maintenance-documents/create?maintenance_id='.$first)->assertInertia(fn (Assert $page) => $page->has('records', 1));
    DB::table('jairoads_next.maintenance_records')->where('id', $second)->update(['managing_engineer_id' => $this->engineer()]);
    $this->get('/workspace/ui/monthly-updates/create?maintenance_id='.$second)->assertForbidden();
    $this->get('/workspace/ui/maintenance-documents/create?maintenance_id='.$second)->assertForbidden();
    $choices = '/workspace/ui/monthly-updates/form-choices?project='.$f['project'];
    $this->getJson($choices)->assertOk()
        ->assertJsonCount(1, 'records')->assertJsonPath('records.0.id', (int) $first)
        ->assertJsonCount(0, 'existingUpdates');
    $this->getJson($choices.'&record='.$second)->assertNotFound();
    $this->getJson($choices.'&record='.$first)->assertOk()
        ->assertJsonCount(1, 'records')->assertJsonCount(0, 'existingUpdates')
        ->assertJsonPath('selectedRecordId', (int) $first)
        ->assertJsonPath('occupiedMonths.recordId', (int) $first)
        ->assertJsonPath('occupiedMonths.years.2026', 1)
        ->assertJsonCount(2, 'occupiedMonths')->assertJsonCount(1, 'occupiedMonths.years');
});

it('batches manager choices with exactly the same eligibility as individual LGU lookups', function (string $role): void {
    $f = $this->fixture($role, $role === 'Admin');
    $otherRoad = $this->road($f['engineer']);
    $lgus = DB::table('jairoads_next.road_coverages')->whereIn('id', [$f['road'], $otherRoad])->pluck('lgu_id')->map(fn ($id): int => (int) $id)->all();
    $actor = app(AccountIdentityResolver::class)->resolve($f['user']);
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
        $last = DB::table('jairoads_next.maintenance_records')->insertGetId($data + ['created_by' => $f['user']->canonical_user_account_id]);
    }
    $url = '/workspace/ui/maintenance-projects/'.$f['project'];
    $expected = DB::table('jairoads_next.maintenance_records')->where('project_id', $f['project'])
        ->orderByDesc('maintenance_year')->orderByDesc('quarter')->orderByDesc('id')->pluck('id')->map(fn ($id): int => (int) $id)->all();
    for ($number = 1; $number <= 15; $number++) {
        $ids = array_slice($expected, ($number - 1) * 20, 20);
        $this->get($url.'?history_page='.$number)->assertOk()->assertInertia(function (Assert $page) use ($number, $ids): void {
            $page->where('historyPagination.page', $number)->where('historyPagination.pages', 15)
                ->where('historyPagination.totalYears', 75)->has('records', 20)
                ->missing('records.0.description')->has('records.0.details_url')->has('records.0.managing_engineer')
                ->has('project.geojson');
            foreach ($ids as $index => $id) {
                $page->where('records.'.$index.'.id', $id);
            }
        });
    }
    $this->get('/workspace/ui/maintenance-projects/'.$f['project'].'/records/'.$last)->assertInertia(fn (Assert $page) => $page
        ->where('record.description', $description));
    expect(DB::table('jairoads_next.maintenance_records')->count())->toBe(300);
});

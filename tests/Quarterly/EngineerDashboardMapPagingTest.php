<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('pages dashboard maps without dropping older assigned roads', function (): void {
    $f = $this->fixture('Engineer');
    $original = DB::table('jairoads_next.road_coverages')->where('id', $f['road'])->first();
    DB::table('jairoads_next.maintenance_records')->insert(
        $this->recordData($f['project'], $f['engineer'], 'Q1')
        + ['created_by' => $f['user']->canonical_user_account_id],
    );
    $batch = [];
    for ($i = 0; $i < 104; $i++) {
        $batch[] = [
            'road_name' => 'Dashboard paged road '.$i,
            'lgu_id' => $original->lgu_id,
            'kilometers' => 1,
            'pavement_type' => 'Concrete',
            'state_category' => 'Good',
            'created_by' => $f['engineer'],
            'geojson' => $original->geojson,
        ];
    }
    DB::table('jairoads_next.road_coverages')->insert($batch);
    $this->get('/workspace/dashboard')->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->missing('mapCoverages')->missing('mapNextCursor'));

    $response = $this->getJson('/workspace/dashboard/map-roads')
        ->assertOk()->assertJsonCount(100, 'data');
    $response->assertJsonPath('data.0.state_category', 'Good');
    $cursor = $response->json('next_cursor');
    expect($cursor)->toBeInt()->toBeGreaterThan(0);
    $result = $this->getJson('/workspace/dashboard/map-roads?before='.$cursor)
        ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonCount(5, 'data')->assertJsonPath('next_cursor', null);
    $older = collect($result->json('data'))->firstWhere('id', $f['road']);
    expect($older)->not->toBeNull();
    expect($older['my_project'])->toBeTrue();
    $this->getJson('/workspace/dashboard/map-roads?before=not-a-number')
        ->assertUnprocessable();
});

it('rejects non-engineers from the dashboard road map endpoint', function (): void {
    $this->fixture('Viewer');
    $this->getJson('/workspace/dashboard/map-roads?before=1')->assertForbidden();
});

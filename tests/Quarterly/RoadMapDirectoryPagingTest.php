<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

it('bounds the initial road directory map and pages older road geometry for Viewers', function (): void {
    $fixture = $this->fixture('Admin');
    $road = DB::table('jairoads_next.road_coverages')->where('id', $fixture['road'])->first();
    $batch = [];
    for ($i = 0; $i < 104; $i++) {
        $batch[] = [
            'road_name' => sprintf('Paged road %03d', $i),
            'lgu_id' => $road->lgu_id,
            'kilometers' => 1,
            'pavement_type' => 'Concrete',
            'state_category' => 'Good',
            'created_by' => $fixture['engineer'],
            'geojson' => $road->geojson,
        ];
    }
    DB::table('jairoads_next.road_coverages')->insert($batch);

    $this->actingAs($this->account('Viewer'));
    $this->get('/workspace/ui/road-coverages')->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('mapDeferred', true)->missing('mapCoverages')->missing('mapNextCursor'));
    $index = $this->getJson('/workspace/ui/map/road-index')->assertOk()
        ->assertHeader('Cache-Control', 'no-store, private')->assertJsonCount(100, 'data');
    $cursor = $index->json('next_cursor');
    $this->assertIsInt($cursor);

    $response = $this->getJson('/workspace/ui/map/road-index?before='.$cursor)
        ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonCount(5, 'data')->assertJsonPath('next_cursor', null);
    $this->assertContains($fixture['road'], array_column($response->json('data'), 'id'));
    $this->getJson('/workspace/ui/map/road-index?condition=Bad')
        ->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('next_cursor', null);
    $this->getJson('/workspace/ui/map/road-index?search=Paged&condition=Good&before='.$cursor)
        ->assertOk()->assertJsonCount(4, 'data')->assertJsonPath('next_cursor', null);
    $this->getJson('/workspace/ui/map/road-index?before=invalid')->assertUnprocessable();
    auth()->logout();
    $this->getJson('/workspace/ui/map/road-index?before='.$cursor)->assertUnauthorized();
});

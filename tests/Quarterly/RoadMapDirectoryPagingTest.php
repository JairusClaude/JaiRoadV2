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
    $this->get('/dd-phase3/ui/road-coverages')->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('mapCoverages', 100)->where('mapNextCursor', fn ($cursor) => is_int($cursor) && $cursor > 0));
    $index = $this->get('/dd-phase3/ui/road-coverages');
    $page = $index->viewData('page');
    $cursor = $page['props']['mapNextCursor'] ?? null;
    $this->assertIsInt($cursor);

    $response = $this->getJson('/dd-phase3/ui/map/road-index?before='.$cursor)
        ->assertOk()->assertHeader('Cache-Control', 'private, no-store')
        ->assertJsonCount(5, 'data')->assertJsonPath('next_cursor', null);
    $this->assertContains($fixture['road'], array_column($response->json('data'), 'id'));
    $this->getJson('/dd-phase3/ui/map/road-index?before=invalid')->assertUnprocessable();
    auth()->logout();
    $this->getJson('/dd-phase3/ui/map/road-index?before='.$cursor)->assertUnauthorized();
});

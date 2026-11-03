<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

beforeEach(function (): void {
    $this->f = $this->fixture('Engineer');
    $this->lgu = (int) DB::table('jairoads_next.road_coverages')->where('id', $this->f['road'])->value('lgu_id');
    $this->bounds = ['west' => 125.9, 'east' => 126.0, 'south' => 7.5, 'north' => 7.7];
    $this->referenceUrl = fn (array $params = []): string => '/dd-phase3/ui/map/roads?'.http_build_query($params + $this->bounds);
});

it('does not embed the reference network in the road form', function (): void {
    $this->get('/dd-phase3/ui/road-coverages/create')->assertInertia(fn (Assert $page) => $page
        ->where('referenceCoverages', [])->where('referenceUrl', '/dd-phase3/ui/map/roads'));
});

it('filters all accepted saved line wrappers by bounds without rewriting their coordinates', function (string $type): void {
    $line = ['type' => 'LineString', 'coordinates' => [[125.8, 7.6, 12], [126.1, 7.6, 13]]]; // Both endpoints outside; crosses viewport.
    $geometry = match ($type) {
        'LineString' => $line,
        'Feature' => ['type' => 'Feature', 'properties' => ['historic' => true], 'geometry' => $line],
        'MultiLineString' => ['type' => 'MultiLineString', 'coordinates' => [$line['coordinates'], [[128, 8], [129, 9]]]],
        'GeometryCollection' => ['type' => 'GeometryCollection', 'geometries' => [$line]],
        default => ['type' => 'FeatureCollection', 'features' => [['type' => 'Feature', 'properties' => [], 'geometry' => $line]]],
    };
    DB::table('jairoads_next.road_coverages')->where('id', $this->f['road'])->update(['geojson' => json_encode($geometry)]);
    $stored = DB::table('jairoads_next.road_coverages')->where('id', $this->f['road'])->value('geojson');
    $response = $this->getJson(($this->referenceUrl)())->assertOk()->assertHeader('Cache-Control', 'no-store, private')
        ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $this->f['road']);
    expect($response->json('data.0.geojson'))->toEqual(json_decode($stored, true));
    expect(array_keys($response->json('data.0')))->toBe(['id', 'road_name', 'lgus_id', 'kilometers', 'pavement_type', 'state_category', 'geojson']);
    expect(DB::table('jairoads_next.road_coverages')->where('id', $this->f['road'])->value('geojson'))->toBe($stored);
})->with(['LineString', 'Feature', 'MultiLineString', 'GeometryCollection', 'FeatureCollection']);

it('keeps every authorized match reachable by cursor and preserves search municipality and bounds', function (): void {
    $geometry = '{"type":"LineString","coordinates":[[125.95,7.59],[125.96,7.60]]}';
    for ($i = 0; $i < 105; $i++) {
        DB::table('jairoads_next.road_coverages')->insert(['road_name' => sprintf('Find %03d', $i), 'lgu_id' => $this->lgu,
            'kilometers' => 1, 'pavement_type' => 'Concrete', 'state_category' => 'Good', 'created_by' => $this->f['engineer'], 'geojson' => $geometry]);
    }
    $other = $this->road();
    DB::table('jairoads_next.road_coverages')->where('id', $other)->update(['road_name' => 'Find hidden', 'geojson' => $geometry]);
    $cursor = null;
    $ids = [];
    $pages = 0;
    do {
        $response = $this->getJson(($this->referenceUrl)(['q' => 'Find', 'lgu_id' => $this->lgu, 'after' => $cursor]))->assertOk();
        $ids = array_merge($ids, array_column($response->json('data'), 'id'));
        $cursor = $response->json('next_cursor');
        $pages++;
    } while ($cursor !== null);
    expect(count($ids))->toBe(105)->and(count(array_unique($ids)))->toBe(105)->and($pages)->toBe(2)->and(in_array($other, $ids, true))->toBeFalse();
    $this->getJson(($this->referenceUrl)(['q' => 'Find hidden']))->assertOk()->assertJsonCount(0, 'data');
    $this->getJson(($this->referenceUrl)(['q' => 'Find 104']))->assertOk()->assertJsonCount(1, 'data');
    $this->getJson(($this->referenceUrl)(['q' => 'Find', 'west' => 130, 'east' => 131]))->assertOk()->assertJsonCount(0, 'data');
});

it('rejects guests Viewers and invalid viewport parameters', function (): void {
    $this->getJson(($this->referenceUrl)(['west' => 999]))->assertUnprocessable()->assertJsonValidationErrors('west');
    $this->getJson(($this->referenceUrl)(['west' => 127]))->assertUnprocessable()->assertJsonValidationErrors('east');
    $this->withSession(['password_hash_web' => null])->actingAs($this->account('Viewer'))->getJson(($this->referenceUrl)())->assertForbidden();
    auth()->logout();
    $this->getJson(($this->referenceUrl)())->assertUnauthorized();
});

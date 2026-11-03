<?php

declare(strict_types=1);

use App\Services\DataDictionary\RoadCoverageGeometry;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Quarterly\PostgresTestCase;

uses(PostgresTestCase::class);

dataset('saved road formats', [
    'legacy line' => ['{"type":"LineString","coordinates":[[125,7],[125.1,7.1],[125.2,7.2]]}'],
    'feature line' => ['{"type":"Feature","properties":{"historical":"retained"},"geometry":{"type":"LineString","coordinates":[[125,7],[125.1,7.1]]}}'],
    'multi line' => ['{"type":"MultiLineString","coordinates":[[[125,7],[125.1,7.1]],[[126,8],[126.1,8.1]]]}'],
    'geometry collection' => ['{"type":"GeometryCollection","geometries":[{"type":"LineString","coordinates":[[125,7],[125.1,7.1]]},{"type":"MultiLineString","coordinates":[[[126,8],[126.1,8.1]]]}]}'],
    'feature collection' => ['{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"LineString","coordinates":[[125,7],[125.1,7.1]]}}]}'],
    'higher dimensions' => ['{"type":"LineString","coordinates":[[125,7,12,99],[125.1,7.1,13,98]]}'],
    'outside editor latitude' => ['{"type":"LineString","coordinates":[[125,86],[125.1,87]]}'],
]);

beforeEach(function (): void {
    $this->f = $this->fixture('Engineer');
    $this->roadQuery = fn () => DB::table('jairoads_next.road_coverages')->where('id', $this->f['road']);
    $this->roadUrl = '/dd-phase3/ui/road-coverages/'.$this->f['road'];
    $this->metadata = function (): array {
        $road = ($this->roadQuery)()->first();

        return ['road_name' => $road->road_name, 'lgus_id' => $road->lgu_id, 'kilometers' => $road->kilometers,
            'pavement_type' => $road->pavement_type, 'state_category' => 'Fair'];
    };
});

it('creates and reloads valid two-point and three-point manual roads', function (int $count): void {
    $points = array_slice([[125.95, 7.59], [125.96, 7.60], [125.97, 7.61]], 0, $count);
    $geometry = ['type' => 'Feature', 'properties' => ['jairoads_mapping' => [
        'version' => 1, 'method' => 'manual', 'control_points' => $points, 'control_point_indices' => range(0, $count - 1),
    ]], 'geometry' => ['type' => 'LineString', 'coordinates' => $points]];
    $this->post('/dd-phase3/ui/road-coverages', array_replace(($this->metadata)(), ['road_name' => 'New manual road', 'geojson' => $geometry]))
        ->assertSessionHasNoErrors()->assertRedirect();
    $created = DB::table('jairoads_next.road_coverages')->where('road_name', 'New manual road')->first();
    expect(json_decode($created->geojson, true))->toEqual($geometry);
    $this->get('/dd-phase3/ui/road-coverages/'.$created->id.'/edit')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('coverage.geojson', json_decode($created->geojson, true)));
    expect(DB::table('jairoads_next.maintenance_projects')->count())->toBe(1)
        ->and(DB::table('jairoads_next.maintenance_records')->count())->toBe(0);
})->with([2, 3]);

it('preserves every stored ordinate and wrapper for metadata-only edits and unchanged resubmissions', function (string $json): void {
    expect(RoadCoverageGeometry::valid(json_decode($json, true)))->toBeTrue();
    ($this->roadQuery)()->update(['geojson' => $json]);
    $before = ($this->roadQuery)()->value('geojson');
    $this->get($this->roadUrl.'/edit')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('coverage.geojson', json_decode($before, true)));
    // No geometry field, and even a lying request-only flag, cannot erase data.
    $this->put($this->roadUrl, ($this->metadata)() + ['geometry_changed' => true])->assertSessionHasNoErrors()->assertRedirect();
    expect(($this->roadQuery)()->value('geojson'))->toBe($before);
    $this->put($this->roadUrl, ($this->metadata)() + ['geojson' => json_decode($before, true)])->assertSessionHasNoErrors()->assertRedirect();
    expect(($this->roadQuery)()->value('geojson'))->toBe($before);
    expect(DB::table('jairoads_next.road_coverages')->count())->toBe(1)
        ->and(DB::table('jairoads_next.maintenance_projects')->count())->toBe(1)
        ->and(DB::table('jairoads_next.maintenance_records')->count())->toBe(0);
})->with('saved road formats');

it('rejects invalid direct HTTP geometry even when a client claims it is unchanged', function (mixed $geometry): void {
    $before = ($this->roadQuery)()->first();
    $this->putJson($this->roadUrl, ($this->metadata)() + ['geojson' => $geometry, 'geometry_changed' => false])
        ->assertUnprocessable()->assertJsonValidationErrors('geojson');
    expect(($this->roadQuery)()->first())->toEqual($before);
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
})->with([
    'empty' => [null],
    'point' => [['type' => 'Point', 'coordinates' => [125, 7]]],
    'bad latitude' => [['type' => 'LineString', 'coordinates' => [[125, 91], [125, 7]]]],
    'invalid dimension' => [['type' => 'LineString', 'coordinates' => [[125, 7, 'secret'], [125, 7, 4]]]],
    'empty collection' => [['type' => 'GeometryCollection', 'geometries' => []]],
    'bad feature collection child' => [['type' => 'FeatureCollection', 'features' => [['type' => 'LineString', 'coordinates' => [[125, 7], [125.1, 7.1]]]]]],
]);

it('rejects unauthorized geometry writes without changing data or audit history', function (string $role): void {
    $before = ($this->roadQuery)()->first();
    $user = $this->account($role, $role === 'Engineer' ? $this->engineer() : null);
    $this->withSession(['password_hash_web' => null])->actingAs($user);
    $this->putJson($this->roadUrl, ($this->metadata)() + ['geojson' => ['type' => 'LineString', 'coordinates' => [[126, 8], [126.1, 8.1]]]])->assertForbidden();
    expect(($this->roadQuery)()->first())->toEqual($before);
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(0);
})->with(['Viewer', 'Engineer']);

it('keeps complex geometry and historical audit entries through cancelled and confirmed municipality review', function (string $json): void {
    ($this->roadQuery)()->update(['geojson' => $json]);
    $destination = DB::table('jairoads_next.lgus')->insertGetId(['municipality_name' => 'Destination', 'province' => 'Test', 'region' => 'Test', 'mayor_first_name' => 'Test', 'mayor_last_name' => 'Mayor']);
    DB::table('jairoads_next.engineer_lgus')->insert(['engineer_id' => $this->f['engineer'], 'lgu_id' => $destination, 'is_active' => true]);
    $historicId = DB::table('jairoads_next.audit_logs')->insertGetId(['user_id' => $this->f['user']->dd_user_account_id, 'actor_identifier' => 'Historic actor', 'action' => 'CREATE', 'entity_type' => 'RoadCoverage', 'entity_id' => $this->f['road'], 'description' => 'Preserved history']);
    $historic = DB::table('jairoads_next.audit_logs')->where('id', $historicId)->first();
    $before = ($this->roadQuery)()->first();
    $base = '/dd-phase3/ops/roads/'.$this->f['road'].'/municipality/';
    $preview = $this->postJson($base.'preview', ['lgu_id' => $destination])->assertOk()->json();
    expect(($this->roadQuery)()->first())->toEqual($before); // Cancel is no confirmation request.
    $this->postJson($base.'confirm', ['confirmation_token' => $preview['confirmation_token']])->assertRedirect();
    expect(($this->roadQuery)()->value('geojson'))->toBe($before->geojson);
    expect(DB::table('jairoads_next.audit_logs')->where('id', $historicId)->first())->toEqual($historic);
    expect(DB::table('jairoads_next.audit_logs')->count())->toBe(2);
    expect(DB::table('jairoads_next.audit_logs')->orderByDesc('id')->value('action'))->toBe('UPDATE');
    expect(DB::table('jairoads_next.road_coverages')->count())->toBe(1)
        ->and(DB::table('jairoads_next.maintenance_projects')->count())->toBe(1);
})->with('saved road formats');

<?php

declare(strict_types=1);

use App\Services\RoadCoverageGeometry;

it('accepts normal mapped line geometries', function (): void {
    expect(RoadCoverageGeometry::valid([
        'type' => 'LineString',
        'coordinates' => [[123, 10], [123.1, 10.1]],
    ]))->toBeTrue();
});

it('rejects excessive GeoJSON positions across nested collections', function (): void {
    $line = ['type' => 'LineString', 'coordinates' => array_fill(0, 25001, [123, 10])];
    $shape = ['type' => 'GeometryCollection', 'geometries' => [$line, $line]];
    expect(RoadCoverageGeometry::valid($shape))->toBeFalse();
    expect(RoadCoverageGeometry::valid([
        'type' => 'LineString',
        'coordinates' => array_fill(0, 50001, [123, 10]),
    ]))->toBeFalse();
});

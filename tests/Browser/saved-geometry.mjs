import assert from 'node:assert/strict';
import {
    geometryEditingMode,
    validRoadGeometry,
    validateCoverage,
} from '../../resources/js/lib/road-coverages/geometry.mjs';
import { savedRoadLines } from '../../resources/js/lib/road-coverages/saved-lines.ts';
const a = [
    [125, 7, 12],
    [125.01, 7.01, 13],
    [125.02, 7.02, 14],
];
const b = [
    [126, 8],
    [126.1, 8.1],
];
const line = { type: 'LineString', coordinates: a };
const multi = { type: 'MultiLineString', coordinates: [a, b] };
const feature = {
    type: 'Feature',
    properties: { historical: true },
    geometry: multi,
};
const collection = {
    type: 'FeatureCollection',
    features: [feature, { type: 'Feature', properties: {}, geometry: line }],
};
const nested = { type: 'GeometryCollection', geometries: [collection, line] };
const snapshot = JSON.stringify(nested);
const projected = a.map((p) => p.slice(0, 2));
assert.deepEqual(savedRoadLines(line), [projected]);
assert.deepEqual(savedRoadLines(multi), [projected, b]);
assert.deepEqual(savedRoadLines(feature), [projected, b]);
assert.deepEqual(savedRoadLines(collection), [projected, b, projected]);
assert.deepEqual(savedRoadLines(nested), [projected, b, projected, projected]);
assert.equal(JSON.stringify(nested), snapshot);
assert.deepEqual(savedRoadLines({ type: 'Point', coordinates: [125, 7] }), []);
assert.deepEqual(
    savedRoadLines({
        type: 'MultiLineString',
        coordinates: [
            a,
            [
                [999, 7],
                [125, 7],
            ],
        ],
    }),
    [],
);
console.log(
    'PASS: eight saved-geometry assertions; all accepted line collections render without connecting separate lines or mutating stored coordinates.',
);

const plain = { type: 'LineString', coordinates: b };

for (const value of [
    plain,
    { type: 'Feature', properties: {}, geometry: plain },
]) {
    assert.equal(geometryEditingMode(value), 'editable');
}

for (const value of [
    line,
    multi,
    feature,
    collection,
    nested,
    {
        type: 'LineString',
        coordinates: [
            [125, 86],
            [125, 87],
        ],
    },
]) {
    assert.equal(geometryEditingMode(value), 'readonly');
    const snapshot = JSON.stringify(value);
    assert.equal(
        validateCoverage(
            {
                road_name: 'Saved road',
                lgus_id: 1,
                pavement_type: 'Concrete',
                state_category: 'Fair',
                kilometers: '2.50',
                geojson: value,
            },
            [{ id: 1 }],
            { geojson: value },
        ).geojson,
        undefined,
    );
    assert.equal(JSON.stringify(value), snapshot);
}

for (const value of [
    null,
    {},
    { type: 'Point', coordinates: [125, 7] },
    {
        type: 'LineString',
        coordinates: [
            [125, 7, 'bad'],
            [125, 7, 2],
        ],
    },
    { type: 'FeatureCollection', features: [plain] },
    { type: 'MultiLineString', coordinates: [] },
    { type: 'GeometryCollection', geometries: [plain, null] },
]) {
    assert.equal(validRoadGeometry(value), false);
    assert.equal(geometryEditingMode(value), 'invalid');
}

console.log(
    'PASS: saved geometry capability classification and metadata preservation match the canonical road-line contract.',
);

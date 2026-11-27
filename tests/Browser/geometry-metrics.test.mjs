import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validRoadPage } from '../../resources/js/lib/road-coverages/road-page.ts';
import { savedLineMetrics, savedRoadLines } from '../../resources/js/lib/road-coverages/saved-lines.ts';

test('geometry measurements preserve gaps and every saved vertex', () => {
    const geometry = { type: 'MultiLineString', coordinates: [[[0, 0], [1, 0]], [[10, 0], [11, 0]]] };
    const lines = savedRoadLines(geometry);
    const metrics = savedLineMetrics(lines);

    assert.equal(metrics.segments, 2);
    assert.equal(metrics.vertices, 4);
    assert.ok(Math.abs(metrics.kilometers - 222.39016) < 0.001);
    assert.deepEqual(lines, geometry.coordinates);
    assert.deepEqual(savedLineMetrics([]), { kilometers: 0, vertices: 0, segments: 0 });
});

test('malformed saved geometry cannot invent connections across missing vertices', () => {
    assert.deepEqual(savedRoadLines({ type: 'LineString', coordinates: [[0, 0], [999, 0], [1, 0]] }), []);
    assert.deepEqual(savedRoadLines({ type: 'MultiLineString', coordinates: [[[0, 0], [1, 0]], [[2, 0], [2, 99]]] }), []);
    const geometry = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 0]] } }, { type: 'Feature', geometry: { type: 'LineString', coordinates: [[10, 0], [11, 0]] } }] };
    assert.equal(savedLineMetrics(savedRoadLines(geometry)).segments, 2);
});

test('road pages must have unique IDs and advancing matching cursors', () => {
    const road = id => ({ id, road_name: 'Road ' + id });

    assert.equal(validRoadPage({ data: [road(2)], next_cursor: 2 }, 1, 'ascending'), true);
    assert.equal(validRoadPage({ data: [road(1)], next_cursor: 1 }, 2, 'descending'), true);
    assert.equal(validRoadPage({ data: [road(2)], next_cursor: 2 }, 2, 'ascending'), false);
    assert.equal(validRoadPage({ data: [road(2)], next_cursor: 2 }, 1, 'descending'), false);
    assert.equal(validRoadPage({ data: [], next_cursor: 2 }, null, 'ascending'), false);
    assert.equal(validRoadPage({ data: Array(101).fill(road(1)), next_cursor: null }, null, 'ascending'), false);
    assert.equal(validRoadPage({ data: [], next_cursor: null }, null, 'ascending'), true);
    assert.equal(validRoadPage({ data: [road(1), road(1)], next_cursor: null }, null, 'ascending'), false);
    assert.equal(validRoadPage({ data: [road(3), road(2)], next_cursor: 2 }, null, 'ascending'), false);
    assert.equal(validRoadPage({ data: [road(2), road(1)], next_cursor: 3 }, null, 'descending'), false);
    assert.equal(validRoadPage({ data: [road(3)], next_cursor: null }, 2, 'descending'), false);
    assert.equal(validRoadPage({ data: [null], next_cursor: null }, null, 'ascending'), false);
    assert.equal(validRoadPage({ data: [road(-1)], next_cursor: null }, null, 'ascending'), false);
    assert.equal(validRoadPage({ data: [{ id: 1 }], next_cursor: null }, null, 'ascending'), false);
    // Isolated, unpaginated preview results may use their own display order.
    assert.equal(validRoadPage({ data: [road(3), road(1)], next_cursor: null }, null, 'ascending'), true);
});

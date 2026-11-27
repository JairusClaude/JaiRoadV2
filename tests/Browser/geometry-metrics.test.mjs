import assert from 'node:assert/strict';
import { test } from 'node:test';
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

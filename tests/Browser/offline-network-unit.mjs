import assert from 'node:assert/strict';
import {
    buildNetwork,
    alignment,
    findPlaces,
} from '../../resources/js/lib/road-coverages/offline-network.mjs';
const p = [
    [125.9, 7.6],
    [125.901, 7.6],
    [125.902, 7.6],
    [125.901, 7.601],
    [125.904, 7.6],
];
const graph = buildNetwork({
    points: p,
    edges: [
        [0, 1],
        [1, 2],
        [1, 3],
    ],
    places: [
        { name: 'Test Road', point: p[1] },
        { name: 'Test Village', point: p[2] },
    ],
});
assert.deepEqual(await alignment(graph, p[0], p[2]), p.slice(0, 3));
assert.equal(await alignment(graph, p[0], p[4]), null);
assert.equal(await alignment(graph, [126, 7.8], p[2]), null);
assert.equal(findPlaces(graph, 'test').length, 2);
assert.equal(findPlaces(graph, 'village')[0].name, 'Test Village');
assert.throws(() => buildNetwork({ points: p, edges: [[0, 999]], places: [] }));
const c = new AbortController();
c.abort();
await assert.rejects(alignment(graph, p[0], p[2], c.signal));
console.log('Offline road alignment and place lookup tests passed');

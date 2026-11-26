import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../../public/build/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const initial = new Set();
function walk(key) {
    if (initial.has(key)) {
        return;
    }

    assert.ok(manifest[key], `Missing manifest entry: ${key}`);
    initial.add(key);

    for (const child of manifest[key].imports || []) {
        walk(child);
    }
}
walk('resources/js/app.tsx');
walk('resources/js/pages/auth/login.tsx');

for (const key of initial) {
    assert.doesNotMatch(key, /(?:maplibre|leaflet|davao-de-oro-boundary|road-coverage-map|road-trace-map)/i);
}

for (const layout of [
    'maintenance-project-layout',
    'role-aware-workspace-layout',
    'role-workspace-layout',
]) {
    const key = `resources/js/layouts/${layout}.tsx`;
    assert.ok(manifest[key]?.isDynamicEntry, `Workspace layout must be deferred: ${layout}`);
    assert.ok(!initial.has(key), `Login must not import ${layout} eagerly`);
}

const files = [...new Set([...initial].map((key) => manifest[key].file).filter((file) => file.endsWith('.js')))];
let bytes = 0;

for (const file of files) {
    bytes += (await stat(new URL(file, root))).size;
}

console.log(`Login initial static JavaScript: ${bytes} bytes across ${files.length} files (uncompressed).`);
assert.ok(bytes <= 750 * 1024, 'Initial login JavaScript exceeded the 750 KiB regression budget');
console.log('PASS: login static dependency graph excludes deferred workspace layouts and map engines.');

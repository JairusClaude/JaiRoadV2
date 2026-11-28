import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('mobile/android-pilot/build/web');
const source = resolve('public/build');
const manifest = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));
const app = manifest['resources/js/app.tsx'];
const css = manifest['resources/css/app.css'];
if (!app?.file || !css?.file || !app.isEntry) throw new Error('Canonical workspace build missing.');
const valid = (file) => /^assets\/[a-zA-Z0-9_./-]+$/.test(file) && !file.includes('..');
const styles = [...new Set([css.file, ...(app.css ?? [])])];
if (![app.file, ...styles].every(valid)) throw new Error('Unexpected workspace manifest path.');
await mkdir(out, { recursive: true });
await cp(source, resolve(out, 'site-build'), { recursive: true });
await cp(resolve('public/images'), resolve(out, 'site-images'), { recursive: true });
await writeFile(resolve(out, 'workspace.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="same-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self' https:; media-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' blob:; base-uri 'none'; object-src 'none'; form-action 'self'">
<title>JaiROADS</title>${styles.map(file=>`<link rel="stylesheet" href="/build/${file}">`).join('')}
<script type="module" src="/build/${app.file}"></script>
</head><body class="font-sans antialiased"><div id="app"></div><p id="jairoads-startup-message" role="alert"></p></body></html>`);
console.log('Packaged original JaiROADS React/Inertia app and assets.');

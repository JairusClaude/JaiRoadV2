// Run: node tests/Browser/manila-time.mjs (requires the project's TypeScript dev dependency).
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import ts from 'typescript';
const source = await readFile(new URL('../../resources/js/lib/manila-time.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { manilaTimestamp, manilaDate } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
const raw = '2026-11-25 18:01:00';
const expected = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date('2026-11-26T02:01:00+08:00'));

for (const zone of ['UTC', 'Asia/Manila', 'America/Los_Angeles']) {
    process.env.TZ = zone;
    assert.equal(manilaTimestamp(raw), expected);
    assert.equal(manilaTimestamp('2026-11-25T18:01:00Z'), expected);
    assert.equal(manilaTimestamp('2026-11-26T02:01:00+08:00'), expected);
    assert.equal(manilaTimestamp('2026-11-25 18:01:00+00'), expected);
    assert.equal(manilaDate(raw), new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' }).format(new Date('2026-11-25T18:01:00Z')));
    assert.equal(manilaTimestamp(null), 'Unavailable');
    assert.equal(manilaTimestamp('invalid'), 'Unavailable');
}

console.log('Manila timestamp regression passed.');

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { analyticsPdf, analyticsXlsx } from '../../resources/js/lib/analytics-report-formats.ts';
import { hasOccupiedReportingMonth } from '../../resources/js/lib/occupied-reporting-months.ts';

test('PDF summary has escaped strings and valid xref byte offsets', () => {
    const pdf = Buffer.from(analyticsPdf([['Scope', 'System-wide'], ['Metric (test)', 12]]));
    const text = pdf.toString('ascii');

    assert.ok(text.startsWith('%PDF-1.4\n'));
    assert.ok(text.includes(String.raw`Metric \(test\)`));
    const start = Number(text.match(/startxref\n(\d+)/)[1]);

    assert.equal(text.slice(start, start + 4), 'xref');
    const offsets = text.slice(start).split('\n').slice(3, 8);

    for (const [index, entry] of offsets.entries()) {
        const offset = Number(entry.slice(0, 10));

        assert.ok(text.slice(offset).startsWith((index + 1) + ' 0 obj\n'));
    }
});

test('XLSX summary stores values as literal strings and numbers', () => {
    const data = Buffer.from(analyticsXlsx([['=1+1', 12], ['<tag>', 'A & B']]));
    const text = data.toString('utf8');

    assert.equal(data.readUInt32LE(0), 0x04034b50);
    assert.equal(data.readUInt32LE(data.length - 22), 0x06054b50);
    assert.ok(text.includes('t="inlineStr"'));
    assert.ok(text.includes('>=1+1</t>'));
    assert.ok(text.includes('<v>12</v>'));
    assert.ok(text.includes('&lt;tag&gt;'));
    assert.ok(text.includes('A &amp; B'));
    assert.ok(!text.includes('<f>'));
});

test('report occupancy matches each month, year and record exactly', () => {
    const occupied = { recordId: 42, years: { '0001': 1, '2026': 2049, '2027': 4095, '9999': 2048 } };
    assert.equal(hasOccupiedReportingMonth(occupied, 42, '0001-01'), true);
    assert.equal(hasOccupiedReportingMonth(occupied, 42, '2026-01'), true);
    assert.equal(hasOccupiedReportingMonth(occupied, 42, '2026-12'), true);
    assert.equal(hasOccupiedReportingMonth(occupied, 42, '2026-02'), false);
    assert.equal(hasOccupiedReportingMonth(occupied, 99, '2026-01'), false);
    assert.equal(hasOccupiedReportingMonth(occupied, 42, '2025-01'), false);
    assert.equal(hasOccupiedReportingMonth(occupied, 42, '9999-12'), true);
    assert.equal(hasOccupiedReportingMonth(occupied, 42, '0000-01'), false);
    assert.equal(hasOccupiedReportingMonth(occupied, 42, '2027-13'), false);
    for (let month = 1; month <= 12; month++) {
        assert.equal(hasOccupiedReportingMonth(occupied, 42, `2027-${String(month).padStart(2, '0')}`), true);
    }
});

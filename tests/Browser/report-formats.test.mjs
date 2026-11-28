import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { analyticsCsv, analyticsPdf, analyticsXlsx } from '../../resources/js/lib/analytics-report-formats.ts';
import { maintenanceCalendar } from '../../resources/js/lib/maintenance-calendar.ts';
import { hasOccupiedReportingMonth } from '../../resources/js/lib/occupied-reporting-months.ts';
import { validProjectPage, validRecordChoices } from '../../resources/js/lib/project-choice-page.ts';

const report = {
    id: 'JR-test',
    scope: 'System-wide',
    generatedAt: '2026-11-28T04:00:00.000Z',
    reportingMonth: '2026-11',
    reportingCoverage: 62.5,
    cards: [
        { label: 'Metric (test)', value: 12 },
        { label: '=1+1', value: 2 },
        { label: '<tag> A & B Résumé', value: 1 },
    ],
    trend: [{ month: '2026-11', count: 3 }],
};

test('PDF report wraps content into A4 pages with escaped strings and valid xref offsets', () => {
    const cards = [
        ...report.cards,
        ...Array.from({ length: 28 }, (_, index) => ({
            label: 'Long maintenance label '.repeat(3) + index,
            value: index,
        })),
    ];
    const pdf = Buffer.from(analyticsPdf({ ...report, cards }));
    const text = pdf.toString('ascii');

    assert.ok(text.startsWith('%PDF-1.4\n'));
    assert.ok(text.includes(String.raw`Metric \(test\)`));
    assert.ok(text.includes('/MediaBox [0 0 595 842]'));
    assert.ok(text.match(/\/Type \/Page /g).length > 1);
    const start = Number(text.match(/startxref\n(\d+)/)[1]);

    assert.equal(text.slice(start, start + 4), 'xref');
    const [, range, , ...entries] = text.slice(start).split('\n');
    const count = Number(range.split(' ')[1]);

    for (const [index, entry] of entries.slice(0, count - 1).entries()) {
        const offset = Number(entry.slice(0, 10));

        assert.ok(text.slice(offset).startsWith((index + 1) + ' 0 obj\n'));
    }
});

test('XLSX report stores styled sheets, formatted numeric values and literal text', () => {
    const data = Buffer.from(analyticsXlsx(report));
    const text = data.toString('utf8');

    assert.equal(data.readUInt32LE(0), 0x04034b50);
    assert.equal(data.readUInt32LE(data.length - 22), 0x06054b50);
    assert.ok(text.includes('t="inlineStr"'));
    assert.ok(text.includes('>=1+1</t>'));
    assert.ok(text.includes('<v>12</v>'));
    assert.ok(text.includes('<v>0.625</v>'));
    assert.ok(text.includes('&lt;tag&gt; A &amp; B Résumé'));
    assert.ok(text.includes('name="Monthly Trends"'));
    assert.ok(text.includes('state="frozen"'));
    assert.ok(!text.includes('<f>'));
});

test('CSV report preserves the schema, escapes spreadsheet formulas and represents missing coverage', () => {
    const csv = analyticsCsv({ ...report, reportingCoverage: null });

    assert.ok(csv.startsWith('\uFEFF"report_scope","category","metric","period","value","unit"\r\n'));
    assert.ok(csv.includes('"' + "'=1+1" + '","",2,"count"'));
    assert.ok(csv.includes('"Reporting coverage","2026-11","","percent"'));
    assert.ok(csv.endsWith('"Monthly updates","2026-11",3,"count"'));
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

test('calendar export folds UTF-8 lines and escapes text without creating injected events', () => {
    const title = 'Davao, road; ' + '道路🚧'.repeat(30) + '\nBEGIN:VEVENT';
    const calendar = maintenanceCalendar([{ id: 7, projectTitle: title, estimatedFinish: '2026-11-30' }], new Date('2026-11-27T00:00:00Z'));

    for (const line of calendar.split('\r\n')) {
        assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
    }

    const unfolded = calendar.replace(/\r\n /g, '');
    assert.ok(unfolded.includes('DTSTAMP:20261127T000000Z'));
    assert.ok(unfolded.includes('DTSTART;VALUE=DATE:20261130'));
    assert.ok(unfolded.includes('UID:jairoads-estimate-7@jairoads'));
    assert.ok(unfolded.includes('SUMMARY:Estimated finish: Davao\\, road\\; ' + '道路🚧'.repeat(30) + '\\nBEGIN:VEVENT'));
    assert.equal(unfolded.split('\r\n').filter(line => line === 'BEGIN:VEVENT').length, 1);
    assert.ok(unfolded.endsWith('END:VCALENDAR\r\n'));
});

test('project pickers reject malformed or duplicate paginated choices', () => {
    const item = { id: 12, project_title: 'Road project', municipality: null };
    const valid = { data: [item], page: 1, last_page: 2 };

    assert.equal(validProjectPage(valid), true);
    assert.equal(validProjectPage({ data: [], page: 1, last_page: 1 }), true);
    assert.equal(validProjectPage(null), false);
    assert.equal(validProjectPage({ ...valid, page: 0 }), false);
    assert.equal(validProjectPage({ ...valid, page: 3 }), false);
    assert.equal(validProjectPage({ ...valid, last_page: '2' }), false);
    assert.equal(validProjectPage({ ...valid, data: [item, item] }), false);
    assert.equal(validProjectPage({ ...valid, data: [{ ...item, id: -1 }] }), false);
    assert.equal(validProjectPage({ ...valid, data: [{ ...item, project_title: 7 }] }), false);
    assert.equal(validProjectPage({ ...valid, data: [{ ...item, municipality: {} }] }), false);
    assert.equal(validProjectPage({ ...valid, data: Array(31).fill(item) }), false);
});

test('record choices reject unrelated rows and inconsistent reporting occupancy', () => {
    const record = { id: 3, project_id: 12, year: 2026, quarter: 'Q2' };
    const page = {
        project: { id: 12, project_title: 'Road project', municipality: null },
        records: [record], recordPage: 1, recordHasMore: false,
        selectedRecordId: null, existingUpdates: [], occupiedMonths: null,
    };
    const selected = {
        ...page, selectedRecordId: 3, occupiedMonths: { recordId: 3, years: { '2026': 16 } },
    };

    assert.equal(validRecordChoices(page, '12'), true);
    assert.equal(validRecordChoices(selected, '12', '3'), true);
    assert.equal(validRecordChoices(page, '11'), false);
    assert.equal(validRecordChoices({ ...page, records: [record, record] }, '12'), false);
    assert.equal(validRecordChoices({ ...page, records: [{ ...record, project_id: 13 }] }, '12'), false);
    assert.equal(validRecordChoices({ ...page, records: [{ ...record, quarter: 'Q5' }] }, '12'), false);
    assert.equal(validRecordChoices({ ...page, recordPage: 0 }, '12'), false);
    assert.equal(validRecordChoices({ ...page, recordHasMore: 'false' }, '12'), false);
    assert.equal(validRecordChoices(selected, '12'), false);
    assert.equal(validRecordChoices({ ...selected, records: [] }, '12', '3'), false);
    assert.equal(validRecordChoices({ ...selected, occupiedMonths: null }, '12', '3'), false);
    assert.equal(validRecordChoices({ ...selected, occupiedMonths: { recordId: 4, years: {} } }, '12', '3'), false);
    assert.equal(validRecordChoices({ ...selected, occupiedMonths: { recordId: 3, years: { '2026': 4096 } } }, '12', '3'), false);
    assert.equal(validRecordChoices({ ...selected, occupiedMonths: { recordId: 3, years: { '0000': 1 } } }, '12', '3'), false);
    assert.equal(validRecordChoices({ ...selected, occupiedMonths: { recordId: 3, years: [] } }, '12', '3'), false);
});

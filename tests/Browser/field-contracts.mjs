// Isolated process-local preview compatibility; never starts its server or sessions.
import assert from 'node:assert/strict';
import { recordPayload } from '../../resources/js/lib/maintenance-records.ts';
import {
    createMonthlyPreview,
    monthlyDirectoryData,
} from '../../tools/maintenance-project-preview/monthly-updates.mjs';
import {
    createPreviewRecord,
    recordSummaries,
} from '../../tools/maintenance-project-preview/records.mjs';

const values = {
    maintenance_year: '2026',
    quarter: 'Q2',
    engineers_id: '1',
    status: 'Ongoing',
    start_date: '2026-04-01',
    estimated_duration_days: '5',
    complete_date: '',
    description: 'Isolated preview',
};
const canonical = recordPayload(values, 777, 'canonical');
assert.equal(canonical.project_id, 777);
assert.equal(Object.hasOwn(canonical, 'maintenance_projects_id'), false);
assert.equal(canonical.maintenance_year, 2026);
assert.equal(canonical.engineers_id, 1);
assert.equal(Object.hasOwn(canonical, 'created_by'), false);

for (const mode of ['preview', 'legacy']) {
    const payload = recordPayload(values, 777, mode);
    assert.equal(payload.maintenance_projects_id, 777);
    assert.equal(Object.hasOwn(payload, 'project_id'), false);
}

const preview = recordPayload(values, 777, 'preview');
assert.deepEqual(
    recordPayload(values, 777),
    preview,
    'Historical callers keep their existing default',
);
const created = createPreviewRecord(777, preview);
assert.equal(created.errors, undefined);
const record = recordSummaries(777).find(
    (item) => item.id === created.record_id,
);
assert.equal(record.year, 2026);
assert.equal(record.engineers_id, 1);
assert.ok(
    createPreviewRecord(777, preview).errors.quarter,
    'Preview duplicate-period protection remains',
);
const projects = [{ id: 777, project_title: 'Isolated contract preview' }];
const report = await createMonthlyPreview(
    projects,
    {
        project_id: '777',
        maintenance_id: String(record.id),
        update_month: '2027-12',
        progress_percentage: '33.50',
        summary_of_text_reports: 'Preview only',
        removed_media_ids: [],
    },
    [],
    null,
);
assert.equal(report.errors, undefined);
const directory = monthlyDirectoryData(
    projects,
    new URL('http://127.0.0.1/monthly-updates?year=2027&sort=newest'),
);
assert.deepEqual(directory.years, [2027]);
assert.equal(directory.updates.data[0].update_month, '2027-12');
assert.equal(directory.updates.data[0].record.year, 2026);
console.log(
    'PASS: explicit canonical/preview/legacy record payloads; isolated preview create/duplicate checks; reporting-month versus quarterly-year separation.',
);

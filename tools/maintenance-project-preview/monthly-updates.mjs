import { attachMedia, prepareMedia, monthlyMediaPreview, removeMonthlyMedia } from './media.mjs';
import { createPreviewRecord, media, monthlyUpdates, records } from './records.mjs';

// Additional process-local examples for the sidebar directory. No SQL, files,
// authentication or production APIs are involved. Existing records 1/2 stay intact.
export function initializeMonthlyPreview() {
    for (const [projectId, year, start] of [[103, 2025, '2025-11-01'], [104, 2024, '2024-10-01']]) {
        const result = createPreviewRecord(projectId, {
            maintenance_projects_id: projectId,
            maintenance_year: year,
            quarter: 'Q4',
            engineers_id: 1,
            status: 'Ongoing',
            start_date: start,
            estimated_duration_days: 90,
        });
        if (result.errors) throw new Error('Invalid Monthly Updates preview parent.');
    }
    const first = records.find((record) => record.project_id === 103);
    const second = records.find((record) => record.project_id === 104);
    const examples = [
        [first.id, '2026-10', 100, 'Final inspection and roadside clearing completed.'],
        [first.id, '2026-09', 90, 'Drainage channels cleared along the maintenance coverage.'],
        [first.id, '2026-08', 82, 'Road surface preparation and shoulder repairs continued.'],
        [first.id, '2026-07', 75, 'Culvert cleaning and minor drainage repairs completed.'],
        [first.id, '2026-06', 66, 'Compaction and gravel placement progressed.'],
        [first.id, '2026-05', 58, 'Shoulder reshaping along the northern section.'],
        [first.id, '2026-04', 45, 'Material deliveries and surface preparation.'],
        [first.id, '2026-03', 32, 'Grading operations and drainage inspection.'],
        [first.id, '2026-02', 20, 'Initial repair work and site preparation.'],
        [first.id, '2026-01', 10, 'Coverage inspection and work scheduling.'],
        [first.id, '2025-12', 5, 'Initial project assessment.'],
        [first.id, '2025-11', 0, null],
        [second.id, '2026-05', 100, 'Follow-up surface inspection completed.'],
        [second.id, '2026-04', 92, 'Drainage maintenance and finishing work.'],
        [second.id, '2026-03', 80, 'Shoulder rehabilitation and routine clearing.'],
        [second.id, '2026-02', 65, 'Surface maintenance continued.'],
        [second.id, '2026-01', 50, 'Inspection following heavy rainfall.'],
        [second.id, '2025-12', 35, 'Repair materials applied to affected sections.'],
        [second.id, '2025-11', 15, 'Maintenance planning and site inspection.'],
        [second.id, '2024-12', 0, 'Baseline condition assessment.'],
    ];
    for (const [i, [maintenanceId, month, progress, summary]] of examples.entries()) {
        monthlyUpdates.push({
            id: 501 + i,
            maintenance_id: maintenanceId,
            update_month: month,
            progress_percentage: progress,
            summary_of_text_reports: summary,
            created_by: 'demoAdmin',
            created_at: `${month}-15T08:00:00Z`,
            // Older reports can be modified recently; this is not month sorting.
            updated_at: i === 11 ? '2026-10-19T09:00:00Z' : `${month}-15T08:00:00Z`,
        });
    }
    media.push({ id: 9001, monthly_update_id: 501 }, { id: 9002, monthly_update_id: 501 }, { id: 9003, monthly_update_id: 513 });
    const keys = monthlyUpdates.map((update) => `${update.maintenance_id}:${update.update_month}`);
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate preview reporting month.');
}

export function monthlyDirectoryData(projects, url) {
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const joined = monthlyUpdates.flatMap((update) => {
        const record = records.find((item) => item.id === update.maintenance_id);
        const project = record && projectMap.get(record.project_id);
        if (!project || (!/^\d{4}-(0[1-9]|1[0-2])$/.test(update.update_month ?? '') || Number(update.update_month.slice(0, 4)) < 1)) return [];
        return [{ ...update,
            project: { id: project.id, project_title: project.project_title },
            record: { id: record.id, year: record.year, quarter: record.quarter },
            media_count: media.filter((item) => item.monthly_update_id === update.id).length,
        }];
    });
    const filters = {
        search: (url.searchParams.get('search') || '').slice(0, 255),
        project: url.searchParams.get('project') || '',
        year: url.searchParams.get('year') || '',
        sort: ['oldest', 'modified'].includes(url.searchParams.get('sort')) ? url.searchParams.get('sort') : 'newest',
    };
    const query = filters.search.trim().toLocaleLowerCase();
    const rows = joined.filter((update) =>
        (!filters.project || String(update.project.id) === filters.project) &&
        (!filters.year || update.update_month.slice(0, 4) === filters.year) &&
        `${update.project.project_title} ${update.summary_of_text_reports ?? ''}`.toLocaleLowerCase().includes(query),
    );
    rows.sort((a, b) => {
        if (filters.sort === 'modified') return b.updated_at.localeCompare(a.updated_at) || b.id - a.id;
        const monthOrder = a.update_month.localeCompare(b.update_month);
        return (filters.sort === 'oldest' ? monthOrder : -monthOrder) || b.id - a.id;
    });
    const lastPage = Math.max(1, Math.ceil(rows.length / 10));
    const requestedPage = Number(url.searchParams.get('page'));
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(lastPage, Math.floor(requestedPage))) : 1;
    return {
        updates: { data: rows.slice((page - 1) * 10, page * 10), total: rows.length, current_page: page, last_page: lastPage, from: rows.length ? (page - 1) * 10 + 1 : null, to: Math.min(page * 10, rows.length) },
        projects: projects.map(({ id, project_title }) => ({ id, project_title })),
        years: [...new Set(joined.map((update) => Number(update.update_month.slice(0, 4))))].sort((a, b) => b - a),
        filters,
    };
}

// Resolve ownership from the same graph as the directory; context accepts only
// the owning record ID and known directory parameters, never arbitrary URLs.
export function monthlyDetailData(projects, url) {
    const id = Number(url.pathname.split('/').pop());
    const update = monthlyUpdates.find(item => item.id === id);
    const record = update && records.find(item => item.id === update.maintenance_id);
    const project = record && projects.find(item => item.id === record.project_id);
    if (!project || !/^\d{4}-(0[1-9]|1[0-2])$/.test(update.update_month ?? '') || Number(update.update_month.slice(0, 4)) < 1) return null;
    const directory = monthlyDirectoryData(projects, url);
    const query = new URLSearchParams({ ...directory.filters, page: String(directory.updates.current_page) });
    const directoryUrl = `/monthly-updates?${query}`;
    const fromRecord = url.searchParams.get('record') === String(record.id);
    const attachments = monthlyMediaPreview(update.id);
    return {
        update: { ...update, project: { id: project.id, project_title: project.project_title }, record: { id: record.id, year: record.year, quarter: record.quarter }, media_count: attachments.length },
        media: attachments,
        directoryUrl,
        backUrl: fromRecord ? `/maintenance-projects/${project.id}/records/${record.id}` : directoryUrl,
        backLabel: fromRecord ? 'Maintenance Record Details' : 'Monthly Updates',
    };
}

export function deleteMonthlyPreview(ids) {
    if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id) || !monthlyUpdates.some((item) => item.id === id))) {
        return { update_ids: 'Nothing was deleted. Select existing monthly updates and try again.' };
    }
    const selected = new Set(ids);
    for (let i = media.length - 1; i >= 0; i--) {
        if (selected.has(media[i].monthly_update_id)) media.splice(i, 1);
    }
    for (let i = monthlyUpdates.length - 1; i >= 0; i--) {
        if (selected.has(monthlyUpdates[i].id)) monthlyUpdates.splice(i, 1);
    }
    return null;
}

let nextUpdateId = 521;
export async function createMonthlyPreview(projects, data, files, contextRecordId, currentId) {
    const prepared = await prepareMedia(files);
    const current = currentId ? monthlyUpdates.find(item => item.id === currentId) : null;
    if (currentId && !current) return null;
    const errors = {};
    const record = records.find((item) => String(item.id) === String(data.maintenance_id));
    const project = record && projects.find((item) => item.id === record.project_id);
    if (!projects.some((item) => String(item.id) === String(data.project_id))) errors.project_id = 'Select an existing Maintenance Project.';
    if (!record || !project || String(project.id) !== String(data.project_id) || (contextRecordId && String(record.id) !== contextRecordId)) errors.maintenance_id = 'Select a Maintenance Record belonging to this project.';
    if (current && String(current.maintenance_id) !== String(data.maintenance_id)) errors.maintenance_id = 'The existing Maintenance Record association cannot be changed.';
    const removed = data.removed_media_ids ?? [];
    if (!Array.isArray(removed) || removed.some(id => !Number.isSafeInteger(Number(id)) || !media.some(item => item.id === Number(id) && item.monthly_update_id === current?.id))) errors.attachments = 'Select attachments belonging to this Monthly Update.';
    const month = String(data.update_month ?? '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1) errors.update_month = 'Enter a valid reporting month and four-digit year.';
    else if (record && monthlyUpdates.some((item) => item.id !== current?.id && item.maintenance_id === record.id && item.update_month === month)) errors.update_month = 'This Maintenance Record already has an update for this reporting month.';
    const progress = String(data.progress_percentage ?? '');
    if (!/^\d+(?:\.\d{1,2})?$/.test(progress) || !Number.isFinite(Number(progress)) || Number(progress) > 100) errors.progress_percentage = 'Enter progress from 0 to 100 with up to two decimal places.';
    if (prepared.error) errors.attachments = prepared.error;
    if (Object.keys(errors).length) return { errors };
    // All checks complete before mutating the shared graph. No async work between
    // the uniqueness check and commit, including when uploads arrive together.
    const now = new Date().toISOString();
    const values = { id: current?.id ?? nextUpdateId++, maintenance_id: record.id, update_month: month, progress_percentage: Number(progress), summary_of_text_reports: String(data.summary_of_text_reports ?? '').trim() || null, created_by: current?.created_by ?? 'demoAdmin', created_at: current?.created_at ?? now, updated_at: now };
    const update = current ? Object.assign(current, values) : values;
    if (!current) monthlyUpdates.push(update);
    removeMonthlyMedia(update.id, removed.map(Number));
    attachMedia(update.id, prepared.prepared);
    if (current) return { location: `/monthly-updates/${current.id}` };
    return { location: `/monthly-updates?${new URLSearchParams({ project: String(project.id), year: month.slice(0, 4), sort: 'modified', page: '1' })}` };
}

export function monthlyUpdatesForRecord(projects, recordId) {
    return monthlyUpdates.filter(update => update.maintenance_id === recordId).map(update => {
        const detail = monthlyDetailData(projects, new URL(`http://localhost/monthly-updates/${update.id}`));
        if (!detail) return null;
        const photos = detail.media.filter(file => file.mime_type?.startsWith('image/')).length;
        const videos = detail.media.filter(file => file.mime_type?.startsWith('video/')).length;
        return { ...detail.update, photo_count: photos, video_count: videos, other_count: detail.media.length - photos - videos };
    }).filter(Boolean);
}

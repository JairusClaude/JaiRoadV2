// UI fixtures only. No Laravel, SQL, account eligibility or audit writes.
export const engineers = [
    { id: 1, first_name: 'Andrea', last_name: 'Santos' },
    { id: 2, first_name: 'Miguel', last_name: 'Reyes' },
    { id: 3, first_name: 'Paolo', last_name: 'Cruz' },
    { id: 4, first_name: 'Isabel', last_name: 'Garcia' },
];
export const records = [
    {
        id: 1,
        project_id: 101,
        year: 2026,
        quarter: 'Q1',
        status: 'Completed',
        engineers_id: 1,
        start_date: '2026-04-01',
        estimated_duration_days: 30,
        complete_date: '2026-04-30',
        description: null,
    },
    {
        id: 2,
        project_id: 101,
        year: 2026,
        quarter: 'Q2',
        status: 'Ongoing',
        engineers_id: 2,
        start_date: '2026-05-15',
        estimated_duration_days: 90,
        complete_date: null,
        description: null,
    },
];
// Related collections intentionally start empty. They share the same preview
// ownership graph; no uploaded files, accounts, SQL or audit history are touched.
export const monthlyUpdates = [];
export const media = [];
export const maintenanceDocuments = [];
let nextRecordId = Math.max(0, ...records.map((record) => record.id)) + 1;
for (const record of records) {
    record.created_by = 'demoAdmin';
    record.created_at = `${record.start_date}T08:00:00Z`;
    record.updated_at = record.created_at;
}
export function dependentCounts(recordIds) {
    const ids = new Set(recordIds);
    const updates = monthlyUpdates.filter((item) =>
        ids.has(item.maintenance_id),
    );
    const updateIds = new Set(updates.map((item) => item.id));
    return {
        maintenance_records: ids.size,
        monthly_updates: updates.length,
        media: media.filter((item) => updateIds.has(item.monthly_update_id))
            .length,
        maintenance_documents: maintenanceDocuments.filter((item) =>
            ids.has(item.maintenance_id),
        ).length,
    };
}
export function deletePreviewRecords(recordIds) {
    const ids = new Set(recordIds);
    const updates = new Set(
        monthlyUpdates
            .filter((item) => ids.has(item.maintenance_id))
            .map((item) => item.id),
    );
    const remove = (items, match) => {
        for (let i = items.length - 1; i >= 0; i--)
            if (match(items[i])) items.splice(i, 1);
    };
    remove(media, (item) => updates.has(item.monthly_update_id));
    remove(maintenanceDocuments, (item) => ids.has(item.maintenance_id));
    remove(monthlyUpdates, (item) => ids.has(item.maintenance_id));
    remove(records, (item) => ids.has(item.id));
}
export const recordSummaries = (projectId) =>
    records
        .filter((record) => record.project_id === projectId)
        .map((record) => ({
            ...record,
            managing_engineer:
                engineers.find(
                    (engineer) => engineer.id === record.engineers_id,
                ) ?? null,
            details_url: `/maintenance-projects/${projectId}/records/${record.id}`,
            edit_url: `/maintenance-projects/${projectId}/records/${record.id}/edit`,
            delete_url: `/maintenance-projects/${projectId}/records/${record.id}`,
            deletion_counts: dependentCounts([record.id]),
        }));
const validDate = (value) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) > 0 &&
    Number.isFinite(new Date(`${value}T00:00:00Z`).getTime()) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function createPreviewRecord(projectId, data, current) {
    const errors = {};
    const year = Number(data.maintenance_year);

    if (!Number.isInteger(year) || year < 1 || year > 9999) {
        errors.maintenance_year = 'Enter a valid four-digit calendar year.';
    }

    if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(data.quarter)) {
        errors.quarter = 'Select a Quarter.';
    }

    if (
        !engineers.some((engineer) => engineer.id === Number(data.engineers_id))
    ) {
        errors.engineers_id = 'Select an existing Managing Engineer.';
    }

    if (!['Ongoing', 'Completed'].includes(data.status)) {
        errors.status = 'Select Ongoing or Completed.';
    }

    if (!validDate(data.start_date)) {
        errors.start_date = 'Enter a valid Start Date.';
    }

    const duration = Number(data.estimated_duration_days);

    if (!Number.isSafeInteger(duration) || duration <= 0) {
        errors.estimated_duration_days =
            'Enter a positive whole number of days.';
    }

    if (Number(data.maintenance_projects_id) !== projectId) {
        errors.maintenance_year =
            'The parent project does not match this form. Reopen it from Project Details.';
    }

    if (data.status === 'Completed') {
        if (!validDate(data.complete_date)) {
            errors.complete_date =
                'Enter a valid Completion Date for a Completed record.';
        } else if (
            validDate(data.start_date) &&
            data.complete_date < data.start_date
        ) {
            errors.complete_date =
                'Completion Date cannot be earlier than Start Date.';
        }
    }

    if (
        records.some(
            (record) =>
                record.id !== current?.id &&
                record.project_id === projectId &&
                record.year === year &&
                record.quarter === data.quarter,
        )
    ) {
        errors.quarter = `${data.quarter} ${year} already exists for this project. Choose another year or quarter.`;
    }

    if (Object.keys(errors).length) {
        return {
            location: current
                ? `/maintenance-projects/${projectId}/records/${current.id}/edit`
                : `/maintenance-projects/${projectId}/records/create`,
            errors,
        };
    }

    const now = new Date().toISOString();
    const values = {
        id: current?.id ?? nextRecordId++,
        project_id: projectId,
        year,
        quarter: data.quarter,
        status: data.status,
        engineers_id: Number(data.engineers_id),
        start_date: data.start_date,
        estimated_duration_days: duration,
        complete_date: data.status === 'Completed' ? data.complete_date : null,
        description: String(data.description || '').trim() || null,
        created_by: current?.created_by ?? 'demoAdmin',
        created_at: current?.created_at ?? now,
        updated_at: now,
    };
    if (current) Object.assign(current, values);
    else records.push(values);

    return {
        record_id: values.id,
        location: current
            ? `/maintenance-projects/${projectId}/records/${current.id}`
            : `/maintenance-projects/${projectId}?record_year=${year}`,
    };
}

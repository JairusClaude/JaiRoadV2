import type {
    EngineerOption,
    MaintenanceRecordSummary,
    MaintenanceRecordValues,
    RecordErrors,
} from '@/types/maintenance-records';

export const engineerName = (engineer: EngineerOption) =>
    [engineer.first_name, engineer.middle_name, engineer.last_name]
        .filter(Boolean)
        .join(' ');

export const validRecordDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
};

// Match the existing Store/UpdateMaintenanceRecordRequest reporting-year range.
export function validateMaintenanceYear(value: string): string | undefined {
    if (!value) {
        return 'Maintenance year is required.';
    }

    if (!/^\d{4}$/.test(value)) {
        return 'Enter a four-digit year.';
    }

    if (Number(value) < 2000 || Number(value) > 2100) {
        return 'Enter a valid maintenance year.';
    }

    return undefined;
}

export function validateRecord(
    values: MaintenanceRecordValues,
    records: MaintenanceRecordSummary[],
    engineers: EngineerOption[],
    currentRecordId?: number,
): RecordErrors {
    const errors: RecordErrors = {};
    const year = values.maintenance_year;
    const yearError = validateMaintenanceYear(year);

    if (yearError) {
        errors.maintenance_year = yearError;
    }

    if (!['Q1', 'Q2', 'Q3', 'Q4'].includes(values.quarter)) {
        errors.quarter = 'Select a Quarter.';
    }

    if (
        !engineers.some(
            (engineer) => String(engineer.id) === values.engineers_id,
        )
    ) {
        errors.engineers_id = 'Select an existing Managing Engineer.';
    }

    if (!['Ongoing', 'Completed'].includes(values.status)) {
        errors.status = 'Select Ongoing or Completed.';
    }

    if (!values.start_date) {
        errors.start_date = 'Enter a Start Date.';
    } else if (!validRecordDate(values.start_date)) {
        errors.start_date = 'Enter a valid calendar date.';
    }

    const duration = values.estimated_duration_days.trim();

    if (!duration) {
        errors.estimated_duration_days = 'Enter an Estimated Duration in days.';
    } else if (
        !/^\d+$/.test(duration) ||
        !Number.isSafeInteger(Number(duration)) ||
        Number(duration) <= 0
    ) {
        errors.estimated_duration_days =
            'Enter a positive whole number of days.';
    }

    if (values.status === 'Completed') {
        if (!values.complete_date) {
            errors.complete_date =
                'Enter a Completion Date for a Completed record.';
        } else if (!validRecordDate(values.complete_date)) {
            errors.complete_date = 'Enter a valid calendar date.';
        } else if (
            validRecordDate(values.start_date) &&
            values.complete_date < values.start_date
        ) {
            errors.complete_date =
                'Completion Date cannot be earlier than Start Date.';
        }
    }

    if (
        !errors.maintenance_year &&
        !errors.quarter &&
        records.some(
            (record) =>
                record.id !== currentRecordId &&
                record.year === Number(year) &&
                record.quarter === values.quarter,
        )
    ) {
        errors.quarter = `${values.quarter} ${Number(year)} already exists for this project. Choose another year or quarter.`;
    }

    return errors;
}

export function recordPayload(
    values: MaintenanceRecordValues,
    projectId: number,
) {
    return {
        maintenance_projects_id: projectId,
        maintenance_year: Number(values.maintenance_year),
        quarter: values.quarter,
        engineers_id: Number(values.engineers_id),
        status: values.status,
        start_date: values.start_date,
        estimated_duration_days: Number(values.estimated_duration_days),
        ...(values.status === 'Completed'
            ? { complete_date: values.complete_date }
            : {}),
        description: values.description.trim() || null,
    };
}

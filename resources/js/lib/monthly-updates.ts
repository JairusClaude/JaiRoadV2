import type {
    MonthlyCreateProps,
    MonthlyUpdateErrors,
    MonthlyUpdateValues,
} from '@/types/monthly-updates';

export const monthlyMediaTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
];
export const monthlyMediaAccept = '.jpg,.jpeg,.png,.webp,.mp4,.webm';
export function validateMonthlyUpdate(
    values: MonthlyUpdateValues,
    parents: MonthlyCreateProps,
): MonthlyUpdateErrors {
    const errors: MonthlyUpdateErrors = {};
    const project = parents.projects.find(
        (item) => String(item.id) === values.project_id,
    );
    const record = parents.records.find(
        (item) =>
            String(item.id) === values.maintenance_id &&
            item.project_id === project?.id,
    );

    if (!project) {
        errors.project_id = 'Select an existing Maintenance Project.';
    }

    if (
        !record ||
        (parents.contextRecordId && record.id !== parents.contextRecordId)
    ) {
        errors.maintenance_id =
            'Select a Maintenance Record belonging to this project.';
    }

    if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(values.update_month) ||
        Number(values.update_month.slice(0, 4)) < 1
    ) {
        errors.update_month =
            'Enter a valid reporting month and four-digit year.';
    } else if (
        record &&
        parents.existingUpdates.some(
            (item) =>
                item.id !== parents.update?.id &&
                item.maintenance_id === record.id &&
                item.update_month === values.update_month,
        )
    ) {
        errors.update_month =
            'This Maintenance Record already has an update for this reporting month.';
    }

    if (
        !/^(?:\d+)(?:\.\d{1,2})?$/.test(values.progress_percentage) ||
        !Number.isFinite(Number(values.progress_percentage)) ||
        Number(values.progress_percentage) > 100
    ) {
        errors.progress_percentage =
            'Enter progress from 0 to 100 with up to two decimal places.';
    }

    if (
        values.attachments.some(
            (file) => !monthlyMediaTypes.includes(file.type),
        )
    ) {
        errors.attachments = 'Use JPEG, PNG, WebP, MP4, or WebM files only.';
    }

    return errors;
}

export const updateMonth = (value: string) =>
    new Intl.DateTimeFormat('en-PH', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${value}-01T00:00:00Z`));

export const updateTimestamp = (value: string | null) =>
    value && Number.isFinite(Date.parse(value))
        ? new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Unavailable';

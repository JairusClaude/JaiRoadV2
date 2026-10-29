import type { LguValues } from '@/types/lgus';
export const lguFields = [
    { key: 'municipality_name', label: 'Municipality Name', required: true },
    { key: 'province', label: 'Province', required: true },
    { key: 'region', label: 'Region', required: true },
    { key: 'mayor_first_name', label: 'Mayor’s First Name', required: true },
    { key: 'mayor_middle_name', label: 'Mayor’s Middle Name', required: false },
    { key: 'mayor_last_name', label: 'Mayor’s Last Name', required: true },
] as const;
export const mayorName = (lgu: LguValues) =>
    [lgu.mayor_first_name, lgu.mayor_middle_name, lgu.mayor_last_name]
        .filter(Boolean)
        .join(' ');
export function validateLgu(values: LguValues) {
    const errors: Partial<Record<keyof LguValues, string>> = {};

    for (const field of lguFields) {
        if (field.required && !values[field.key].trim()) {
            errors[field.key] = `${field.label} is required.`;
        } else if (values[field.key].trim().length > 255) {
            errors[field.key] = 'Use 255 characters or fewer.';
        }
    }

    return errors;
}

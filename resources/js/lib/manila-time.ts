// Canonical PostgreSQL timestamps without an offset are stored in UTC,
// matching the Audit History controller. Preserve explicitly zoned inputs.
function instant(value?: string | null): Date | null {
    if (!value) return null;
    let normalized = value.trim().replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) {
        normalized += 'Z';
    }
    // PostgreSQL may emit a bare hour offset, such as +00.
    normalized = normalized.replace(/(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?[+-]\d{2})$/, '$1:00');
    const parsed = new Date(normalized);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function manilaTimestamp(value?: string | null, timeStyle: 'short' | 'medium' = 'short'): string {
    const date = instant(value);
    return date ? new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle,
    }).format(date) : 'Unavailable';
}

export function manilaDate(value?: string | null): string {
    const date = instant(value);
    return date ? new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila', dateStyle: 'medium',
    }).format(date) : 'Unavailable';
}

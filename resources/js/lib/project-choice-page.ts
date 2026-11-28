/** Shared response guard for the project filter and form pickers. */
export function validProjectPage(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const {
        data,
        page,
        last_page: lastPage,
    } = payload as {
        data?: unknown;
        page?: unknown;
        last_page?: unknown;
    };

    if (
        !Array.isArray(data) ||
        data.length > 30 ||
        typeof page !== 'number' ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        typeof lastPage !== 'number' ||
        !Number.isSafeInteger(lastPage) ||
        lastPage < page
    ) {
        return false;
    }

    const ids = new Set<number>();

    for (const row of data) {
        if (
            !row ||
            typeof row !== 'object' ||
            !Number.isSafeInteger(row.id) ||
            row.id <= 0 ||
            ids.has(row.id) ||
            typeof row.project_title !== 'string' ||
            (row.municipality !== undefined &&
                row.municipality !== null &&
                typeof row.municipality !== 'string')
        ) {
            return false;
        }

        ids.add(row.id);
    }

    return true;
}

/** Validate the writer-scoped record page before using it in a form. */
export function validRecordChoices(
    payload: unknown,
    projectId: string,
    recordId = '',
): boolean {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const response = payload as Record<string, unknown>;
    const project = response.project;
    const page = response.recordPage;
    const records = response.records;

    if (
        !validProjectPage({ data: [project], page: 1, last_page: 1 }) ||
        String((project as { id: number }).id) !== projectId ||
        !Array.isArray(records) ||
        records.length > (recordId ? 26 : 25) ||
        typeof page !== 'number' ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        typeof response.recordHasMore !== 'boolean' ||
        String(response.selectedRecordId ?? '') !== recordId ||
        !Array.isArray(response.existingUpdates) ||
        response.existingUpdates.length !== 0
    ) {
        return false;
    }

    const ids = new Set<number>();

    for (const record of records) {
        if (
            !record ||
            typeof record !== 'object' ||
            !Number.isSafeInteger(record.id) ||
            record.id <= 0 ||
            ids.has(record.id) ||
            String(record.project_id) !== projectId ||
            !Number.isSafeInteger(record.year) ||
            record.year < 1 ||
            record.year > 9999 ||
            !['Q1', 'Q2', 'Q3', 'Q4'].includes(record.quarter)
        ) {
            return false;
        }

        ids.add(record.id);
    }

    if (!recordId) {
        return response.occupiedMonths === null;
    }

    const occupied = response.occupiedMonths;

    if (
        !ids.has(Number(recordId)) ||
        !occupied ||
        typeof occupied !== 'object' ||
        !('recordId' in occupied) ||
        String(occupied.recordId) !== recordId ||
        !('years' in occupied) ||
        !occupied.years ||
        typeof occupied.years !== 'object' ||
        Array.isArray(occupied.years)
    ) {
        return false;
    }

    return Object.entries(occupied.years).every(
        ([year, mask]) =>
            /^(?!0000)\d{4}$/.test(year) &&
            typeof mask === 'number' &&
            Number.isInteger(mask) &&
            mask >= 0 &&
            mask <= 4095,
    );
}

/** Shared response guard for the project filter and form pickers. */
export function validProjectPage(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const { data, page, last_page: lastPage } = payload as {
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

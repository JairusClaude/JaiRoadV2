export function validRoadPage(
    page: { data: unknown; next_cursor: unknown },
    previous: number | null,
    direction: 'ascending' | 'descending',
): boolean {
    if (!page || !Array.isArray(page.data) || page.data.length > 100) {
        return false;
    }

    const cursor = page.next_cursor;
    const ordered = previous !== null || cursor !== null;
    const ids = new Set<number>();
    let last = previous;

    for (const row of page.data) {
        if (
            !row ||
            typeof row !== 'object' ||
            !Number.isSafeInteger(row.id) ||
            row.id <= 0 ||
            typeof row.road_name !== 'string' ||
            ids.has(row.id) ||
            (ordered &&
                last !== null &&
                (direction === 'ascending' ? row.id <= last : row.id >= last))
        ) {
            return false;
        }

        ids.add(row.id);
        last = row.id;
    }

    return (
        cursor === null ||
        (typeof cursor === 'number' &&
            Number.isSafeInteger(cursor) &&
            cursor > 0 &&
            page.data.length > 0 &&
            cursor === last)
    );
}

/** The project picker must never render an unvalidated remote choice. */
export function validCoverageChoices(
    payload: unknown,
    showAssigned: boolean,
): boolean {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const {
        data,
        available,
        assigned,
        page,
        last_page: lastPage,
    } = payload as {
        data?: unknown;
        available?: unknown;
        assigned?: unknown;
        page?: unknown;
        last_page?: unknown;
    };

    if (
        !Array.isArray(data) ||
        data.length > 30 ||
        typeof available !== 'number' ||
        !Number.isSafeInteger(available) ||
        available < 0 ||
        typeof assigned !== 'number' ||
        !Number.isSafeInteger(assigned) ||
        assigned < 0 ||
        typeof page !== 'number' ||
        !Number.isSafeInteger(page) ||
        page < 1 ||
        typeof lastPage !== 'number' ||
        !Number.isSafeInteger(lastPage) ||
        lastPage < page
    ) {
        return false;
    }

    const total = showAssigned ? available + assigned : available;

    if (
        !Number.isSafeInteger(total) ||
        lastPage !== Math.max(1, Math.ceil(total / 30)) ||
        data.length !== Math.min(30, Math.max(0, total - (page - 1) * 30))
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
            typeof row.road_name !== 'string' ||
            (row.municipality !== null &&
                typeof row.municipality !== 'string') ||
            typeof row.kilometers !== 'string' ||
            typeof row.assigned !== 'boolean' ||
            (!showAssigned && row.assigned) ||
            row.geojson !== null
        ) {
            return false;
        }

        ids.add(row.id);
    }

    return true;
}

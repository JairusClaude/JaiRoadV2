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

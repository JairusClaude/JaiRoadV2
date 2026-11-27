export function validRoadPage(
    page: { data: unknown; next_cursor: unknown },
    previous: number | null,
    direction: 'ascending' | 'descending',
): boolean {
    if (!Array.isArray(page.data) || page.data.length > 100) {
        return false;
    }

    const cursor = page.next_cursor;

    return (
        cursor === null ||
        (typeof cursor === 'number' &&
            Number.isSafeInteger(cursor) &&
            cursor > 0 &&
            page.data.length > 0 &&
            (previous === null ||
                (direction === 'ascending'
                    ? cursor > previous
                    : cursor < previous)))
    );
}

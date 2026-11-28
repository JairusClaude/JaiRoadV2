type OccupiedMonths = {
    recordId: number;
    years: Record<string, number>;
};

export function hasOccupiedReportingMonth(
    occupied: OccupiedMonths | null | undefined,
    recordId: number,
    month: string,
): boolean {
    const match = /^(?!0000)(\d{4})-(0[1-9]|1[0-2])$/.exec(month);

    if (!occupied || occupied.recordId !== recordId || !match) {
        return false;
    }

    const mask = occupied.years[match[1]];

    return (
        Number.isInteger(mask) &&
        mask >= 0 &&
        mask <= 4095 &&
        (mask & (1 << (Number(match[2]) - 1))) !== 0
    );
}

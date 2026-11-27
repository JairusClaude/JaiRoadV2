/** Export only the aggregate cards actually displayed, not private records. */
export function downloadAnalyticsCsv(
    scope: string,
    cards: { label: string; value: number }[],
    reportingCoverage: number | null,
    trend: { month: string; count: number }[],
) {
    const rows = [
        ['Scope', scope],
        ['Metric', 'Value'],
        ...cards.map(({ label, value }) => [label, value]),
        ['Reporting coverage (%)', reportingCoverage ?? 'Not applicable'],
        ['Reporting month', 'Update count'],
        ...trend.map(({ month, count }) => [month, count]),
    ];
    const escape = (value: string | number) => {
        const cell = String(value);
        // Neutralize formula prefixes, including leading whitespace.
        const safe = /^\s*[=+\-@\t\r\n]/.test(cell) ? "'" + cell : cell;

        return '"' + safe.replaceAll('"', '""') + '"';
    };
    const content = rows.map((row) => row.map(escape).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', content], {
        type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jairoads-analytics-summary.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

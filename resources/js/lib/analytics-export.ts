import { analyticsPdf, analyticsXlsx } from './analytics-report-formats';

export type ReportCell = string | number;

/** Export only the aggregate cards actually displayed, not private records. */
export function downloadAnalyticsReport(
    format: 'CSV' | 'XLSX' | 'PDF',
    scope: string,
    cards: { label: string; value: number }[],
    reportingCoverage: number | null,
    trend: { month: string; count: number }[],
) {
    const rows: ReportCell[][] = [
        ['Scope', scope],
        ['Metric', 'Value'],
        ...cards.map(({ label, value }) => [label, value]),
        ['Reporting coverage (%)', reportingCoverage ?? 'Not applicable'],
        ['Reporting month', 'Update count'],
        ...trend.map(({ month, count }) => [month, count]),
    ];
    const escape = (value: ReportCell) => {
        const cell = String(value);
        // Neutralize formula prefixes, including leading whitespace.
        const safe = /^\s*[=+\-@\t\r\n]/.test(cell) ? "'" + cell : cell;

        return '"' + safe.replaceAll('"', '""') + '"';
    };
    const blob =
        format === 'XLSX'
            ? new Blob([analyticsXlsx(rows)], {
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              })
            : format === 'PDF'
              ? new Blob([analyticsPdf(rows)], { type: 'application/pdf' })
              : new Blob(
                    [
                        '\uFEFF',
                        rows.map((row) => row.map(escape).join(',')).join('\r\n'),
                    ],
                    { type: 'text/csv;charset=utf-8' },
                );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jairoads-analytics-summary.${format.toLowerCase()}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

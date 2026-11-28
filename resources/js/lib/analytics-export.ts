import {
    analyticsCsv,
    analyticsPdf,
    analyticsXlsx,
} from './analytics-report-formats';
import type { AnalyticsReport } from './analytics-report-formats';

/** Only currently displayed aggregate values are eligible for an export. */
export function downloadAnalyticsReport(
    format: 'CSV' | 'XLSX' | 'PDF',
    scope: string,
    cards: { label: string; value: number }[],
    reportingCoverage: number | null,
    trend: { month: string; count: number }[],
) {
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(now);
    const year = dateParts.find((part) => part.type === 'year')?.value;
    const month = dateParts.find((part) => part.type === 'month')?.value;

    if (!year || !month) {
        throw new Error('Report date is unavailable.');
    }

    const reportingMonth = trend.at(-1)?.month ?? year + '-' + month;
    const scopeName = scope.replace(/[^a-z0-9-]+/gi, '_');
    const report: AnalyticsReport = {
        scope,
        id: 'JR-' + now.toISOString().replace(/[^0-9]/g, '') + '-' + scopeName,
        generatedAt: now.toISOString(),
        reportingMonth,
        cards,
        reportingCoverage,
        trend,
    };
    const blob =
        format === 'XLSX'
            ? new Blob([analyticsXlsx(report)], {
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              })
            : format === 'PDF'
              ? new Blob([analyticsPdf(report)], { type: 'application/pdf' })
              : new Blob([analyticsCsv(report)], {
                    type: 'text/csv;charset=utf-8',
                });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
        'JaiROADS_' +
        scopeName +
        '_Analytics_' +
        year +
        '-' +
        month +
        '.' +
        format.toLowerCase();
    document.body.appendChild(link);

    try {
        link.click();
    } finally {
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

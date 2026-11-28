export type ReceiptReport = {
    project_id: string;
    maintenance_id: string;
    update_month: string;
    progress_percentage: string;
    summary_of_text_reports: string;
};

export type ReceiptQueue = {
    version: 1;
    accountId: number;
    submissionId: string;
    createdAt: number;
    expiresAt: number;
    attempted: boolean;
    report: ReceiptReport;
};

export const queueLifetime = 24 * 60 * 60 * 1000;
export const receiptQueueKey = 'jairoads:encrypted-receipt-queue:v1';

const positiveId = (id: unknown): id is string =>
    typeof id === 'string' &&
    /^[1-9]\d*$/.test(id) &&
    Number.isSafeInteger(Number(id));

export function parseReceiptQueue(
    data: unknown,
    accountId: number,
): ReceiptQueue {
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid saved report queue.');
    }

    const item = data as ReceiptQueue;
    const report = item.report;

    if (
        item.version !== 1 ||
        !Number.isSafeInteger(accountId) ||
        accountId < 1 ||
        item.accountId !== accountId ||
        typeof item.submissionId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
            item.submissionId,
        ) ||
        !Number.isSafeInteger(item.createdAt) ||
        item.createdAt < 1 ||
        item.createdAt > Date.now() ||
        !Number.isSafeInteger(item.expiresAt) ||
        item.expiresAt !== item.createdAt + queueLifetime ||
        typeof item.attempted !== 'boolean' ||
        !report ||
        !positiveId(report.project_id) ||
        !positiveId(report.maintenance_id) ||
        typeof report.update_month !== 'string' ||
        !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(report.update_month) ||
        typeof report.progress_percentage !== 'string' ||
        !/^\d+(?:\.\d{1,2})?$/.test(report.progress_percentage) ||
        Number(report.progress_percentage) > 100 ||
        typeof report.summary_of_text_reports !== 'string' ||
        [...report.summary_of_text_reports].length > 20000
    ) {
        throw new Error('Invalid queue or queue belongs to another account.');
    }

    // Reconstruct only approved fields; never forward arbitrary draft fields.
    return {
        version: 1,
        accountId,
        submissionId: item.submissionId,
        createdAt: item.createdAt,
        expiresAt: item.expiresAt,
        attempted: item.attempted,
        report: {
            project_id: report.project_id,
            maintenance_id: report.maintenance_id,
            update_month: report.update_month,
            progress_percentage: report.progress_percentage,
            summary_of_text_reports: report.summary_of_text_reports,
        },
    };
}

export function createReceiptQueue(
    report: ReceiptReport,
    accountId: number,
): ReceiptQueue {
    const createdAt = Date.now();

    return parseReceiptQueue(
        {
            version: 1,
            accountId,
            submissionId: crypto.randomUUID(),
            createdAt,
            expiresAt: createdAt + queueLifetime,
            attempted: false,
            report,
        },
        accountId,
    );
}

export function canAttemptReceiptQueue(queue: ReceiptQueue): boolean {
    return !queue.attempted && Date.now() < queue.expiresAt;
}

export function receiptQuery(queue: ReceiptQueue, receipt = true) {
    return new URLSearchParams({
        account_id: String(queue.accountId),
        project_id: queue.report.project_id,
        maintenance_id: queue.report.maintenance_id,
        update_month: queue.report.update_month,
        ...(receipt ? { submission_id: queue.submissionId } : {}),
    });
}

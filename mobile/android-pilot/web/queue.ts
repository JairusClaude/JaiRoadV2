import {
    decryptDraft,
    encryptDraft,
} from '../../../resources/js/lib/encrypted-field-draft.mjs';
import {
    canAttemptReceiptQueue,
    createReceiptQueue,
    parseReceiptQueue,
    receiptQuery,
} from '../../../resources/js/lib/receipt-queue';
import type {
    ReceiptQueue,
    ReceiptReport,
} from '../../../resources/js/lib/receipt-queue';

export type RecordChoice = {
    id: string;
    projectId: string;
    project: string;
    year: number;
    quarter: string;
    status: string;
    municipality: string;
};

export type Snapshot = {
    accountId: number;
    role: 'Engineer' | 'Viewer';
    records: RecordChoice[];
    canSync: boolean;
    truncated: boolean;
};

export type Workspace = Snapshot & { csrfToken: string };

type Envelope = Awaited<ReturnType<typeof encryptDraft>>;
type Entry = {
    queue: ReceiptQueue;
    status: 'pending' | 'checking' | 'review' | 'synced';
    reportId?: number;
};

type Stored = { version: 1; snapshot: Envelope; entries: Envelope[] };

const keyPrefix = 'jairoads:android-pilot:account:v1:';
const workspaceUrl = '/workspace/ui/android-pilot/workspace';
const reportsUrl = '/workspace/ui/android-pilot/reports';
const outcomeUrl = '/workspace/ui/monthly-updates/submission-outcome';

export class RequestError extends Error {
    constructor(public readonly status: number) {
        super('JaiROADS returned HTTP ' + status);
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(path, {
        ...init,
        cache: 'no-store',
        credentials: 'same-origin',
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
        headers: {
            Accept: 'application/json',
            ...init.headers,
        },
    });

    if (!response.ok) {
        throw new RequestError(response.status);
    }

    if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('JaiROADS returned an unexpected response.');
    }

    return (await response.json()) as T;
}

export async function loadWorkspace(): Promise<Workspace> {
    const data = await request<Workspace>(workspaceUrl);

    if (
        !Number.isSafeInteger(data.accountId) ||
        data.accountId < 1 ||
        !['Engineer', 'Viewer'].includes(data.role) ||
        !Array.isArray(data.records) ||
        typeof data.csrfToken !== 'string' ||
        data.csrfToken.length < 20
    ) {
        throw new Error('The staging workspace returned invalid account data.');
    }

    return data;
}

async function digest(value: string) {
    const bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value),
    );

    return Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');
}

export class Vault {
    private constructor(
        private readonly storageKey: string,
        private readonly passphrase: string,
        private saved: Stored,
        public snapshot: Snapshot,
        public entries: Entry[],
    ) {}

    static async prepare(
        email: string,
        password: string,
        workspace: Workspace,
    ) {
        const storageKey = keyPrefix + (await digest(email));
        const passphrase = await digest(JSON.stringify([email, password]));
        const raw = localStorage.getItem(storageKey);

        if (raw) {
            const vault = await this.restore(storageKey, passphrase, raw);
            await vault.update(workspace);

            return vault;
        }

        const snapshot = snapshotOf(workspace);
        const saved: Stored = {
            version: 1,
            snapshot: await encryptDraft(snapshot, passphrase),
            entries: [],
        };
        const vault = new Vault(storageKey, passphrase, saved, snapshot, []);

        vault.persist(saved);

        return vault;
    }

    static async open(email: string, password: string) {
        const storageKey = keyPrefix + (await digest(email));
        const raw = localStorage.getItem(storageKey);

        if (!raw) {
            throw new Error(
                'Sign in online on this phone before using offline mode.',
            );
        }

        const passphrase = await digest(JSON.stringify([email, password]));

        return this.restore(storageKey, passphrase, raw);
    }

    private static async restore(
        storageKey: string,
        passphrase: string,
        raw: string,
    ) {
        const saved = JSON.parse(raw) as Stored;

        if (
            saved.version !== 1 ||
            !Array.isArray(saved.entries) ||
            saved.entries.length > 20
        ) {
            throw new Error('The saved workspace has an unsupported format.');
        }

        const snapshot = (await decryptDraft(
            saved.snapshot,
            passphrase,
        )) as Snapshot;
        const entries: Entry[] = [];

        for (const envelope of saved.entries) {
            const entry = (await decryptDraft(envelope, passphrase)) as Entry;
            entry.queue = parseReceiptQueue(entry.queue, snapshot.accountId);

            if (
                !['pending', 'checking', 'review', 'synced'].includes(
                    entry.status,
                ) ||
                (entry.status === 'synced' &&
                    (!Number.isSafeInteger(entry.reportId) ||
                        (entry.reportId ?? 0) < 1))
            ) {
                throw new Error('Invalid saved report.');
            }

            entries.push(entry);
        }

        return new Vault(storageKey, passphrase, saved, snapshot, entries);
    }

    private persist(saved: Stored) {
        localStorage.setItem(this.storageKey, JSON.stringify(saved));
        this.saved = saved;
    }

    async update(workspace: Workspace) {
        if (
            workspace.accountId !== this.snapshot.accountId ||
            workspace.role !== this.snapshot.role
        ) {
            throw new Error(
                'This offline workspace belongs to another account. Sign in with the original account.',
            );
        }

        const snapshot = snapshotOf(workspace);
        this.persist({
            ...this.saved,
            snapshot: await encryptDraft(snapshot, this.passphrase),
        });
        this.snapshot = snapshot;
    }

    async save(report: ReceiptReport) {
        if (
            this.snapshot.role !== 'Engineer' ||
            !this.snapshot.canSync ||
            !this.snapshot.records.some(
                (record) =>
                    record.id === report.maintenance_id &&
                    record.projectId === report.project_id,
            )
        ) {
            throw new Error('This record is unavailable for offline saving.');
        }

        if (this.entries.length >= 20) {
            throw new Error(
                'The device has 20 reports. Remove a confirmed or reviewed report to make room.',
            );
        }

        if (
            this.entries.some(
                ({ queue, status }) =>
                    status !== 'review' &&
                    queue.report.maintenance_id === report.maintenance_id &&
                    queue.report.update_month === report.update_month,
            )
        ) {
            throw new Error(
                'A report for this record and month is already on this device.',
            );
        }

        const entry: Entry = {
            queue: createReceiptQueue(report, this.snapshot.accountId),
            status: 'pending',
        };
        await this.replace(this.entries.length, entry);
    }

    async remove(index: number) {
        this.persist({
            ...this.saved,
            entries: this.saved.entries.filter((_, i) => i !== index),
        });
        this.entries = this.entries.filter((_, i) => i !== index);
    }

    private async replace(index: number, entry: Entry) {
        const entries = [...this.saved.entries];
        entries[index] = await encryptDraft(entry, this.passphrase);
        this.persist({ ...this.saved, entries });
        this.entries[index] = entry;
    }

    async sync(notify: () => void) {
        // Validate the current server-side role and account before releasing any drafts.
        const workspace = await loadWorkspace();
        await this.update(workspace);

        if (!workspace.canSync || workspace.role !== 'Engineer') {
            throw new Error(
                'Report sync is unavailable for this account or staging server.',
            );
        }

        for (const [index, entry] of this.entries.entries()) {
            const { queue } = entry;

            if (entry.status === 'synced' || entry.status === 'review') {
                continue;
            }

            try {
                if (entry.status === 'checking') {
                    const receipt = await request<Receipt>(
                        outcomeUrl + '?' + receiptQuery(queue),
                    );
                    await this.confirm(index, queue, receipt);
                    continue;
                }

                if (
                    !canAttemptReceiptQueue(queue) ||
                    !workspace.records.some(
                        ({ id, projectId }) =>
                            id === queue.report.maintenance_id &&
                            projectId === queue.report.project_id,
                    )
                ) {
                    await this.replace(index, { queue, status: 'review' });
                    continue;
                }

                // Save the attempted marker before the POST. If the response is lost,
                // later syncs only check the receipt and never guess that it is safe to resend.
                const attempted = { ...queue, attempted: true };
                await this.replace(index, {
                    queue: attempted,
                    status: 'checking',
                });
                notify();

                const receipt = await request<Receipt>(reportsUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': workspace.csrfToken,
                    },
                    body: JSON.stringify({
                        ...attempted.report,
                        submission_id: attempted.submissionId,
                        reconnect_account_id: attempted.accountId,
                    }),
                });
                await this.confirm(index, attempted, receipt);
            } catch (error) {
                if (
                    !(error instanceof RequestError) ||
                    ![403, 404, 409, 422].includes(error.status)
                ) {
                    throw error;
                }

                await this.replace(index, {
                    queue: this.entries[index].queue,
                    status: 'review',
                });
            } finally {
                notify();
            }
        }
    }

    private async confirm(
        index: number,
        queue: ReceiptQueue,
        receipt: Receipt,
    ) {
        if (
            receipt.receiptConfirmed === true &&
            Number.isSafeInteger(receipt.reportId) &&
            (receipt.reportId ?? 0) > 0
        ) {
            await this.replace(index, {
                queue,
                status: 'synced',
                reportId: receipt.reportId ?? undefined,
            });
        }
    }
}

type Receipt = { reportId: number | null; receiptConfirmed: boolean };

function snapshotOf({
    accountId,
    role,
    canSync,
    records,
    truncated,
}: Workspace): Snapshot {
    return { accountId, role, canSync, records, truncated };
}

import { Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    decryptDraft,
    encryptDraft,
    isEncryptedDraft,
    maxDraftFileBytes,
} from '@/lib/encrypted-field-draft.mjs';
import {
    canAttemptReceiptQueue,
    createReceiptQueue,
    parseReceiptQueue,
    receiptQuery,
    receiptQueueKey,
} from '@/lib/receipt-queue';
import type { ReceiptQueue } from '@/lib/receipt-queue';
import type { MonthlyUpdateValues } from '@/types/monthly-updates';

async function readQueue(accountId: number, passphrase: string) {
    const raw = localStorage.getItem(receiptQueueKey);

    if (!raw || raw.length > maxDraftFileBytes) {
        throw new Error('No readable encrypted queue was found.');
    }

    const envelope: unknown = JSON.parse(raw);

    if (!isEncryptedDraft(envelope)) {
        throw new Error('Invalid encrypted queue.');
    }

    return {
        raw,
        queue: parseReceiptQueue(
            await decryptDraft(envelope, passphrase),
            accountId,
        ),
    };
}

async function lookup(
    queue: ReceiptQueue,
    signal: AbortSignal,
    receipt = true,
): Promise<number | null> {
    const response = await fetch(
        '/workspace/ui/monthly-updates/submission-outcome?' +
            receiptQuery(queue, receipt),
        {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
        },
    );

    if (!response.ok) {
        throw new Error('Unable to verify current access or saved report.');
    }

    const data = (await response.json()) as {
        reportId: number | null;
        receiptConfirmed?: boolean;
    };

    if (
        !data ||
        (data.reportId !== null &&
            (!Number.isSafeInteger(data.reportId) || data.reportId < 1)) ||
        (receipt && data.receiptConfirmed !== (data.reportId !== null))
    ) {
        throw new Error('Invalid receipt response.');
    }

    return data.reportId;
}

export function DurableReportQueue({
    accountId,
    contextRecordId,
    values,
    valid,
    disabled,
    onBusy,
}: {
    accountId: number;
    contextRecordId?: number;
    values: MonthlyUpdateValues;
    valid: boolean;
    disabled: boolean;
    onBusy: (busy: boolean) => void;
}) {
    const password = useRef<HTMLInputElement>(null);
    const active = useRef<AbortController | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [unlocked, setUnlocked] = useState<ReceiptQueue | null>(null);
    const [reportId, setReportId] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const blocked = busy || disabled || !confirmed;
    const hasMedia =
        values.attachments.length > 0 || values.removed_media_ids.length > 0;

    useEffect(() => () => active.current?.abort(), []);

    const run = async (
        action: (passphrase: string, signal: AbortSignal) => Promise<void>,
    ) => {
        if (blocked || active.current) {
            return;
        }

        if (!navigator.locks) {
            setMessage('Secure cross-tab locking is unavailable.');

            return;
        }

        const passphrase = password.current?.value ?? '';

        if (password.current) {
            password.current.value = '';
        }

        if (passphrase.length < 12 || passphrase.length > 256) {
            setMessage('Use a draft passphrase of 12 to 256 characters.');

            return;
        }

        const controller = new AbortController();
        active.current = controller;
        setBusy(true);
        onBusy(true);
        setReportId(null);
        setMessage('Processing encrypted queue…');

        try {
            await navigator.locks.request(
                receiptQueueKey,
                { ifAvailable: true },
                (lock) => {
                    if (!lock) {
                        throw new Error('Queue is busy in another tab.');
                    }

                    controller.signal.throwIfAborted();

                    return action(passphrase, controller.signal);
                },
            );
        } catch {
            if (!controller.signal.aborted) {
                setUnlocked(null);
                setMessage(
                    'Queue operation failed. Unlock again or check the saved receipt. No automatic retry will occur.',
                );
            }
        } finally {
            active.current = null;

            if (!controller.signal.aborted) {
                setBusy(false);
                onBusy(false);
            }
        }
    };

    const create = () =>
        run(async (passphrase, signal) => {
            if (
                !valid ||
                hasMedia ||
                localStorage.getItem(receiptQueueKey) !== null
            ) {
                throw new Error('Existing queue or invalid report.');
            }

            const queue = createReceiptQueue(values, accountId);
            const encrypted = await encryptDraft(queue, passphrase);
            signal.throwIfAborted();

            if (localStorage.getItem(receiptQueueKey) !== null) {
                throw new Error('Queue changed.');
            }

            localStorage.setItem(receiptQueueKey, JSON.stringify(encrypted));
            setUnlocked(queue);
            setMessage('Encrypted report saved on this device. Not submitted.');
        });

    const unlock = () =>
        run(async (passphrase, signal) => {
            const { queue } = await readQueue(accountId, passphrase);
            signal.throwIfAborted();
            setUnlocked(queue);
            setMessage(
                queue.attempted
                    ? 'Review the attempted report. Check its receipt.'
                    : 'Review the saved report. Nothing has been submitted.',
            );
        });

    const selected = async (passphrase: string) => {
        const saved = await readQueue(accountId, passphrase);

        if (
            !unlocked ||
            JSON.stringify(saved.queue) !== JSON.stringify(unlocked)
        ) {
            throw new Error('Queue changed. Unlock it again.');
        }

        return saved;
    };

    const check = () =>
        run(async (passphrase, signal) => {
            const { queue } = await selected(passphrase);
            const id = await lookup(queue, signal);
            signal.throwIfAborted();
            setReportId(id);
            setMessage(
                id
                    ? 'The original submission receipt is confirmed.'
                    : 'No receipt was found. An earlier request could still be processing.',
            );
        });

    const submit = () =>
        run(async (passphrase, signal) => {
            const { queue, raw } = await selected(passphrase);

            if (
                !navigator.onLine ||
                hasMedia ||
                !canAttemptReceiptQueue(queue) ||
                (contextRecordId &&
                    String(contextRecordId) !== queue.report.maintenance_id)
            ) {
                throw new Error('Queue is not eligible for a new attempt.');
            }

            const id = await lookup(queue, signal);

            if (id !== null) {
                signal.throwIfAborted();
                setReportId(id);
                setMessage('This report already has a confirmed receipt.');

                return;
            }

            if ((await lookup(queue, signal, false)) !== null) {
                signal.throwIfAborted();
                setMessage('The period is occupied. No submission was sent.');

                return;
            }

            // Record attempted state before initiating any write. The marker
            // remains encrypted and survives navigation and uncertain responses.
            const attempted = { ...queue, attempted: true };
            const encrypted = await encryptDraft(attempted, passphrase);
            signal.throwIfAborted();

            if (
                !navigator.onLine ||
                !canAttemptReceiptQueue(queue) ||
                localStorage.getItem(receiptQueueKey) !== raw
            ) {
                throw new Error('Queue or connection changed.');
            }

            localStorage.setItem(receiptQueueKey, JSON.stringify(encrypted));
            setUnlocked(attempted);
            setMessage('Submitting once. Check the receipt if interrupted.');
            await new Promise<void>((resolve) => {
                router.post(
                    '/workspace/ui/monthly-updates',
                    {
                        ...queue.report,
                        submission_id: queue.submissionId,
                        reconnect_account_id: queue.accountId,
                    },
                    {
                        preserveScroll: true,
                        onError: () => {
                            if (!signal.aborted) {
                                setMessage(
                                    'Submission not confirmed. Check the receipt before taking further action.',
                                );
                            }
                        },
                        onFinish: () => resolve(),
                    },
                );
            });
        });

    const discard = () =>
        run(async (passphrase, signal) => {
            const { raw } = await selected(passphrase);
            signal.throwIfAborted();

            if (localStorage.getItem(receiptQueueKey) !== raw) {
                throw new Error('Queue changed.');
            }

            localStorage.removeItem(receiptQueueKey);
            setUnlocked(null);
            setMessage(
                'Local encrypted queue removed. Server reports unchanged.',
            );
        });

    return (
        <section
            className="jr-record-schedule"
            aria-label="Encrypted submission queue"
        >
            <h2>Encrypted submission queue (pilot)</h2>
            <p className="jr-field-hint">
                One text-only report can be saved on this browser for explicit
                submission within 24 hours. Closing the browser does not submit
                it. Attachments are excluded. After an attempt, only receipt
                checking is available. Keep your passphrase separately.
            </p>
            <label className="my-3 flex items-start gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={disabled || busy}
                    onChange={(event) => {
                        setConfirmed(event.target.checked);

                        if (!event.target.checked) {
                            setUnlocked(null);
                            setReportId(null);

                            if (password.current) {
                                password.current.value = '';
                            }
                        }
                    }}
                />
                I consent to encrypted local storage and understand that the
                saved report, not the current form, will be submitted.
            </label>
            <label className="my-3 grid gap-1 text-sm">
                Queue passphrase (12–256 characters)
                <input
                    ref={password}
                    type="password"
                    autoComplete="new-password"
                    maxLength={256}
                    disabled={blocked}
                    className="rounded-lg border p-2"
                />
            </label>
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={blocked || !valid || hasMedia}
                    onClick={() => void create()}
                >
                    Save encrypted queue
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={blocked}
                    onClick={() => void unlock()}
                >
                    Unlock saved queue
                </Button>
            </div>
            {unlocked && (
                <div className="mt-3 space-y-2 text-sm">
                    <p>
                        Project #{unlocked.report.project_id}, record #
                        {unlocked.report.maintenance_id} ·{' '}
                        {unlocked.report.update_month} ·{' '}
                        {unlocked.report.progress_percentage}%
                    </p>
                    <p className="max-h-48 overflow-auto break-words whitespace-pre-wrap">
                        {unlocked.report.summary_of_text_reports ||
                            'No report summary'}
                    </p>
                    <p>
                        {unlocked.attempted
                            ? 'Attempted; check receipt only.'
                            : 'Not attempted. Review before submitting.'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={blocked}
                            onClick={() => void check()}
                        >
                            Check submission receipt
                        </Button>
                        <Button
                            type="button"
                            disabled={
                                blocked ||
                                hasMedia ||
                                !canAttemptReceiptQueue(unlocked)
                            }
                            onClick={() => void submit()}
                        >
                            Submit saved report once
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={blocked}
                            onClick={() => void discard()}
                        >
                            Remove local queue
                        </Button>
                    </div>
                </div>
            )}
            {message && (
                <p className="mt-2 text-sm" role="status">
                    {message}
                </p>
            )}
            {reportId !== null && (
                <Link
                    className="text-sm font-semibold underline"
                    href={`/workspace/ui/monthly-updates/${reportId}`}
                >
                    Open confirmed report
                </Link>
            )}
        </section>
    );
}

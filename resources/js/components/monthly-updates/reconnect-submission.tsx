import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { validateMonthlyUpdate } from '@/lib/monthly-updates';
import type {
    MonthlyCreateProps,
    MonthlyUpdateValues,
} from '@/types/monthly-updates';

type PendingReport = { snapshot: string; expiresAt: number };

export function ReconnectSubmission({
    parents,
    values,
    disabled,
    onSubmit,
}: {
    parents: MonthlyCreateProps;
    values: MonthlyUpdateValues;
    disabled: boolean;
    onSubmit: () => void;
}) {
    const [online, setOnline] = useState(
        () => typeof navigator === 'undefined' || navigator.onLine,
    );
    const [queued, setQueued] = useState(false);
    const [message, setMessage] = useState('');
    const pending = useRef<PendingReport | null>(null);
    const snapshot = JSON.stringify([
        parents.reconnectAccountId,
        values.project_id,
        values.maintenance_id,
        values.update_month,
        values.progress_percentage,
        values.summary_of_text_reports,
    ]);
    const valid =
        !disabled &&
        Boolean(parents.reconnectAccountId) &&
        !values.attachments.length &&
        !values.removed_media_ids.length &&
        Object.keys(validateMonthlyUpdate(values, parents)).length === 0;

    useEffect(() => {
        const report = pending.current;

        if (!queued || !report) {
            return;
        }

        const timer = window.setTimeout(
            () => {
                if (pending.current === report) {
                    pending.current = null;
                    setQueued(false);
                    setMessage(
                        'Queue expired. Review and queue the report again.',
                    );
                }
            },
            Math.max(0, report.expiresAt - Date.now()),
        );

        return () => window.clearTimeout(timer);
    }, [queued]);

    useEffect(() => {
        const disconnect = () => setOnline(false);
        const reconnect = () => {
            setOnline(true);
            const report = pending.current;

            if (!report) {
                return;
            }

            // Consume first: never retry a request with an uncertain outcome.
            pending.current = null;
            setQueued(false);

            if (
                !valid ||
                report.snapshot !== snapshot ||
                Date.now() >= report.expiresAt
            ) {
                setMessage(
                    'Queued report cancelled. Review and save manually.',
                );

                return;
            }

            setMessage(
                'Submitting once. Check the saved record before retrying.',
            );
            onSubmit();
        };
        window.addEventListener('offline', disconnect);
        window.addEventListener('online', reconnect);

        return () => {
            window.removeEventListener('offline', disconnect);
            window.removeEventListener('online', reconnect);
        };
    }, [valid, snapshot, onSubmit]);

    return (
        <section
            className="jr-record-schedule"
            aria-label="Reconnect submission"
        >
            <h2>Reconnect submission</h2>
            <p className="jr-field-hint">
                {online ? 'Connection detected.' : 'Currently offline.'}
            </p>
            <p className="jr-field-hint">
                Queue a text-only report for one reconnect attempt within 15
                minutes. Keep this page open. The same report values must still
                be valid at reconnection. No automatic retries or local storage.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={online || !valid || queued}
                    onClick={() => {
                        pending.current = {
                            snapshot,
                            expiresAt: Date.now() + 15 * 60 * 1000,
                        };
                        setQueued(true);
                        setMessage('Queued for one attempt when connected.');
                    }}
                >
                    Submit once when connected
                </Button>
                {queued && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            pending.current = null;
                            setQueued(false);
                            setMessage('Queued submission cancelled.');
                        }}
                    >
                        Cancel queued submission
                    </Button>
                )}
            </div>
            <ReportingPeriodLookup
                key={JSON.stringify([
                    parents.reconnectAccountId,
                    values.project_id,
                    values.maintenance_id,
                    values.update_month,
                ])}
                parents={parents}
                values={values}
                disabled={disabled || queued}
                online={online}
            />
            {message && (
                <p className="mt-2 text-sm" role="status">
                    {message}
                </p>
            )}
        </section>
    );
}

function ReportingPeriodLookup({
    parents,
    values,
    disabled,
    online,
}: {
    parents: MonthlyCreateProps;
    values: MonthlyUpdateValues;
    disabled: boolean;
    online: boolean;
}) {
    const outcomeRequest = useRef<AbortController | null>(null);
    const [outcome, setOutcome] = useState<{
        message: string;
        reportId?: number;
        checking?: boolean;
    } | null>(null);
    const canCheckOutcome =
        !disabled &&
        online &&
        Boolean(parents.reconnectAccountId) &&
        parents.records.some(
            (record) =>
                String(record.id) === values.maintenance_id &&
                String(record.project_id) === values.project_id,
        ) &&
        /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(values.update_month);

    useEffect(() => {
        return () => outcomeRequest.current?.abort();
    }, []);

    const checkOutcome = async () => {
        if (!canCheckOutcome || outcome?.checking) {
            return;
        }

        outcomeRequest.current?.abort();
        const controller = new AbortController();
        outcomeRequest.current = controller;
        setOutcome({ message: 'Checking…', checking: true });

        try {
            const query = new URLSearchParams({
                account_id: String(parents.reconnectAccountId),
                project_id: values.project_id,
                maintenance_id: values.maintenance_id,
                update_month: values.update_month,
            });
            const response = await fetch(
                '/workspace/ui/monthly-updates/submission-outcome?' + query,
                {
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: AbortSignal.any([
                        controller.signal,
                        AbortSignal.timeout(12_000),
                    ]),
                },
            );

            if (!response.ok) {
                throw new Error('Outcome lookup unavailable');
            }

            const data = (await response.json()) as {
                reportId: number | null;
            };

            if (
                data.reportId !== null &&
                (!Number.isSafeInteger(data.reportId) || data.reportId < 1)
            ) {
                throw new Error('Invalid outcome response');
            }

            if (!controller.signal.aborted) {
                setOutcome({
                    message: data.reportId
                        ? 'A report exists for this period. Open it and compare the saved values before retrying.'
                        : 'No report was found at the time of checking. An earlier request may still be processing.',
                    reportId: data.reportId ?? undefined,
                });
            }
        } catch {
            if (!controller.signal.aborted) {
                setOutcome({
                    message:
                        'Unable to verify the saved report. Do not automatically retry an uncertain submission.',
                });
            }
        }
    };

    return (
        <div className="mt-2">
            <Button
                type="button"
                variant="outline"
                disabled={!canCheckOutcome || Boolean(outcome?.checking)}
                onClick={() => void checkOutcome()}
            >
                Check saved reporting period
            </Button>
            {outcome && (
                <div className="mt-2 text-sm" role="status">
                    <p>{outcome.message}</p>
                    {outcome.reportId && (
                        <Link
                            className="font-semibold underline"
                            href={`/workspace/ui/monthly-updates/${outcome.reportId}`}
                        >
                            Open saved report
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}

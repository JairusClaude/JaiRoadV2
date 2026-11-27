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
            {message && (
                <p className="mt-2 text-sm" role="status">
                    {message}
                </p>
            )}
        </section>
    );
}

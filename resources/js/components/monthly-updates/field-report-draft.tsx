import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    decryptDraft,
    encryptDraft,
    isEncryptedDraft,
} from '@/lib/encrypted-field-draft.mjs';
import type {
    MonthlyCreateProps,
    MonthlyUpdateValues,
} from '@/types/monthly-updates';

type DraftValues = Pick<
    MonthlyUpdateValues,
    | 'project_id'
    | 'maintenance_id'
    | 'update_month'
    | 'progress_percentage'
    | 'summary_of_text_reports'
>;

export function FieldReportDraft({
    parents,
    values,
    onImport,
    disabled,
}: {
    parents: MonthlyCreateProps;
    values: MonthlyUpdateValues;
    onImport: (value: DraftValues) => void;
    disabled: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const password = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const blocked = disabled || busy || !confirmed;
    const canImport = !blocked && !values.attachments.length;
    const download = async (encrypted = false) => {
        const data = {
            version: 1,
            project_id: values.project_id,
            maintenance_id: values.maintenance_id,
            update_month: values.update_month,
            progress_percentage: values.progress_percentage,
            summary_of_text_reports: values.summary_of_text_reports,
        };
        setBusy(true);

        try {
            const contents = encrypted
                ? await encryptDraft(data, password.current?.value ?? '')
                : data;
            const url = URL.createObjectURL(
                new Blob([JSON.stringify(contents, null, 2)], {
                    type: 'application/json',
                }),
            );
            const link = document.createElement('a');
            link.href = url;
            link.download = encrypted
                ? 'jairoads-encrypted-draft.json'
                : 'jairoads-field-report-draft.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage('Draft downloaded. No report was submitted.');
        } catch (error) {
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to save draft.',
            );
        } finally {
            if (password.current) {
                password.current.value = '';
            }

            setBusy(false);
        }
    };
    const restore = async (file: File) => {
        setBusy(true);

        try {
            if (file.size > 128 * 1024) {
                throw new Error('Draft exceeds the 128 KB size limit.');
            }

            const envelope: unknown = JSON.parse(await file.text());
            const data = isEncryptedDraft(envelope)
                ? await decryptDraft(envelope, password.current?.value ?? '')
                : envelope;

            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Invalid draft format.');
            }

            const item = data as Record<string, unknown>;
            const fields = [
                'project_id',
                'maintenance_id',
                'update_month',
                'progress_percentage',
                'summary_of_text_reports',
            ] as const;

            if (
                item.version !== 1 ||
                fields.some((key) => typeof item[key] !== 'string')
            ) {
                throw new Error('Invalid draft format.');
            }

            const restored = Object.fromEntries(
                fields.map((key) => [key, item[key]]),
            ) as DraftValues;
            const record = parents.records.find(
                (entry) =>
                    String(entry.id) === restored.maintenance_id &&
                    String(entry.project_id) === restored.project_id,
            );

            if (
                !record ||
                (parents.contextRecordId &&
                    record.id !== parents.contextRecordId) ||
                !parents.projects.some(
                    (entry) => String(entry.id) === restored.project_id,
                )
            ) {
                throw new Error(
                    'This draft does not match a currently available maintenance record.',
                );
            }

            if (restored.summary_of_text_reports.length > 10000) {
                throw new Error('Draft summary exceeds the supported limit.');
            }

            onImport(restored);
            setMessage(
                'Draft loaded. Review all values, attach evidence, and submit when connected.',
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unable to import draft.';
            setMessage(message);
        } finally {
            if (password.current) {
                password.current.value = '';
            }

            setBusy(false);
        }
    };

    return (
        <section
            className="jr-record-schedule"
            aria-label="Offline field report draft"
        >
            <h2>Offline field report draft</h2>
            <p className="jr-field-hint">
                Prefer an encrypted draft. No credentials, private media, or
                attachments are included. Plain JSON is not encrypted. Use an
                authorized device and delete drafts when finished.
            </p>
            <a
                className="mt-2 inline-block text-sm font-semibold underline"
                href="/offline-field-report.html"
                download="jairoads-offline-field-report.html"
            >
                Download standalone offline report editor
            </a>
            <label className="my-3 flex items-start gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={disabled}
                    onChange={(event) => setConfirmed(event.target.checked)}
                />
                I understand that the draft contains report text and record
                identifiers, and importing replaces the form.
            </label>
            <label className="my-3 grid gap-1 text-sm">
                Draft passphrase (12–256 characters; not your account password)
                <input
                    ref={password}
                    type="password"
                    autoComplete="new-password"
                    maxLength={256}
                    disabled={blocked}
                    className="rounded-lg border p-2"
                />
            </label>
            <p className="jr-field-hint mb-3">
                Keep the passphrase separately. It is needed to import the
                encrypted file and cannot be recovered by JaiROADS.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    variant="outline"
                    disabled={blocked}
                    onClick={() => void download(true)}
                >
                    Download encrypted draft
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={blocked}
                    onClick={() => void download()}
                >
                    Download draft
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={!canImport}
                    onClick={() => input.current?.click()}
                >
                    Import draft
                </Button>
                <input
                    ref={input}
                    type="file"
                    aria-label="Import field report draft file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';

                        if (file && canImport) {
                            void restore(file);
                        }
                    }}
                />
            </div>
            {values.attachments.length > 0 && (
                <p className="jr-field-hint">
                    Remove selected attachments before importing a draft.
                </p>
            )}
            {message && (
                <p className="mt-2 text-sm" role="status">
                    {message}
                </p>
            )}
        </section>
    );
}

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useId, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import type { DependentCounts } from '@/types/maintenance-projects';

export function DeletionCounts({
    counts,
    includeRecords = true,
    preserve = false,
}: {
    counts?: DependentCounts;
    includeRecords?: boolean;
    preserve?: boolean;
}) {
    if (!counts) {
        return null;
    }

    const affected = [
        ...(includeRecords
            ? [
                  {
                      label: 'Maintenance records',
                      count: counts.maintenance_records,
                  },
              ]
            : []),
        { label: 'Monthly updates', count: counts.monthly_updates },
        { label: 'Media', count: counts.media },
        { label: 'Maintenance documents', count: counts.maintenance_documents },
    ].filter((item) => preserve || item.count > 0);

    if (affected.length === 0) {
        return (
            <p className="jr-delete-empty">No dependent maintenance data.</p>
        );
    }

    return (
        <dl
            className="jr-delete-counts"
            aria-label={
                preserve
                    ? 'Related data to preserve'
                    : 'Dependent data to delete'
            }
        >
            {affected.map(({ label, count }) => (
                <div key={label}>
                    <dt>{label}</dt>
                    <dd>{count}</dd>
                </div>
            ))}
        </dl>
    );
}

export function DeletionDialog({
    open,
    title,
    description,
    children,
    processing,
    error,
    confirmLabel,
    confirmDisabled = false,
    requireYes = false,
    onClose,
    onConfirm,
    returnFocus,
}: {
    open: boolean;
    title: string;
    description: string;
    children: ReactNode;
    processing: boolean;
    error: string;
    confirmLabel: string;
    confirmDisabled?: boolean;
    requireYes?: boolean;
    onClose: () => void;
    onConfirm: () => void;
    returnFocus?: RefObject<HTMLElement | null>;
}) {
    const [confirmation, setConfirmation] = useState('');
    const confirmationId = useId();
    useEffect(() => {
        setConfirmation('');
    }, [open, title]);
    const confirmed = !requireYes || confirmation === 'YES';

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    onClose();
                }
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="jr-delete-overlay" />
                <Dialog.Content
                    className="jr-app jr-theme jr-delete-dialog"
                    onCloseAutoFocus={(event) => {
                        if (returnFocus?.current?.isConnected) {
                            event.preventDefault();
                            returnFocus.current.focus();
                        }
                    }}
                    onEscapeKeyDown={(event) => {
                        if (processing) {
                            event.preventDefault();
                        }
                    }}
                    onPointerDownOutside={(event) => {
                        if (processing) {
                            event.preventDefault();
                        }
                    }}
                >
                    <Dialog.Title>{title}</Dialog.Title>
                    <Dialog.Description>{description}</Dialog.Description>
                    {children}
                    {requireYes && (
                        <div className="mt-4 grid gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                            <label htmlFor={confirmationId} className="text-sm font-semibold text-red-800">Type YES to confirm permanent deletion <span className="jr-required">*</span></label>
                            <input id={confirmationId} type="text" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Type YES" disabled={processing} className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-slate-900" />
                        </div>
                    )}
                    {error && (
                        <p className="jr-field-error" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="jr-dialog-actions">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={processing}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            className="jr-danger"
                            variant="destructive"
                            disabled={processing || confirmDisabled || !confirmed}
                            onClick={() => { if (confirmed && !confirmDisabled && !processing) onConfirm(); }}
                        >
                            {processing ? 'Deleting…' : confirmLabel}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

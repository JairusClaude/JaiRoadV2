import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import type { DependentCounts } from '@/types/maintenance-projects';

export function DeletionCounts({
    counts,
    includeRecords = true,
}: {
    counts?: DependentCounts;
    includeRecords?: boolean;
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
    ].filter((item) => item.count > 0);

    if (affected.length === 0) {
        return (
            <p className="jr-delete-empty">No dependent maintenance data.</p>
        );
    }

    return (
        <dl className="jr-delete-counts" aria-label="Dependent data to delete">
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
    onClose: () => void;
    onConfirm: () => void;
    returnFocus?: RefObject<HTMLElement | null>;
}) {
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
                            disabled={processing || confirmDisabled}
                            onClick={onConfirm}
                        >
                            {processing ? 'Deleting…' : confirmLabel}
                        </Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

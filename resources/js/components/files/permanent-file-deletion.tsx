import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export type FileDeletionTarget = {
    id: number;
    kind: 'document' | 'media';
    file_name: string;
    parent_label: string;
    delete_url: string;
};

function headers() {
    const cookie = document.cookie
        .split('; ')
        .find((value) => value.startsWith('XSRF-TOKEN='));

    return {
        Accept: 'application/json',
        'X-XSRF-TOKEN': cookie ? decodeURIComponent(cookie.slice(11)) : '',
    };
}

export function usePermanentFileDeletion(
    onCompleted: () => void = () => router.reload(),
) {
    const [selected, setSelected] = useState<FileDeletionTarget | null>(null);
    const [ready, setReady] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const locked = useRef(false);
    const reviewRequest = useRef<AbortController | null>(null);
    const opener = useRef<HTMLElement | null>(null);
    const close = () => {
        if (!locked.current) {
            reviewRequest.current?.abort();
            setSelected(null);
        }
    };

    return {
        selected,
        ready,
        processing,
        error,
        opener,
        close,
        open: async (target: FileDeletionTarget) => {
            if (locked.current) {
                return;
            }

            reviewRequest.current?.abort();
            const controller = new AbortController();
            reviewRequest.current = controller;
            opener.current = document.activeElement as HTMLElement;
            setSelected(target);
            setReady(false);
            setError('');

            try {
                const response = await fetch(
                    `${target.delete_url}/deletion-review`,
                    { headers: headers(), signal: controller.signal },
                );

                if (!response.ok) {
                    throw new Error('Review unavailable');
                }

                const review = await response.json();

                if (controller.signal.aborted) {
                    return;
                }

                setSelected({
                    ...target,
                    file_name: review.file_name,
                    parent_label: review.monthly_update_id
                        ? `MonthlyUpdate #${review.monthly_update_id} · MaintenanceRecord #${review.maintenance_id}`
                        : `MaintenanceRecord #${review.maintenance_id}`,
                });
                setReady(review.can_delete === true);

                if (review.pending) {
                    setError(
                        'A previously confirmed deletion is pending. Cancel closes this pane but does not cancel the accepted deletion. Delete retries only this selected file.',
                    );
                }

                if (!review.can_delete) {
                    setError(
                        'Permanent file deletion is temporarily unavailable.',
                    );
                }
            } catch {
                if (!controller.signal.aborted) {
                    setError(
                        'Unable to review this file. Refresh the page or contact an administrator.',
                    );
                }
            }
        },
        confirm: async () => {
            if (!selected || !ready || locked.current) {
                return;
            }

            locked.current = true;
            setProcessing(true);
            setError('');

            try {
                const response = await fetch(selected.delete_url, {
                    method: 'DELETE',
                    headers: headers(),
                });

                if (!response.ok) {
                    setError(
                        response.status === 403
                            ? 'You are no longer authorized to delete this file.'
                            : 'Deletion was not confirmed. Refresh the page or contact an administrator.',
                    );

                    return;
                }

                const result = await response.json();

                if (result.state !== 'completed') {
                    setError(
                        'Deletion is pending and may already have removed the Storage object. It is not confirmed complete. Retry Delete or contact an administrator. Cancel closes this pane but does not cancel an accepted deletion.',
                    );

                    return;
                }

                setSelected(null);
                toast.success(result.message);
                onCompleted();
            } catch {
                setError(
                    'Deletion was not confirmed. It may be pending. Retry Delete or contact an administrator; do not assume the file is intact or permanently removed.',
                );
            } finally {
                locked.current = false;
                setProcessing(false);
            }
        },
    };
}

export function PermanentFileDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof usePermanentFileDeletion>;
}) {
    const cancel = useRef<HTMLButtonElement>(null);

    return (
        <Dialog
            open={deletion.selected !== null}
            onOpenChange={(open) => !open && deletion.close()}
        >
            <DialogContent
                className="jr-theme"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    cancel.current?.focus();
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();

                    if (deletion.opener.current?.isConnected) {
                        deletion.opener.current.focus();
                    } else {
                        const heading = document.querySelector('h1');
                        heading?.setAttribute('tabindex', '-1');
                        heading?.focus();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>Delete File Permanently?</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to permanently delete this file?
                        This action cannot be undone. Only the selected file
                        will be deleted. Other files and related maintenance
                        records will remain unchanged.
                    </DialogDescription>
                </DialogHeader>
                {deletion.selected && (
                    <dl className="grid gap-2 text-sm">
                        <div>
                            <dt>Filename</dt>
                            <dd className="font-semibold break-words">
                                {deletion.selected.file_name}
                            </dd>
                        </div>
                        <div>
                            <dt>File type</dt>
                            <dd>
                                {deletion.selected.kind === 'document'
                                    ? 'MaintenanceDocument'
                                    : 'Media'}
                            </dd>
                        </div>
                        <div>
                            <dt>Associated record</dt>
                            <dd>{deletion.selected.parent_label}</dd>
                        </div>
                    </dl>
                )}
                <p>This file will also be removed from private Storage.</p>
                {deletion.error && (
                    <p role="alert" className="jr-field-error">
                        {deletion.error}
                    </p>
                )}
                <DialogFooter>
                    <Button
                        ref={cancel}
                        variant="outline"
                        onClick={deletion.close}
                        disabled={deletion.processing}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        className="jr-danger"
                        onClick={deletion.confirm}
                        disabled={!deletion.ready || deletion.processing}
                    >
                        {deletion.processing ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

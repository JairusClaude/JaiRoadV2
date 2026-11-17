import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';

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
    const [reviewing, setReviewing] = useState(false);
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
        reviewing,
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
            setReviewing(true);
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
            } finally {
                if (!controller.signal.aborted) setReviewing(false);
            }
        },
        confirm: async () => {
            if (!selected || !ready || locked.current) {
                return;
            }

            locked.current = true;
            setProcessing(true);
            setError('');

            let completed = false;
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
                completed = true;
            } catch {
                setError(
                    'Deletion was not confirmed. It may be pending. Retry Delete or contact an administrator; do not assume the file is intact or permanently removed.',
                );
            } finally {
                locked.current = false;
                setProcessing(false);
                if (completed) onCompleted();
            }
        },
    };
}

export function PermanentFileDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof usePermanentFileDeletion>;
}) {
    return (
        <DeletionDialog
            open={deletion.selected !== null}
            title="Delete File Permanently?"
            description="Only the selected file and its private Storage object will be deleted. Other files and related maintenance records will remain unchanged."
            selectionLabel="Selected file"
            processing={deletion.processing}
            reviewing={deletion.reviewing}
            confirmDisabled={!deletion.ready}
            error={deletion.error}
            confirmLabel="Delete"
            onClose={deletion.close}
            onConfirm={deletion.confirm}
            returnFocus={deletion.opener}
        >
            {deletion.selected && (
                <dl className="jr-delete-file-details">
                    <div><dt>Filename</dt><dd>{deletion.selected.file_name}</dd></div>
                    <div><dt>File type</dt><dd>{deletion.selected.kind === 'document' ? 'MaintenanceDocument' : 'Media'}</dd></div>
                    <div><dt>Associated record</dt><dd>{deletion.selected.parent_label}</dd></div>
                </dl>
            )}
        </DeletionDialog>
    );
}

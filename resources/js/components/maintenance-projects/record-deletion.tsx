import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    DeletionCounts,
    DeletionDialog,
} from '@/components/maintenance-projects/deletion-dialog';
import type { MaintenanceRecordSummary } from '@/types/maintenance-records';

export function useRecordDeletion(returnUrl?: string) {
    const [targets, setTargets] = useState<MaintenanceRecordSummary[] | null>(
        null,
    );
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const close = () => {
        if (!processing) {
            setTargets(null);
        }
    };
    const open = (
        selected: MaintenanceRecordSummary | MaintenanceRecordSummary[],
    ) => {
        const list = Array.isArray(selected) ? selected : [selected];
        if (!list.length) {
            return;
        }

        setError('');
        setTargets(list);
    };
    const confirm = () => {
        if (!targets?.length || processing) {
            return;
        }

        setProcessing(true);
        setError('');

        if (targets.length === 1) {
            const url =
                targets[0].delete_url ||
                `/dd-phase3/ui/maintenance-records/${targets[0].id}`;
            router.delete(
                returnUrl
                    ? `${url}?${new URLSearchParams({ return_to: returnUrl })}`
                    : url,
                {
                    preserveScroll: true,
                    onError: (errors) =>
                        setError(Object.values(errors).join(' ')),
                    onSuccess: () => setTargets(null),
                    onFinish: () => setProcessing(false),
                },
            );
        } else {
            router.delete(`/dd-phase3/ui/maintenance-records/bulk`, {
                data: { record_ids: targets.map((t) => t.id) },
                preserveScroll: true,
                onError: (errors) => setError(Object.values(errors).join(' ')),
                onSuccess: () => setTargets(null),
                onFinish: () => setProcessing(false),
            });
        }
    };

    return {
        targets,
        record: targets?.[0] ?? null,
        processing,
        error,
        close,
        open,
        confirm,
    };
}
export function RecordDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof useRecordDeletion>;
}) {
    const { targets, processing, error, close, confirm } = deletion;
    const count = targets?.length ?? 0;

    return (
        <DeletionDialog
            open={targets !== null}
            title={
                count === 1
                    ? 'Delete maintenance record?'
                    : `Delete ${count} maintenance records?`
            }
            description="Its monthly updates, media and maintenance documents will also be deleted. This cannot be undone. The parent project and other records are preserved."
            confirmLabel={
                count === 1 ? 'Delete Record' : `Delete ${count} Records`
            }
            processing={processing}
            error={error}
            onClose={close}
            onConfirm={confirm}
        >
            <ul className="jr-delete-list">
                {(targets ?? []).map((record) => (
                    <li key={record.id}>
                        <strong>
                            {record?.quarter} {record?.year} · Record ID:{' '}
                            {record?.id}
                        </strong>
                        <DeletionCounts
                            counts={record?.deletion_counts}
                            includeRecords={false}
                        />
                    </li>
                ))}
            </ul>
        </DeletionDialog>
    );
}

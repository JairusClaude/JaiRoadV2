import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    DeletionCounts,
    DeletionDialog,
} from '@/components/maintenance-projects/deletion-dialog';
import type { MaintenanceRecordSummary } from '@/types/maintenance-records';

export function useRecordDeletion(returnUrl?: string) {
    const preview = usePage().props.previewOnly === true;
    const [record, setRecord] = useState<MaintenanceRecordSummary | null>(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const close = () => {
        if (!processing) {
            setRecord(null);
        }
    };
    const open = (selected: MaintenanceRecordSummary) => {
        if (!preview || !selected.delete_url) {
            return;
        }

        setError('');
        setRecord(selected);
    };
    const confirm = () => {
        if (!preview || !record?.delete_url || processing) {
            return;
        }

        setProcessing(true);
        setError('');
        router.delete(
            returnUrl
                ? `${record.delete_url}?${new URLSearchParams({ return_to: returnUrl })}`
                : record.delete_url,
            {
                preserveScroll: true,
                onError: (errors) => setError(Object.values(errors).join(' ')),
                onSuccess: () => setRecord(null),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return { record, processing, error, close, open, confirm };
}
export function RecordDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof useRecordDeletion>;
}) {
    const { record, processing, error, close, confirm } = deletion;

    return (
        <DeletionDialog
            open={record !== null}
            title="Delete maintenance record?"
            description="Its monthly updates, media and maintenance documents will also be deleted. This cannot be undone within the preview. The parent project and other records are preserved."
            confirmLabel="Delete Record"
            processing={processing}
            error={error}
            onClose={close}
            onConfirm={confirm}
        >
            <ul className="jr-delete-list">
                <li>
                    <strong>
                        {record?.quarter} {record?.year} · Record ID:{' '}
                        {record?.id}
                    </strong>
                    <DeletionCounts
                        counts={record?.deletion_counts}
                        includeRecords={false}
                    />
                </li>
            </ul>
        </DeletionDialog>
    );
}

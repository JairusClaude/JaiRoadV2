import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { DocumentSummary } from '@/types/maintenance-documents';
export function useDocumentDeletion(returnRecordId?: number) {
    const [selected, setSelected] = useState<DocumentSummary[]>([]);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const returnFocus = useRef<HTMLElement | null>(null);
    const lock = useRef(false);

    return {
        selected,
        processing,
        error,
        returnFocus,
        open: (items: DocumentSummary[]) => {
            returnFocus.current = document.activeElement as HTMLElement;
            setError('');
            setSelected(items);
        },
        close: () => {
            if (!lock.current) {
                setSelected([]);
            }
        },
        confirm: () => {
            if (lock.current || !selected.length) {
                return;
            }

            lock.current = true;
            setProcessing(true);
            const suffix = returnRecordId ? `?record=${returnRecordId}` : '';
            router.delete(
                selected.length === 1
                    ? workspaceHref(
                          `/maintenance-documents/${selected[0].id}${suffix}`,
                      )
                    : workspaceHref(`/maintenance-documents/bulk${suffix}`),
                {
                    data: { document_ids: selected.map((d) => d.id) },
                    onSuccess: () => setSelected([]),
                    onError: (errors) =>
                        setError(Object.values(errors).join(' ')),
                    onFinish: () => {
                        lock.current = false;
                        setProcessing(false);
                    },
                },
            );
        },
    };
}
export function DocumentDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof useDocumentDeletion>;
}) {
    return (
        <DeletionDialog
            open={!!deletion.selected.length}
            title={
                deletion.selected.length === 1
                    ? 'Delete document?'
                    : 'Delete selected documents?'
            }
            description="The selected documents and their local preview files will be deleted. Their Maintenance Records and Projects will be retained."
            processing={deletion.processing}
            error={deletion.error}
            confirmLabel="Delete Document"
            onClose={deletion.close}
            onConfirm={deletion.confirm}
            returnFocus={deletion.returnFocus}
        >
            <ul className="my-4">
                {deletion.selected.map((d) => (
                    <li key={d.id}>{d.document_title}</li>
                ))}
            </ul>
        </DeletionDialog>
    );
}

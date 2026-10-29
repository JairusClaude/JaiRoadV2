import { router, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import { updateMonth } from '@/lib/monthly-updates';
import type { MonthlyUpdateSummary } from '@/types/monthly-updates';

export function useMonthlyDeletion(query: string) {
    const preview = usePage().props.previewOnly === true;
    const returnFocus = useRef<HTMLElement | null>(null);
    const [selected, setSelected] = useState<MonthlyUpdateSummary[] | null>(
        null,
    );
    const [bulk, setBulk] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const open = (updates: MonthlyUpdateSummary[], multiple = false) => {
        if (!preview || processing) {
            return;
        }

        const active = document.activeElement;
        const menuId = active?.closest('[role="menu"]')?.id;
        returnFocus.current =
            (menuId
                ? document.querySelector<HTMLElement>(
                      `[aria-controls="${CSS.escape(menuId)}"]`,
                  )
                : null) ?? (active instanceof HTMLElement ? active : null);
        setError('');
        setBulk(multiple);
        setSelected(updates);
    };
    const close = () => {
        if (!processing) {
            setSelected(null);
        }
    };
    const confirm = () => {
        if (!preview || !selected?.length || processing) {
            return;
        }

        setProcessing(true);
        setError('');
        router.delete(
            `/monthly-updates/${bulk ? 'bulk' : selected[0].id}?${query}`,
            {
                data: bulk
                    ? { update_ids: selected.map((item) => item.id) }
                    : {},
                preserveScroll: true,
                onError: (errors) =>
                    setError(
                        errors.update_ids ?? Object.values(errors).join(' '),
                    ),
                onSuccess: () => setSelected(null),
                onFinish: () => setProcessing(false),
            },
        );
    };

    return { selected, processing, error, open, close, confirm, returnFocus };
}

export function MonthlyDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof useMonthlyDeletion>;
}) {
    const { selected, processing, error, close, confirm, returnFocus } =
        deletion;
    const count = selected?.length ?? 0;

    return (
        <DeletionDialog
            open={selected !== null}
            title={
                count === 1
                    ? 'Delete monthly update?'
                    : `Delete ${count} monthly updates?`
            }
            description="The selected monthly updates and their associated media will be deleted from this preview. This cannot be undone within the preview. Parent maintenance records and projects are preserved."
            processing={processing}
            error={error}
            confirmLabel={
                count === 1
                    ? 'Delete Monthly Update'
                    : 'Delete Selected Updates'
            }
            onClose={close}
            onConfirm={confirm}
            returnFocus={returnFocus}
        >
            <ul className="jr-delete-list">
                {(selected ?? []).map((update) => (
                    <li key={update.id}>
                        <strong>
                            {updateMonth(update.update_month)} ·{' '}
                            {update.project.project_title}
                        </strong>
                        <p className="jr-project-id">
                            Update ID: {update.id} · {update.record.quarter}{' '}
                            {update.record.year}
                        </p>
                        {update.media_count > 0 ? (
                            <dl
                                className="jr-delete-counts"
                                aria-label="Dependent data to delete"
                            >
                                <div>
                                    <dt>Media</dt>
                                    <dd>{update.media_count}</dd>
                                </div>
                            </dl>
                        ) : (
                            <p className="jr-delete-empty">
                                No associated media.
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </DeletionDialog>
    );
}

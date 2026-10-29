import { router, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import { editUrl } from '@/lib/form-navigation';
import type { LguSummary } from '@/types/lgus';

export function useLguDeletion(records: LguSummary[], canDelete: boolean) {
    const page = usePage();
    const [selected, setSelected] = useState<LguSummary | null>(null);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const returnFocus = useRef<HTMLElement | null>(null);
    const lock = useRef(false);
    // Use refreshed page data after a failed confirmation, not stale row counts.
    const current =
        records.find((record) => record.id === selected?.id) ?? selected;
    const check = current?.deletion_check;
    const blocked =
        !canDelete ||
        !check?.available ||
        check.road_coverages > 0 ||
        check.engineer_assignments > 0;

    return {
        selected: current,
        processing,
        error,
        returnFocus,
        blocked,
        open: (lgu: LguSummary) => {
            if (!canDelete) {
                return;
            }

            // Dropdown items unmount; return keyboard focus to their stable row trigger.
            returnFocus.current =
                document.querySelector<HTMLElement>(
                    `[data-lgu-id="${lgu.id}"] .jr-action-trigger`,
                ) ?? (document.activeElement as HTMLElement);
            setError('');
            setSelected(lgu);
        },
        close: () => {
            if (!lock.current) {
                setSelected(null);
            }
        },
        confirm: () => {
            if (lock.current || !current || blocked) {
                return;
            }

            lock.current = true;
            setProcessing(true);
            router.delete(editUrl(`/lgus/${current.id}`, page.url), {
                preserveScroll: true,
                onSuccess: () => setSelected(null),
                onError: (errors) => setError(Object.values(errors).join(' ')),
                onFinish: () => {
                    lock.current = false;
                    setProcessing(false);
                },
            });
        },
    };
}
export function LguDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof useLguDeletion>;
}) {
    const check = deletion.selected?.deletion_check;

    return (
        <DeletionDialog
            open={!!deletion.selected}
            title={deletion.blocked ? 'Cannot delete LGU' : 'Delete LGU?'}
            description={
                deletion.blocked
                    ? 'This LGU cannot be deleted until its dependencies have been checked and handled.'
                    : 'This will permanently delete the selected LGU from the local preview. This action cannot be undone.'
            }
            processing={deletion.processing}
            error={deletion.error}
            confirmLabel="Delete LGU"
            confirmDisabled={deletion.blocked}
            onClose={deletion.close}
            onConfirm={deletion.confirm}
            returnFocus={deletion.returnFocus}
        >
            <p className="my-4 font-medium">
                {deletion.selected?.municipality_name}
            </p>
            {check?.available ? (
                <>
                    <dl
                        className="jr-delete-counts"
                        aria-label="Associated records preventing deletion"
                    >
                        <div>
                            <dt>Road Coverages</dt>
                            <dd>{check.road_coverages}</dd>
                        </div>
                        <div>
                            <dt>EngineerLGU assignments</dt>
                            <dd>{check.engineer_assignments}</dd>
                        </div>
                    </dl>
                    {deletion.blocked ? (
                        <p className="jr-field-error" role="alert">
                            Handle the associated RoadCoverage records and
                            EngineerLGU assignments first. Active and inactive
                            assignments both prevent deletion. No related
                            records will be deleted or detached.
                        </p>
                    ) : (
                        <p className="jr-delete-empty">
                            No dependent RoadCoverages or EngineerLGU
                            assignments.
                        </p>
                    )}
                </>
            ) : (
                <p className="jr-field-error" role="alert">
                    Dependency information is unavailable. Deletion is blocked
                    until both RoadCoverage and EngineerLGU records can be
                    checked.
                </p>
            )}
        </DeletionDialog>
    );
}

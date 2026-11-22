import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { DuplicatePeriod } from '@/types/maintenance-records';

export function DuplicatePeriodWarning({
    conflict,
    onClose,
    onChooseQuarter,
}: {
    conflict: DuplicatePeriod | null;
    onClose: () => void;
    onChooseQuarter: () => void;
}) {
    return (
        <Dialog
            open={conflict !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent
                className="jr-theme max-h-[calc(100dvh-32px)] max-w-[min(560px,calc(100vw-32px))] overflow-y-auto"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    document.getElementById('quarter')?.focus();
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        Quarter already has a maintenance record
                    </DialogTitle>
                    <DialogDescription>
                        Only one record is allowed per project, year and
                        quarter. Your changes have not been saved.
                    </DialogDescription>
                </DialogHeader>
                {conflict && (
                    <dl className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <div>
                            <dt>Project</dt>
                            <dd className="font-semibold">
                                {conflict.project_title} (#{conflict.project_id}
                                )
                            </dd>
                        </div>
                        <div>
                            <dt>Maintenance Year</dt>
                            <dd>{conflict.maintenance_year}</dd>
                        </div>
                        <div>
                            <dt>Occupied Quarter</dt>
                            <dd>{conflict.quarter}</dd>
                        </div>
                    </dl>
                )}
                {conflict?.details_url && (
                    <Link href={conflict.details_url} className="underline">
                        View Existing Record
                    </Link>
                )}
                <p className="text-sm">
                    Your other form inputs have been kept.
                </p>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    <Button type="button" onClick={onChooseQuarter}>
                        Choose Another Quarter
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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
                className="jr-theme"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    document.getElementById('quarter')?.focus();
                }}
            >
                <DialogHeader>
                    <DialogTitle>
                        Maintenance period already occupied
                    </DialogTitle>
                    <DialogDescription>
                        Only one MaintenanceRecord may exist for each project,
                        maintenance year, and quarter. No new record was
                        created.
                    </DialogDescription>
                </DialogHeader>
                {conflict && (
                    <dl className="grid gap-2 text-sm">
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

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { requestOperation } from '@/pages/dd-phase3/requests';

type Review = {
    confirmation_token: string;
    road: { id: number; name: string };
    previous: { lgu_id: number; municipality: string };
    proposed: { lgu_id: number; municipality: string };
    projects: { id: number; title: string }[];
    maintenance_record_ids: number[];
    counts: {
        maintenance_records: number;
        monthly_updates: number;
        documents: number;
        media: number;
    };
    managers: {
        maintenance_record_id: number;
        engineer_id: number;
        name: string;
        eligible: boolean;
    }[];
    conflicts: string[];
    can_confirm: boolean;
};

const button =
    'rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50';

export default function DdRoadMunicipalityChange({
    roadId,
    lgus,
    onClose,
    onSuccess,
    returnUrl,
}: {
    roadId: number;
    lgus: { id: number; name: string }[];
    onClose: () => void;
    onSuccess: (message: string) => void;
    returnUrl?: string;
}) {
    const [destination, setDestination] = useState('');
    const [review, setReview] = useState<Review | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function preview() {
        setBusy(true);
        setError('');
        setReview(null);

        try {
            const xsrf = document.cookie
                .split('; ')
                .find((cookie) => cookie.startsWith('XSRF-TOKEN='));

            if (!xsrf) {
                throw new Error(
                    'Your session needs refreshing. Reload this page before reviewing the change.',
                );
            }

            const response = await fetch(
                `/dd-phase3/ops/roads/${roadId}/municipality/preview`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': decodeURIComponent(
                            xsrf.slice('XSRF-TOKEN='.length),
                        ),
                    },
                    body: JSON.stringify({ lgu_id: destination }),
                },
            );

            if (!response.ok) {
                const failure = (await response.json()) as {
                    message?: string;
                    errors?: Record<string, string[]>;
                };

                throw new Error(
                    failure.errors
                        ? Object.values(failure.errors).flat().join(' ')
                        : failure.message ||
                              'Unable to review this change. Check your assignments and refresh the page.',
                );
            }

            setReview((await response.json()) as Review);
        } catch (failure) {
            setError(
                failure instanceof Error
                    ? failure.message
                    : 'Unable to review the municipality change.',
            );
        } finally {
            setBusy(false);
        }
    }

    async function confirm() {
        if (!review || !review.can_confirm || busy) {
            return;
        }

        setBusy(true);
        setError('');

        try {
            await requestOperation(
                `/dd-phase3/ops/roads/${roadId}/municipality/confirm`,
                {
                    confirmation_token: review.confirmation_token,
                    ...(returnUrl ? { return_to: returnUrl } : {}),
                },
                'post',
                false,
                { preserveState: true },
            );
            onSuccess(
                `Municipality changed from ${review.previous.municipality} to ${review.proposed.municipality}. Road geometry and maintenance history were preserved.`,
            );
        } catch (failure) {
            setReview(null);
            setError(
                failure instanceof Error
                    ? failure.message
                    : 'Confirmation failed. Review current values again.',
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !busy) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {review
                            ? 'Review municipality change'
                            : 'Change municipality'}
                    </DialogTitle>
                    <DialogDescription>
                        RoadCoverage #{roadId}. Review the affected records
                        before final confirmation.
                    </DialogDescription>
                </DialogHeader>
                {!review ? (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void preview();
                        }}
                        className="space-y-4"
                    >
                        <label
                            htmlFor="municipality-destination"
                            className="block text-sm font-medium"
                        >
                            New municipality
                        </label>
                        <select
                            id="municipality-destination"
                            className="mt-2 block w-full rounded-xl border p-3"
                            value={destination}
                            onChange={(event) =>
                                setDestination(event.target.value)
                            }
                            disabled={busy}
                            required
                        >
                            <option value="">
                                Select destination municipality
                            </option>
                            {lgus.map((lgu) => (
                                <option key={lgu.id} value={lgu.id}>
                                    {lgu.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-sm text-slate-600">
                            Review Changes does not save anything. Road name,
                            length, pavement, condition and saved GeoJSON stay
                            unchanged.
                        </p>
                        {error && (
                            <p role="alert" className="text-sm text-red-700">
                                {error}
                            </p>
                        )}
                        <DialogFooter>
                            <button
                                type="button"
                                className={button}
                                disabled={busy}
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className={`${button} jr-primary text-white`}
                                disabled={busy || !destination}
                            >
                                {busy ? 'Reviewing…' : 'Review Changes'}
                            </button>
                        </DialogFooter>
                    </form>
                ) : (
                    <>
                        <p className="font-medium">
                            RoadCoverage #{review.road.id}: {review.road.name}
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <section className="rounded-xl border bg-slate-50 p-3">
                                <h3 className="font-semibold">
                                    Previous municipality
                                </h3>
                                <p>{review.previous.municipality}</p>
                                <p>LGU ID: {review.previous.lgu_id}</p>
                            </section>
                            <section className="rounded-xl border bg-amber-50 p-3">
                                <h3 className="font-semibold">
                                    New municipality
                                </h3>
                                <p>{review.proposed.municipality}</p>
                                <p>LGU ID: {review.proposed.lgu_id}</p>
                            </section>
                        </div>
                        <section
                            className="space-y-2 text-sm"
                            aria-label="Affected maintenance history"
                        >
                            <h3 className="font-semibold">
                                Affected information
                            </h3>
                            {review.projects.length ? (
                                review.projects.map((project) => (
                                    <p key={project.id}>
                                        MaintenanceProject #{project.id}:{' '}
                                        {project.title} will inherit the new
                                        municipality.
                                    </p>
                                ))
                            ) : (
                                <p>
                                    No linked MaintenanceProject or maintenance
                                    history exists.
                                </p>
                            )}
                            <p>
                                {review.counts.maintenance_records}{' '}
                                MaintenanceRecords ·{' '}
                                {review.counts.monthly_updates} MonthlyUpdates ·{' '}
                                {review.counts.documents} documents ·{' '}
                                {review.counts.media} media
                            </p>
                            {review.projects.length > 0 &&
                                review.counts.maintenance_records === 0 && (
                                    <p>
                                        No maintenance history exists for this
                                        project.
                                    </p>
                                )}
                            {review.managers.map((manager) => (
                                <p key={manager.maintenance_record_id}>
                                    MaintenanceRecord #
                                    {manager.maintenance_record_id} —{' '}
                                    {manager.name} (Engineer #
                                    {manager.engineer_id}):{' '}
                                    {manager.eligible
                                        ? 'eligible for destination'
                                        : 'authorization conflict'}
                                </p>
                            ))}
                            {review.conflicts.length ? (
                                <ul
                                    role="alert"
                                    className="list-disc space-y-2 pl-5 text-red-700"
                                >
                                    {review.conflicts.map((conflict) => (
                                        <li key={conflict}>{conflict}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p>
                                    No ManagingEngineer authorization conflicts
                                    found.
                                </p>
                            )}
                        </section>
                        <p className="rounded-xl bg-amber-50 p-3 text-sm">
                            Municipality boundaries are not verified in this
                            review. Check the road location before confirming;
                            saved coordinates will remain exactly as stored.
                        </p>
                        <p className="text-sm">
                            One new AuditLog entry will record this transition.
                            Existing historical AuditLog entries will not be
                            changed. Existing maintenance records, creators,
                            uploaders and private files will be preserved. No
                            notifications will be sent for this transition.
                        </p>
                        <DialogFooter>
                            <button
                                type="button"
                                className={button}
                                disabled={busy}
                                onClick={onClose}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={`${button} jr-primary text-white`}
                                disabled={busy || !review.can_confirm}
                                onClick={() => void confirm()}
                            >
                                {busy
                                    ? 'Confirming…'
                                    : 'Confirm Municipality Change'}
                            </button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

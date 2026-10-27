import { router } from '@inertiajs/react';
import { useState } from 'react';

type Manager = { id: number; first_name: string; last_name: string };
export default function DdManagingEngineerReassignment({
    record,
    managers,
}: {
    record: {
        id: number;
        managing_engineer_id: number;
        maintenance_year: number;
        quarter: string;
    };
    managers: Manager[];
}) {
    const [open, setOpen] = useState(false);
    const [choice, setChoice] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    return (
        <div className="mt-2 space-y-2">
            <button
                className="rounded border px-3 py-2"
                type="button"
                onClick={() => {
                    setOpen(!open);
                    setErrors({});
                    setChoice('');
                }}
            >
                Reassign manager
            </button>
            {open && (
                <form
                    aria-label={`Reassign ${record.maintenance_year} ${record.quarter}`}
                    className="space-y-2 rounded border p-3"
                    onSubmit={(e) => {
                        e.preventDefault();

                        if (
                            window.confirm(
                                'Confirm explicit reassignment? The former manager will lose editing access and the replacement must satisfy the current account and LGU rules.',
                            )
                        ) {
                            setBusy(true);
                            setErrors({});
                            router.post(
                                `/dd-phase3/ops/records/${record.id}/reassignment`,
                                {
                                    managing_engineer_id: choice,
                                    expected_current_manager_id:
                                        record.managing_engineer_id,
                                },
                                {
                                    preserveScroll: true,
                                    onError: setErrors,
                                    onSuccess: () => setOpen(false),
                                    onFinish: () => setBusy(false),
                                },
                            );
                        }
                    }}
                >
                    <p className="text-xs">
                        This changes the current manager only. Original creator
                        and existing updates/files are retained.
                    </p>
                    <label className="block text-sm">
                        Replacement ManagingEngineer
                        <select
                            className="mt-1 block max-w-full rounded border p-2"
                            required
                            value={choice}
                            onChange={(e) => setChoice(e.target.value)}
                        >
                            <option value="">Select eligible manager</option>
                            {managers
                                .filter(
                                    (m) => m.id !== record.managing_engineer_id,
                                )
                                .map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.first_name} {m.last_name}
                                    </option>
                                ))}
                        </select>
                    </label>
                    {Object.entries(errors).map(([field, error]) => (
                        <p role="alert" key={field}>
                            {error}
                        </p>
                    ))}
                    <button
                        className="rounded border px-3 py-2"
                        disabled={busy || !choice}
                    >
                        Confirm reassignment
                    </button>
                    <button
                        className="ml-2 rounded border px-3 py-2"
                        type="button"
                        disabled={busy}
                        onClick={() => setOpen(false)}
                    >
                        Cancel reassignment
                    </button>
                </form>
            )}
        </div>
    );
}

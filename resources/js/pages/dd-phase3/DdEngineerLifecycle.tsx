import { router } from '@inertiajs/react';
import { useState } from 'react';

type Engineer = {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    contact_no: string | null;
    rank: string;
    engineer_status: string;
};
export default function DdEngineerLifecycle({
    engineers,
}: {
    engineers: Engineer[];
}) {
    const [selected, setSelected] = useState<Engineer | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const options = {
        preserveScroll: true,
        onError: setErrors,
        onFinish: () => setBusy(false),
    };

    return (
        <section
            className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
            aria-label="Engineer profile lifecycle"
        >
            <h2 className="text-lg font-semibold">Edit or retire Engineer</h2>
            <p className="text-sm text-slate-600">
                Rank is professional information. Retirement retains history and
                deactivates the linked account and active LGU assignments.
            </p>
            <label className="block text-sm">
                Engineer profile
                <select
                    className="mt-1 block rounded border p-2"
                    value={selected?.id ?? ''}
                    onChange={(e) => {
                        setSelected(
                            engineers.find(
                                (x) => x.id === Number(e.target.value),
                            ) ?? null,
                        );
                        setErrors({});
                        setNotice('');
                    }}
                >
                    <option value="">Select Engineer</option>
                    {engineers.map((e) => (
                        <option key={e.id} value={e.id}>
                            {e.first_name} {e.last_name} · {e.engineer_status}
                        </option>
                    ))}
                </select>
            </label>
            {selected && (
                <form
                    className="grid gap-3 sm:grid-cols-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        setBusy(true);
                        setErrors({});
                        router.put(
                            `/dd-phase3/engineers/${selected.id}`,
                            {
                                first_name: selected.first_name,
                                middle_name: selected.middle_name,
                                last_name: selected.last_name,
                                contact_no: selected.contact_no,
                                rank: selected.rank,
                            },
                            {
                                ...options,
                                onSuccess: () =>
                                    setNotice('Engineer profile saved.'),
                            },
                        );
                    }}
                >
                    {(
                        [
                            'first_name',
                            'middle_name',
                            'last_name',
                            'contact_no',
                            'rank',
                        ] as const
                    ).map((field) => (
                        <label className="text-sm" key={field}>
                            {
                                {
                                    first_name: 'First name',
                                    middle_name: 'Middle name',
                                    last_name: 'Last name',
                                    contact_no: 'Contact number',
                                    rank: 'Rank',
                                }[field]
                            }
                            <input
                                className="mt-1 block w-full rounded border p-2"
                                required={field !== 'middle_name'}
                                maxLength={field === 'contact_no' ? 30 : 100}
                                value={selected[field] ?? ''}
                                onChange={(e) =>
                                    setSelected({
                                        ...selected,
                                        [field]: e.target.value,
                                    })
                                }
                            />
                            {errors[field] && (
                                <span role="alert">{errors[field]}</span>
                            )}
                        </label>
                    ))}
                    <div className="flex gap-3 sm:col-span-2">
                        <button
                            disabled={busy}
                            className="rounded border px-3 py-2"
                        >
                            Save profile
                        </button>
                        <button
                            type="button"
                            disabled={
                                busy || selected.engineer_status === 'Retired'
                            }
                            className="rounded border border-red-300 px-3 py-2"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        'Retire this Engineer? Their linked account and active LGU assignments will be deactivated. Existing maintenance history and uploaded records will be retained.',
                                    )
                                ) {
                                    setBusy(true);
                                    setErrors({});
                                    router.post(
                                        `/dd-phase3/engineers/${selected.id}/retirement`,
                                        {},
                                        {
                                            ...options,
                                            onSuccess: () => {
                                                setSelected(null);
                                                setNotice('Engineer retired.');
                                            },
                                        },
                                    );
                                }
                            }}
                        >
                            Retire Engineer
                        </button>
                    </div>
                </form>
            )}
            {errors.retirement && <p role="alert">{errors.retirement}</p>}
            {errors.is_active && <p role="alert">{errors.is_active}</p>}
            {notice && <p role="status">{notice}</p>}
        </section>
    );
}

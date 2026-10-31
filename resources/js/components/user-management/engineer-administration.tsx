import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Engineer, EngineerLgu, Lgu } from './user-management-page';

const field =
    'w-full rounded-xl border border-[#DFE6EF] bg-white px-3 py-2.5 text-sm text-[#18263A] outline-none focus:border-[#B56C3B] focus:ring-2 focus:ring-[#F4E5D7]';
const primary =
    'rounded-xl bg-[#90451F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const secondary =
    'rounded-xl border border-[#DFE6EF] px-4 py-2.5 text-sm font-medium text-[#435773] disabled:opacity-50';
const error = (message?: string) =>
    message ? (
        <p role="alert" className="mt-1 text-xs text-red-700">
            {message}
        </p>
    ) : null;

const initialEngineer = () => ({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    contact_no: '',
    rank: '',
    position: '',
    lgus_id: '',
    engineer_status: 'Active',
});

type EngineerForm = ReturnType<typeof initialEngineer>;

export function EngineerDialog({
    engineer,
    lgus,
    onClose,
}: {
    engineer: Engineer | null;
    lgus: Lgu[];
    onClose: () => void;
}) {
    const [form, setForm] = useState<EngineerForm>(() =>
        engineer
            ? {
                  first_name: engineer.first_name,
                  middle_name: engineer.middle_name ?? '',
                  last_name: engineer.last_name,
                  email: engineer.email,
                  contact_no: engineer.contact_no ?? '',
                  rank: engineer.rank ?? '',
                  position: engineer.position ?? '',
                  lgus_id: String(engineer.lgus_id),
                  engineer_status: engineer.engineer_status,
              }
            : initialEngineer(),
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const update = (name: keyof EngineerForm, value: string) =>
        setForm((old) => ({ ...old, [name]: value }));

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (busy) {
            return;
        }

        setBusy(true);
        setErrors({});
        const opts = {
            preserveScroll: true,
            onSuccess: () => onClose(),
            onError: (issues: Record<string, string>) => setErrors(issues),
            onFinish: () => setBusy(false),
        };

        if (engineer) {
            // Primary LGU must not be edited here; use the assignment tab.
            const profile = {
                first_name: form.first_name,
                middle_name: form.middle_name,
                last_name: form.last_name,
                email: form.email,
                contact_no: form.contact_no,
                rank: form.rank,
                position: form.position,
                engineer_status: form.engineer_status,
            };
            router.patch(
                `/user-management/engineers/${engineer.id}`,
                profile,
                opts,
            );
        } else {
            router.post(
                '/user-management/engineers',
                { ...form, lgus_id: Number(form.lgus_id) },
                opts,
            );
        }
    };

    return (
        <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#18283F]/50 p-4"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label={engineer ? 'Edit Engineer' : 'Add Engineer'}
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[22px] bg-white shadow-2xl"
            >
                <div className="border-b border-[#E8EDF4] px-6 py-5">
                    <h2 className="text-xl font-bold text-[#16253A]">
                        {engineer ? 'Edit Engineer' : 'Add Engineer'}
                    </h2>
                    <p className="mt-1 text-sm text-[#6A7D96]">
                        {engineer
                            ? 'Update the Engineer profile without changing account roles or LGU assignments.'
                            : 'Create an Engineer identity and one active LGU assignment. Login accounts are created separately.'}
                    </p>
                </div>
                <form
                    onSubmit={submit}
                    className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2"
                >
                    {(
                        [
                            ['first_name', 'First name'],
                            ['middle_name', 'Middle name'],
                            ['last_name', 'Last name'],
                            [
                                'email',
                                'Legacy Engineer email (required by deployed schema)',
                            ],
                            [
                                'contact_no',
                                'Contact number (local or international)',
                            ],
                            ['rank', 'Rank'],
                            ['position', 'Position'],
                        ] as const
                    ).map(([name, title]) => (
                        <div key={name}>
                            <label
                                className="mb-1 block text-sm font-semibold text-[#2A3C53]"
                                htmlFor={`engineer-${name}`}
                            >
                                {title} *
                            </label>
                            <input
                                id={`engineer-${name}`}
                                className={field}
                                required
                                maxLength={
                                    name === 'contact_no'
                                        ? 30
                                        : [
                                                'first_name',
                                                'last_name',
                                                'rank',
                                            ].includes(name)
                                          ? 100
                                          : 255
                                }
                                type={name === 'email' ? 'email' : 'text'}
                                inputMode={
                                    name === 'contact_no' ? 'tel' : undefined
                                }
                                placeholder={
                                    name === 'middle_name'
                                        ? 'N/A if none'
                                        : undefined
                                }
                                value={form[name]}
                                onChange={(event) =>
                                    update(name, event.target.value)
                                }
                            />
                            {error(errors[name])}
                        </div>
                    ))}
                    {engineer && (
                        <div>
                            <label
                                className="mb-1 block text-sm font-semibold text-[#2A3C53]"
                                htmlFor="engineer-status"
                            >
                                Engineer status *
                            </label>
                            <select
                                id="engineer-status"
                                className={field}
                                value={form.engineer_status}
                                onChange={(event) =>
                                    update(
                                        'engineer_status',
                                        event.target.value,
                                    )
                                }
                            >
                                <option
                                    value="Active"
                                    disabled={
                                        engineer.engineer_status === 'Retired'
                                    }
                                >
                                    Active
                                </option>
                                <option value="Retired">Retired</option>
                            </select>
                            {error(errors.engineer_status)}
                            <p className="mt-1 text-xs text-[#6A7D96]">
                                Retirement requires all LGU assignments inactive
                                and any linked login account already
                                deactivated. Retirement never deletes history.
                            </p>
                        </div>
                    )}
                    {!engineer && (
                        <div>
                            <label
                                className="mb-1 block text-sm font-semibold text-[#2A3C53]"
                                htmlFor="engineer-lgu"
                            >
                                Initial LGU *
                            </label>
                            <select
                                required
                                id="engineer-lgu"
                                className={field}
                                value={form.lgus_id}
                                onChange={(event) =>
                                    update('lgus_id', event.target.value)
                                }
                            >
                                <option value="">Select LGU</option>
                                {lgus.map((lgu) => (
                                    <option key={lgu.id} value={lgu.id}>
                                        {lgu.municipality_name}
                                    </option>
                                ))}
                            </select>
                            {error(errors.lgus_id)}
                        </div>
                    )}
                    <p className="rounded-xl bg-[#F6F8FB] p-3 text-xs leading-5 text-[#62768F] sm:col-span-2">
                        The original primary-LGU reference remains intact for
                        compatibility. Use LGU Assignments to add or deactivate
                        other assignments. Legacy email, position, middle name,
                        and primary LGU are retained only because the deployed
                        schema still requires them. The final Data Dictionary
                        assigns login email to UserAccount and LGUs through
                        EngineerLGU. New Engineers start Active.
                    </p>
                    <div className="flex justify-end gap-2 sm:col-span-2">
                        <button
                            type="button"
                            className={secondary}
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={primary}
                            disabled={busy || (!engineer && !lgus.length)}
                        >
                            {busy
                                ? 'Saving…'
                                : engineer
                                  ? 'Save Engineer'
                                  : 'Add Engineer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function AssignmentDialog({
    engineers,
    lgus,
    onClose,
}: {
    engineers: Engineer[];
    lgus: Lgu[];
    onClose: () => void;
}) {
    const [engineerId, setEngineerId] = useState('');
    const [lguId, setLguId] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (busy) {
            return;
        }

        setBusy(true);
        setErrors({});
        router.post(
            '/user-management/assignments',
            { engineers_id: Number(engineerId), lgus_id: Number(lguId) },
            {
                preserveScroll: true,
                onSuccess: onClose,
                onError: (issues) => setErrors(issues),
                onFinish: () => setBusy(false),
            },
        );
    };

    return (
        <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#18283F]/50 p-4"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Assign Engineer to LGU"
                className="w-full max-w-lg rounded-[22px] bg-white p-6 shadow-2xl"
            >
                <h2 className="text-xl font-bold text-[#16253A]">
                    Assign Engineer to LGU
                </h2>
                <p className="mt-1 text-sm text-[#6A7D96]">
                    An existing inactive pair will be reactivated; duplicate
                    active pairs are blocked.
                </p>
                <form className="mt-5 space-y-4" onSubmit={submit}>
                    <div>
                        <label
                            htmlFor="assignment-engineer"
                            className="mb-1 block text-sm font-semibold"
                        >
                            Engineer *
                        </label>
                        <select
                            required
                            id="assignment-engineer"
                            className={field}
                            value={engineerId}
                            onChange={(event) =>
                                setEngineerId(event.target.value)
                            }
                        >
                            <option value="">Select Engineer</option>
                            {engineers
                                .filter((e) => e.engineer_status === 'Active')
                                .map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.first_name} {e.last_name} (#{e.id})
                                    </option>
                                ))}
                        </select>
                        {error(errors.engineers_id)}
                    </div>
                    <div>
                        <label
                            htmlFor="assignment-lgu"
                            className="mb-1 block text-sm font-semibold"
                        >
                            LGU *
                        </label>
                        <select
                            required
                            id="assignment-lgu"
                            className={field}
                            value={lguId}
                            onChange={(event) => setLguId(event.target.value)}
                        >
                            <option value="">Select LGU</option>
                            {lgus.map((lgu) => (
                                <option key={lgu.id} value={lgu.id}>
                                    {lgu.municipality_name}
                                </option>
                            ))}
                        </select>
                        {error(errors.lgus_id)}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            className={secondary}
                            type="button"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            className={primary}
                            type="submit"
                            disabled={busy || !engineers.length || !lgus.length}
                        >
                            {busy ? 'Saving…' : 'Save Assignment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function AssignmentStatusDialog({
    assignment,
    engineerName,
    lguName,
    engineerIsActive,
    onClose,
}: {
    assignment: EngineerLgu;
    engineerName: string;
    lguName: string;
    engineerIsActive: boolean;
    onClose: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const becomingActive = !assignment.is_active;
    const submit = () => {
        if (busy || (becomingActive && !engineerIsActive)) {
            return;
        }

        setBusy(true);
        setMessage(null);
        router.patch(
            `/user-management/assignments/${assignment.engineers_id}/${assignment.lgus_id}`,
            { is_active: becomingActive },
            {
                preserveScroll: true,
                onSuccess: onClose,
                onError: (issues) =>
                    setMessage(
                        Object.values(issues).join(' ') ||
                            'Unable to update assignment.',
                    ),
                onFinish: () => setBusy(false),
            },
        );
    };

    return (
        <div
            role="presentation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#18283F]/50 p-4"
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-label="Confirm LGU assignment change"
                className="w-full max-w-md rounded-[22px] bg-white p-6 shadow-2xl"
            >
                <h2 className="text-xl font-bold text-[#16253A]">
                    {becomingActive ? 'Activate' : 'Deactivate'} assignment?
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#617590]">
                    {engineerName} — {lguName}
                </p>
                {becomingActive && !engineerIsActive && (
                    <p role="alert" className="mt-2 text-sm text-red-700">
                        Retired Engineers cannot receive active assignments.
                    </p>
                )}
                {!becomingActive && (
                    <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                        Deactivating this pair immediately removes Engineer
                        authorization for the LGU. Historical records are
                        preserved.
                    </p>
                )}
                {message && (
                    <p role="alert" className="mt-3 text-sm text-red-700">
                        {message}
                    </p>
                )}
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        disabled={busy}
                        className={secondary}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={busy || (becomingActive && !engineerIsActive)}
                        className={primary}
                        onClick={submit}
                    >
                        {busy
                            ? 'Saving…'
                            : becomingActive
                              ? 'Activate'
                              : 'Deactivate'}
                    </button>
                </div>
            </div>
        </div>
    );
}

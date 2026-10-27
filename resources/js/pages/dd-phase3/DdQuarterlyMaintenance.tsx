import { router } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';
type Maintenance = {
    id: number;
    project_id: number;
    managing_engineer_id: number;
    maintenance_year: number;
    quarter: Quarter;
    start_date: string;
    estimated_duration_days: number;
    complete_date: string | null;
    status: 'Ongoing' | 'Completed';
    description: string | null;
    manager_first_name: string;
    manager_last_name: string;
};
export type QuarterlyProps = {
    project: { id: number; project_title: string };
    records: Maintenance[];
    schedule: {
        conflict: boolean;
        years: {
            year: number;
            quarters: Quarter[];
            available: Quarter[];
        }[];
    } | null;
    managers: {
        id: number;
        first_name: string;
        last_name: string;
        rank?: string;
    }[];
    canCreate: boolean;
    canManage: boolean;
    canEdit: boolean;
    engineerId: number | null;
};
type Form = {
    project_id: string;
    managing_engineer_id: string;
    maintenance_year: string;
    quarter: Quarter;
    start_date: string;
    estimated_duration_days: string;
    complete_date: string;
    status: '' | 'Ongoing' | 'Completed';
    description: string;
};
const input =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100';
const button =
    'rounded-lg bg-[#90451f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const secondary = 'rounded-lg border border-slate-300 px-3 py-2 text-sm';
function suggestedDate(year: number, quarter: Quarter) {
    const month = (Number(quarter[1]) - 1) * 3 + 1;
    const today = new Date();

    return today.getFullYear() === year &&
        Math.ceil((today.getMonth() + 1) / 3) === Number(quarter[1])
        ? `${year}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        : `${year}-${String(month).padStart(2, '0')}-01`;
}

export default function DdQuarterlyMaintenance({
    project,
    records,
    schedule,
    managers,
    canCreate,
    canManage,
    canEdit,
    engineerId,
}: QuarterlyProps) {
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [form, setForm] = useState<Form | null>(null);
    const [editing, setEditing] = useState<number | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const quarters: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
    const selected = records.filter(
        (record) => record.maintenance_year === Number(year),
    );
    const editable = (record: Maintenance) =>
        canManage || (canEdit && record.managing_engineer_id === engineerId);
    function prepare(quarter: Quarter, intendedYear = Number(year)) {
        setYear(String(intendedYear));
        setEditing(null);
        setErrors({});
        setForm({
            project_id: String(project.id),
            managing_engineer_id:
                managers.length === 1 ? String(managers[0].id) : '',
            maintenance_year: String(intendedYear),
            quarter,
            start_date: suggestedDate(intendedYear, quarter),
            estimated_duration_days: '',
            complete_date: '',
            status: '',
            description: '',
        });
    }
    function edit(record: Maintenance) {
        setEditing(record.id);
        setErrors({});
        setForm({
            project_id: String(project.id),
            managing_engineer_id: String(record.managing_engineer_id),
            maintenance_year: String(record.maintenance_year),
            quarter: record.quarter,
            start_date: record.start_date,
            estimated_duration_days: String(record.estimated_duration_days),
            complete_date: record.complete_date ?? '',
            status: record.status,
            description: record.description ?? '',
        });
    }
    function save(event: FormEvent) {
        event.preventDefault();

        if (!form) {
            return;
        }

        setBusy(true);
        setErrors({});
        router.visit(`/dd-phase3/ops/records${editing ? `/${editing}` : ''}`, {
            method: editing ? 'put' : 'post',
            data: form,
            preserveScroll: true,
            preserveState: true,
            onError: setErrors,
            onSuccess: () => {
                setForm(null);
                setEditing(null);
            },
            onFinish: () => setBusy(false),
        });
    }
    const error = (key: string) =>
        errors[key] ? (
            <span className="block text-sm text-red-700">{errors[key]}</span>
        ) : null;

    return (
        <ProjectWorkspace>
            <section
                className="jr-form-section space-y-5"
                aria-labelledby="quarterly-title"
            >
                <h2 id="quarterly-title" className="text-xl font-semibold">
                    Quarterly maintenance · {project.project_title}
                </h2>
                <p className="text-sm text-slate-600">
                    Each quarterly record has its own ManagingEngineer. This
                    project can exist without any maintenance records.
                </p>
                {schedule?.conflict && (
                    <p
                        role="alert"
                        className="rounded-lg bg-amber-50 p-4 text-amber-900"
                    >
                        Historical duplicate or invalid periods need
                        administrator review. Existing records are preserved.
                        Other available quarters can still be recorded.
                    </p>
                )}
                <p className="font-medium">
                    {records.length === 0
                        ? 'No quarterly records recorded yet.'
                        : 'Choose any available quarter for the selected year.'}
                </p>
                <p className="text-sm text-slate-500">
                    Q1, Q2, Q3 and Q4 are available independently. Record actual
                    maintenance; no future activity is created automatically.
                    Each project can have only one record per year and quarter.
                </p>
                <div className="flex flex-wrap items-end gap-4">
                    <label className="text-sm font-medium">
                        Active maintenance year
                        <input
                            aria-label="Active maintenance year"
                            type="number"
                            min="1900"
                            max="2100"
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            className={input}
                        />
                    </label>
                </div>
                <div className="flex flex-wrap gap-2">
                    {schedule?.years.map((annual) => (
                        <button
                            key={annual.year}
                            className={secondary}
                            onClick={() => setYear(String(annual.year))}
                        >
                            {annual.year} · {annual.quarters.length} record(s)
                        </button>
                    ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {quarters.map((quarter) => {
                        const recorded = selected.filter(
                            (item) => item.quarter === quarter,
                        );

                        return (
                            <div
                                key={quarter}
                                className="rounded-xl border border-slate-200 p-4"
                            >
                                <h3 className="font-semibold">
                                    {year} {quarter}
                                </h3>
                                {recorded.length > 0 ? (
                                    recorded.map((record) => (
                                        <p key={record.id}>
                                            {record.status} ·{' '}
                                            {record.manager_first_name}{' '}
                                            {record.manager_last_name}
                                        </p>
                                    ))
                                ) : (
                                    <>
                                        <p className="my-2 text-sm text-slate-600">
                                            Available quarter · no activity
                                            recorded
                                        </p>
                                        {canCreate && (
                                            <button
                                                className={secondary}
                                                disabled={
                                                    !/^\d{4}$/.test(year) ||
                                                    Number(year) < 1900 ||
                                                    Number(year) > 2100
                                                }
                                                onClick={() => prepare(quarter)}
                                            >
                                                Create {quarter} record
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
                {form && (
                    <form
                        onSubmit={save}
                        className="space-y-4 rounded-xl border border-slate-200 p-5"
                    >
                        <h3 className="font-semibold">
                            {editing
                                ? 'Edit maintenance details'
                                : 'Create maintenance record'}{' '}
                            · {form.maintenance_year} {form.quarter}
                        </h3>
                        <p className="text-sm text-slate-500">
                            Project, period and ManagingEngineer remain fixed
                            after creation.
                        </p>
                        {Object.keys(errors).length > 0 && (
                            <p role="alert" className="text-red-700">
                                {Object.values(errors)[0]}
                            </p>
                        )}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <label className="text-sm font-medium">
                                ManagingEngineer
                                <select
                                    className={input}
                                    required
                                    disabled={editing !== null}
                                    value={form.managing_engineer_id}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            managing_engineer_id:
                                                e.target.value,
                                        })
                                    }
                                >
                                    <option value="">
                                        Choose an eligible manager
                                    </option>
                                    {editing ? (
                                        <option
                                            value={form.managing_engineer_id}
                                        >
                                            {
                                                records.find(
                                                    (r) => r.id === editing,
                                                )?.manager_first_name
                                            }{' '}
                                            {
                                                records.find(
                                                    (r) => r.id === editing,
                                                )?.manager_last_name
                                            }
                                        </option>
                                    ) : (
                                        managers.map((manager) => (
                                            <option
                                                key={manager.id}
                                                value={manager.id}
                                            >
                                                {manager.first_name}{' '}
                                                {manager.last_name} ·{' '}
                                                {manager.rank ?? 'Engineer'}
                                            </option>
                                        ))
                                    )}
                                </select>
                                {error('managing_engineer_id')}
                                {!editing && managers.length === 0 && (
                                    <span className="text-sm text-amber-800">
                                        No eligible manager for this
                                        municipality. An active account, profile
                                        and LGU assignment are required.
                                    </span>
                                )}
                            </label>
                            <label className="text-sm font-medium">
                                Actual start date
                                <input
                                    className={input}
                                    type="date"
                                    required
                                    value={form.start_date}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            start_date: e.target.value,
                                        })
                                    }
                                />
                                {error('start_date')}
                            </label>
                            <label className="text-sm font-medium">
                                Estimated duration (days)
                                <input
                                    className={input}
                                    type="number"
                                    min="1"
                                    step="1"
                                    required
                                    value={form.estimated_duration_days}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            estimated_duration_days:
                                                e.target.value,
                                        })
                                    }
                                />
                                {error('estimated_duration_days')}
                            </label>
                            <label className="text-sm font-medium">
                                Maintenance status
                                <select
                                    className={input}
                                    required
                                    value={form.status}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            status: e.target
                                                .value as Form['status'],
                                            complete_date:
                                                e.target.value === 'Completed'
                                                    ? form.complete_date
                                                    : '',
                                        })
                                    }
                                >
                                    <option value="">
                                        Choose actual activity status
                                    </option>
                                    <option>Ongoing</option>
                                    <option>Completed</option>
                                </select>
                                {error('status')}
                            </label>
                            {form.status === 'Completed' && (
                                <label className="text-sm font-medium">
                                    Completion date
                                    <input
                                        className={input}
                                        type="date"
                                        min={form.start_date}
                                        required
                                        value={form.complete_date}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                complete_date: e.target.value,
                                            })
                                        }
                                    />
                                    {error('complete_date')}
                                </label>
                            )}
                            <label className="text-sm font-medium">
                                Description
                                <textarea
                                    className={input}
                                    value={form.description}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            description: e.target.value,
                                        })
                                    }
                                />
                                {error('description')}
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <button
                                disabled={
                                    busy || (!editing && managers.length === 0)
                                }
                                className={button}
                            >
                                {busy ? 'Saving…' : 'Save maintenance record'}
                            </button>
                            <button
                                type="button"
                                className={secondary}
                                onClick={() => setForm(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <caption className="py-3 text-left font-semibold">
                            Maintenance history · {year}
                        </caption>
                        <thead>
                            <tr>
                                <th className="p-2">Period</th>
                                <th className="p-2">ManagingEngineer</th>
                                <th className="p-2">Status</th>
                                <th className="p-2">Actual start</th>
                                <th className="p-2">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selected.map((record) => (
                                <tr key={record.id} className="border-t">
                                    <td className="p-2">
                                        {record.maintenance_year}{' '}
                                        {record.quarter}
                                    </td>
                                    <td className="p-2">
                                        {record.manager_first_name}{' '}
                                        {record.manager_last_name}
                                    </td>
                                    <td className="p-2">{record.status}</td>
                                    <td className="p-2">{record.start_date}</td>
                                    <td className="space-x-2 p-2">
                                        {editable(record) && (
                                            <button
                                                className={secondary}
                                                onClick={() => edit(record)}
                                            >
                                                Edit details
                                            </button>
                                        )}
                                        {canManage && (
                                            <button
                                                className={secondary}
                                                onClick={() => {
                                                    if (
                                                        window.confirm(
                                                            'Delete this maintenance record? Existing dependencies may prevent deletion.',
                                                        )
                                                    ) {
                                                        router.delete(
                                                            `/dd-phase3/ops/records/${record.id}`,
                                                            {
                                                                preserveScroll: true,
                                                                onError:
                                                                    setErrors,
                                                            },
                                                        );
                                                    }
                                                }}
                                            >
                                                Delete
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {selected.length === 0 && (
                        <p className="p-3 text-sm text-slate-500">
                            No maintenance recorded for this year.
                        </p>
                    )}
                </div>
            </section>
        </ProjectWorkspace>
    );
}

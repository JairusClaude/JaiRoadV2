import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

export type Milestone = {
    id: number;
    title: string;
    planned_date: string;
    completed_date: string | null;
    status: 'planned' | 'completed' | 'cancelled';
    version: number;
};

function MilestoneForm({ item, url }: { item?: Milestone; url: string }) {
    const form = useForm({
        title: item?.title ?? '',
        planned_date: item?.planned_date ?? '',
        completed_date: item?.completed_date ?? '',
        status: item?.status ?? 'planned',
        ...(item ? { version: item.version } : {}),
    });

    return (
        <form
            className="mt-3 grid gap-3 rounded-lg border p-3"
            onSubmit={(event) => {
                event.preventDefault();

                if (item) {
                    form.put(url + '/' + item.id, { preserveScroll: true });
                } else {
                    form.post(url, {
                        preserveScroll: true,
                        onSuccess: () => form.reset(),
                    });
                }
            }}
        >
            <label className="grid gap-1 text-sm">
                Milestone title
                <input
                    required
                    maxLength={160}
                    className="rounded-lg border p-2"
                    value={form.data.title}
                    onChange={(event) =>
                        form.setData('title', event.target.value)
                    }
                />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid min-w-0 gap-1 text-sm">
                    Planned date
                    <input
                        required
                        type="date"
                        className="min-w-0 rounded-lg border p-2"
                        value={form.data.planned_date}
                        onChange={(event) =>
                            form.setData('planned_date', event.target.value)
                        }
                    />
                </label>
                <label className="grid gap-1 text-sm">
                    Status
                    <select
                        className="rounded-lg border p-2"
                        value={form.data.status}
                        onChange={(event) =>
                            form.setData({
                                ...form.data,
                                status: event.target
                                    .value as Milestone['status'],
                                completed_date:
                                    event.target.value === 'completed'
                                        ? form.data.completed_date
                                        : '',
                            })
                        }
                    >
                        <option value="planned">Planned</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </label>
            </div>
            {form.data.status === 'completed' && (
                <label className="grid gap-1 text-sm">
                    Completed date
                    <input
                        required
                        type="date"
                        className="rounded-lg border p-2"
                        value={form.data.completed_date}
                        onChange={(event) =>
                            form.setData('completed_date', event.target.value)
                        }
                    />
                </label>
            )}
            {Object.values(form.errors).length > 0 && (
                <p role="alert" className="text-sm text-red-700">
                    {Object.values(form.errors).join(' ')}
                </p>
            )}
            <Button type="submit" disabled={form.processing}>
                {item ? 'Save milestone' : 'Add milestone'}
            </Button>
        </form>
    );
}

export function RecordMilestones({
    milestones,
    writable,
    url,
}: {
    milestones: Milestone[];
    writable: boolean;
    url: string;
}) {
    return (
        <section className="jr-detail-section" aria-label="Custom milestones">
            <h2>Custom milestones</h2>
            <p className="jr-field-hint">
                Planned dates and recorded completion. Cancelled milestones
                remain in history.
            </p>
            {milestones.length === 0 && <p>No custom milestones recorded.</p>}
            <ul className="mt-3 space-y-3">
                {milestones.map((item) => (
                    <li key={item.id} className="rounded-lg border p-3">
                        <strong className="break-words">{item.title}</strong>
                        <p className="text-sm">
                            {item.status} · planned {item.planned_date}
                        </p>
                        {item.completed_date && (
                            <p className="text-sm">
                                Completed {item.completed_date}
                            </p>
                        )}
                        {writable && (
                            <details>
                                <summary className="cursor-pointer text-sm">
                                    Edit milestone
                                </summary>
                                <MilestoneForm
                                    key={item.version}
                                    item={item}
                                    url={url}
                                />
                            </details>
                        )}
                    </li>
                ))}
            </ul>
            {writable && milestones.length < 100 && <MilestoneForm url={url} />}
        </section>
    );
}

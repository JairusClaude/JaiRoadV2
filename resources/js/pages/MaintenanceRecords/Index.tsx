import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import type { FormEvent } from 'react';

type Engineer = {
    id: number;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
};
type Project = { id: number; project_title: string };
type RecordRow = {
    id: number;
    maintenance_year: number;
    quarter: string;
    status: string;
    start_date: string | null;
    complete_date: string | null;
    estimated_duration_days: number | null;
    description: string | null;
    maintenanceProject?: Project | null;
    managingEngineer?: Engineer | null;
};
type PageLink = { url: string | null; label: string; active: boolean };
type RecordsPage = {
    data: RecordRow[];
    current_page: number;
    last_page: number;
    total: number;
    links: PageLink[];
};
type Props = {
    model: RecordsPage;
    queryParams?: Record<string, string | number | undefined>;
};

function engineerName(value?: Engineer | null): string {
    if (!value) {
        return 'Unassigned';
    }

    return [value.first_name, value.middle_name, value.last_name]
        .filter(Boolean)
        .join(' ');
}

function pageLabel(label: string): string {
    return label
        .replace(/&laquo;/g, '«')
        .replace(/&raquo;/g, '»')
        .replace(/&amp;/g, '&');
}

function textDate(value?: string | null): string {
    if (!value) {
        return '—';
    }

    return value.slice(0, 10);
}

export default function MaintenanceRecordIndex({
    model,
    queryParams = {},
}: Props) {
    const [search, setSearch] = useState(String(queryParams.search ?? ''));
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.get(
            '/maintenance-records',
            search.trim() ? { search: search.trim() } : {},
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    return (
        <>
            <Head title="Maintenance Records" />
            <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold tracking-[0.14em] text-amber-800 uppercase">
                            JaiROADS · Maintenance
                        </p>
                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                            Maintenance Records
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            View maintenance activity within your permitted
                            access. This screen is read-only.
                        </p>
                    </div>
                    <Link
                        href="/project-documents-preview"
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Project documents
                    </Link>
                </header>

                <form
                    onSubmit={submit}
                    className="flex flex-wrap items-end gap-3"
                    role="search"
                >
                    <label
                        htmlFor="maintenance-record-search"
                        className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium text-slate-700"
                    >
                        Search records
                        <input
                            id="maintenance-record-search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Project, year, quarter, status..."
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-700"
                        />
                    </label>
                    <button
                        type="submit"
                        className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-900"
                    >
                        Search
                    </button>
                </form>

                <section
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    aria-label="Maintenance record results"
                >
                    <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
                        {model.total} record{model.total === 1 ? '' : 's'} ·
                        Page {model.current_page} of {model.last_page}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                <tr>
                                    <th scope="col" className="px-4 py-3">
                                        Record
                                    </th>
                                    <th scope="col" className="px-4 py-3">
                                        Project
                                    </th>
                                    <th scope="col" className="px-4 py-3">
                                        Managing Engineer
                                    </th>
                                    <th scope="col" className="px-4 py-3">
                                        Period
                                    </th>
                                    <th scope="col" className="px-4 py-3">
                                        Status
                                    </th>
                                    <th scope="col" className="px-4 py-3">
                                        Started
                                    </th>
                                    <th scope="col" className="px-4 py-3">
                                        Completed
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                                {model.data.map((record) => (
                                    <tr key={record.id}>
                                        <td className="px-4 py-3 font-semibold whitespace-nowrap text-slate-900">
                                            #{record.id}
                                        </td>
                                        <td className="px-4 py-3">
                                            {record.maintenanceProject
                                                ?.project_title ?? '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {engineerName(
                                                record.managingEngineer,
                                            )}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {record.maintenance_year} ·{' '}
                                            {record.quarter}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {record.status}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {textDate(record.start_date)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {textDate(record.complete_date)}
                                        </td>
                                    </tr>
                                ))}
                                {model.data.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-12 text-center text-slate-500"
                                        >
                                            No maintenance records match this
                                            search.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {model.links.length > 0 && (
                        <nav
                            className="flex flex-wrap gap-2 border-t border-slate-200 px-4 py-3"
                            aria-label="Pagination"
                        >
                            {model.links.map((link, index) =>
                                link.url ? (
                                    <Link
                                        key={index}
                                        href={link.url}
                                        preserveScroll
                                        className={`rounded-md border px-3 py-1.5 text-xs font-medium ${link.active ? 'border-amber-800 bg-amber-800 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {pageLabel(link.label)}
                                    </Link>
                                ) : (
                                    <span
                                        key={index}
                                        className="rounded-md border border-slate-100 px-3 py-1.5 text-xs text-slate-400"
                                    >
                                        {pageLabel(link.label)}
                                    </span>
                                ),
                            )}
                        </nav>
                    )}
                </section>
                <p className="text-xs text-slate-500">
                    Record creation and editing continue through existing
                    approved workflows. No write actions are exposed on this
                    screen.
                </p>
            </main>
        </>
    );
}

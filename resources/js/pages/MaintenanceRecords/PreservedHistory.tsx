import { Head, Link, router } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

type Record = {
    id: number;
    project_id: null;
    managing_engineer_id: number | null;
    manager_name: string | null;
    maintenance_year: number;
    quarter: string;
    status: string;
    start_date: string;
    estimated_duration_days: number;
    complete_date: string | null;
    description: string | null;
    created_by: number;
    previous_project_id: number;
    historical_context: {
        previous_project: { id: number; project_title: string };
        road: { id: number; road_name: string };
        lgu: { id: number; municipality_name: string };
    };
    detached_at: string;
    details_url: string;
};
type Page<T> = {
    data: T[];
    links: { url: string | null; label: string; active: boolean }[];
    total: number;
};
function Pagination<T>({ page }: { page: Page<T> }) {
    return (
        <nav
            aria-label="History pagination"
            className="my-4 flex flex-wrap gap-3"
        >
            {page.links.map((link, i) =>
                link.url ? (
                    <Link
                        key={i}
                        href={link.url}
                        aria-current={link.active ? 'page' : undefined}
                    >
                        {link.label.replace(/&laquo;|&raquo;/g, '')}
                    </Link>
                ) : (
                    <span key={i}>
                        {link.label.replace(/&laquo;|&raquo;/g, '')}
                    </span>
                ),
            )}
        </nav>
    );
}
export default function PreservedHistory({
    records,
    record,
    search = '',
    updates,
    documents,
    media,
}: {
    records: Page<Record> | null;
    record: Record | null;
    search?: string;
    updates?: Page<{
        id: number;
        update_month: string;
        progress_percentage: number;
        summary_of_text_reports: string | null;
        created_by: number;
    }>;
    documents?: Page<{
        id: number;
        document_title: string;
        file_name: string;
        uploaded_by: number;
    }>;
    media?: Page<{
        id: number;
        file_name: string;
        monthly_update_id: number;
        uploaded_by: number;
    }>;
}) {
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        router.get('/dd-phase3/history/records', {
            search: new FormData(event.currentTarget).get('search') as string,
        });
    };

    return (
        <div className="jr-theme">
            <Head title="Preserved project history" />
            <ProjectWorkspace>
                <Link
                    href="/dd-phase3/ui/maintenance-records"
                    className="underline"
                >
                    Maintenance Records
                </Link>
                <h1 className="my-4 text-2xl font-semibold">
                    Preserved project history
                </h1>
                <p>
                    Admin/SuperAdmin-only, read-only history. Current project
                    references are NULL. Historical context is separate and
                    grants no Engineer or Viewer access.
                </p>
                {records && (
                    <>
                        <form
                            onSubmit={submit}
                            className="my-4 flex flex-wrap gap-2"
                        >
                            <label>
                                Previous project{' '}
                                <input
                                    className="rounded border p-2"
                                    name="search"
                                    defaultValue={search}
                                />
                            </label>
                            <button
                                className="rounded border px-3"
                                type="submit"
                            >
                                Search history
                            </button>
                        </form>
                        <p>{records.total} retained records</p>
                        <ul className="space-y-3">
                            {records.data.map((r) => (
                                <li key={r.id} className="rounded border p-3">
                                    <Link
                                        className="underline"
                                        href={r.details_url}
                                    >
                                        MaintenanceRecord #{r.id} ·{' '}
                                        {r.maintenance_year} {r.quarter}
                                    </Link>
                                    <p>
                                        Current Project: NULL (Project deleted)
                                    </p>
                                    <p>
                                        Previously associated with Project #
                                        {r.previous_project_id}:{' '}
                                        {
                                            r.historical_context
                                                .previous_project.project_title
                                        }
                                    </p>
                                    <p>
                                        ManagingEngineer:{' '}
                                        {r.manager_name ?? 'NULL (unassigned)'}
                                    </p>
                                </li>
                            ))}
                        </ul>
                        <Pagination page={records} />
                    </>
                )}
                {record && (
                    <>
                        <h2 className="my-4 text-xl">
                            MaintenanceRecord #{record.id}
                        </h2>
                        <dl className="space-y-2">
                            <div>
                                <dt>Current Project</dt>
                                <dd>NULL (Project deleted)</dd>
                            </div>
                            <div>
                                <dt>Historical project</dt>
                                <dd>
                                    Previously associated with Project #
                                    {record.previous_project_id}:{' '}
                                    {
                                        record.historical_context
                                            .previous_project.project_title
                                    }
                                </dd>
                            </div>
                            <div>
                                <dt>Historical RoadCoverage</dt>
                                <dd>
                                    #{record.historical_context.road.id} ·{' '}
                                    {record.historical_context.road.road_name}
                                </dd>
                            </div>
                            <div>
                                <dt>Historical municipality</dt>
                                <dd>
                                    #{record.historical_context.lgu.id} ·{' '}
                                    {
                                        record.historical_context.lgu
                                            .municipality_name
                                    }
                                </dd>
                            </div>
                            <div>
                                <dt>Current ManagingEngineer</dt>
                                <dd>
                                    {record.manager_name ?? 'NULL (unassigned)'}
                                </dd>
                            </div>
                            <div>
                                <dt>Period / status</dt>
                                <dd>
                                    {record.maintenance_year} {record.quarter} ·{' '}
                                    {record.status}
                                </dd>
                            </div>
                            <div>
                                <dt>Start / estimated duration / completion</dt>
                                <dd>
                                    {record.start_date} ·{' '}
                                    {record.estimated_duration_days} days ·{' '}
                                    {record.complete_date ?? 'NULL'}
                                </dd>
                            </div>
                            <div>
                                <dt>Original creator</dt>
                                <dd>UserAccount #{record.created_by}</dd>
                            </div>
                        </dl>
                        {updates && (
                            <section>
                                <h2 className="my-4 text-xl">
                                    MonthlyUpdates ({updates.total})
                                </h2>
                                {updates.data.map((u) => (
                                    <article
                                        className="my-2 rounded border p-3"
                                        key={u.id}
                                    >
                                        <h3>
                                            #{u.id} · {u.update_month} ·{' '}
                                            {u.progress_percentage}%
                                        </h3>
                                        <p>
                                            {u.summary_of_text_reports ??
                                                'NULL'}
                                        </p>
                                        <p>
                                            Original creator: UserAccount #
                                            {u.created_by}
                                        </p>
                                    </article>
                                ))}
                                <Pagination page={updates} />
                            </section>
                        )}
                        {documents && (
                            <section>
                                <h2 className="my-4 text-xl">
                                    MaintenanceDocuments ({documents.total})
                                </h2>
                                {documents.data.map((d) => (
                                    <p key={d.id}>
                                        <a
                                            className="underline"
                                            href={`/dd-phase3/files/document/${d.id}`}
                                        >
                                            {d.document_title} · {d.file_name}
                                        </a>{' '}
                                        · Original uploader: UserAccount #
                                        {d.uploaded_by}
                                    </p>
                                ))}
                                <Pagination page={documents} />
                            </section>
                        )}
                        {media && (
                            <section>
                                <h2 className="my-4 text-xl">
                                    Media ({media.total})
                                </h2>
                                {media.data.map((m) => (
                                    <p key={m.id}>
                                        <a
                                            className="underline"
                                            href={`/dd-phase3/files/media/${m.id}`}
                                        >
                                            {m.file_name}
                                        </a>{' '}
                                        · MonthlyUpdate #{m.monthly_update_id} ·
                                        Original uploader: UserAccount #
                                        {m.uploaded_by}
                                    </p>
                                ))}
                                <Pagination page={media} />
                            </section>
                        )}
                    </>
                )}
            </ProjectWorkspace>
        </div>
    );
}

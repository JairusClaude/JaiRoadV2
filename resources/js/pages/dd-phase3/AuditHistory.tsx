import { Head, Link } from '@inertiajs/react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

type Event = {
    id: number;
    actor_identifier: string;
    action: string;
    entity_type: string;
    entity_id: number | null;
    description: string;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    recipient_user_id: number | null;
    notification_message: string | null;
    created_at: string;
};

export default function AuditHistory({
    events,
}: {
    events: {
        data: Event[];
        total: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
}) {
    return (
        <div className="jr-theme">
            <Head title="Permanent audit history" />
            <ProjectWorkspace>
                <h1 className="text-2xl font-bold">Permanent audit history</h1>
                <p className="my-3 text-sm">
                    Administrator-only, read-only history. {events.total}{' '}
                    retained entries. Historical notification copies and sign-in
                    entries are labeled and preserved. Payloads show only
                    approved safe business fields. Sign-in telemetry is no
                    longer collected here.
                </p>
                <Link href="/dashboard" className="underline">
                    Back to dashboard
                </Link>
                {events.data.length === 0 && (
                    <p className="my-5">No audit history yet.</p>
                )}
                <ol className="my-5 space-y-4">
                    {events.data.map((event) => (
                        <li
                            key={event.id}
                            className="rounded-xl border border-slate-200 p-4"
                        >
                            <h2 className="font-semibold">
                                #{event.id} · {event.action} ·{' '}
                                {event.entity_type}{' '}
                                {event.entity_id === null
                                    ? ''
                                    : `#${event.entity_id}`}
                            </h2>
                            <p className="text-sm">
                                {event.actor_identifier} · {event.created_at}
                            </p>
                            {event.recipient_user_id !== null && (
                                <p className="text-sm">
                                    Historical notification copy for account #
                                    {event.recipient_user_id}
                                </p>
                            )}
                            {event.notification_message !== null && (
                                <p className="text-sm">
                                    {event.notification_message}
                                </p>
                            )}
                            {(event.action === 'LOGIN' ||
                                event.action === 'LOGOUT') && (
                                <p className="text-sm">
                                    Historical authentication entry
                                </p>
                            )}
                            <p className="my-2 break-words">
                                {event.description}
                            </p>
                            <details>
                                <summary>Safe before / after values</summary>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div>
                                        <h3>Before</h3>
                                        <pre className="overflow-x-auto text-xs break-all whitespace-pre-wrap">
                                            {JSON.stringify(
                                                event.old_value,
                                                null,
                                                2,
                                            )}
                                        </pre>
                                    </div>
                                    <div>
                                        <h3>After</h3>
                                        <pre className="overflow-x-auto text-xs break-all whitespace-pre-wrap">
                                            {JSON.stringify(
                                                event.new_value,
                                                null,
                                                2,
                                            )}
                                        </pre>
                                    </div>
                                </div>
                            </details>
                        </li>
                    ))}
                </ol>
                <nav
                    aria-label="Audit history pagination"
                    className="my-5 flex flex-wrap gap-4"
                >
                    {events.links.map((link, index) =>
                        link.url ? (
                            <Link
                                key={index}
                                href={link.url}
                                aria-current={link.active ? 'page' : undefined}
                            >
                                {link.label.replace(/&laquo;|&raquo;/g, '')}
                            </Link>
                        ) : (
                            <span key={index}>
                                {link.label.replace(/&laquo;|&raquo;/g, '')}
                            </span>
                        ),
                    )}
                </nav>
            </ProjectWorkspace>
        </div>
    );
}

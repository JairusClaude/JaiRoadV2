import { Head, Link, router, usePage } from '@inertiajs/react';
import { Activity, LogIn, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

type Pagination = {
    links: { url: string | null; label: string; active: boolean }[];
    total: number;
};
type ActivityEvent = {
    id: number;
    user_id: number | null;
    actor_identifier: string;
    current_account_type: string | null;
    action: string;
    entity_type: string;
    entity_id: number | null;
    description: string;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    created_at: string;
    recipient_user_id: number | null;
    notification_message: string | null;
};
type AuthenticationEvent = {
    id: number;
    user_account_id: number | null;
    actor_identifier: string | null;
    account_type: string | null;
    attempted_identifier: string | null;
    event: string;
    outcome: string;
    method: string;
    client_description: string;
    created_at: string;
};
type OnlineAccount = {
    account_id: number;
    username: string;
    account_type: string;
    session_count: number;
    status: string;
    login_at: string | null;
    last_activity: string;
    client_description: string;
};
type Props = {
    events: Pagination & { data: ActivityEvent[] };
    authentication: Pagination & { data: AuthenticationEvent[] };
    filters: Record<string, string>;
    actions: string[];
    entities: string[];
    monitoring: {
        available: boolean;
        message: string;
        recent_failure_at: string | null;
    };
    presence: {
        available: boolean;
        message: string;
        window_seconds: number;
        total: number;
        accounts: OnlineAccount[];
    };
    summary: {
        system_activities: number;
        logins: number | null;
        failed_logins: number | null;
        online_accounts: number | null;
    };
};
const field =
    'mt-1 block w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
const button =
    'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50';
function time(value: string | null) {
    return value === null
        ? 'Not recorded'
        : new Intl.DateTimeFormat('en-PH', {
              timeZone: 'Asia/Manila',
              dateStyle: 'medium',
              timeStyle: 'medium',
          }).format(new Date(value));
}
function value(data: unknown): string {
    return data === null || data === undefined
        ? 'Empty'
        : typeof data === 'object'
          ? JSON.stringify(data)
          : String(data);
}
function Badge({ action }: { action: string }) {
    return (
        <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${['DELETE', 'FAILED_LOGIN', 'DEACTIVATE', 'RETIRE'].includes(action) ? 'bg-rose-50 text-rose-800' : ['CREATE', 'LOGIN', 'ACTIVATE'].includes(action) ? 'bg-emerald-50 text-emerald-800' : 'bg-sky-50 text-sky-800'}`}
        >
            {action.replaceAll('_', ' ')}
        </span>
    );
}
function Table({
    title,
    headers,
    children,
}: {
    title: string;
    headers: string[];
    children: ReactNode;
}) {
    return (
        <div
            className="max-w-full overflow-x-auto rounded-xl border border-slate-200"
            role="region"
            aria-label={title}
            tabIndex={0}
        >
            <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                        {headers.map((h) => (
                            <th key={h} className="px-3 py-3 font-semibold">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 [&_td]:px-3 [&_td]:py-3 [&_td]:align-top">
                    {children}
                </tbody>
            </table>
        </div>
    );
}
function PaginationLinks({ page, label }: { page: Pagination; label: string }) {
    return (
        <nav aria-label={label} className="mt-4 flex flex-wrap gap-2 text-sm">
            {page.links.map((link, i) =>
                link.url ? (
                    <Link
                        key={i}
                        href={link.url}
                        preserveScroll
                        className={`${button} ${link.active ? 'border-amber-700 text-amber-900' : ''}`}
                        aria-current={link.active ? 'page' : undefined}
                    >
                        {link.label.replace(/&laquo;|&raquo;/g, '')}
                    </Link>
                ) : (
                    <span key={i} className="px-3 py-2 text-slate-400">
                        {link.label.replace(/&laquo;|&raquo;/g, '')}
                    </span>
                ),
            )}
        </nav>
    );
}
function Filters({
    prefix,
    filters,
    actions,
    entities,
}: {
    prefix: 'activity' | 'auth';
    filters: Record<string, string>;
    actions: string[];
    entities?: string[];
}) {
    const [busy, setBusy] = useState(false);
    const { errors } = usePage<{ errors: Record<string, string> }>().props;
    const [draft, setDraft] = useState({
        search: filters[`${prefix}_search`] ?? '',
        action:
            filters[`${prefix}_${prefix === 'auth' ? 'event' : 'action'}`] ??
            '',
        entity: filters.activity_entity ?? '',
        from: filters[`${prefix}_from`] ?? '',
        to: filters[`${prefix}_to`] ?? '',
        order: filters.activity_order ?? 'newest',
    });
    function navigate(clear = false) {
        const url = new URL(window.location.href);

        for (const key of [...url.searchParams.keys()]) {
            if (
                key.startsWith(prefix + '_') ||
                key === (prefix === 'activity' ? 'page' : 'auth_page')
            ) {
                url.searchParams.delete(key);
            }
        }

        if (!clear) {
            for (const [key, v] of Object.entries(draft)) {
                if (
                    v &&
                    (prefix === 'activity' ||
                        !['entity', 'order'].includes(key))
                ) {
                    url.searchParams.set(
                        `${prefix}_${key === 'action' && prefix === 'auth' ? 'event' : key}`,
                        v,
                    );
                }
            }
        }

        router.get(
            url.pathname + url.search,
            {},
            {
                preserveState: true,
                preserveScroll: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onSuccess: () => {
                    if (clear) {
                        setDraft({
                            search: '',
                            action: '',
                            entity: '',
                            from: '',
                            to: '',
                            order: 'newest',
                        });
                    }
                },
            },
        );
    }
    function submit(e: FormEvent) {
        e.preventDefault();
        navigate();
    }

    return (
        <form
            onSubmit={submit}
            aria-label={`${prefix === 'activity' ? 'Activity' : 'Authentication'} filters`}
            className="mb-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
            <label className="min-w-0 text-xs font-semibold text-slate-600">
                {prefix === 'activity'
                    ? 'Search activity'
                    : 'Search authentication'}
                <input
                    className={field}
                    value={draft.search}
                    maxLength={150}
                    onChange={(e) =>
                        setDraft({ ...draft, search: e.target.value })
                    }
                />
            </label>
            <label className="min-w-0 text-xs font-semibold text-slate-600">
                {prefix === 'activity' ? 'Action' : 'Authentication event'}
                <select
                    className={field}
                    value={draft.action}
                    onChange={(e) =>
                        setDraft({ ...draft, action: e.target.value })
                    }
                >
                    <option value="">All events</option>
                    {actions.map((a) => (
                        <option key={a} value={a}>
                            {a.replaceAll('_', ' ')}
                            {prefix === 'activity' &&
                            ['LOGIN', 'LOGOUT'].includes(a)
                                ? ' (historical)'
                                : ''}
                        </option>
                    ))}
                </select>
            </label>
            {entities && (
                <label className="min-w-0 text-xs font-semibold text-slate-600">
                    Module
                    <select
                        className={field}
                        value={draft.entity}
                        onChange={(e) =>
                            setDraft({ ...draft, entity: e.target.value })
                        }
                    >
                        <option value="">All modules</option>
                        {entities.map((a) => (
                            <option key={a}>{a}</option>
                        ))}
                    </select>
                </label>
            )}
            <label className="min-w-0 text-xs font-semibold text-slate-600">
                From date (Manila)
                <input
                    type="date"
                    className={field}
                    value={draft.from}
                    onChange={(e) =>
                        setDraft({ ...draft, from: e.target.value })
                    }
                />
            </label>
            <label className="min-w-0 text-xs font-semibold text-slate-600">
                Through date (Manila)
                <input
                    type="date"
                    className={field}
                    value={draft.to}
                    onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                />
            </label>
            {prefix === 'activity' && (
                <label className="min-w-0 text-xs font-semibold text-slate-600">
                    Activity order
                    <select
                        className={field}
                        value={draft.order}
                        onChange={(e) =>
                            setDraft({ ...draft, order: e.target.value })
                        }
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                    </select>
                </label>
            )}
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-3">
                <button
                    className="rounded-xl bg-[#90451f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    disabled={busy}
                >
                    {busy ? 'Loading…' : 'Apply filters'}
                </button>
                <button
                    className={button}
                    type="button"
                    disabled={busy}
                    onClick={() => navigate(true)}
                >
                    Clear{' '}
                    {prefix === 'activity' ? 'activity' : 'authentication'}{' '}
                    filters
                </button>
            </div>
            {Object.entries(errors ?? {})
                .filter(([key]) => key.startsWith(prefix + '_'))
                .map(([key, error]) => (
                    <p
                        key={key}
                        role="alert"
                        className="text-sm text-red-700 sm:col-span-2 xl:col-span-3"
                    >
                        {error}
                    </p>
                ))}
        </form>
    );
}
export default function AuditHistory({
    events,
    authentication,
    filters,
    actions,
    entities,
    monitoring,
    presence,
    summary,
}: Props) {
    const [refreshing, setRefreshing] = useState(false);

    return (
        <div className="jr-theme min-w-0">
            <Head title="Audit Log" />
            <ProjectWorkspace>
                <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="mb-2 text-xs font-semibold tracking-widest text-amber-800 uppercase">
                            Admin security console
                        </p>
                        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <ShieldCheck
                                aria-hidden
                                className="size-6 text-[#90451f]"
                            />
                            Audit Log
                        </h1>
                        <p className="mt-2 max-w-3xl text-sm text-slate-600">
                            Security and Activity Monitoring · Read-only history
                            and estimated online presence. Times shown in
                            Asia/Manila.
                        </p>
                    </div>
                    <button
                        className={`${button} inline-flex items-center gap-2`}
                        disabled={refreshing}
                        onClick={() =>
                            router.reload({
                                onStart: () => setRefreshing(true),
                                onFinish: () => setRefreshing(false),
                            })
                        }
                    >
                        <RefreshCw
                            className={`size-4 ${refreshing ? 'animate-spin' : ''}`}
                        />
                        {refreshing ? 'Refreshing…' : 'Refresh monitoring'}
                    </button>
                </header>
                <div className="mb-6 grid min-w-0 gap-4 md:grid-cols-3">
                    {[
                        {
                            title: 'System activities',
                            text: String(summary.system_activities),
                            note: 'Permanent business entries; historical copies remain preserved.',
                            icon: Activity,
                        },
                        {
                            title: 'Authentication in period',
                            text: monitoring.available
                                ? `${summary.logins} successful · ${summary.failed_logins} rejected`
                                : 'Unavailable',
                            note: 'Recorded events in the authentication date range; failed attempts are rate-bounded.',
                            icon: LogIn,
                        },
                        {
                            title: 'Unique online accounts',
                            text:
                                summary.online_accounts === null
                                    ? 'Unavailable'
                                    : String(summary.online_accounts),
                            note: `${Math.round(presence.window_seconds / 60)}-minute activity window; multiple sessions count once.`,
                            icon: Users,
                        },
                    ].map(({ title, text, note, icon: Icon }) => (
                        <section
                            key={title}
                            className="min-w-0 rounded-2xl border border-[#eadbc8] bg-white p-5 shadow-sm"
                        >
                            <Icon
                                className="mb-3 size-5 text-[#90451f]"
                                aria-hidden
                            />
                            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                {title}
                            </h2>
                            <p className="mt-2 text-xl font-bold text-slate-900">
                                {text}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-slate-500">
                                {note}
                            </p>
                        </section>
                    ))}
                </div>
                <section className="mb-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <h2 className="text-lg font-bold text-slate-900">
                        System Activity History
                    </h2>
                    <p className="mt-1 mb-4 text-sm text-slate-500">
                        {events.total} matching entries. Existing historical
                        authentication and notification copies are preserved and
                        labeled. Account Type shows the current stored role; the
                        original audit schema did not snapshot the actor role.
                    </p>
                    <Filters
                        key={`activity-${JSON.stringify(filters)}`}
                        prefix="activity"
                        filters={filters}
                        actions={actions}
                        entities={entities}
                    />
                    <Table
                        title="System Activity History"
                        headers={[
                            'Date and Time',
                            'Performed By',
                            'Account Type',
                            'Action',
                            'Module',
                            'Affected Record',
                            'Description',
                            'Details',
                        ]}
                    >
                        {events.data.map((e) => (
                            <tr key={e.id}>
                                <td className="whitespace-nowrap">
                                    <time dateTime={e.created_at}>
                                        {time(e.created_at)}
                                    </time>
                                </td>
                                <td className="max-w-64 min-w-40 break-words">
                                    {e.actor_identifier}
                                    <span className="mt-1 block text-xs text-slate-500">
                                        UserAccount{' '}
                                        {e.user_id === null
                                            ? 'not recorded'
                                            : `#${e.user_id}`}
                                    </span>
                                </td>
                                <td>
                                    {e.current_account_type ?? 'Not recorded'}
                                    <span className="block text-xs text-slate-400">
                                        Current role
                                    </span>
                                </td>
                                <td>
                                    <Badge action={e.action} />
                                    {['LOGIN', 'LOGOUT'].includes(e.action) && (
                                        <span className="mt-1 block text-xs text-slate-500">
                                            Historical authentication entry
                                        </span>
                                    )}
                                    {e.recipient_user_id !== null && (
                                        <span className="mt-1 block text-xs text-slate-500">
                                            Historical notification copy
                                        </span>
                                    )}
                                </td>
                                <td>{e.entity_type}</td>
                                <td>
                                    {e.entity_type}{' '}
                                    {e.entity_id === null
                                        ? '—'
                                        : `#${e.entity_id}`}
                                </td>
                                <td className="max-w-80 min-w-48 break-words">
                                    {e.description}
                                </td>
                                <td>
                                    <details className="min-w-52">
                                        <summary className="cursor-pointer font-semibold text-[#90451f]">
                                            Safe before / after values
                                        </summary>
                                        <div className="mt-3 max-w-md space-y-2 text-xs">
                                            <p>
                                                AuditLog #{e.id} ·{' '}
                                                {e.actor_identifier}
                                            </p>
                                            <p>
                                                {e.action} · {e.entity_type} #
                                                {e.entity_id ?? '—'}
                                            </p>
                                            <p>{e.created_at}</p>
                                            <p className="break-words">
                                                {e.description}
                                            </p>
                                            {e.notification_message && (
                                                <p>
                                                    Historical notification:{' '}
                                                    {e.notification_message}
                                                </p>
                                            )}
                                            {Object.keys({
                                                ...e.old_value,
                                                ...e.new_value,
                                            }).length === 0 ? (
                                                <p>
                                                    No safe change details were
                                                    recorded for this event.
                                                </p>
                                            ) : (
                                                <table className="w-full table-fixed text-left">
                                                    <thead>
                                                        <tr>
                                                            <th>Field</th>
                                                            <th>
                                                                Previous value
                                                            </th>
                                                            <th>New value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[
                                                            ...new Set([
                                                                ...Object.keys(
                                                                    e.old_value ??
                                                                        {},
                                                                ),
                                                                ...Object.keys(
                                                                    e.new_value ??
                                                                        {},
                                                                ),
                                                            ]),
                                                        ].map((k) => (
                                                            <tr key={k}>
                                                                <th className="p-1 break-words">
                                                                    {k.replaceAll(
                                                                        '_',
                                                                        ' ',
                                                                    )}
                                                                </th>
                                                                <td className="p-1 break-all whitespace-pre-wrap">
                                                                    {value(
                                                                        e
                                                                            .old_value?.[
                                                                            k
                                                                        ],
                                                                    )}
                                                                </td>
                                                                <td className="p-1 break-all whitespace-pre-wrap">
                                                                    {value(
                                                                        e
                                                                            .new_value?.[
                                                                            k
                                                                        ],
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </details>
                                </td>
                            </tr>
                        ))}
                        {events.data.length === 0 && (
                            <tr>
                                <td colSpan={8}>
                                    No system activity matches these filters.
                                </td>
                            </tr>
                        )}
                    </Table>
                    <PaginationLinks
                        page={events}
                        label="Audit history pagination"
                    />
                </section>
                <section className="mb-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <h2 className="text-lg font-bold text-slate-900">
                        Authentication History
                    </h2>
                    <p className="mt-1 mb-4 text-sm text-slate-500">
                        {monitoring.message}
                    </p>
                    {monitoring.recent_failure_at && (
                        <p
                            role="status"
                            className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                        >
                            Collection encountered a recent outage at{' '}
                            {time(monitoring.recent_failure_at)}. Some events
                            may be missing; authentication remains governed by
                            existing security controls.
                        </p>
                    )}
                    {!monitoring.available && (
                        <p
                            role="status"
                            className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                        >
                            Schema-owner activation is required. No synthetic or
                            historical backfill is performed.
                        </p>
                    )}
                    <Filters
                        key={`auth-${JSON.stringify(filters)}`}
                        prefix="auth"
                        filters={filters}
                        actions={['LOGIN', 'LOGOUT', 'FAILED_LOGIN']}
                    />
                    <Table
                        title="Authentication History"
                        headers={[
                            'Date and Time',
                            'Account / Attempted Identifier',
                            'Account Type',
                            'Event',
                            'Outcome',
                            'Client Information',
                            'Details',
                        ]}
                    >
                        {authentication.data.map((e) => (
                            <tr key={e.id}>
                                <td className="whitespace-nowrap">
                                    {time(e.created_at)}
                                </td>
                                <td className="min-w-48 break-words">
                                    {e.actor_identifier ??
                                        e.attempted_identifier ??
                                        'Unavailable account'}
                                    {e.user_account_id === null && (
                                        <span className="block text-xs text-slate-500">
                                            Unverified identifier
                                        </span>
                                    )}
                                </td>
                                <td>{e.account_type ?? 'Not verified'}</td>
                                <td>
                                    <Badge action={e.event} />
                                </td>
                                <td>{e.outcome}</td>
                                <td>{e.client_description}</td>
                                <td>
                                    <details>
                                        <summary className="cursor-pointer font-semibold text-[#90451f]">
                                            Authentication details
                                        </summary>
                                        <p className="mt-2 text-xs">
                                            Event #{e.id} · {e.method} ·{' '}
                                            {e.created_at}
                                        </p>
                                        <p className="text-xs">
                                            {e.user_account_id === null
                                                ? 'No canonical identity attributed.'
                                                : `Verified UserAccount #${e.user_account_id}`}
                                        </p>
                                    </details>
                                </td>
                            </tr>
                        ))}
                        {authentication.data.length === 0 && (
                            <tr>
                                <td colSpan={7}>
                                    No recorded authentication events match
                                    these filters.
                                </td>
                            </tr>
                        )}
                    </Table>
                    <PaginationLinks
                        page={authentication}
                        label="Authentication history pagination"
                    />
                </section>
                <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                    <h2 className="text-lg font-bold text-slate-900">
                        Currently Online Users
                    </h2>
                    <p className="mt-1 mb-4 text-sm text-slate-500">
                        {presence.message} Closing a tab may leave a valid
                        session recently active until this window elapses.
                    </p>
                    <Table
                        title="Currently Online Users"
                        headers={[
                            'Username',
                            'Account Type',
                            'Session Status',
                            'Login Time',
                            'Last Activity',
                            'Device / Browser',
                        ]}
                    >
                        {presence.accounts.map((a) => (
                            <tr key={a.account_id}>
                                <td>
                                    {a.username}
                                    <span className="block text-xs text-slate-500">
                                        UserAccount #{a.account_id}
                                    </span>
                                </td>
                                <td>{a.account_type}</td>
                                <td>
                                    {a.status}
                                    <span className="block text-xs text-slate-500">
                                        {a.session_count} valid session
                                        {a.session_count === 1 ? '' : 's'}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap">
                                    {time(a.login_at)}
                                </td>
                                <td className="whitespace-nowrap">
                                    {time(a.last_activity)}
                                </td>
                                <td>{a.client_description}</td>
                            </tr>
                        ))}
                        {presence.accounts.length === 0 && (
                            <tr>
                                <td colSpan={6}>
                                    {presence.available
                                        ? 'No eligible accounts are recently active.'
                                        : 'Online presence is unavailable; no unverified sessions are shown.'}
                                </td>
                            </tr>
                        )}
                    </Table>
                </section>
            </ProjectWorkspace>
        </div>
    );
}

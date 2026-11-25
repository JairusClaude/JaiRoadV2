import { manilaTimestamp } from '@/lib/manila-time';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    Eye,
    RefreshCw,
    ShieldCheck,
    UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { MetricCard } from '@/components/metric-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from '@/components/ui/dialog';
import '../../../css/maintenance-projects-exploration.css';
import '../../../css/jairoads-audit-history.css';

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
    'jr-audit-filter mt-1 block w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
const button =
    'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50';
function time(value: string | null) {
    return value === null ? 'Not recorded' : manilaTimestamp(value, 'medium');
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
            className="jr-audit-table-scroll max-w-full overflow-x-auto rounded-xl border border-slate-200"
            role="region"
            aria-label={title}
            tabIndex={0}
        >
            <table className={`jr-audit-table text-left text-sm ${headers.length === 8 ? 'jr-audit-table-activity' : headers.length === 7 ? 'jr-audit-table-auth' : 'jr-audit-table-presence'}`}>
                <thead className="bg-slate-50 text-xs text-slate-600">
                    <tr>
                        {headers.map((h) => (
                            <th key={h} scope="col" className="px-3 py-3 font-semibold">
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
function AuditDetail({ title, description, triggerLabel, children }: { title: string; description: string; triggerLabel: string; children: ReactNode }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <button type="button" className="jr-audit-detail-trigger" aria-label={triggerLabel}>
                    <Eye size={15} aria-hidden="true" /> View details
                </button>
            </DialogTrigger>
            <DialogContent className="jr-audit-detail-dialog">
                <DialogHeader className="jr-audit-detail-header">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="jr-audit-detail-body" tabIndex={0} role="region" aria-label="Recorded event details">
                    {children}
                </div>
                <DialogFooter className="jr-audit-detail-footer">
                    <DialogClose asChild><Button variant="outline">Done</Button></DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
function PaginationLinks({ page, label }: { page: Pagination; label: string }) {
    return (
        <nav aria-label={label} className="jr-audit-pagination mt-4 flex flex-wrap gap-2 text-sm">
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
                    className="rounded-xl bg-[var(--jr-role-accent)] hover:bg-[var(--jr-role-accent-hover)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
        <div className="jr-directory-exploration jr-audit-history">
            <Head title="Audit Log" />
            <ProjectWorkspace>
                <div className="jr-page-head">
                    <div>
                        <h1>Audit Log</h1>
                        <p>
                            Security and activity monitoring across system
                            operations. Times shown in Asia/Manila.
                        </p>
                    </div>
                    <Button
                        className="jr-primary"
                        disabled={refreshing}
                        onClick={() =>
                            router.reload({
                                onStart: () => setRefreshing(true),
                                onFinish: () => setRefreshing(false),
                            })
                        }
                    >
                        <RefreshCw
                            className={`mr-2 size-4 ${refreshing ? 'animate-spin' : ''}`}
                        />
                        {refreshing ? 'Refreshing…' : 'Refresh monitoring'}
                    </Button>
                </div>
                <main className="relative mx-0 -mt-3.5 min-w-0 rounded-t-[20px] bg-white px-4 pt-7 pb-10 shadow-sm sm:px-6 lg:-mx-7 lg:px-7">
                    <section
                        aria-label="Audit log statistics"
                        className="jr-metrics-grid mb-6 grid w-full gap-4 sm:grid-cols-3"
                    >
                        <MetricCard
                            title="System Activities"
                            icon={<Activity className="size-5" />}
                            value={summary.system_activities}
                            subtitle="Permanent business entries; historical copies remain preserved."
                            highlight={true}
                        />
                        <MetricCard
                            title="Authentication in Period"
                            icon={<ShieldCheck className="size-5" />}
                            value={
                                monitoring.available
                                    ? `${summary.logins ?? 0} logins`
                                    : 'Unavailable'
                            }
                            subtitle={
                                monitoring.available
                                    ? `${summary.logins ?? 0} successful · ${summary.failed_logins ?? 0} rejected`
                                    : 'Recorded events in the authentication date range; failed attempts are rate-bounded.'
                            }
                        />
                        <MetricCard
                            title="Unique Online Accounts"
                            icon={<UsersRound className="size-5" />}
                            value={
                                summary.online_accounts === null
                                    ? 'Unavailable'
                                    : summary.online_accounts
                            }
                            subtitle={`${Math.round(presence.window_seconds / 60)}-minute activity window; multiple sessions count once.`}
                        />
                    </section>
                    <section className="mb-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                        <h2 className="text-lg font-bold text-slate-900">
                            System Activity History
                        </h2>
                        <p className="mt-1 mb-4 text-sm text-slate-500">
                            {events.total} matching entries. Existing historical
                            authentication and notification copies are preserved
                            and labeled. Account Type shows the current stored
                            role; the original audit schema did not snapshot the
                            actor role.
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
                                    <td className="jr-audit-date">
                                        <time dateTime={e.created_at}>
                                            {time(e.created_at)}
                                        </time>
                                    </td>
                                    <td className="break-words">
                                        {e.actor_identifier}
                                        <span className="mt-1 block text-xs text-slate-500">
                                            UserAccount{' '}
                                            {e.user_id === null
                                                ? 'not recorded'
                                                : `#${e.user_id}`}
                                        </span>
                                    </td>
                                    <td>
                                        {e.current_account_type ??
                                            'Not recorded'}
                                        <span className="block text-xs text-slate-400">
                                            Current role
                                        </span>
                                    </td>
                                    <td>
                                        <Badge action={e.action} />
                                        {['LOGIN', 'LOGOUT'].includes(
                                            e.action,
                                        ) && (
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
                                    <td className="break-words">
                                        {e.description}
                                    </td>
                                    <td>
                                        <AuditDetail title={`Activity #${e.id}`} description="Safe before / after values" triggerLabel="Safe before / after values">
                                            <div className="jr-audit-detail-meta">
                                                <div><span>Performed by</span><strong>{e.actor_identifier}</strong></div>
                                                <div><span>Date and time (Manila)</span><strong>{time(e.created_at)}</strong></div>
                                                <div><span>Action</span><Badge action={e.action} /></div>
                                                <div><span>Affected record</span><strong>{e.entity_type} #{e.entity_id ?? '—'}</strong></div>
                                            </div>
                                            <div className="jr-audit-detail-description"><span>Description</span><p>{e.description}</p></div>
                                            {e.notification_message && <div className="jr-audit-detail-description"><span>Historical notification</span><p>{e.notification_message}</p></div>}
                                            <h3 className="text-sm font-semibold">Recorded field changes</h3>
                                            {Object.keys({ ...e.old_value, ...e.new_value }).length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No safe change details were recorded for this event.</p>
                                            ) : (
                                                <div className="jr-audit-changes">
                                                    {[...new Set([...Object.keys(e.old_value ?? {}), ...Object.keys(e.new_value ?? {})])].map(k => (
                                                        <section key={k} className="jr-audit-change">
                                                            <h4>{k.replaceAll('_', ' ')}</h4>
                                                            <div className="jr-audit-change-values">
                                                                <div><span>Previous value</span><p>{value(e.old_value?.[k])}</p></div>
                                                                <div><span>New value</span><p>{value(e.new_value?.[k])}</p></div>
                                                            </div>
                                                        </section>
                                                    ))}
                                                </div>
                                            )}
                                        </AuditDetail>
                                    </td>
                                </tr>
                            ))}
                            {events.data.length === 0 && (
                                <tr>
                                    <td colSpan={8}>
                                        No system activity matches these
                                        filters.
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
                                {time(monitoring.recent_failure_at)}. Some
                                events may be missing; authentication remains
                                governed by existing security controls.
                            </p>
                        )}
                        {!monitoring.available && (
                            <p
                                role="status"
                                className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                            >
                                Schema-owner activation is required. No
                                synthetic or historical backfill is performed.
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
                                    <td className="jr-audit-date">
                                        {time(e.created_at)}
                                    </td>
                                    <td className="break-words">
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
                                        <AuditDetail title={`Authentication event #${e.id}`} description="Recorded sign-in or sign-out information" triggerLabel="Authentication details">
                                            <div className="jr-audit-detail-meta">
                                                <div><span>Account / identifier</span><strong>{e.actor_identifier ?? e.attempted_identifier ?? 'Unavailable account'}</strong></div>
                                                <div><span>Date and time (Manila)</span><strong>{time(e.created_at)}</strong></div>
                                                <div><span>Event</span><Badge action={e.event} /></div>
                                                <div><span>Outcome</span><strong>{e.outcome}</strong></div>
                                                <div><span>Method</span><strong>{e.method}</strong></div>
                                                <div><span>Account type</span><strong>{e.account_type ?? 'Not verified'}</strong></div>
                                            </div>
                                            <div className="jr-audit-detail-description"><span>Client information</span><p>{e.client_description}</p></div>
                                            <p className="text-sm">{e.user_account_id === null ? 'No canonical identity attributed.' : `Verified UserAccount #${e.user_account_id}`}</p>
                                        </AuditDetail>
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
                                    <td className="jr-audit-date">
                                        {time(a.login_at)}
                                    </td>
                                    <td className="jr-audit-date">
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
                </main>
            </ProjectWorkspace>
        </div>
    );
}

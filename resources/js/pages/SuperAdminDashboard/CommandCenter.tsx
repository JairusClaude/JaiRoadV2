import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowRight,
    CalendarDays,
    ClipboardCheck,
    Crown,
    FileText,
    FolderKanban,
    RefreshCw,
    ShieldCheck,
    UsersRound,
} from 'lucide-react';
import { useState } from 'react';
import { DashboardAnalytics } from '@/components/dashboard/dashboard-analytics';
import type { DashboardSummary } from '@/components/dashboard/dashboard-analytics';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { MetricCard } from '@/components/metric-card';
import { MonthlyProgress } from '@/components/monthly-updates/monthly-progress';
import { Button } from '@/components/ui/button';
import '../../../css/maintenance-projects-exploration.css';

type Counts = {
    accounts: number;
    activeAccounts: number;
    inactiveAccounts: number;
    superadmins: number;
    admins: number;
    engineerAccounts: number;
    viewers: number;
    unlinkedAdmins: number;
    engineers: number;
    retiredEngineers: number;
    lguAssignments: number;
    activeAssignments: number;
    lgus: number;
    projects: number;
    roadCoverages: number;
    maintenanceRecords: number;
    monthlyUpdates: number;
    documents: number;
    media: number;
    auditEvents: number;
};

type PrivilegedAccount = {
    id: number;
    username: string;
    role: string;
    active: boolean;
    linkedEngineer: number | null;
};

type AuditEvent = {
    id: number;
    actor: string;
    action: string;
    entity: string;
    createdAt: string;
};

type MonthlyPreview = {
    id: number;
    projectTitle: string;
    updateMonth: string;
    period: string;
    progress: number;
};

type Props = {
    username: string;
    analytics: DashboardSummary;
    counts: Counts;
    privilegedAccounts: PrivilegedAccount[];
    recentEvents: AuditEvent[];
    recentMonthlyUpdates: MonthlyPreview[];
    supportedActions: {
        createAdmin: boolean;
        roleChange: boolean;
        adminDeactivation: boolean;
        securityPolicyEditing: boolean;
    };
};

const format = (value: number) => value.toLocaleString();

/** System Command Center Dashboard styled consistently with the JaiROADS system design. */
export default function SuperAdminCommandCenter({
    username,
    counts,
    analytics,
    privilegedAccounts,
    recentEvents,
    recentMonthlyUpdates,
}: Props) {
    const [refreshing, setRefreshing] = useState(false);

    return (
        <div className="jr-directory-exploration jr-superadmin-dashboard">
            <Head title="System Command Center - Dashboard" />
            <ProjectWorkspace>
                <div className="jr-page-head">
                    <div>
                        <div className="jr-superadmin-access">
                            <Crown className="h-3.5 w-3.5" /> Highest Authority
                            · SuperAdmin
                        </div>
                        <h1>System Command Center</h1>
                        <p>
                            Welcome, {username}. Manage accounts, assignments,
                            and road maintenance across JaiROADS.
                        </p>
                    </div>
                    <div className="jr-page-actions">
                        <Button
                            className="jr-superadmin-refresh"
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
                            {refreshing ? 'Refreshing…' : 'Refresh dashboard'}
                        </Button>
                    </div>
                </div>

                <main className="relative mx-0 -mt-3.5 min-w-0 space-y-6 rounded-t-[20px] bg-white px-4 pt-7 pb-10 shadow-sm sm:px-6 lg:-mx-7 lg:px-7">
                    {/* Top System Metrics */}
                    <section
                        aria-label="System metrics"
                        className="jr-metrics-grid grid w-full gap-4 sm:grid-cols-2 xl:grid-cols-4"
                    >
                        <MetricCard
                            title="Active Accounts"
                            value={counts.activeAccounts}
                            subtitle={`${format(counts.inactiveAccounts)} inactive retained`}
                            highlight={true}
                            icon={<UsersRound className="size-5" />}
                        />
                        <MetricCard
                            title="Privileged Accounts"
                            value={counts.superadmins + counts.admins}
                            subtitle={`${counts.superadmins} SuperAdmin · ${counts.admins} Admin`}
                            icon={<ShieldCheck className="size-5" />}
                        />
                        <MetricCard
                            title="Active Assignments"
                            value={counts.activeAssignments}
                            subtitle={`${format(counts.lguAssignments)} total LGU links`}
                            icon={<ClipboardCheck className="size-5" />}
                        />
                        <MetricCard
                            title="Maintenance Records"
                            value={counts.maintenanceRecords}
                            subtitle={`${format(counts.projects)} active projects`}
                            icon={<FolderKanban className="size-5" />}
                        />
                    </section>

                    {/* Real counts and reporting chart, with a concise operations rail. */}
                    <div className="jr-command-overview grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(290px,0.9fr)]">
                        <DashboardAnalytics
                            data={analytics}
                            compact
                            showActivity={false}
                        />
                        <aside
                            className="jr-command-rail min-w-0 space-y-5"
                            aria-label="Recent operations and reports"
                        >
                            <section className="jr-command-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                                            <ShieldCheck className="size-5 text-[#51269B]" />
                                            Recent Activity
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Latest recorded system operations
                                            (Asia/Manila)
                                        </p>
                                    </div>
                                    <Link
                                        href="/workspace/audit-logs"
                                        className="shrink-0 text-xs font-semibold text-[#51269B] hover:underline"
                                    >
                                        View audit log
                                    </Link>
                                </div>
                                <ol className="jr-command-activity mt-4 max-h-72 space-y-0 overflow-y-auto">
                                    {recentEvents.map((event) => (
                                        <li
                                            key={event.id}
                                            className="border-l-2 border-[#E6D9FB] py-2.5 pl-4"
                                        >
                                            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                                                <span className="rounded-md bg-[#EEE6FF] px-2 py-0.5 text-xs font-semibold text-[#51269B]">
                                                    {event.action}
                                                </span>
                                                <span>{event.entity}</span>
                                            </div>
                                            <p className="mt-1 text-xs break-words text-slate-500">
                                                By {event.actor}
                                            </p>
                                            <time
                                                dateTime={event.createdAt}
                                                className="mt-1 block text-xs text-slate-400"
                                            >
                                                {new Intl.DateTimeFormat(
                                                    'en-PH',
                                                    {
                                                        timeZone: 'Asia/Manila',
                                                        dateStyle: 'medium',
                                                        timeStyle: 'medium',
                                                    },
                                                ).format(
                                                    new Date(event.createdAt),
                                                )}
                                            </time>
                                        </li>
                                    ))}
                                    {recentEvents.length === 0 && (
                                        <li className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                            No recent system activity to
                                            display.
                                        </li>
                                    )}
                                </ol>
                            </section>
                            <section className="jr-command-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                                            <CalendarDays className="size-5 text-[#51269B]" />
                                            Monthly Updates
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Latest maintenance progress reports
                                        </p>
                                    </div>
                                    <Link
                                        href="/workspace/ui/monthly-updates"
                                        className="shrink-0 text-xs font-semibold text-[#51269B] hover:underline"
                                    >
                                        View all
                                    </Link>
                                </div>
                                <div className="mt-4 space-y-3">
                                    {recentMonthlyUpdates.map((update) => (
                                        <Link
                                            key={update.id}
                                            href={`/workspace/ui/monthly-updates/${update.id}`}
                                            className="jr-command-update block rounded-xl border border-[#F0E9FB] p-3 transition hover:bg-[#F8F3FF]"
                                        >
                                            <div className="flex min-w-0 items-start gap-3">
                                                <FileText className="mt-0.5 size-4 shrink-0 text-[#51269B]" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="line-clamp-2 text-xs font-semibold text-slate-800">
                                                        {update.projectTitle}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {update.period} ·{' '}
                                                        {update.updateMonth}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-3">
                                                <MonthlyProgress
                                                    value={update.progress}
                                                    label={`Progress for ${update.projectTitle}`}
                                                />
                                            </div>
                                        </Link>
                                    ))}
                                    {recentMonthlyUpdates.length === 0 && (
                                        <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                                            No monthly progress reports
                                            submitted yet.
                                        </p>
                                    )}
                                </div>
                            </section>
                        </aside>
                    </div>

                    <section className="jr-command-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Administrative Operations
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Quick access to authorized system modules
                                </p>
                            </div>
                            <ShieldCheck
                                className="size-5 text-[#51269B]"
                                aria-hidden="true"
                            />
                        </div>
                        <nav
                            className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                            aria-label="Administrative modules"
                        >
                            {[
                                [
                                    'Maintenance Projects',
                                    '/workspace/ui/maintenance-projects',
                                ],
                                [
                                    'Road Coverages',
                                    '/workspace/ui/road-coverages',
                                ],
                                [
                                    'Monthly Updates',
                                    '/workspace/ui/monthly-updates',
                                ],
                                [
                                    'Maintenance Documents',
                                    '/workspace/ui/maintenance-documents',
                                ],
                                ['LGU Directory', '/workspace/ui/lgus'],
                                ['User Management', '/workspace/users'],
                                ['Audit Log', '/workspace/audit-logs'],
                                ['Settings', '/workspace/settings'],
                            ].map(([name, url]) => (
                                <Link
                                    key={name}
                                    href={url}
                                    className="jr-command-quick-link flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#E9E0F6] bg-[#FCFAFF] px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-[#F4EDFF]"
                                >
                                    <span>{name}</span>
                                    <ArrowRight
                                        className="size-4 shrink-0 text-[#6B46AF]"
                                        aria-hidden="true"
                                    />
                                </Link>
                            ))}
                        </nav>
                    </section>

                    {/* Privileged Accounts Table */}
                    <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Privileged Accounts Directory
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Active and retained SuperAdmin / Admin
                                    accounts
                                </p>
                            </div>
                            <Link
                                href="/user-management"
                                className="text-xs font-semibold text-amber-800 hover:underline"
                            >
                                Manage accounts
                            </Link>
                        </div>
                        <div className="mt-4 w-full max-w-full min-w-0 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-slate-200 bg-[#F5F0FC] text-xs font-semibold tracking-wider text-slate-600 uppercase">
                                    <tr>
                                        <th className="px-5 py-3.5">
                                            Username
                                        </th>
                                        <th className="px-4 py-3.5">Role</th>
                                        <th className="px-4 py-3.5">
                                            Linked Engineer
                                        </th>
                                        <th className="px-5 py-3.5">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {privilegedAccounts.map((a) => (
                                        <tr
                                            key={a.id}
                                            className="hover:bg-slate-50/50"
                                        >
                                            <td className="px-5 py-3 font-semibold text-slate-900">
                                                {a.username}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded-full bg-[#EDE5FF] px-2.5 py-0.5 text-xs font-semibold text-[#51269B]">
                                                    {a.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {a.linkedEngineer === null
                                                    ? 'Unlinked'
                                                    : `#${a.linkedEngineer}`}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                                        a.active
                                                            ? 'bg-[#E9F7EE] text-[#238554]'
                                                            : 'bg-[#F1F2F5] text-[#79869A]'
                                                    }`}
                                                >
                                                    <span
                                                        className={`h-1.5 w-1.5 rounded-full ${
                                                            a.active
                                                                ? 'bg-[#35A66B]'
                                                                : 'bg-[#9AA5B5]'
                                                        }`}
                                                    />
                                                    {a.active
                                                        ? 'Active'
                                                        : 'Inactive'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {privilegedAccounts.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-5 py-6 text-center text-slate-500"
                                            >
                                                No privileged accounts found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </main>
            </ProjectWorkspace>
        </div>
    );
}

import { Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    ArrowRight,
    Building2,
    Crown,
    FileText,
    RefreshCw,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { DdDashboardAnalytics } from '@/components/dd-dashboard-analytics';
import type { DdDashboardSummary } from '@/components/dd-dashboard-analytics';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { MetricCard } from '@/components/metric-card';
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

type Props = {
    username: string;
    analytics: DdDashboardSummary;
    counts: Counts;
    privilegedAccounts: PrivilegedAccount[];
    recentEvents: AuditEvent[];
    supportedActions: {
        createAdmin: boolean;
        roleChange: boolean;
        adminDeactivation: boolean;
        securityPolicyEditing: boolean;
    };
};

const format = (value: number) => value.toLocaleString();

/** System Command Center Dashboard styled consistently with the JaiROADS system design. */
export default function DdSuperAdminCommandCenter({
    username,
    counts,
    analytics,
    privilegedAccounts,
    recentEvents,
}: Props) {
    const [refreshing, setRefreshing] = useState(false);

    return (
        <div className="jr-directory-exploration">
            <Head title="System Command Center - Dashboard" />
            <ProjectWorkspace>
                <div className="jr-page-head">
                    <div>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF0E2] px-2.5 py-0.5 text-xs font-semibold text-[#995321] mb-2">
                            <Crown className="h-3.5 w-3.5" /> Highest Authority · SuperAdmin
                        </div>
                        <h1>System Command Center</h1>
                        <p>
                            Welcome, {username}. Manage accounts, assignments, and road maintenance across JaiROADS.
                        </p>
                    </div>
                    <div className="jr-page-actions">
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
                            {refreshing ? 'Refreshing…' : 'Refresh dashboard'}
                        </Button>
                    </div>
                </div>

                <main className="relative -mt-3.5 -mx-7 rounded-t-[20px] bg-white px-7 pt-7 pb-10 shadow-sm min-w-0 space-y-6">
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
                        />
                        <MetricCard
                            title="Privileged Accounts"
                            value={counts.superadmins + counts.admins}
                            subtitle={`${counts.superadmins} SuperAdmin · ${counts.admins} Admin`}
                        />
                        <MetricCard
                            title="Active Assignments"
                            value={counts.activeAssignments}
                            subtitle={`${format(counts.lguAssignments)} total LGU links`}
                        />
                        <MetricCard
                            title="Maintenance Records"
                            value={counts.maintenanceRecords}
                            subtitle={`${format(counts.projects)} active projects`}
                        />
                    </section>

                    {/* System Analytics */}
                    <DdDashboardAnalytics data={analytics} />

                    {/* Operational Access & Privileged Governance */}
                    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Administrative Operations
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Quick access to authorized system modules
                                    </p>
                                </div>
                                <ShieldCheck className="h-6 w-6 text-amber-700" />
                            </div>
                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                {[
                                    ['Maintenance Projects', '/dd-phase3/ui/maintenance-projects'],
                                    ['Road Coverages', '/dd-phase3/ui/road-coverages'],
                                    ['Monthly Updates', '/dd-phase3/ui/monthly-updates'],
                                    ['Maintenance Documents', '/dd-phase3/ui/maintenance-documents'],
                                    ['LGU Directory', '/dd-phase3/ui/lgus'],
                                    ['User Management', '/user-management'],
                                    ['Audit Log', '/dd-phase3/audit-logs'],
                                    ['Settings', '/dd-phase3/settings'],
                                ].map(([name, url]) => (
                                    <Link
                                        key={name}
                                        href={url}
                                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-[#fdfcfb] px-4 py-3 text-sm font-semibold text-slate-800 transition hover:border-amber-400 hover:bg-[#fff9f4]"
                                    >
                                        <span>{name}</span>
                                        <ArrowRight className="h-4 w-4 text-slate-400" />
                                    </Link>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Recent Activity
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Latest system operations
                                    </p>
                                </div>
                                <Link
                                    href="/dd-phase3/audit-logs"
                                    className="text-xs font-semibold text-amber-800 hover:underline"
                                >
                                    Full audit log
                                </Link>
                            </div>
                            <div className="mt-5 divide-y divide-slate-100">
                                {recentEvents.map((e) => (
                                    <div
                                        key={e.id}
                                        className="flex items-center justify-between gap-3 py-3"
                                    >
                                        <div>
                                            <div className="text-sm font-semibold text-slate-800">
                                                <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 mr-1.5">
                                                    {e.action}
                                                </span>
                                                {e.entity}
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                By {e.actor}
                                            </div>
                                        </div>
                                        <time className="shrink-0 text-right text-xs text-slate-400">
                                            {e.createdAt}
                                        </time>
                                    </div>
                                ))}
                                {recentEvents.length === 0 && (
                                    <p className="py-6 text-center text-sm text-slate-500">
                                        No recent audit events available.
                                    </p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Privileged Accounts Table */}
                    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Privileged Accounts Directory
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Active and retained SuperAdmin / Admin accounts
                                </p>
                            </div>
                            <Link
                                href="/user-management"
                                className="text-xs font-semibold text-amber-800 hover:underline"
                            >
                                Manage accounts
                            </Link>
                        </div>
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-slate-200 bg-[#fbf9f7] text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3.5">Username</th>
                                        <th className="px-4 py-3.5">Role</th>
                                        <th className="px-4 py-3.5">Linked Engineer</th>
                                        <th className="px-5 py-3.5">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {privilegedAccounts.map((a) => (
                                        <tr key={a.id} className="hover:bg-slate-50/50">
                                            <td className="px-5 py-3 font-semibold text-slate-900">
                                                {a.username}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex rounded-full bg-[#FFF0E2] px-2.5 py-0.5 text-xs font-semibold text-[#995321]">
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
                                                            a.active ? 'bg-[#35A66B]' : 'bg-[#9AA5B5]'
                                                        }`}
                                                    />
                                                    {a.active ? 'Active' : 'Inactive'}
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

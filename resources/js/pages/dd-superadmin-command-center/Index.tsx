import { Head, Link } from '@inertiajs/react';
import {
    Activity,
    Building2,
    CircleAlert,
    Crown,
    FileText,
    ShieldCheck,
    Users,
} from 'lucide-react';
import { DdDashboardAnalytics } from '@/components/dd-dashboard-analytics';
import type { DdDashboardSummary } from '@/components/dd-dashboard-analytics';

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
const panel =
    'rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(30,45,67,.035)]';
const format = (value: number) => value.toLocaleString();

/** Original JaiROADS SuperAdmin Command Center visual language; all data is DD-only. */
export default function DdSuperAdminCommandCenter({
    username,
    counts,
    analytics,
    privilegedAccounts,
    recentEvents,
}: Props) {
    const roles = [
        { name: 'SuperAdmin', value: counts.superadmins },
        { name: 'Admin', value: counts.admins },
        { name: 'Engineer', value: counts.engineerAccounts },
        { name: 'Viewer', value: counts.viewers },
    ];
    const metrics = [
        {
            label: 'Active accounts',
            value: counts.activeAccounts,
            detail: `${format(counts.inactiveAccounts)} inactive retained`,
            icon: Users,
        },
        {
            label: 'Privileged Admin Accounts',
            value: counts.superadmins + counts.admins,
            detail: `${counts.superadmins} SuperAdmin · ${counts.admins} Admin`,
            icon: ShieldCheck,
        },
        {
            label: 'Active engineer assignments',
            value: counts.activeAssignments,
            detail: `${format(counts.lguAssignments)} assignments`,
            icon: Building2,
        },
        {
            label: 'Maintenance Records',
            value: counts.maintenanceRecords,
            detail: `${format(counts.projects)} long-term projects`,
            icon: Activity,
        },
    ];

    return (
        <>
            <Head title="JaiROADS SuperAdmin Command Center" />
            <div className="space-y-6">
                <section className="relative overflow-hidden rounded-[26px] bg-[#111c33] px-6 py-7 text-white sm:px-8 sm:py-9">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-28 -right-20 h-80 w-80 rounded-full border-[52px] border-amber-400/10"
                    />
                    <div className="relative max-w-3xl space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-bold tracking-[.13em] text-amber-300 uppercase">
                            <Crown className="h-3.5 w-3.5" /> Highest Authority
                            · SuperAdmin
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            System Command Center
                        </h1>
                        <p className="text-sm leading-relaxed text-slate-300">
                            Welcome, {username}. Manage accounts, assignments,
                            and road maintenance across JaiROADS.
                        </p>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-5 text-xs text-slate-300">
                            <span className="inline-flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-amber-300" />{' '}
                                Verified SuperAdmin access
                            </span>
                            <span>System overview</span>
                            <span>Account governance</span>
                        </div>
                    </div>
                </section>
                <section
                    aria-label="System metrics"
                    className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                >
                    {metrics.map(({ label, value, detail, icon: Icon }) => (
                        <div key={label} className={`${panel} p-5`}>
                            <div className="flex items-center justify-between text-sm font-medium text-slate-600">
                                <span>{label}</span>
                                <Icon className="h-5 w-5 text-amber-700" />
                            </div>
                            <div className="mt-3 text-3xl font-bold tabular-nums">
                                {format(value)}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                                {detail}
                            </p>
                        </div>
                    ))}
                </section>
                <DdDashboardAnalytics data={analytics} />
                <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                    <section className={`${panel} p-5 sm:p-6`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold">
                                    Administrative authority
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Manage system access and operations
                                </p>
                            </div>
                            <ShieldCheck className="h-6 w-6 text-amber-700" />
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {[
                                ['User Management', '/dd-phase3/users'],
                                ['LGU management', '/dd-phase3/lgus'],
                                ['Maintenance Projects', '/dd-phase3/projects'],
                                ['Road Sections', '/dd-phase3/roads'],
                                ['Monthly Updates', '/dd-phase3/updates'],
                                ['Project Documents', '/dd-phase3/documents'],
                                ['Settings', '/dd-phase3/settings'],
                            ].map(([name, url]) => (
                                <Link
                                    key={name}
                                    href={url}
                                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 hover:border-amber-400 hover:bg-amber-50"
                                >
                                    {name} →
                                </Link>
                            ))}
                        </div>
                        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                            <div className="flex items-start gap-3">
                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                                <div>
                                    <h3 className="font-semibold">
                                        SuperAdmin verification features
                                    </h3>
                                    <p className="mt-1 text-xs leading-6">
                                        The Command Center now highlights
                                        verified privileged access,
                                        privileged-account integrity, and recent
                                        audit visibility so the workspace
                                        clearly reads as the SuperAdmin console.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                    <section className={`${panel} p-5 sm:p-6`}>
                        <h2 className="text-lg font-bold">Role distribution</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Accounts by role
                        </p>
                        <div className="mt-5 space-y-4">
                            {roles.map(({ name, value }) => (
                                <div key={name}>
                                    <div className="mb-1.5 flex justify-between text-sm">
                                        <span className="font-medium">
                                            {name}
                                        </span>
                                        <span className="text-slate-600 tabular-nums">
                                            {value}
                                        </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className="h-full rounded-full bg-[#c47b32]"
                                            style={{
                                                width: `${counts.accounts ? Math.max(0, Math.min(100, (value / counts.accounts) * 100)) : 0}%`,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
                            {format(counts.engineers)} Engineer profiles ·{' '}
                            {format(counts.retiredEngineers)} Retired ·{' '}
                            {format(counts.roadCoverages)} road coverages ·{' '}
                            {format(counts.lgus)} LGUs
                        </div>
                    </section>
                </div>
                {counts.unlinkedAdmins > 0 && (
                    <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                        <div>
                            <h2 className="text-sm font-semibold">
                                {counts.unlinkedAdmins} Admin account(s) without
                                an Engineer link
                            </h2>
                            <p className="mt-1 text-xs">
                                Review these Admin accounts and their engineer
                                profiles in User Management.
                            </p>
                        </div>
                    </section>
                )}
                <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                    <section className={`${panel} overflow-hidden`}>
                        <div className="px-5 pt-5 pb-3 sm:px-6">
                            <h2 className="text-lg font-bold">
                                Privileged accounts
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Account roles and current status
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-5 py-3 font-semibold">
                                            Account
                                        </th>
                                        <th className="px-3 py-3 font-semibold">
                                            Role
                                        </th>
                                        <th className="px-3 py-3 font-semibold">
                                            Engineer
                                        </th>
                                        <th className="px-5 py-3 font-semibold">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {privilegedAccounts.map((a) => (
                                        <tr key={a.id}>
                                            <td className="px-5 py-3 font-medium">
                                                {a.username}
                                            </td>
                                            <td className="px-3 py-3">
                                                {a.role}
                                            </td>
                                            <td className="px-3 py-3 text-slate-600">
                                                {a.linkedEngineer === null
                                                    ? 'Unlinked'
                                                    : `#${a.linkedEngineer}`}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span
                                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${a.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                                                >
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
                    <section className={`${panel} p-5 sm:p-6`}>
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-amber-700" />
                            <h2 className="text-lg font-bold">
                                Recent audit activity
                            </h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            Recent system activity
                        </p>
                        <div className="mt-5 divide-y divide-slate-100">
                            {recentEvents.map((e) => (
                                <div
                                    key={e.id}
                                    className="flex justify-between gap-3 py-3"
                                >
                                    <div>
                                        <div className="text-sm font-semibold">
                                            {e.action} · {e.entity}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {e.actor}
                                        </div>
                                    </div>
                                    <time className="shrink-0 text-right text-xs text-slate-400">
                                        {e.createdAt}
                                    </time>
                                </div>
                            ))}
                            {recentEvents.length === 0 && (
                                <p className="py-6 text-sm text-slate-500">
                                    No audit events available.
                                </p>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}

import { Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    FileText,
    FolderKanban,
    ArrowRight,
    Building2,
    ShieldCheck,
    Users,
    Wrench,
    RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import { DashboardAnalytics } from '@/components/dashboard/dashboard-analytics';
import type { DashboardSummary } from '@/components/dashboard/dashboard-analytics';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import CanonicalUserManagement from '@/components/user-management/canonical-user-management';
import WorkspaceLguDirectory from '@/components/lgus/workspace-directory';
import '../../../css/maintenance-projects-exploration.css';

type Role = 'SuperAdmin' | 'Admin' | 'Engineer' | 'Viewer';
type Account = {
    id: number;
    username: string;
    email: string;
    account_type: Role;
    engineer_id: number | null;
    is_active: boolean;
};
type Engineer = {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    rank: string;
    engineer_status: string;
    contact_no: string | null;
};
type Lgu = {
    id: number;
    municipality_name: string;
    province: string;
    region: string;
    mayor_first_name: string;
    mayor_middle_name: string | null;
    mayor_last_name: string;
};
type Assignment = { engineer_id: number; lgu_id: number; is_active: boolean };
type DirectoryPaging = {
    tab: 'accounts' | 'engineers';
    search: string;
    role: string;
    state: string;
    page: number;
    pages: number;
    total: number;
    accountTotal: number;
    activeAccounts: number;
    engineerTotal: number;
    activeEngineers: number;
};
type Props = {
    historyUrl?: string | null;
    section: 'dashboard' | 'users' | 'lgus';
    identity: { role: Role; username: string; accountId: number };
    counts: {
        lgus: number;
        roadCoverages: number;
        maintenanceProjects: number | null;
        maintenanceRecords: number | null;
        monthlyUpdates: number | null;
        documents: number | null;
        userAccounts: number | null;
    };
    lgus: Lgu[];
    accounts: Account[];
    engineers: Engineer[];
    initialEngineerId?: number | null;
    directory?: DirectoryPaging | null;
    eligibleEngineers: Engineer[];
    eligibleEngineerTotal: number;
    assignments: Assignment[];
    canManage: boolean;
    canCreateRoles: Role[];
    status: string | null;
    analytics: DashboardSummary | null;
};
const panel =
    'rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,.04)]';

function StatCard({
    label,
    value,
    detail,
    icon: Icon,
}: {
    label: string;
    value: number | string;
    detail: string;
    icon: typeof Users;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-600">
                <span>{label}</span>
                <Icon className="h-5 w-5 text-amber-700" />
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                {value}
            </div>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
    );
}

export default function WorkspaceDirectory({
    section,
    identity,
    counts,
    lgus,
    accounts,
    engineers,
    initialEngineerId,
    directory,
    eligibleEngineers,
    eligibleEngineerTotal,
    canManage,
    canCreateRoles,
    status,
    analytics,
    historyUrl,
}: Props) {
    const [refreshing, setRefreshing] = useState(false);
    const adminDashboard = section === 'dashboard' && identity.role === 'Admin';

    if (section === 'lgus') {
        return (
            <>
                <Head title="LGU" />
                {status && (
                    <div
                        role="status"
                        className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
                    >
                        {status}
                    </div>
                )}
                <WorkspaceLguDirectory
                    initialLgus={lgus.map((x) => ({
                        id: Number(x.id),
                        municipalityName: x.municipality_name,
                        province: x.province,
                        region: x.region,
                        mayorFirstName: x.mayor_first_name,
                        mayorMiddleName: x.mayor_middle_name,
                        mayorLastName: x.mayor_last_name,
                        roadCoverageCount: null,
                        activeAssignmentCount: null,
                    }))}
                    availableFields={{
                        municipality: true,
                        province: true,
                        region: true,
                        mayorFirst: true,
                        mayorMiddle: true,
                        mayorLast: true,
                    }}
                    canCreate={identity.role !== 'Viewer' && canManage}
                />
            </>
        );
    }

    return (
        <div
            className={
                adminDashboard
                    ? 'jr-directory-exploration jr-admin-dashboard'
                    : 'jr-directory-exploration'
            }
        >
            <ProjectWorkspace>
                <Head
                    title={`JaiROADS — ${section === 'users' ? 'User Management' : 'Dashboard'}`}
                />
                <div className="jr-page-head">
                    <div>
                        {adminDashboard && (
                            <span className="jr-admin-access">
                                <ShieldCheck
                                    className="size-4"
                                    aria-hidden="true"
                                />{' '}
                                Administration Panel
                            </span>
                        )}
                        <h1>
                            {section === 'users'
                                ? 'User Management'
                                : adminDashboard
                                  ? 'Administration Dashboard'
                                  : 'Dashboard'}
                        </h1>
                        <p>
                            {section === 'users'
                                ? 'Manage user access and Engineer profiles.'
                                : identity.role === 'Admin'
                                  ? `Welcome, ${identity.username}. Coordinate day-to-day road maintenance operations and staff assignments.`
                                  : 'An overview of your road maintenance workspace.'}
                        </p>
                    </div>
                    {section === 'dashboard' && (
                        <button
                            type="button"
                            className={
                                adminDashboard
                                    ? 'jr-admin-refresh'
                                    : 'jr-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white'
                            }
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
                                aria-hidden="true"
                            />
                            {refreshing ? 'Refreshing…' : 'Refresh dashboard'}
                        </button>
                    )}
                </div>

                <main className="relative mx-0 -mt-3.5 min-w-0 space-y-6 rounded-t-[20px] bg-white px-4 pt-7 pb-10 shadow-sm sm:px-6 lg:-mx-7 lg:px-7">
                    {section === 'users' && canManage && (
                        <CanonicalUserManagement
                            key={initialEngineerId ?? 'directory'}
                            initialEngineerId={initialEngineerId}
                            directory={directory}
                            accounts={accounts}
                            engineers={engineers}
                            eligibleEngineers={eligibleEngineers}
                            eligibleEngineerTotal={eligibleEngineerTotal}
                            actorId={identity.accountId}
                            canCreateRoles={canCreateRoles}
                            accountTotal={counts.userAccounts}
                            status={status}
                        />
                    )}

                    {section === 'dashboard' && status && (
                        <div
                            role="status"
                            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
                        >
                            {status}
                        </div>
                    )}
                    {section === 'dashboard' && historyUrl && (
                        <p className="my-4">
                            <a className="underline" href={historyUrl}>
                                Preserved project history
                            </a>{' '}
                            · Administrative totals include retained records.
                            Detached history remains restricted to
                            Admin/SuperAdmin.
                        </p>
                    )}
                    {section === 'dashboard' && identity.role === 'Admin' && (
                        <div className="space-y-6">
                            <section
                                aria-label="Administration metrics"
                                className="jr-admin-metrics grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                            >
                                <StatCard
                                    label="Maintenance projects"
                                    value={counts.maintenanceProjects ?? 0}
                                    detail="Linked road maintenance projects"
                                    icon={FolderKanban}
                                />
                                <StatCard
                                    label="Maintenance records"
                                    value={counts.maintenanceRecords ?? 0}
                                    detail="Quarterly maintenance history"
                                    icon={Activity}
                                />
                                <StatCard
                                    label="Monthly updates"
                                    value={counts.monthlyUpdates ?? 0}
                                    detail="Progress reports"
                                    icon={FileText}
                                />
                                <StatCard
                                    label="LGUs"
                                    value={counts.lgus}
                                    detail="Municipalities in inventory"
                                    icon={Building2}
                                />
                            </section>
                            {analytics && (
                                <DashboardAnalytics
                                    data={analytics}
                                    compact
                                />
                            )}
                            <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
                                <div className={panel}>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Daily operations
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Access the workflows that Admin is
                                        permitted to manage.
                                    </p>
                                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                        {[
                                            [
                                                'Maintenance Projects',
                                                '/dd-phase3/projects',
                                                'Create and maintain projects and records',
                                            ],
                                            [
                                                'Monthly Updates',
                                                '/dd-phase3/updates',
                                                'Review monthly progress and evidence',
                                            ],
                                            [
                                                'Maintenance Documents',
                                                '/dd-phase3/documents',
                                                'Manage formal project documentation',
                                            ],
                                            [
                                                'Road Coverages',
                                                '/dd-phase3/roads',
                                                'Manage mapped road coverages',
                                            ],
                                            [
                                                'LGU',
                                                '/dd-phase3/lgus',
                                                'Manage municipality details',
                                            ],
                                            [
                                                'User Management',
                                                '/dd-phase3/users',
                                                'Provision accounts and manage Engineer profiles',
                                            ],
                                        ].map(([label, href, summary]) => (
                                            <Link
                                                key={label}
                                                href={href}
                                                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-amber-300 hover:bg-amber-50"
                                            >
                                                <div>
                                                    <div className="text-sm font-semibold text-slate-900">
                                                        {label}
                                                    </div>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {summary}
                                                    </p>
                                                </div>
                                                <ArrowRight className="h-4 w-4 shrink-0 text-amber-700 transition group-hover:translate-x-1" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    <div className={panel}>
                                        <h2 className="text-lg font-bold text-slate-900">
                                            Operations inventory
                                        </h2>
                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            <StatCard
                                                label="Road coverages"
                                                value={counts.roadCoverages}
                                                detail="Physical mapped road inventory"
                                                icon={Wrench}
                                            />
                                            <StatCard
                                                label="Documents"
                                                value={counts.documents ?? 0}
                                                detail="Linked formal documents"
                                                icon={FileText}
                                            />
                                            <StatCard
                                                label="User accounts"
                                                value={counts.userAccounts ?? 0}
                                                detail="Authorized business users"
                                                icon={Users}
                                            />
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-[#e9d5bb] bg-[#fff9ef] p-5 text-sm text-slate-700">
                                        <div className="font-bold text-slate-900">
                                            Admin versus SuperAdmin
                                        </div>
                                        <p className="mt-2 leading-6">
                                            Admin and SuperAdmin share ordinary
                                            CRUD where authorized by the Data
                                            Dictionary. This dashboard is
                                            designed for daily work; the
                                            SuperAdmin has a separate Command
                                            Center with system-wide activity and
                                            governance visibility.
                                        </p>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}
                    {section === 'dashboard' && identity.role !== 'Admin' && (
                        <section className={`${panel} mt-6`}>
                            <h2 className="text-xl font-bold">
                                Workspace overview
                            </h2>
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {[
                                    [
                                        'LGUs',
                                        counts.lgus,
                                        'Municipality directory',
                                        Building2,
                                    ],
                                    [
                                        'Road coverages',
                                        counts.roadCoverages,
                                        'Mapped inventory',
                                        Wrench,
                                    ],
                                    [
                                        'Maintenance projects',
                                        counts.maintenanceProjects,
                                        'Tracked road maintenance work',
                                        ShieldCheck,
                                    ],
                                    [
                                        'User accounts',
                                        counts.userAccounts,
                                        'Provisioned user identities',
                                        Users,
                                    ],
                                ].map(([label, value, detail, icon]) => (
                                    <StatCard
                                        key={String(label)}
                                        label={String(label)}
                                        value={
                                            value === null
                                                ? 'Scoped'
                                                : Number(value)
                                        }
                                        detail={String(detail)}
                                        icon={icon as typeof Users}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </main>
            </ProjectWorkspace>
        </div>
    );
}

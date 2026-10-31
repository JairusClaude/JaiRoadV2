import { Head, Link, router } from '@inertiajs/react';
import {
    BadgeCheck,
    Activity,
    FileText,
    FolderKanban,
    ArrowRight,
    Building2,
    Crown,
    ShieldCheck,
    TriangleAlert,
    UserCog,
    UserPlus,
    Users,
    Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { DdDashboardAnalytics } from '@/components/dd-dashboard-analytics';
import type { DdDashboardSummary } from '@/components/dd-dashboard-analytics';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import DdAccountLifecycle from '@/pages/dd-phase3/DdAccountLifecycle';
import DdEngineerLifecycle from '@/pages/dd-phase3/DdEngineerLifecycle';
import DdLguDirectory from '@/pages/dd-phase3/DdLguDirectory';

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
type Props = {
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
    eligibleEngineers: Engineer[];
    assignments: Assignment[];
    canManage: boolean;
    canCreateRoles: Role[];
    status: string | null;
    analytics: DdDashboardSummary | null;
};
const inp =
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100';
const btn =
    'rounded-xl bg-[#90451f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#773917] disabled:cursor-not-allowed disabled:opacity-50';
const ghostBtn =
    'rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50';
const panel =
    'rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,.04)]';
const sectionTitle = 'text-lg font-bold text-slate-900';
const muted = 'text-sm text-slate-500';

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

function RoleBadge({ role }: { role: Role }) {
    const styles: Record<Role, string> = {
        SuperAdmin: 'border-amber-300 bg-amber-50 text-amber-800',
        Admin: 'border-orange-200 bg-orange-50 text-orange-800',
        Engineer: 'border-sky-200 bg-sky-50 text-sky-800',
        Viewer: 'border-slate-200 bg-slate-50 text-slate-700',
    };

    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[role]}`}
        >
            {role}
        </span>
    );
}

function FieldError({ message }: { message?: string }) {
    if (!message) {
        return null;
    }

    return <span className="mt-1 block text-xs text-red-700">{message}</span>;
}

export default function DdPhase3Workspace({
    section,
    identity,
    counts,
    lgus,
    accounts,
    engineers,
    eligibleEngineers,
    assignments,
    canManage,
    canCreateRoles,
    status,
    analytics,
}: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [account, setAccount] = useState({
        username: '',
        email: '',
        name: '',
        account_type: canCreateRoles[0] ?? 'Viewer',
        engineer_id: '',
        password: '',
        password_confirmation: '',
    });
    const [engineer, setEngineer] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        contact_no: '',
        rank: '',
    });
    const [assignment, setAssignment] = useState({
        engineer_id: '',
        lgu_id: '',
        is_active: '1',
    });
    const [validation, setValidation] = useState<Record<string, string>>({});

    const activeEngineers = useMemo(
        () => engineers.filter((entry) => entry.engineer_status === 'Active'),
        [engineers],
    );
    const availableEngineers = eligibleEngineers;
    const activeAccounts = accounts.filter((entry) => entry.is_active).length;
    const privilegedAccounts = accounts.filter((entry) =>
        ['SuperAdmin', 'Admin'].includes(entry.account_type),
    ).length;
    const activeAssignments = assignments.filter(
        (entry) => entry.is_active,
    ).length;
    const validationSummary = Object.entries(validation);
    const managerRoleSelected = account.account_type !== 'Viewer';
    const assignmentLookup = useMemo(() => {
        const map = new Map<number, number>();
        assignments.forEach((item) => {
            if (item.is_active) {
                map.set(item.engineer_id, (map.get(item.engineer_id) ?? 0) + 1);
            }
        });

        return map;
    }, [assignments]);

    const submit = (
        url: string,
        data: Record<string, string>,
        clear: () => void,
    ) => {
        setBusy(true);
        setError('');
        setValidation({});
        router.post(url, data, {
            preserveScroll: true,
            onError: (issues) => {
                setValidation(issues);
                setError('The form was not saved. Review the field errors.');
            },
            onSuccess: () => clear(),
            onFinish: () => setBusy(false),
        });
    };

    const fields = (
        v: Record<string, string>,
        update: (values: any) => void,
        names: [string, string, string, string?][],
    ) =>
        names.map(([key, label, type, help]) => (
            <label
                key={key}
                className="block text-xs font-semibold text-slate-600"
            >
                {label}
                <input
                    className={`${inp} mt-1`}
                    type={type}
                    value={v[key] ?? ''}
                    autoComplete="off"
                    onChange={(e) => update({ ...v, [key]: e.target.value })}
                />
                {help && (
                    <span className="mt-1 block text-[11px] text-slate-500">
                        {help}
                    </span>
                )}
                <FieldError message={validation[key]} />
            </label>
        ));

    const isManager = canManage;

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
                <DdLguDirectory
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
                    canCreate={canManage}
                />
            </>
        );
    }

    return (
        <ProjectWorkspace>
            <Head
                title={`JaiROADS — ${section === 'users' ? 'User Management' : 'Dashboard'}`}
            />
            <div className="jr-page-head">
                <div>
                    <h1>
                        {section === 'users' ? 'User Management' : 'Dashboard'}
                    </h1>
                    <p>
                        {section === 'users'
                            ? 'Create engineers, link assignments, and provision data-dictionary compliant accounts.'
                            : identity.role === 'Admin'
                              ? 'Coordinate day-to-day road maintenance operations and staff assignments.'
                              : 'An overview of your road maintenance workspace.'}
                    </p>
                </div>
                {section === 'dashboard' && (
                    <button
                        type="button"
                        className="jr-primary rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                        onClick={() => router.reload()}
                    >
                        Refresh data
                    </button>
                )}
            </div>

            {section === 'users' && isManager && (
                <DdAccountLifecycle
                    accounts={accounts}
                    actorId={identity.accountId}
                />
            )}
            {section === 'users' && isManager && (
                <DdEngineerLifecycle engineers={engineers} />
            )}
            {section === 'users' && isManager && (
                <section className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <div
                        className={`relative overflow-hidden rounded-[28px] px-6 py-6 shadow-[0_20px_45px_rgba(17,28,51,.08)] ${identity.role === 'SuperAdmin' ? 'bg-[#111c33] text-white' : 'border border-[#eadbc8] bg-gradient-to-br from-[#fff8ee] to-white text-[#17304b]'}`}
                    >
                        <div
                            aria-hidden="true"
                            className={`pointer-events-none absolute -top-20 -right-16 h-72 w-72 rounded-full border-[48px] ${identity.role === 'SuperAdmin' ? 'border-amber-300/10' : 'border-[#efcf9d]/20'}`}
                        />
                        <div className="relative max-w-3xl space-y-3">
                            <div
                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold tracking-[.13em] uppercase ${identity.role === 'SuperAdmin' ? 'border-amber-300/20 bg-amber-300/10 text-amber-300' : 'border-amber-200 bg-white text-amber-800'}`}
                            >
                                {identity.role === 'SuperAdmin' ? (
                                    <Crown className="h-3.5 w-3.5" />
                                ) : (
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                )}
                                {identity.role === 'SuperAdmin'
                                    ? 'Verified SuperAdmin Governance'
                                    : 'Verified Administrative Access'}
                            </div>
                            <h2 className="text-3xl font-bold tracking-tight">
                                {identity.role === 'SuperAdmin'
                                    ? 'Access Governance'
                                    : 'People & Access Operations'}
                            </h2>
                            <p
                                className={`max-w-2xl text-sm leading-6 ${identity.role === 'SuperAdmin' ? 'text-slate-300' : 'text-slate-600'}`}
                            >
                                New Admin and Engineer accounts require an
                                active, available Engineer profile. Existing
                                unlinked Admin accounts retain their permitted
                                access.
                            </p>
                            <div className="grid gap-3 pt-2 sm:grid-cols-3">
                                <div
                                    className={`rounded-2xl border p-4 ${identity.role === 'SuperAdmin' ? 'border-white/10 bg-white/5' : 'border-[#eadbc8] bg-white/75'}`}
                                >
                                    <div
                                        className={`text-xs tracking-wide uppercase ${identity.role === 'SuperAdmin' ? 'text-slate-400' : 'text-slate-500'}`}
                                    >
                                        Engineer pool
                                    </div>
                                    <div className="mt-2 text-2xl font-bold">
                                        {availableEngineers.length}
                                    </div>
                                    <div
                                        className={`mt-1 text-xs ${identity.role === 'SuperAdmin' ? 'text-slate-300' : 'text-slate-600'}`}
                                    >
                                        active profiles available for linking
                                    </div>
                                </div>
                                <div
                                    className={`rounded-2xl border p-4 ${identity.role === 'SuperAdmin' ? 'border-white/10 bg-white/5' : 'border-[#eadbc8] bg-white/75'}`}
                                >
                                    <div
                                        className={`text-xs tracking-wide uppercase ${identity.role === 'SuperAdmin' ? 'text-slate-400' : 'text-slate-500'}`}
                                    >
                                        Account integrity
                                    </div>
                                    <div className="mt-2 text-2xl font-bold">
                                        {activeAccounts}
                                    </div>
                                    <div
                                        className={`mt-1 text-xs ${identity.role === 'SuperAdmin' ? 'text-slate-300' : 'text-slate-600'}`}
                                    >
                                        active user accounts retained
                                    </div>
                                </div>
                                <div
                                    className={`rounded-2xl border p-4 ${identity.role === 'SuperAdmin' ? 'border-white/10 bg-white/5' : 'border-[#eadbc8] bg-white/75'}`}
                                >
                                    <div
                                        className={`text-xs tracking-wide uppercase ${identity.role === 'SuperAdmin' ? 'text-slate-400' : 'text-slate-500'}`}
                                    >
                                        Active LGU links
                                    </div>
                                    <div className="mt-2 text-2xl font-bold">
                                        {activeAssignments}
                                    </div>
                                    <div
                                        className={`mt-1 text-xs ${identity.role === 'SuperAdmin' ? 'text-slate-300' : 'text-slate-600'}`}
                                    >
                                        current engineer-to-LGU assignments
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={`${panel} grid gap-3`}>
                        <div>
                            <h2 className={sectionTitle}>Provisioning rules</h2>
                            <p className={muted}>
                                New Admin/Engineer accounts require a Linked
                                Engineer; account uniqueness and password rules
                                still apply.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                            <div className="flex items-start gap-3">
                                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                                <div className="space-y-2">
                                    <p className="font-semibold">
                                        Updated account creation rules
                                    </p>
                                    <ul className="list-disc space-y-1 pl-5 text-[13px] leading-6">
                                        <li>
                                            New Admin and Engineer accounts must
                                            have an Engineer link.
                                        </li>
                                        <li>
                                            Viewer accounts must not be linked
                                            to an Engineer.
                                        </li>
                                        <li>
                                            The required link must reference an
                                            active Engineer profile that no
                                            other account uses.
                                        </li>
                                        <li>
                                            Passwords must be strong and must
                                            match the confirmation field.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <StatCard
                                label="Privileged accounts"
                                value={privilegedAccounts}
                                detail="SuperAdmin and Admin accounts"
                                icon={ShieldCheck}
                            />
                            <StatCard
                                label="Engineer profiles"
                                value={activeEngineers.length}
                                detail={`${availableEngineers.length} unlinked and available`}
                                icon={Wrench}
                            />
                        </div>
                    </div>
                </section>
            )}

            {status && (
                <div
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
                >
                    {status}
                </div>
            )}
            {error && (
                <div
                    role="alert"
                    className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                    <div className="font-semibold">{error}</div>
                    {validationSummary.length > 0 && (
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px]">
                            {validationSummary.map(([field, message]) => (
                                <li key={field}>
                                    <span className="font-medium">
                                        {field.replace(/_/g, ' ')}:
                                    </span>{' '}
                                    {message}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            {section === 'dashboard' && identity.role === 'Admin' && (
                <div className="space-y-6">
                    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                        <DdDashboardAnalytics data={analytics} compact />
                    )}
                    <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
                        <div className={panel}>
                            <h2 className="text-lg font-bold text-slate-900">
                                Daily operations
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Access the workflows that Admin is permitted to
                                manage.
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
                                        'Project Documents',
                                        '/dd-phase3/documents',
                                        'Manage formal project documentation',
                                    ],
                                    [
                                        'Road Sections',
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
                                        'Provision accounts and maintain assignments',
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
                                    Admin and SuperAdmin share ordinary CRUD
                                    where authorized by the Data Dictionary.
                                    This dashboard is designed for daily work;
                                    the SuperAdmin has a separate Command Center
                                    with system-wide activity and governance
                                    visibility.
                                </p>
                            </div>
                        </div>
                    </section>
                </div>
            )}
            {section === 'dashboard' && identity.role !== 'Admin' && (
                <section className={`${panel} mt-6`}>
                    <h2 className="text-xl font-bold">Workspace overview</h2>
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
                                    value === null ? 'Scoped' : Number(value)
                                }
                                detail={String(detail)}
                                icon={icon as typeof Users}
                            />
                        ))}
                    </div>
                </section>
            )}
            {section === 'users' && isManager && (
                <>
                    <section className={`${panel} mt-6`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 className={sectionTitle}>User accounts</h2>
                                <p className={muted}>
                                    Provisioned business identities with Account
                                    Type, linked Engineer, and active status.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs font-semibold">
                                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
                                    {accounts.length} total accounts
                                </span>
                                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-700">
                                    {activeAccounts} active
                                </span>
                            </div>
                        </div>
                        <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold">
                                            Account
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Account Type
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Linked engineer
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {accounts.map((a) => {
                                        const linked = engineers.find(
                                            (item) => item.id === a.engineer_id,
                                        );

                                        return (
                                            <tr key={a.id}>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-slate-900">
                                                        {a.username}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {a.email}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <RoleBadge
                                                        role={a.account_type}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    {linked
                                                        ? `${linked.first_name} ${linked.last_name} · #${linked.id}`
                                                        : a.account_type ===
                                                            'Engineer'
                                                          ? 'Unlinked · LGU editing disabled'
                                                          : 'Not linked'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${a.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                                                    >
                                                        {a.is_active
                                                            ? 'Active'
                                                            : 'Inactive'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {accounts.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="px-4 py-8 text-center text-slate-500"
                                            >
                                                No user accounts available.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                        <div className="space-y-6">
                            <section className={panel}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className={sectionTitle}>
                                            Create Engineer profile
                                        </h2>
                                        <p className={muted}>
                                            Create an active Engineer first,
                                            then link that Engineer to an
                                            account if needed. Rank describes
                                            professional standing; Account Type
                                            controls permissions.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                                        <Wrench className="h-5 w-5" />
                                    </div>
                                </div>
                                <form
                                    className="mt-4 grid gap-3 sm:grid-cols-2"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        submit(
                                            '/dd-phase3/engineers',
                                            engineer,
                                            () =>
                                                setEngineer({
                                                    first_name: '',
                                                    middle_name: '',
                                                    last_name: '',
                                                    contact_no: '',
                                                    rank: '',
                                                }),
                                        );
                                    }}
                                >
                                    {fields(engineer, setEngineer, [
                                        ['first_name', 'First name', 'text'],
                                        [
                                            'middle_name',
                                            'Middle name (optional)',
                                            'text',
                                        ],
                                        ['last_name', 'Last name', 'text'],
                                        [
                                            'contact_no',
                                            'Contact number',
                                            'text',
                                            'Required by the current business rules.',
                                        ],
                                        ['rank', 'Rank', 'text'],
                                    ])}
                                    <div className="sm:col-span-2">
                                        <button disabled={busy} className={btn}>
                                            Create engineer
                                        </button>
                                    </div>
                                </form>
                            </section>

                            <section className={panel}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className={sectionTitle}>
                                            Engineer assignments
                                        </h2>
                                        <p className={muted}>
                                            Assign active Engineers to LGUs.
                                            Inactive assignments are retained as
                                            history.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-sky-50 p-3 text-sky-700">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                </div>
                                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                    {assignments.length} assignment(s) total ·{' '}
                                    {activeAssignments} active
                                </div>
                                <form
                                    className="mt-4 grid gap-3 sm:grid-cols-3"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        submit(
                                            '/dd-phase3/assignments',
                                            assignment,
                                            () =>
                                                setAssignment({
                                                    engineer_id: '',
                                                    lgu_id: '',
                                                    is_active: '1',
                                                }),
                                        );
                                    }}
                                >
                                    <label className="text-xs font-semibold text-slate-600">
                                        Engineer
                                        <select
                                            className={`${inp} mt-1`}
                                            value={assignment.engineer_id}
                                            onChange={(e) =>
                                                setAssignment({
                                                    ...assignment,
                                                    engineer_id: e.target.value,
                                                })
                                            }
                                        >
                                            <option value="">
                                                Select Engineer
                                            </option>
                                            {activeEngineers.map((e) => (
                                                <option key={e.id} value={e.id}>
                                                    {e.first_name} {e.last_name}{' '}
                                                    ·{' '}
                                                    {assignmentLookup.get(
                                                        e.id,
                                                    ) ?? 0}{' '}
                                                    active LGU link(s)
                                                </option>
                                            ))}
                                        </select>
                                        <FieldError
                                            message={validation.engineer_id}
                                        />
                                    </label>
                                    <label className="text-xs font-semibold text-slate-600">
                                        LGU
                                        <select
                                            className={`${inp} mt-1`}
                                            value={assignment.lgu_id}
                                            onChange={(e) =>
                                                setAssignment({
                                                    ...assignment,
                                                    lgu_id: e.target.value,
                                                })
                                            }
                                        >
                                            <option value="">Select LGU</option>
                                            {lgus.map((l) => (
                                                <option key={l.id} value={l.id}>
                                                    {l.municipality_name}
                                                </option>
                                            ))}
                                        </select>
                                        <FieldError
                                            message={validation.lgu_id}
                                        />
                                    </label>
                                    <label className="text-xs font-semibold text-slate-600">
                                        State
                                        <select
                                            className={`${inp} mt-1`}
                                            value={assignment.is_active}
                                            onChange={(e) =>
                                                setAssignment({
                                                    ...assignment,
                                                    is_active: e.target.value,
                                                })
                                            }
                                        >
                                            <option value="1">Active</option>
                                            <option value="0">Inactive</option>
                                        </select>
                                        <FieldError
                                            message={validation.is_active}
                                        />
                                    </label>
                                    <div className="sm:col-span-3">
                                        <button className={btn} disabled={busy}>
                                            Save assignment
                                        </button>
                                    </div>
                                </form>
                            </section>
                        </div>

                        <section className={panel}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h2 className={sectionTitle}>
                                        Create account
                                    </h2>
                                    <p className={muted}>
                                        Provision Admin, Engineer, or Viewer
                                        accounts. Admin and Engineer require a
                                        Linked Engineer.
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-violet-50 p-3 text-violet-700">
                                    <UserPlus className="h-5 w-5" />
                                </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <ShieldCheck className="h-4 w-4 text-amber-700" />{' '}
                                        Admin
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                        Requires an active available Engineer
                                        profile. Account Type remains Admin.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <UserCog className="h-4 w-4 text-sky-700" />{' '}
                                        Engineer
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                        Requires an active available Engineer
                                        profile. LGU editing also requires an
                                        active assignment.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                        <BadgeCheck className="h-4 w-4 text-slate-700" />{' '}
                                        Viewer
                                    </div>
                                    <p className="mt-2 text-xs leading-5 text-slate-500">
                                        Must remain unlinked to an Engineer
                                        profile.
                                    </p>
                                </div>
                            </div>

                            {managerRoleSelected && (
                                <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                                    New Admin and Engineer accounts require a
                                    Linked Engineer. Create an active Engineer
                                    profile with its professional Rank first if
                                    no eligible profile is available.
                                </div>
                            )}

                            <form
                                className="mt-5 grid gap-4 sm:grid-cols-2"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    submit(
                                        '/dd-phase3/accounts',
                                        {
                                            ...account,
                                            engineer_id:
                                                account.account_type ===
                                                'Viewer'
                                                    ? ''
                                                    : account.engineer_id,
                                        },
                                        () =>
                                            setAccount({
                                                username: '',
                                                email: '',
                                                name: '',
                                                account_type:
                                                    account.account_type,
                                                engineer_id: '',
                                                password: '',
                                                password_confirmation: '',
                                            }),
                                    );
                                }}
                            >
                                {fields(account, setAccount, [
                                    [
                                        'username',
                                        'Username',
                                        'text',
                                        'Letters, numbers, underscore, dot, and hyphen are allowed.',
                                    ],
                                    ['email', 'Email', 'email'],
                                    ['name', 'Display name', 'text'],
                                ])}
                                <label className="text-xs font-semibold text-slate-600">
                                    Account Type
                                    <select
                                        className={`${inp} mt-1`}
                                        value={account.account_type}
                                        onChange={(e) => {
                                            const nextRole = e.target
                                                .value as Role;
                                            const nextEngineer =
                                                nextRole === 'Viewer'
                                                    ? ''
                                                    : account.engineer_id;
                                            setAccount({
                                                ...account,
                                                account_type: nextRole,
                                                engineer_id: nextEngineer,
                                            });
                                        }}
                                    >
                                        {canCreateRoles.map((r) => (
                                            <option key={r} value={r}>
                                                {r}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="mt-1 block text-[11px] text-slate-500">
                                        Viewer stays unlinked. New Admin and
                                        Engineer accounts must link to an
                                        available active Engineer.
                                    </span>
                                    <FieldError
                                        message={validation.account_type}
                                    />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                    Linked Engineer
                                    <select
                                        required={
                                            account.account_type !== 'Viewer'
                                        }
                                        className={`${inp} mt-1`}
                                        value={account.engineer_id}
                                        onChange={(e) =>
                                            setAccount({
                                                ...account,
                                                engineer_id: e.target.value,
                                            })
                                        }
                                        disabled={
                                            account.account_type === 'Viewer'
                                        }
                                    >
                                        <option value="">
                                            {account.account_type === 'Viewer'
                                                ? 'Viewer remains unlinked'
                                                : 'Select a Linked Engineer (required)'}
                                        </option>
                                        {availableEngineers.map((e) => (
                                            <option key={e.id} value={e.id}>
                                                {e.first_name} {e.last_name} ·{' '}
                                                {e.rank}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="mt-1 block text-[11px] text-slate-500">
                                        {availableEngineers.length} Engineer
                                        profile(s) available for new linked
                                        accounts.
                                    </span>
                                    <FieldError
                                        message={validation.engineer_id}
                                    />
                                </label>
                                {fields(account, setAccount, [
                                    [
                                        'password',
                                        'Password',
                                        'password',
                                        'Use at least 12 characters with upper/lowercase letters, numbers, and symbols.',
                                    ],
                                    [
                                        'password_confirmation',
                                        'Confirm password',
                                        'password',
                                    ],
                                ])}
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                                    <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                                        Provisioning checklist
                                    </div>
                                    <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                                        <li>
                                            • Username and email must be unique.
                                        </li>
                                        <li>
                                            • Admin and Engineer may be created
                                            without an Engineer profile.
                                        </li>
                                        <li>
                                            • Viewer must not have an Engineer
                                            link.
                                        </li>
                                        <li>
                                            • Linking later is a separate
                                            privileged workflow; unlinked
                                            Engineer has no LGU edit access.
                                        </li>
                                        <li>
                                            • Password and confirmation must
                                            match.
                                        </li>
                                    </ul>
                                </div>
                                <div className="flex flex-wrap gap-3 sm:col-span-2">
                                    <button className={btn} disabled={busy}>
                                        Create account
                                    </button>
                                    <button
                                        type="button"
                                        className={ghostBtn}
                                        onClick={() =>
                                            setAccount({
                                                username: '',
                                                email: '',
                                                name: '',
                                                account_type:
                                                    canCreateRoles[0] ??
                                                    'Viewer',
                                                engineer_id: '',
                                                password: '',
                                                password_confirmation: '',
                                            })
                                        }
                                    >
                                        Reset form
                                    </button>
                                </div>
                            </form>
                        </section>
                    </section>
                </>
            )}
        </ProjectWorkspace>
    );
}

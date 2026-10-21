import { Head, router, usePage } from '@inertiajs/react';
import { Settings2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { useAppearance } from '@/hooks/use-appearance';
import DdDocuments from '@/pages/dd-phase3/DdDocuments';
import DdMaintenanceProjects from '@/pages/dd-phase3/DdMaintenanceProjects';
import DdMonthlyUpdates from '@/pages/dd-phase3/DdMonthlyUpdates';
import DdQuarterlyMaintenance from '@/pages/dd-phase3/DdQuarterlyMaintenance';
import type { QuarterlyProps } from '@/pages/dd-phase3/DdQuarterlyMaintenance';
import DdRoadSections from '@/pages/dd-phase3/DdRoadSections';

type Role = 'SuperAdmin' | 'Admin' | 'Engineer' | 'Viewer';
type Row = Record<string, any>;
// Reuse the project adapter's exact incoming prop contract. The backend already
// supplies the fields from jairoads_next; do not erase them to generic Row[].
type ProjectInputs = ComponentProps<typeof DdMaintenanceProjects>;
type Props = {
    section: 'settings' | 'roads' | 'projects' | 'updates' | 'documents';
    role: Role;
    canManage: boolean;
    capabilities: {
        role: Role;
        manageAccounts: boolean;
        readAuditLog: boolean;
        createProjects: boolean;
        updateProjects: boolean;
        deleteProjects: boolean;
        createRoads: boolean;
        updateRoads: boolean;
        deleteRoads: boolean;
        createUpdates: boolean;
        createDocuments: boolean;
        manageLgus: boolean;
        readOnly: boolean;
        assignedScope: boolean;
    };
    engineerId: number | null;
    hasAssignment: boolean;
    identity: { role: Role; username: string; email: string };
    lgus: ProjectInputs['lgus'];
    engineers: Row[];
    maintenanceHistory: QuarterlyProps['records'];
    maintenanceSchedule: QuarterlyProps['schedule'];
    managerChoices: QuarterlyProps['managers'];
    roadCreatorChoices: {
        id: number;
        lgu_id: number;
        first_name: string;
        last_name: string;
    }[];
    roads: ProjectInputs['roads'];
    projects: ProjectInputs['projects'];
    records: (ProjectInputs['records'][number] & {
        managing_engineer_id: number;
        start_date: string;
        estimated_duration_days: number;
        complete_date: string | null;
        description: string | null;
    })[];
    updates: Row[];
    documents: Row[];
    media: Row[];
    documentsReady: boolean;
    mediaReady: boolean;
    status: string | null;
};
const box = 'rounded-2xl border border-[#e2e8f1] bg-white p-5 sm:p-6';
const tiny =
    'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs hover:bg-slate-50';
const input =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100';
const action =
    'rounded-lg bg-[#90451f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#773917] disabled:opacity-60';
const names: Record<Props['section'], string> = {
    settings: 'Settings',
    roads: 'Road Sections',
    projects: 'Maintenance Projects',
    updates: 'Monthly Updates',
    documents: 'Project Documents',
};
export default function Operations({
    section,
    role,
    canManage,
    capabilities,
    engineerId,
    hasAssignment,
    identity,
    lgus,
    maintenanceHistory,
    maintenanceSchedule,
    managerChoices,
    roadCreatorChoices,
    roads,
    projects,
    records,
    updates,
    documents,
    media,
    documentsReady,
    mediaReady,
    status,
}: Props) {
    const [settings, setSettings] = useState({
        username: identity.username,
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    const [busy, setBusy] = useState(false);
    const [issues, setIssues] = useState<Record<string, string>>({});
    const [error, setError] = useState('');
    const isSuperAdmin = role === 'SuperAdmin';
    const settingsHeroTheme = isSuperAdmin
        ? 'border border-[#111c33] bg-[#111c33] text-white'
        : role === 'Admin'
          ? 'border border-amber-200 bg-gradient-to-br from-[#fff6e8] to-white text-[#1c2b40]'
          : role === 'Engineer'
            ? 'border border-sky-200 bg-gradient-to-br from-[#eef7ff] to-white text-[#1c344e]'
            : 'border border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-800';
    const settingsPanelClass = isSuperAdmin
        ? 'border-white/10 bg-white/5'
        : 'border-slate-200 bg-white/80';
    const settingsMuted = isSuperAdmin ? 'text-slate-300' : 'text-slate-600';
    const { appearance, updateAppearance } = useAppearance();
    const submit = (
        url: string,
        data: Record<string, string | File | null>,
        method: 'post' | 'put' = 'post',
        done?: () => void,
        upload = false,
    ) => {
        setBusy(true);
        setIssues({});
        setError('');
        router.visit(url, {
            method,
            data,
            forceFormData: upload,
            preserveScroll: true,
            onSuccess: () => {
                if (done) {
                    done();
                }
            },
            onError: (bad) => {
                setIssues(bad);
                setError(
                    Object.values(bad)[0] ||
                        'Please review the form and try again.',
                );
            },
            onFinish: () => setBusy(false),
        });
    };
    const page = usePage();
    const notice = (
        <>
            {status && (
                <div
                    role="status"
                    className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                >
                    {status}
                </div>
            )}
            {error && (
                <div
                    role="alert"
                    className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                    {error}
                </div>
            )}
        </>
    );
    const recordChoices = records.map((x) => ({
        id: Number(x.id),
        projectId: Number(x.project_id),
        projectTitle:
            projects.find((p) => Number(p.id) === Number(x.project_id))
                ?.project_title ?? `Project #${x.project_id}`,
        year: Number(x.maintenance_year),
        quarter: x.quarter,
        status: x.status,
    }));
    const writableRecords = records.filter(
        (record) =>
            canManage ||
            (capabilities.createUpdates &&
                Number(record.managing_engineer_id) === Number(engineerId)),
    );
    const writableRecordIds = writableRecords.map((x) => Number(x.id));

    if (section === 'roads') {
        return (
            <>
                <Head title="Road Sections" />
                {notice}
                <DdRoadSections
                    initialCoverages={roads.map((x) => {
                        const row = x as typeof x & {
                            state_category: string;
                            created_by: number;
                        };
                        const project = projects.find(
                            (p) => Number(p.road_coverage_id) === Number(x.id),
                        );

                        return {
                            id: Number(x.id),
                            roadName: x.road_name,
                            lguId: Number(x.lgu_id),
                            kilometers: Number(x.kilometers),
                            pavementType: x.pavement_type,
                            stateCategory: row.state_category,
                            geojson: x.geojson,
                            createdByEngineerId: Number(row.created_by),
                            projectId: project ? Number(project.id) : null,
                            projectTitle: project?.project_title ?? null,
                        };
                    })}
                    lgus={lgus.map((x) => ({
                        id: Number(x.id),
                        name: x.municipality_name,
                    }))}
                    roadCreatorChoices={canManage ? roadCreatorChoices : []}
                    schemaNotice={
                        canManage && roadCreatorChoices.length === 0
                            ? 'Before creating a road coverage, assign an active Engineer to an LGU in User Management. The selected Engineer must have prepared the mapped road.'
                            : null
                    }
                    canCreate={capabilities.createRoads}
                    canEdit={capabilities.updateRoads}
                    canManage={capabilities.deleteRoads}
                />
            </>
        );
    }

    if (section === 'updates') {
        return (
            <>
                <Head title="Monthly Updates" />
                {notice}
                <DdMonthlyUpdates
                    initialUpdates={updates.map((x) => ({
                        id: Number(x.id),
                        maintenanceRecordId: Number(x.maintenance_id),
                        month: x.update_month,
                        summary: x.summary_of_text_reports ?? '',
                        progressPercentage: Number(x.progress_percentage),
                        author: x.author_name ?? '—',
                        createdAt: null,
                        mediaCount: media.filter(
                            (m) => Number(m.monthly_update_id) === Number(x.id),
                        ).length,
                        mediaFiles: media
                            .filter(
                                (m) =>
                                    Number(m.monthly_update_id) ===
                                    Number(x.id),
                            )
                            .map((m) => ({
                                id: Number(m.id),
                                name: m.file_name,
                            })),
                    }))}
                    maintenanceRecords={recordChoices}
                    canWrite={capabilities.createUpdates}
                    canManage={canManage}
                    writableRecordIds={writableRecordIds}
                    mediaReady={mediaReady}
                />
            </>
        );
    }

    if (section === 'documents') {
        return (
            <>
                <Head title="Project Documents" />
                {notice}
                <DdDocuments
                    initialDocuments={documents.map((x) => ({
                        id: Number(x.id),
                        maintenanceRecordId: Number(x.maintenance_id),
                        title: x.document_title,
                        description: x.description ?? null,
                        fileName: x.file_name,
                        uploadedBy: x.uploader_name ?? '—',
                        uploadedAt: x.uploaded_at ?? null,
                    }))}
                    maintenanceRecords={recordChoices}
                    canUpload={capabilities.createDocuments}
                    uploadsReady={documentsReady}
                    writableRecordIds={writableRecordIds}
                />
            </>
        );
    }

    const projectView =
        new URLSearchParams(page.url.split('?')[1] ?? '').get('view') ??
        'directory';
    const selectedProjectId = new URLSearchParams(
        page.url.split('?')[1] ?? '',
    ).get('project');
    const selectedProject = projects.find(
        (project) => String(project.id) === selectedProjectId,
    );

    if (section === 'projects') {
        return (
            <>
                {notice}
                <DdMaintenanceProjects
                    canCreate={capabilities.createProjects}
                    canUpdate={capabilities.updateProjects}
                    canManage={capabilities.deleteProjects}
                    roads={roads}
                    lgus={lgus}
                    projects={projects}
                    records={
                        projectView === 'show' ? maintenanceHistory : records
                    }
                />
                {projectView === 'show' && selectedProject && (
                    <DdQuarterlyMaintenance
                        key={selectedProject.id}
                        project={selectedProject}
                        records={maintenanceHistory}
                        schedule={maintenanceSchedule}
                        managers={managerChoices}
                        canCreate={capabilities.createProjects}
                        canManage={canManage}
                        engineerId={engineerId}
                        canEdit={role === 'Engineer' && hasAssignment}
                    />
                )}
            </>
        );
    }

    return (
        <ProjectWorkspace>
            <Head title={`JaiROADS — ${names[section]}`} />
            <div className="jr-page-head">
                <div>
                    <h1>Settings</h1>
                    <p>
                        Manage your account, password, and display preferences.
                    </p>
                </div>
            </div>
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
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                    {error}
                </div>
            )}
            {section === 'settings' && (
                <>
                    <section
                        className={`relative overflow-hidden rounded-[28px] px-6 py-6 shadow-[0_16px_34px_rgba(17,28,51,.08)] ${settingsHeroTheme}`}
                    >
                        <div
                            aria-hidden="true"
                            className={`pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full border-[48px] ${isSuperAdmin ? 'border-amber-300/10' : 'border-amber-300/15'}`}
                        />
                        <div className="relative grid gap-4 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
                            <div className="space-y-3">
                                <div
                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold tracking-[.13em] uppercase ${isSuperAdmin ? 'border-amber-300/20 bg-amber-300/10 text-amber-300' : 'border-amber-200 bg-white text-amber-800'}`}
                                >
                                    <ShieldCheck className="h-3.5 w-3.5" />{' '}
                                    Verified {identity.role}
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight">
                                    Account and security
                                </h2>
                                <p
                                    className={`max-w-2xl text-sm leading-6 ${settingsMuted}`}
                                >
                                    {role === 'SuperAdmin'
                                        ? 'Verify your privileged account and manage authorized security settings. System oversight remains in the Command Center.'
                                        : role === 'Admin'
                                          ? 'Administrative profile and approved credential management for daily operations.'
                                          : role === 'Engineer'
                                            ? 'Your operational identity and local appearance preferences. Account changes require an administrator.'
                                            : 'Your read-only identity and personal display preferences.'}
                                </p>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div
                                        className={`rounded-2xl border p-4 ${settingsPanelClass}`}
                                    >
                                        <div
                                            className={`text-xs tracking-wide uppercase ${isSuperAdmin ? 'text-slate-400' : 'text-slate-500'}`}
                                        >
                                            Identity
                                        </div>
                                        <div className="mt-2 text-base font-semibold">
                                            {identity.username}
                                        </div>
                                        <div
                                            className={`mt-1 text-xs ${settingsMuted}`}
                                        >
                                            {identity.email}
                                        </div>
                                    </div>
                                    <div
                                        className={`rounded-2xl border p-4 ${settingsPanelClass}`}
                                    >
                                        <div
                                            className={`text-xs tracking-wide uppercase ${isSuperAdmin ? 'text-slate-400' : 'text-slate-500'}`}
                                        >
                                            Account Type
                                        </div>
                                        <div className="mt-2 text-base font-semibold">
                                            {identity.role}
                                        </div>
                                        <div
                                            className={`mt-1 text-xs ${settingsMuted}`}
                                        >
                                            {canManage
                                                ? 'Privileged management access'
                                                : 'Scoped account access'}
                                        </div>
                                    </div>
                                    <div
                                        className={`rounded-2xl border p-4 ${settingsPanelClass}`}
                                    >
                                        <div
                                            className={`text-xs tracking-wide uppercase ${isSuperAdmin ? 'text-slate-400' : 'text-slate-500'}`}
                                        >
                                            Security policy
                                        </div>
                                        <div className="mt-2 text-base font-semibold">
                                            Password rotation
                                        </div>
                                        <div
                                            className={`mt-1 text-xs ${settingsMuted}`}
                                        >
                                            Requires current password
                                            verification
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div
                                className={`rounded-3xl border p-5 ${settingsPanelClass}`}
                            >
                                <div
                                    className={`flex items-center gap-2 text-sm font-semibold ${isSuperAdmin ? 'text-white' : 'text-slate-900'}`}
                                >
                                    <Settings2 className="h-4 w-4 text-amber-600" />{' '}
                                    Account protection
                                </div>
                                <ul
                                    className={`mt-4 space-y-3 text-sm ${isSuperAdmin ? 'text-slate-200' : 'text-slate-700'}`}
                                >
                                    <li>
                                        • Your account type is verified by the
                                        application on each request.
                                    </li>
                                    <li>
                                        •{' '}
                                        {canManage
                                            ? 'Approved credential changes require the current password.'
                                            : 'Account information is read-only for this account type.'}
                                    </li>
                                    <li>
                                        •{' '}
                                        {role === 'Engineer'
                                            ? 'Maintenance changes require current assigned LGU scope and record ownership.'
                                            : role === 'Viewer'
                                              ? 'No creation, update, or deletion of business data is permitted.'
                                              : 'Administrative updates are written to the existing audit history.'}
                                    </li>
                                    <li>
                                        • Appearance is a personal device
                                        preference, not an authorization
                                        setting.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className={`${box} mt-6`}>
                        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Settings2 className="h-5 w-5 text-amber-700" />
                                    <h2 className="text-lg font-bold">
                                        Update credentials
                                    </h2>
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                    Confirm your current password before saving
                                    account changes.
                                </p>
                                {!canManage && (
                                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                                        <p>
                                            <strong>Username:</strong>{' '}
                                            {identity.username}
                                        </p>
                                        <p className="mt-2 text-slate-500">
                                            Your account details are read-only.
                                            Contact an administrator for account
                                            changes. Self-service password
                                            changes require an approved
                                            workflow.
                                        </p>
                                    </div>
                                )}
                                {canManage && (
                                    <form
                                        className="mt-5 grid gap-4 sm:grid-cols-2"
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            submit(
                                                '/dd-phase3/ops/settings',
                                                settings,
                                                'put',
                                                () =>
                                                    setSettings((old) => ({
                                                        ...old,
                                                        current_password: '',
                                                        password: '',
                                                        password_confirmation:
                                                            '',
                                                    })),
                                            );
                                        }}
                                    >
                                        {(
                                            [
                                                'username',
                                                'current_password',
                                                'password',
                                                'password_confirmation',
                                            ] as const
                                        ).map((k) => (
                                            <label
                                                key={k}
                                                className="text-xs font-semibold text-slate-600"
                                            >
                                                {
                                                    {
                                                        username: 'Username',
                                                        current_password:
                                                            'Current password',
                                                        password:
                                                            'New password (optional)',
                                                        password_confirmation:
                                                            'Confirm new password',
                                                    }[k]
                                                }
                                                <input
                                                    className={input}
                                                    type={
                                                        k === 'username'
                                                            ? 'text'
                                                            : 'password'
                                                    }
                                                    autoComplete={
                                                        k === 'username'
                                                            ? 'username'
                                                            : k ===
                                                                'current_password'
                                                              ? 'current-password'
                                                              : 'new-password'
                                                    }
                                                    value={settings[k]}
                                                    onChange={(e) =>
                                                        setSettings((old) => ({
                                                            ...old,
                                                            [k]: e.target.value,
                                                        }))
                                                    }
                                                />
                                                {k === 'password' && (
                                                    <span className="mt-1 block text-[11px] font-normal text-slate-500">
                                                        Leave blank if you only
                                                        want to rename the
                                                        username.
                                                    </span>
                                                )}
                                                {issues[k] && (
                                                    <span className="mt-1 block text-xs text-red-700">
                                                        {issues[k]}
                                                    </span>
                                                )}
                                            </label>
                                        ))}
                                        <div className="flex flex-wrap gap-3 sm:col-span-2">
                                            <button
                                                className={action}
                                                disabled={busy}
                                            >
                                                Save changes
                                            </button>
                                            <button
                                                type="button"
                                                className={tiny}
                                                onClick={() =>
                                                    setSettings({
                                                        username:
                                                            identity.username,
                                                        current_password: '',
                                                        password: '',
                                                        password_confirmation:
                                                            '',
                                                    })
                                                }
                                            >
                                                Reset form
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                                <h3 className="text-base font-bold text-slate-900">
                                    {isSuperAdmin
                                        ? 'Privileged identity'
                                        : role === 'Admin'
                                          ? 'Administrative identity'
                                          : 'My account overview'}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    Your verified Account Type and applicable
                                    account protections.
                                </p>
                                <div className="mt-5 grid gap-3">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <div className="text-xs tracking-wide text-slate-500 uppercase">
                                            Verified account
                                        </div>
                                        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                                            <ShieldCheck className="h-4 w-4 text-emerald-600" />{' '}
                                            {identity.username}
                                        </div>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Account Type: {identity.role}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <div className="text-xs tracking-wide text-slate-500 uppercase">
                                            Protection
                                        </div>
                                        <p className="mt-2 text-sm text-slate-700">
                                            {canManage
                                                ? 'Approved password changes require your current credentials and synchronize both login identities.'
                                                : 'Changing credentials requires an authorized administrator or a separately approved recovery process.'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <div className="text-xs tracking-wide text-slate-500 uppercase">
                                            Appearance control
                                        </div>
                                        <p className="mt-2 text-sm text-slate-700">
                                            Choose a brighter or darker
                                            workspace without affecting other
                                            users.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                </>
            )}
            <section className={`${box} mt-6`}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold">Appearance</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            Choose how JaiROADS looks on this device.
                        </p>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                        Current: {appearance}
                    </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {(['light', 'dark', 'system'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            aria-pressed={appearance === mode}
                            onClick={() => updateAppearance(mode)}
                            className={`rounded-2xl border px-5 py-4 text-left text-sm font-semibold capitalize transition ${appearance === mode ? 'border-[#a15b34] bg-[#fff1e3] text-[#90451f] shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                            <div>{mode}</div>
                            <div className="mt-1 text-xs font-normal text-slate-500 normal-case">
                                {mode === 'light'
                                    ? 'Bright workspace with high contrast cards.'
                                    : mode === 'dark'
                                      ? 'Darker panels for low-light use.'
                                      : 'Follow the device or browser preference.'}
                            </div>
                        </button>
                    ))}
                </div>
            </section>
        </ProjectWorkspace>
    );
}

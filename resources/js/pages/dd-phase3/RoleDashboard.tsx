import { Head, Link, router } from '@inertiajs/react';
import {
    Bell,
    Eye,
    RefreshCw,
    CircleAlert,
    FileText,
    FolderKanban,
    MapPinned,
    Wrench,
    Route,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { DdDashboardAnalytics } from '@/components/dd-dashboard-analytics';
import type { DdDashboardSummary } from '@/components/dd-dashboard-analytics';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { SimplifiedCoverageMap } from '@/components/road-coverages/simplified-coverage-map';
import type { SimplifiedCoverageItem } from '@/components/road-coverages/simplified-coverage-map';
import '../../../css/maintenance-projects-exploration.css';

type Role = 'engineer' | 'viewer';
type StatKey =
    | 'assignedLgus'
    | 'managedRecords'
    | 'ongoingRecords'
    | 'roadCoverages'
    | 'projects'
    | 'lgus';
type Props = {
    role: Role;
    analytics: DdDashboardSummary;
    mapCoverages: SimplifiedCoverageItem[];
    name: string;
    username: string;
    engineer: { id: number; name: string; rank: string; status: string } | null;
    assignedLgus: { id: number; name: string }[];
    limitedAccess: boolean;
    stats: Record<StatKey, number | null>;
    records: {
        id: number;
        projectId: number | null;
        projectTitle: string;
        period: string;
        status: string;
        inActiveLgu: boolean;
    }[];
    notifications: { id: number; message: string; createdAt: string }[];
};

function Metric({
    label,
    value,
    icon,
}: {
    label: string;
    value: number | null;
    icon: ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
            <div className="flex items-start justify-between gap-3">
                <span className="text-sm text-slate-500">{label}</span>
                <span className="text-amber-800">{icon}</span>
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">
                {value ?? '—'}
            </div>
        </div>
    );
}

const cardLink =
    'inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50';

export default function RoleDashboard({
    role,
    name,
    username,
    engineer,
    assignedLgus,
    limitedAccess,
    stats,
    records,
    notifications,
    analytics,
    mapCoverages = [],
}: Props) {
    const isEngineer = role === 'engineer';
    const [refreshing, setRefreshing] = useState(false);
    const notificationPanel = (
    <section
        className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"
        id="notifications"
    >
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
            <Bell className="h-5 w-5 text-amber-800" /> My
            notifications
        </h2>
        <p className="mt-1 text-sm text-slate-500">
            Updates and messages for your account.
        </p>
        <div className="mt-4 divide-y divide-slate-100">
            {notifications.map((notice) => (
                <div key={notice.id} className="py-3">
                    <p className="text-sm text-slate-700">
                        {notice.message}
                    </p>
                    <time className="mt-1 block text-xs text-slate-500">
                        {notice.createdAt}
                    </time>
                </div>
            ))}
        </div>
        {notifications.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">
                No personal notifications.
            </p>
        )}
    </section>
    );

    return (
        <div className={`jr-directory-exploration${isEngineer ? ' jr-engineer-dashboard' : ' jr-viewer-dashboard'}`}>
            <Head
                title={`${isEngineer ? 'Engineer' : 'Viewer'} Dashboard · JaiROADS`}
            />
            <ProjectWorkspace>
                <div className="jr-page-head">
                    <div>
                        {isEngineer
                            ? <span className="jr-engineer-access"><Wrench className="size-4" aria-hidden="true" /> Technical Workspace</span>
                            : <span className="jr-viewer-access"><Eye className="size-4" aria-hidden="true" /> Read-Only Access</span>}
                        <h1>{isEngineer ? 'Engineering Dashboard' : 'Road Maintenance Overview'}</h1>
                        <p>
                            {isEngineer
                                ? `Welcome, ${engineer?.name || name}. Manage your maintenance activities and explore road coverage across municipalities.`
                                : `Welcome, ${username || name}. Explore road coverage, maintenance projects and progress across JaiROADS.`}
                        </p>
                    </div>
                    <button type="button" className={isEngineer ? 'jr-engineer-refresh' : 'jr-viewer-refresh'} disabled={refreshing}
                        onClick={() => router.reload({ onStart: () => setRefreshing(true), onFinish: () => setRefreshing(false) })}>
                        <RefreshCw className={`size-4${refreshing ? ' animate-spin' : ''}`} aria-hidden="true"/>
                        {refreshing ? 'Refreshing…' : 'Refresh dashboard'}
                    </button>
                </div>

                <main className="relative -mt-3.5 -mx-7 rounded-t-[20px] bg-white px-7 pt-7 pb-10 shadow-sm min-w-0 space-y-6">
                <section className={isEngineer ? 'jr-engineer-overview' : 'jr-viewer-overview'} aria-label="Road maintenance summary">
                    <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4${isEngineer ? ' jr-engineer-metrics' : ' jr-viewer-metrics'}`}>
                        {isEngineer ? (
                            <>
                                <Metric
                                    label="Active LGU assignments"
                                    value={stats.assignedLgus}
                                    icon={<MapPinned className="h-5 w-5" />}
                                />
                                <Metric
                                    label="My maintenance records"
                                    value={stats.managedRecords}
                                    icon={<FileText className="h-5 w-5" />}
                                />
                                <Metric
                                    label="My ongoing records"
                                    value={stats.ongoingRecords}
                                    icon={<FolderKanban className="h-5 w-5" />}
                                />
                                <Metric
                                    label="Road coverages"
                                    value={stats.roadCoverages}
                                    icon={<Route className="h-5 w-5" />}
                                />
                            </>
                        ) : (
                            <>
                                <Metric
                                    label="Maintenance projects"
                                    value={stats.projects}
                                    icon={<FolderKanban className="h-5 w-5" />}
                                />
                                <Metric
                                    label="Maintenance records"
                                    value={stats.managedRecords}
                                    icon={<FileText className="h-5 w-5" />}
                                />
                                <Metric
                                    label="Road coverages"
                                    value={stats.roadCoverages}
                                    icon={<Route className="h-5 w-5" />}
                                />
                                <Metric
                                    label="LGUs"
                                    value={stats.lgus}
                                    icon={<Users className="h-5 w-5" />}
                                />
                            </>
                        )}
                    </div>
                    {isEngineer && (
                        <div
                            className={`mt-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${limitedAccess ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}
                        >
                            <CircleAlert
                                className={`mt-0.5 h-5 w-5 shrink-0 ${limitedAccess ? 'text-amber-800' : 'text-emerald-700'}`}
                            />
                            <div className="text-sm leading-6 text-slate-700">
                                <strong className="block">
                                    {limitedAccess
                                        ? engineer === null
                                            ? 'Engineer profile not linked'
                                            : 'Engineer profile unavailable'
                                        : 'All municipalities available'}
                                </strong>
                                {limitedAccess
                                    ? engineer === null
                                        ? 'Your account requires an active linked Engineer profile. Contact your administrator.'
                                        : 'Your Engineer profile is unavailable. Contact your administrator.'
                                    : 'You may work across municipalities and edit the maintenance records you manage.'}
                            </div>
                        </div>
                    )}

                </section>

                {isEngineer && (
                    <section aria-label="My projects road map">
                        <SimplifiedCoverageMap coverages={mapCoverages} engineerView height={450} />
                    </section>
                )}

                <DdDashboardAnalytics data={analytics} compact={isEngineer} omitInventoryMetrics omitOngoingMetric={isEngineer} showActivity={false} activityReplacement={notificationPanel} />

                <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-950">
                                {isEngineer
                                    ? 'Quick access'
                                    : 'Explore operations'}
                            </h2>
                            <p className="mt-1 text-sm text-slate-500">
                                {isEngineer
                                    ? limitedAccess
                                        ? 'Browsing only until your Engineer profile is available.'
                                        : 'Changes are allowed across municipalities; maintenance edits remain restricted to your managed records.'
                                    : 'Viewing privileges only. Editing and deletion controls are not available.'}
                            </p>
                        </div>
                        <span
                            className={`rounded-full border px-3 py-1 text-xs font-bold ${isEngineer ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                        >
                            {isEngineer
                                ? 'Create / Update across municipalities'
                                : 'Read only'}
                        </span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                            [
                                'Maintenance Projects',
                                '/dd-phase3/projects',
                                isEngineer
                                    ? 'Project and maintenance history'
                                    : 'Browse projects',
                            ],
                            [
                                'Monthly Updates',
                                '/dd-phase3/updates',
                                isEngineer
                                    ? 'My monthly progress reporting'
                                    : 'Browse monthly reports',
                            ],
                            [
                                'Project Documents',
                                '/dd-phase3/documents',
                                isEngineer
                                    ? 'Assigned documentation'
                                    : 'Browse formal documents',
                            ],
                            [
                                'Road Sections',
                                '/dd-phase3/roads',
                                'Road coverage inventory',
                            ],
                            [
                                'LGU Directory',
                                '/dd-phase3/lgus',
                                'Municipality information',
                            ],
                        ].map(([label, href, summary]) => (
                            <Link
                                key={href}
                                href={href}
                                className="rounded-xl border border-slate-200 p-4 transition hover:border-amber-300 hover:bg-amber-50"
                            >
                                <div className="text-sm font-semibold text-slate-900">
                                    {label} →
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    {summary}
                                </p>
                            </Link>
                        ))}
                    </div>
                </section>

                <div className={`grid gap-6${isEngineer ? ' xl:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]' : ''}`}>
                    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-950">
                            {isEngineer
                                ? 'My managed maintenance activities'
                                : 'Recent maintenance projects'}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            {isEngineer
                                ? 'Maintenance activities assigned to you.'
                                : 'Current projects across LGUs. Viewer actions are read-only.'}
                        </p>
                        <div className="mt-5 divide-y divide-slate-100">
                            {records.map((record) => (
                                <div
                                    key={record.id}
                                    className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-slate-900">
                                            {record.projectTitle}
                                        </div>
                                        {record.period && (
                                            <div className="mt-1 text-xs text-slate-500">
                                                Record #{record.id} ·{' '}
                                                {record.period} ·{' '}
                                                {record.status}
                                            </div>
                                        )}
                                    </div>
                                    <Link
                                        href={record.projectId ? `/dd-phase3/ui/maintenance-projects/${record.projectId}${isEngineer ? `/records/${record.id}` : ''}` : '/dd-phase3/projects'}
                                        className={cardLink}
                                    >
                                        View
                                    </Link>
                                </div>
                            ))}
                            {records.length === 0 && (
                                <p className="py-10 text-center text-sm text-slate-500">
                                    {isEngineer
                                        ? 'No maintenance records are currently assigned to your Engineer identity.'
                                        : 'No maintenance projects available.'}
                                </p>
                            )}
                        </div>
                        <Link
                            href="/dd-phase3/projects"
                            className={`${cardLink} mt-4`}
                        >
                            Browse maintenance projects
                        </Link>
                    </section>

                    {isEngineer && <div className="space-y-6">
                        {isEngineer && (
                            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                                <h2 className="text-lg font-bold text-slate-950">
                                    Available municipalities
                                </h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    Municipalities available to you.
                                </p>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {assignedLgus.map((lgu) => (
                                        <span
                                            key={lgu.id}
                                            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700"
                                        >
                                            {lgu.name}
                                        </span>
                                    ))}
                                </div>
                                {assignedLgus.length === 0 && (
                                    <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-600">
                                        No municipalities are registered. Contact your
                                        Administrator if access is needed.
                                    </p>
                                )}
                            </section>
                        )}
                    </div>}
                </div>
                    <div className="text-xs text-slate-500">
                        Signed in as {username}.{' '}
                    </div>
                </main>
            </ProjectWorkspace>
        </div>
    );
}

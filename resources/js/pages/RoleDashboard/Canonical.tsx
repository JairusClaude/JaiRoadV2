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
import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { DashboardAnalytics } from '@/components/dashboard/dashboard-analytics';
import type { DashboardSummary } from '@/components/dashboard/dashboard-analytics';
import { RenderErrorBoundary } from '@/components/jairoads/render-error-boundary';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import type { SimplifiedCoverageItem } from '@/components/road-coverages/simplified-coverage-map';
import { validRoadPage } from '@/lib/road-coverages/road-page';
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
    analytics: DashboardSummary;
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

const SimplifiedCoverageMap = lazy(
    () => import('@/components/road-coverages/simplified-coverage-map'),
);

function MapPlaceholder({ children }: { children: ReactNode }) {
    return (
        <div className="grid min-h-[450px] place-items-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
            {children}
        </div>
    );
}

function DashboardRoadMap({
    isEngineer,
    total,
}: {
    isEngineer: boolean;
    total: number | null;
}) {
    const [coverages, setCoverages] = useState<SimplifiedCoverageItem[]>([]);
    const [cursor, setCursor] = useState<number | null>(null);
    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [requestCursor, setRequestCursor] = useState<number | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const deadline = window.setTimeout(() => {
            controller.abort();
            setError('Road map request timed out. You can retry.');
            setLoading(false);
        }, 12_000);
        const url =
            '/workspace/dashboard/map-roads' +
            (requestCursor === null
                ? ''
                : '?before=' + encodeURIComponent(requestCursor));
        fetch(url, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Road map unavailable');
                }

                const result = (await response.json()) as {
                    data: SimplifiedCoverageItem[];
                    next_cursor: number | null;
                };

                if (!validRoadPage(result, requestCursor, 'descending')) {
                    throw new Error('Invalid map data');
                }

                if (controller.signal.aborted) {
                    return;
                }

                setCoverages((prior) => {
                    if (requestCursor === null) {
                        return result.data;
                    }

                    const seen = new Set(prior.map((road) => road.id));

                    return [
                        ...prior,
                        ...result.data.filter((road) => !seen.has(road.id)),
                    ];
                });
                setCursor(result.next_cursor);
                setReady(true);
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setError(
                        'Unable to load road coverages. You can continue using the dashboard.',
                    );
                }
            })
            .finally(() => {
                window.clearTimeout(deadline);

                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => {
            window.clearTimeout(deadline);
            controller.abort();
        };
    }, [requestCursor, attempt]);

    return (
        <section
            aria-label={
                isEngineer ? 'My projects road map' : 'Viewer road coverage map'
            }
            className="min-w-0"
        >
            {ready ? (
                <RenderErrorBoundary
                    fallback={
                        <MapPlaceholder>
                            <div>
                                <p role="alert">
                                    The map could not initialize. The rest of
                                    the dashboard is available.
                                </p>
                                <button
                                    type="button"
                                    className="mt-3 underline"
                                    onClick={() => window.location.reload()}
                                >
                                    Reload page to retry map
                                </button>
                            </div>
                        </MapPlaceholder>
                    }
                >
                    <Suspense
                        fallback={
                            <MapPlaceholder>
                                <span role="status">
                                    Opening road coverage map…
                                </span>
                            </MapPlaceholder>
                        }
                    >
                        <SimplifiedCoverageMap
                            coverages={coverages}
                            engineerView={isEngineer}
                            viewerView={!isEngineer}
                            height={450}
                        />
                    </Suspense>
                </RenderErrorBoundary>
            ) : (
                <MapPlaceholder>
                    <span role="status">
                        {error
                            ? 'Road map temporarily unavailable'
                            : 'Loading road coverage map…'}
                    </span>
                </MapPlaceholder>
            )}
            {cursor !== null && !error && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                    <span>
                        Showing {coverages.length} of {total ?? 'available'}{' '}
                        road coverages on the map.
                    </span>
                    <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                            setLoading(true);
                            setError('');
                            setRequestCursor(cursor);
                        }}
                        className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-[var(--jr-display-accent)] hover:bg-[var(--jr-display-soft)] disabled:opacity-50"
                    >
                        {loading ? 'Loading roads…' : 'Load more map roads'}
                    </button>
                </div>
            )}
            {error && (
                <div role="alert" className="mt-2 text-sm text-red-700">
                    {error}{' '}
                    <button
                        type="button"
                        className="underline"
                        disabled={loading}
                        onClick={() => {
                            setLoading(true);
                            setError('');
                            setAttempt((n) => n + 1);
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}
        </section>
    );
}

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
                <span className="text-[var(--jr-role-accent)]">{icon}</span>
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
}: Props) {
    const isEngineer = role === 'engineer';
    const [refreshing, setRefreshing] = useState(false);
    const notificationPanel = (
        <section
            className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm"
            id="notifications"
        >
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                <Bell className="h-5 w-5 text-[var(--jr-role-accent)]" /> My
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
        <div
            className={`jr-directory-exploration${isEngineer ? 'jr-engineer-dashboard' : 'jr-viewer-dashboard'}`}
        >
            <Head
                title={`${isEngineer ? 'Engineer' : 'Viewer'} Dashboard · JaiROADS`}
            />
            <ProjectWorkspace>
                <div className="jr-page-head">
                    <div>
                        {isEngineer ? (
                            <span className="jr-engineer-access">
                                <Wrench className="size-4" aria-hidden="true" />{' '}
                                Technical Workspace
                            </span>
                        ) : (
                            <span className="jr-viewer-access">
                                <Eye className="size-4" aria-hidden="true" />{' '}
                                Read-Only Access
                            </span>
                        )}
                        <h1>
                            {isEngineer
                                ? 'Engineering Dashboard'
                                : 'Road Maintenance Overview'}
                        </h1>
                        <p>
                            {isEngineer
                                ? `Welcome, ${engineer?.name || name}. Manage your maintenance activities and explore road coverage across municipalities.`
                                : `Welcome, ${username || name}. Explore road coverage, maintenance projects and progress across JaiROADS.`}
                        </p>
                    </div>
                    {isEngineer && (
                        <button
                            type="button"
                            className={
                                isEngineer
                                    ? 'jr-engineer-refresh'
                                    : 'jr-viewer-refresh'
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
                                className={`size-4${refreshing ? 'animate-spin' : ''}`}
                                aria-hidden="true"
                            />
                            {refreshing ? 'Refreshing…' : 'Refresh dashboard'}
                        </button>
                    )}
                </div>

                <main className="relative mx-0 -mt-3.5 min-w-0 space-y-6 rounded-t-[20px] bg-white px-4 pt-7 pb-10 shadow-sm sm:px-6 lg:-mx-7 lg:px-7">
                    <section
                        className={
                            isEngineer
                                ? 'jr-engineer-overview'
                                : 'jr-viewer-overview'
                        }
                        aria-label="Road maintenance summary"
                    >
                        <div
                            className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4${isEngineer ? 'jr-engineer-metrics' : 'jr-viewer-metrics'}`}
                        >
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
                                        icon={
                                            <FolderKanban className="h-5 w-5" />
                                        }
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
                                        icon={
                                            <FolderKanban className="h-5 w-5" />
                                        }
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
                                    className={`mt-0.5 h-5 w-5 shrink-0 ${limitedAccess ? 'text-[var(--jr-role-accent)]' : 'text-emerald-700'}`}
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
                        <DashboardRoadMap
                            key={role + ':' + (engineer?.id ?? username)}
                            isEngineer={isEngineer}
                            total={stats.roadCoverages}
                        />
                    )}

                    <DashboardAnalytics
                        data={analytics}
                        compact={isEngineer}
                        omitInventoryMetrics
                        omitOngoingMetric={isEngineer}
                        showActivity={false}
                        activityReplacement={
                            isEngineer ? notificationPanel : undefined
                        }
                    />

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
                                className={`rounded-full border px-3 py-1 text-xs font-bold ${isEngineer ? 'border-amber-200 bg-amber-50 text-[var(--jr-role-accent)]' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
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
                                    '/workspace/projects',
                                    isEngineer
                                        ? 'Project and maintenance history'
                                        : 'Browse projects',
                                ],
                                [
                                    'Monthly Updates',
                                    '/workspace/updates',
                                    isEngineer
                                        ? 'My monthly progress reporting'
                                        : 'Browse monthly reports',
                                ],
                                [
                                    'Maintenance Documents',
                                    '/workspace/documents',
                                    isEngineer
                                        ? 'Assigned documentation'
                                        : 'Browse formal documents',
                                ],
                                [
                                    'Road Coverages',
                                    '/workspace/roads',
                                    'Road coverage inventory',
                                ],
                                [
                                    'LGU',
                                    '/workspace/lgus',
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

                    <div
                        className={`grid gap-6${isEngineer ? 'xl:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]' : ''}`}
                    >
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
                                            href={
                                                record.projectId
                                                    ? `/workspace/ui/maintenance-projects/${record.projectId}${isEngineer ? `/records/${record.id}` : ''}`
                                                    : '/workspace/projects'
                                            }
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
                                href="/workspace/projects"
                                className={`${cardLink} mt-4`}
                            >
                                Browse maintenance projects
                            </Link>
                        </section>

                        {isEngineer && (
                            <div className="space-y-6">
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
                                                No municipalities are
                                                registered. Contact your
                                                Administrator if access is
                                                needed.
                                            </p>
                                        )}
                                    </section>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-slate-500">
                        Signed in as {username}.{' '}
                    </div>
                </main>
            </ProjectWorkspace>
        </div>
    );
}

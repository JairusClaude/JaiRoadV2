import { Link } from '@inertiajs/react';
import {
    Activity,
    BarChart3,
    Clock3,
    ClipboardCheck,
    FileText,
    FolderKanban,
    MapPinned,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type DdDashboardSummary = {
    scope: string;
    metrics: {
        records: number;
        ongoing: number;
        completed: number;
        reportingCoverage: number | null;
        updates: number;
        documents: number;
        lgus: number;
        roads: number;
        projects: number;
    };
    trend: { month: string; count: number }[];
    activity: {
        id: number;
        action: string;
        entity: string;
        username: string;
        role: string;
        at: string;
    }[];
    logins: { id: number; username: string; role: string; at: string }[];
    trackingNote: string;
};

const prettyDate = (value: string) => {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(date);
};

export function DdDashboardAnalytics({
    data,
    compact = false,
    omitInventoryMetrics = false,
    omitOngoingMetric = false,
    showActivity = true,
    activityReplacement,
}: {
    data: DdDashboardSummary;
    compact?: boolean;
    omitInventoryMetrics?: boolean;
    omitOngoingMetric?: boolean;
    showActivity?: boolean;
    activityReplacement?: ReactNode;
}) {
    const max = Math.max(1, ...data.trend.map((item) => item.count));
    const trendTotal = data.trend.reduce((sum, item) => sum + item.count, 0);
    const cards = [
        {
            label: 'Maintenance projects',
            value: data.metrics.projects,
            icon: FolderKanban,
        },
        {
            label: 'Ongoing records',
            value: data.metrics.ongoing,
            icon: Activity,
        },
        {
            label: 'Completed records',
            value: data.metrics.completed,
            icon: ClipboardCheck,
        },
        {
            label: 'Monthly updates',
            value: data.metrics.updates,
            icon: FileText,
        },
        {
            label: 'Project documents',
            value: data.metrics.documents,
            icon: FileText,
        },
        { label: 'Road coverages', value: data.metrics.roads, icon: MapPinned },
    ];
    const visibleCards = cards.filter(
        ({ label }) =>
            !(
                omitInventoryMetrics &&
                (label === 'Maintenance projects' || label === 'Road coverages')
            ) && !(omitOngoingMetric && label === 'Ongoing records'),
    );
    const items = data.activity;

    return (
        <section
            aria-label={`${data.scope} analytics`}
            className="jr-dashboard-analytics space-y-5"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
                        <BarChart3 className="h-5 w-5 text-amber-700" />{' '}
                        {data.scope} analytics
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Live counts from Data Dictionary business records; no
                        sample data.
                    </p>
                </div>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                    {data.scope}
                </span>
            </div>
            <div
                className={`jr-dashboard-analytics-metrics grid gap-3 sm:grid-cols-2 ${omitOngoingMetric ? 'xl:grid-cols-3' : omitInventoryMetrics ? 'xl:grid-cols-4' : compact ? 'xl:grid-cols-3' : 'xl:grid-cols-6'}`}
            >
                {visibleCards.map(({ label, value, icon: Icon }) => (
                    <div
                        key={label}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
                            <span>{label}</span>
                            <Icon className="h-4 w-4 shrink-0 text-amber-700" />
                        </div>
                        <p className="mt-3 text-3xl font-bold text-slate-900 tabular-nums">
                            {value.toLocaleString()}
                        </p>
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <ClipboardCheck className="h-4 w-4 text-amber-700" />
                <strong>Reporting coverage this month:</strong>
                {data.metrics.reportingCoverage === null
                    ? 'Not applicable (no ongoing records)'
                    : `${data.metrics.reportingCoverage}% of ongoing maintenance records have an update`}
            </div>
            <div
                className={`grid gap-5${showActivity || activityReplacement ? 'xl:grid-cols-[1.15fr_.85fr]' : ''}`}
            >
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">
                                Monthly progress reports
                            </h3>
                            <p className="mt-1 text-xs text-slate-500">
                                Actual monthly-update counts, last six calendar
                                months · {data.scope}
                            </p>
                        </div>
                        <span className="jr-trend-total rounded-xl bg-[#F2EAFF] px-3 py-2 text-xs font-semibold text-[#51269B]">
                            <strong className="mr-1 text-lg tabular-nums">
                                {trendTotal.toLocaleString()}
                            </strong>
                            reports in 6 months
                        </span>
                    </div>
                    <div
                        className="jr-dashboard-trend mt-5 grid h-44 grid-cols-6 items-end gap-2 sm:gap-4"
                        role="img"
                        aria-label={data.trend
                            .map(
                                (item) =>
                                    `${item.month}: ${item.count} reports`,
                            )
                            .join('; ')}
                    >
                        {data.trend.map((item) => (
                            <div
                                key={item.month}
                                className="flex h-full min-w-0 flex-col items-center justify-end gap-1"
                            >
                                <span className="text-xs font-bold text-slate-700 tabular-nums">
                                    {item.count}
                                </span>
                                <div
                                    className="flex h-[105px] w-full items-end rounded-t-lg bg-slate-50"
                                    aria-hidden="true"
                                >
                                    <div
                                        className="w-full rounded-t-lg bg-gradient-to-t from-amber-700 to-amber-400 transition-all"
                                        style={{
                                            height: `${item.count === 0 ? 0 : Math.max(6, (item.count / max) * 100)}%`,
                                        }}
                                    />
                                </div>
                                <span className="w-full text-center text-[10px] text-slate-500">
                                    {new Date(
                                        `${item.month}-01T00:00:00Z`,
                                    ).toLocaleDateString(undefined, {
                                        month: 'short',
                                        year: '2-digit',
                                        timeZone: 'UTC',
                                    })}
                                </span>
                            </div>
                        ))}
                    </div>
                    {trendTotal === 0 && (
                        <p className="mt-3 rounded-xl bg-[#F8F5FE] px-4 py-3 text-center text-xs text-slate-600">
                            No monthly progress reports were submitted during
                            this six-month period.
                        </p>
                    )}
                </div>
                {showActivity && (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-base font-bold text-slate-900">
                                Account activity
                            </h3>
                            {(data.scope === 'System-wide' ||
                                data.scope === 'Operations overview') && (
                                <Link
                                    href="/dd-phase3/audit-logs"
                                    className="text-sm underline"
                                >
                                    Full audit history
                                </Link>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            {data.scope === 'My assigned work' ||
                            data.scope === 'Read-only inventory'
                                ? 'Personal activity notices are available from the header bell. Full audit logs remain restricted to administrators.'
                                : 'Recent business events. Full audit history includes retained legacy entries.'}
                        </p>
                        {items.length === 0 ? (
                            <div className="mt-5 rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                No authorized business events to display.
                            </div>
                        ) : (
                            <ul className="mt-3 max-h-[230px] divide-y divide-slate-100 overflow-y-auto">
                                {items.map((e) => (
                                    <li
                                        key={e.id}
                                        className="flex items-start justify-between gap-3 py-2.5 text-sm"
                                    >
                                        <div>
                                            <span className="font-semibold text-slate-800">
                                                {e.username}
                                            </span>{' '}
                                            <span className="text-xs text-slate-500">
                                                ({e.role})
                                            </span>
                                            <div className="mt-0.5 text-xs text-slate-600">
                                                {`${e.action} · ${e.entity}`}
                                            </div>
                                        </div>
                                        <time className="shrink-0 text-right text-[11px] text-slate-500">
                                            {prettyDate(e.at)}
                                        </time>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-5 text-slate-500">
                            <Clock3 className="mr-1 inline h-3.5 w-3.5" />{' '}
                            {data.trackingNote}
                        </p>
                    </div>
                )}
                {activityReplacement}
            </div>
        </section>
    );
}

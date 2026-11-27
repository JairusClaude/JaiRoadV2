import { Link } from '@inertiajs/react';
import {
    Activity,
    ArrowUpRight,
    CalendarDays,
    ChevronDown,
    ClockAlert,
    Download,
    FileClock,
    Route,
    SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { maintenanceCalendar } from '@/lib/maintenance-calendar';
import { manilaDate } from '@/lib/manila-time';

export type MaintenanceIntelligenceSummary = {
    asOf: string;
    reportingMonth: string;
    conditions: Record<'Good' | 'Fair' | 'Bad', number>;
    noCurrentReport: number;
    pastEstimate: number;
    ongoingCount: number;
    priorityTotal: number;
    priority: {
        id: number;
        roadName: string;
        condition: string;
        conditionScore: number;
        overdueScore: number;
        reportScore: number;
        score: number;
    }[];
    calendar: {
        id: number;
        projectId: number;
        projectTitle: string;
        startDate: string;
        estimatedFinish: string;
    }[];
};

const factors = [
    { label: 'Condition severity', weight: 30 },
    { label: 'Maintenance urgency', weight: 25 },
    { label: 'Road importance', weight: 20 },
    { label: 'Overdue severity', weight: 15 },
    { label: 'Safety concern', weight: 10 },
];

function downloadCalendar(items: MaintenanceIntelligenceSummary['calendar']) {
    const url = URL.createObjectURL(
        new Blob([maintenanceCalendar(items)], {
            type: 'text/calendar;charset=utf-8',
        }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jairoads-maintenance-estimates.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const conditionStyles = {
    Good: {
        label: 'text-emerald-800 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-200',
        fill: 'bg-emerald-500',
    },
    Fair: {
        label: 'text-amber-900 bg-amber-50 dark:bg-amber-950 dark:text-amber-200',
        fill: 'bg-amber-400',
    },
    Bad: {
        label: 'text-rose-800 bg-rose-50 dark:bg-rose-950 dark:text-rose-200',
        fill: 'bg-rose-500',
    },
};
const conditions = ['Good', 'Fair', 'Bad'] as const;
const panel =
    'min-w-0 rounded-2xl border border-violet-100 bg-white dark:border-violet-900/70 dark:bg-slate-900';
const linkStyle =
    'break-words font-semibold text-slate-900 underline-offset-4 hover:text-violet-800 hover:underline focus-visible:underline dark:text-slate-100 dark:hover:text-violet-200';
const subtleText = 'text-sm text-slate-600 dark:text-slate-300';

function PriorityScenario() {
    const [values, setValues] = useState(() => factors.map(() => 0));
    const score = factors.reduce(
        (sum, factor, index) => sum + (values[index] * factor.weight) / 100,
        0,
    );

    return (
        <details className={`group/scenario mt-4 ${panel}`}>
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-4 py-3.5 font-semibold text-violet-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:text-violet-100 [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal
                    aria-hidden="true"
                    className="size-5 shrink-0 text-violet-600 dark:text-violet-300"
                />
                Maintenance priority scenario
                <ChevronDown
                    aria-hidden="true"
                    className="ml-auto size-4 shrink-0 group-open/scenario:rotate-180"
                />
            </summary>
            <div className="grid gap-4 border-t border-violet-100 p-4 sm:p-5 @min-[52rem]:grid-cols-[minmax(0,1fr)_minmax(11rem,0.34fr)] dark:border-violet-900/70">
                <div className="min-w-0">
                    <p className={subtleText}>
                        Test assumed severity levels from 0 to 100. Scenario
                        values have no effect on the road review list.
                    </p>
                    <div className="mt-4 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                        {factors.map((factor, index) => (
                            <label
                                key={factor.label}
                                className="grid min-w-0 gap-1 rounded-lg bg-violet-50/55 px-3 py-2 text-sm dark:bg-violet-950/45"
                            >
                                <span className="flex justify-between gap-2">
                                    <span>
                                        {factor.label}{' '}
                                        <span className={subtleText}>
                                            ({factor.weight}%)
                                        </span>
                                    </span>
                                    <span
                                        className="font-semibold text-violet-800 tabular-nums dark:text-violet-200"
                                        aria-hidden="true"
                                    >
                                        {values[index]}
                                    </span>
                                </span>
                                <input
                                    className="h-6 w-full min-w-0 accent-violet-700 focus-visible:outline-violet-600"
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={values[index]}
                                    onChange={(event) => {
                                        const value = Number(
                                            event.target.value,
                                        );
                                        setValues((previous) =>
                                            previous.map((item, i) =>
                                                i === index ? value : item,
                                            ),
                                        );
                                    }}
                                />
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col justify-center rounded-xl bg-violet-950 p-4 text-violet-50">
                    <p className="text-sm font-medium text-violet-200">
                        Scenario score
                    </p>
                    <output
                        className="mt-1 block text-3xl leading-tight font-semibold tabular-nums"
                        aria-live="polite"
                    >
                        {score.toFixed(1)}{' '}
                        <span className="text-base font-medium text-violet-200">
                            / 100
                        </span>
                    </output>
                    <button
                        type="button"
                        className="mt-3 min-h-9 self-start rounded-md border border-violet-400/60 px-3 text-sm font-medium hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-100"
                        onClick={() => setValues(factors.map(() => 0))}
                    >
                        Reset sliders
                    </button>
                </div>
            </div>
        </details>
    );
}

export function MaintenanceIntelligencePanel({
    data,
}: {
    data: MaintenanceIntelligenceSummary;
}) {
    const total = conditions.reduce(
        (sum, condition) => sum + data.conditions[condition],
        0,
    );
    const reportingMonth = new Intl.DateTimeFormat('en-PH', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(data.reportingMonth + '-01T00:00:00Z'));

    return (
        <section
            aria-label="Maintenance intelligence"
            className="jr-command-panel @container rounded-2xl border border-violet-100 bg-white p-4 shadow-sm sm:p-6 dark:border-violet-900/70 dark:bg-slate-900"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        <Activity aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-lg leading-tight font-bold text-slate-900 sm:text-xl dark:text-slate-100">
                            Maintenance intelligence
                        </h2>
                        <p className={`mt-1 ${subtleText}`}>
                            Road condition, reporting, and maintenance schedules
                        </p>
                    </div>
                </div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    As of{' '}
                    <time dateTime={data.asOf}>{manilaDate(data.asOf)}</time>
                </p>
            </div>

            <div className="mt-5 grid gap-3 @min-[52rem]:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                <section
                    aria-label="Road condition"
                    className="min-w-0 rounded-2xl bg-violet-50/70 p-4 dark:bg-violet-950/30"
                >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <h3 className="font-semibold text-violet-950 dark:text-violet-100">
                            Road condition
                        </h3>
                        <span className={subtleText}>{total} classified</span>
                    </div>
                    {total > 0 && (
                        <div
                            className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-900"
                            aria-hidden="true"
                        >
                            {conditions
                                .filter(
                                    (condition) =>
                                        data.conditions[condition] > 0,
                                )
                                .map((condition) => (
                                    <div
                                        key={condition}
                                        className={
                                            conditionStyles[condition].fill
                                        }
                                        style={{
                                            flex: data.conditions[condition],
                                        }}
                                    />
                                ))}
                        </div>
                    )}
                    <dl className="mt-3 grid grid-cols-3 gap-2">
                        {conditions.map((condition) => (
                            <div key={condition} className="min-w-0">
                                <dt
                                    className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${conditionStyles[condition].label}`}
                                >
                                    {condition}
                                </dt>
                                <dd className="mt-1 text-xl leading-tight font-bold text-slate-900 tabular-nums dark:text-slate-100">
                                    {data.conditions[condition]}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
                <dl className="grid grid-cols-1 gap-3 @min-[25rem]:grid-cols-2">
                    <div className={`p-3.5 ${panel}`}>
                        <FileClock
                            aria-hidden="true"
                            className="size-4 text-violet-700 dark:text-violet-300"
                        />
                        <dt className="mt-2 text-sm font-semibold">
                            Missing {reportingMonth} report
                        </dt>
                        <dd className="mt-1 text-2xl leading-tight font-bold tabular-nums">
                            {data.noCurrentReport}
                        </dd>
                        <p className={`mt-1 ${subtleText}`}>
                            Started, ongoing records
                        </p>
                    </div>
                    <div className={`p-3.5 ${panel}`}>
                        <ClockAlert
                            aria-hidden="true"
                            className="size-4 text-amber-700 dark:text-amber-300"
                        />
                        <dt className="mt-2 text-sm font-semibold">
                            Past estimated finish
                        </dt>
                        <dd className="mt-1 text-2xl leading-tight font-bold tabular-nums">
                            {data.pastEstimate}
                        </dd>
                        <p className={`mt-1 ${subtleText}`}>Ongoing records</p>
                    </div>
                </dl>
            </div>

            <div className="mt-4 grid items-start gap-4 @min-[54rem]:grid-cols-[repeat(2,minmax(0,1fr))]">
                <section className={panel} aria-label="Maintenance schedule">
                    <div className="border-b border-violet-100 p-4 dark:border-violet-900/70">
                        <h3 className="flex items-center gap-2 font-semibold">
                            <CalendarDays
                                aria-hidden="true"
                                className="size-4 shrink-0 text-violet-700 dark:text-violet-300"
                            />
                            Maintenance schedule
                        </h3>
                        <p className={`mt-1 ${subtleText}`}>
                            {data.calendar.length} of {data.ongoingCount}{' '}
                            ongoing records, earliest estimate first.
                        </p>
                        {data.ongoingCount > data.calendar.length && (
                            <Link
                                href="/workspace/ui/maintenance-records?status=Ongoing"
                                className={`mt-2 inline-block text-sm ${linkStyle}`}
                            >
                                View all ongoing records
                            </Link>
                        )}
                        {data.calendar.length > 0 && (
                            <button
                                type="button"
                                className="mt-3 inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-left text-sm font-semibold text-violet-900 hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-600 dark:bg-violet-950 dark:text-violet-200 dark:hover:bg-violet-900"
                                onClick={() => downloadCalendar(data.calendar)}
                            >
                                <Download
                                    aria-hidden="true"
                                    className="size-4 shrink-0"
                                />
                                Download displayed estimates (.ics)
                            </button>
                        )}
                    </div>
                    {data.calendar.length ? (
                        <ul className="divide-y divide-violet-100 px-4 dark:divide-violet-900/70">
                            {data.calendar.map((item) => (
                                <li key={item.id} className="py-3">
                                    <Link
                                        className={linkStyle}
                                        href={`/workspace/ui/maintenance-projects/${item.projectId}/records/${item.id}`}
                                    >
                                        {item.projectTitle}
                                    </Link>
                                    <div
                                        className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 ${subtleText}`}
                                    >
                                        <span>
                                            Start{' '}
                                            <time dateTime={item.startDate}>
                                                {manilaDate(item.startDate)}
                                            </time>
                                        </span>
                                        <span className="font-medium">
                                            Est. finish{' '}
                                            <time
                                                dateTime={item.estimatedFinish}
                                            >
                                                {manilaDate(
                                                    item.estimatedFinish,
                                                )}
                                            </time>
                                        </span>
                                        {item.estimatedFinish < data.asOf && (
                                            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                                Past estimate
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={`p-4 ${subtleText}`}>
                            No ongoing maintenance records.
                        </p>
                    )}
                </section>

                <section className={panel} aria-label="Road review priority">
                    <div className="border-b border-violet-100 p-4 dark:border-violet-900/70">
                        <h3 className="flex items-center gap-2 font-semibold">
                            <Route
                                aria-hidden="true"
                                className="size-4 shrink-0 text-violet-700 dark:text-violet-300"
                            />
                            Road review priority
                        </h3>
                        <p className={`mt-1 ${subtleText}`}>
                            {data.priority.length} of {data.priorityTotal}{' '}
                            roads with provisional review indicators.
                        </p>
                        <details className="mt-2 text-sm">
                            <summary className="cursor-pointer font-medium text-violet-800 focus-visible:outline-violet-600 dark:text-violet-200">
                                How scores are calculated
                            </summary>
                            <p className={`mt-2 ${subtleText}`}>
                                Bad condition adds 60, fair adds 30, a past
                                estimate adds 25, and a missing current report
                                adds 15. Scores guide record review. Safety
                                decisions and work authorization use their own
                                assessments. Each factor is counted at most
                                once per road, even when several records are
                                overdue or missing reports.
                            </p>
                        </details>
                    </div>
                    {data.priority.length ? (
                        <ol className="divide-y divide-violet-100 px-4 dark:divide-violet-900/70">
                            {data.priority.map((road) => (
                                <li key={road.id} className="py-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <Link
                                            className={`inline-flex min-w-0 items-baseline gap-1 ${linkStyle}`}
                                            href={`/workspace/ui/road-coverages/${road.id}`}
                                        >
                                            <span className="min-w-0 break-words">
                                                {road.roadName}
                                            </span>
                                            <ArrowUpRight
                                                aria-hidden="true"
                                                className="size-3.5 shrink-0 text-violet-600 dark:text-violet-300"
                                            />
                                        </Link>
                                        <span className="shrink-0 text-sm font-bold text-violet-900 tabular-nums dark:text-violet-200">
                                            {road.score}
                                            <span className="font-medium">
                                                /100
                                            </span>
                                        </span>
                                    </div>
                                    <div
                                        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-950"
                                        aria-hidden="true"
                                    >
                                        <div
                                            className="h-full rounded-full bg-violet-600 dark:bg-violet-400"
                                            style={{ width: road.score + '%' }}
                                        />
                                    </div>
                                    <p className={`mt-1.5 ${subtleText}`}>
                                        {road.condition} condition{' '}
                                        {road.conditionScore} · Past estimate{' '}
                                        {road.overdueScore} · Missing report{' '}
                                        {road.reportScore}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className={`p-4 ${subtleText}`}>
                            No roads match the current review indicators.
                        </p>
                    )}
                </section>
            </div>
            <PriorityScenario />
        </section>
    );
}

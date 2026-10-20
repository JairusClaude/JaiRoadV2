import { Link, router } from '@inertiajs/react';
import {
    Activity,
    ArrowRight,
    BarChart3,
    Building2,
    CalendarDays,
    CheckCircle2,
    CircleHelp,
    ClipboardList,
    FileText,
    FolderKanban,
    HardHat,
    MapPinned,
    RefreshCw,
    Route as RoadIcon,
    ShieldCheck,
    TrendingUp,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

type NumberOrNull = number | null;
type Breakdown = { name: string; count: number };
type Quarter = { label: string; count: number };
type Project = {
    id: number;
    title: string;
    municipality: string | null;
    kilometers: number | null;
};
type Maintenance = {
    id: number;
    projectId: number;
    projectTitle: string;
    period: string;
    status: string;
};
type Lgu = { id: number; name: string; roads: number; kilometers: number };

export type AdminDashboardProps = {
    viewer: { name: string; role: string };
    stats: {
        projects: NumberOrNull;
        roads: NumberOrNull;
        kilometers: NumberOrNull;
        lgus: NumberOrNull;
        engineers: NumberOrNull;
        maintenanceRecords: NumberOrNull;
        ongoingRecords: NumberOrNull;
        monthlyUpdates: NumberOrNull;
        documents: NumberOrNull;
        accounts: NumberOrNull;
        activeAccounts: NumberOrNull;
        inactiveAccounts: NumberOrNull;
    };
    statuses: Breakdown[];
    conditions: Breakdown[];
    pavements: Breakdown[];
    quarterly: Quarter[];
    recentProjects: Project[];
    recentRecords: Maintenance[];
    topLgus: Lgu[];
    notices: string[];
    generatedAt: string;
    links: {
        projects: string | null;
        roads: string | null;
        updates: string | null;
        documents: string | null;
        accounts: string | null;
        lgus: string | null;
    };
};

const navy = 'text-[#1D2E43]';
const secondary = 'text-[#7B8BA2]';
const border = 'border-[#E4EAF1]';
const number = (value: NumberOrNull) =>
    value === null ? '—' : value.toLocaleString();
const length = (value: NumberOrNull) =>
    value === null
        ? '—'
        : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;

function Metric({
    title,
    value,
    subline,
    icon: Icon,
    featured = false,
}: {
    title: string;
    value: string;
    subline: string;
    icon: LucideIcon;
    featured?: boolean;
}) {
    return (
        <div
            className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${border} ${featured ? 'bg-[#FFFAF7]' : 'bg-white'}`}
        >
            <div className="mb-5 flex items-start justify-between gap-2">
                <p className="text-[13px] leading-5 font-medium text-[#647890]">
                    {title}
                </p>
                <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${featured ? 'bg-[#F3DFD3]' : 'bg-[#F2F5F9]'}`}
                >
                    <Icon
                        className={`size-[19px] ${featured ? 'text-[#90451F]' : 'text-[#6F839D]'}`}
                        aria-hidden="true"
                    />
                </div>
            </div>
            <div
                className={`text-[29px] font-semibold tracking-tight ${navy} tabular-nums`}
            >
                {value}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#8A99AC]">{subline}</p>
        </div>
    );
}

function Heading({
    title,
    note,
    action,
}: {
    title: string;
    note?: string;
    action?: ReactNode;
}) {
    return (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
                <h2 className={`text-[18px] font-semibold ${navy}`}>{title}</h2>
                {note && (
                    <p className={`mt-1 text-[13px] leading-5 ${secondary}`}>
                        {note}
                    </p>
                )}
            </div>
            {action}
        </div>
    );
}

function Panel({
    children,
    className = '',
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={`min-w-0 rounded-2xl border bg-white p-4 sm:p-5 ${border} ${className}`}
        >
            {children}
        </section>
    );
}

function Empty({ text }: { text: string }) {
    return (
        <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E0E8F1] bg-[#FBFCFE] px-5 py-7 text-center">
            <BarChart3 className="size-6 text-[#A3B0C1]" aria-hidden="true" />
            <p className="max-w-sm text-[13px] leading-6 text-[#8090A5]">
                {text}
            </p>
        </div>
    );
}

function SmallLink({
    href,
    children,
}: {
    href: string | null;
    children: ReactNode;
}) {
    if (!href) {
        return null;
    }

    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#90451F] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#90451F]"
        >
            {children}
            <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
    );
}

const conditionColors: Record<string, string> = {
    Good: '#3D9872',
    Fair: '#D7A04F',
    Bad: '#C96A65',
    Other: '#A4B1C4',
};
const pavementColors: Record<string, string> = {
    Concrete: '#9A5534',
    Asphalt: '#54738F',
    Gravel: '#C79F5B',
    Earth: '#8C9B77',
    Other: '#ABB4C2',
};
const statusColors: Record<string, string> = {
    Ongoing: '#D59C4B',
    Completed: '#3D9872',
    Other: '#9CADC1',
};

function Donut({
    values,
    colors,
    centerLabel,
}: {
    values: Breakdown[];
    colors: Record<string, string>;
    centerLabel: string;
}) {
    const total = values.reduce((sum, item) => sum + item.count, 0);

    if (!total) {
        return (
            <Empty text="No records are available for this breakdown yet." />
        );
    }

    return (
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between sm:gap-4">
            <div className="relative shrink-0">
                <svg
                    viewBox="0 0 160 160"
                    width="184"
                    height="184"
                    role="img"
                    aria-label={`${centerLabel}: ${values.map((v) => `${v.name} ${v.count}`).join(', ')}`}
                >
                    <circle
                        cx="80"
                        cy="80"
                        r="59"
                        fill="none"
                        stroke="#EDF1F5"
                        strokeWidth="17"
                    />
                    {values.map((item, index) => {
                        const percent = (item.count / total) * 100;
                        const start = values
                            .slice(0, index)
                            .reduce(
                                (offset, previous) =>
                                    offset + (previous.count / total) * 100,
                                0,
                            );

                        return (
                            <circle
                                key={item.name}
                                cx="80"
                                cy="80"
                                r="59"
                                fill="none"
                                stroke={colors[item.name] ?? '#ABB4C2'}
                                strokeWidth="17"
                                pathLength="100"
                                strokeDasharray={`${percent} ${100 - percent}`}
                                strokeDashoffset={-start}
                                transform="rotate(-90 80 80)"
                            />
                        );
                    })}
                    <text
                        x="80"
                        y="77"
                        textAnchor="middle"
                        fontSize="29"
                        fontWeight="700"
                        fill="#1D2E43"
                    >
                        {number(total)}
                    </text>
                    <text
                        x="80"
                        y="96"
                        textAnchor="middle"
                        fontSize="10.5"
                        fill="#8291A5"
                    >
                        {centerLabel}
                    </text>
                </svg>
            </div>
            <div className="w-full min-w-0 space-y-3">
                {values.map((item) => (
                    <div
                        key={item.name}
                        className="flex items-center gap-3 text-[13px]"
                    >
                        <span
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{
                                backgroundColor: colors[item.name] ?? '#ABB4C2',
                            }}
                        />
                        <span className="flex-1 text-[#61738A]">
                            {item.name}
                        </span>
                        <strong className="text-[#23354D] tabular-nums">
                            {number(item.count)}
                        </strong>
                        <span className="w-10 text-right text-[#93A1B4] tabular-nums">
                            {Math.round((item.count / total) * 100)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ActivityChart({ data }: { data: Quarter[] }) {
    const [periods, setPeriods] = useState<4 | 8 | 12>(8);
    const visible = data.slice(-periods);

    if (!data.length) {
        return (
            <Empty text="No maintenance activities have been recorded by year and quarter yet." />
        );
    }

    const max = Math.max(1, ...visible.map((row) => row.count));

    return (
        <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#91A0B1]">
                    Number of Maintenance Records created for each listed year
                    and quarter, not progress percentages.
                </p>
                <div
                    className="inline-flex rounded-lg border border-[#E2E8F0] bg-[#F7F9FC] p-0.5"
                    aria-label="Quarter range"
                >
                    {([4, 8, 12] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setPeriods(value)}
                            aria-pressed={periods === value}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-[#90451F] ${periods === value ? 'bg-white text-[#90451F] shadow-sm' : 'text-[#8493A7] hover:text-[#52657D]'}`}
                        >
                            Last {value}
                        </button>
                    ))}
                </div>
            </div>
            <div
                className="flex min-h-52 items-end gap-2.5 border-b border-[#E9EFF5] px-1 pb-0 sm:gap-4"
                role="img"
                aria-label={`Maintenance activities: ${visible.map((item) => `${item.label}, ${item.count}`).join('; ')}`}
            >
                {visible.map((row) => (
                    <div
                        key={row.label}
                        className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2.5"
                    >
                        <span className="text-[11px] font-semibold text-[#5F7088] tabular-nums">
                            {row.count}
                        </span>
                        <div
                            title={`${row.label}: ${row.count} activities`}
                            style={{
                                height: `${Math.max(3, (row.count / max) * 151)}px`,
                            }}
                            className="w-full max-w-[55px] rounded-t-md bg-[#B16D46] transition-colors group-hover:bg-[#90451F]"
                        />
                        <span className="min-h-9 text-center text-[10px] leading-4 text-[#8393A8] sm:text-[11px]">
                            {row.label}
                        </span>
                    </div>
                ))}
            </div>
        </>
    );
}

function BarBreakdown({
    values,
    colors,
}: {
    values: Breakdown[];
    colors: Record<string, string>;
}) {
    const total = values.reduce((sum, row) => sum + row.count, 0);

    if (!total) {
        return <Empty text="No road pavement types have been recorded yet." />;
    }

    return (
        <div className="space-y-4">
            {values.map((row) => (
                <div key={row.name}>
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                        <span className="font-medium text-[#63768D]">
                            {row.name}
                        </span>
                        <span className="text-[#53687F] tabular-nums">
                            {row.count}{' '}
                            <span className="text-[#A0ADBD]">
                                ({Math.round((row.count / total) * 100)}%)
                            </span>
                        </span>
                    </div>
                    <div
                        className="h-2.5 overflow-hidden rounded-full bg-[#F0F3F7]"
                        role="progressbar"
                        aria-label={`${row.name} road coverages`}
                        aria-valuenow={row.count}
                        aria-valuemin={0}
                        aria-valuemax={total}
                    >
                        <div
                            className="h-full rounded-full"
                            style={{
                                width: `${(row.count / total) * 100}%`,
                                backgroundColor: colors[row.name] ?? '#ABB4C2',
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const key = status.toLowerCase();
    const cls =
        key === 'completed'
            ? 'bg-[#E5F5EB] text-[#27764F]'
            : key === 'ongoing'
              ? 'bg-[#FFF1DF] text-[#9A6024]'
              : 'bg-[#EDF1F5] text-[#61748A]';

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
        >
            {status}
        </span>
    );
}

function QuickLink({
    icon: Icon,
    title,
    description,
    href,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    href: string | null;
}) {
    const contents = (
        <>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F8EEE7] text-[#965332]">
                <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-[#26394E]">
                    {title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#8797A9]">
                    {description}
                </span>
            </div>
            {href ? (
                <ArrowRight
                    className="size-4 shrink-0 text-[#A0AEBE]"
                    aria-hidden="true"
                />
            ) : (
                <span className="text-[10px] text-[#A0AEBE]">Unavailable</span>
            )}
        </>
    );
    const css = `flex items-center gap-3 rounded-xl border px-3.5 py-3.5 ${border} transition ${href ? 'bg-white hover:border-[#D4BAAB] hover:bg-[#FFFCFA] focus-visible:outline-2 focus-visible:outline-[#90451F]' : 'bg-[#F9FAFC] opacity-70'}`;

    return href ? (
        <Link href={href} className={css}>
            {contents}
        </Link>
    ) : (
        <div className={css}>{contents}</div>
    );
}

export default function AdminDashboardPage({
    viewer,
    stats,
    statuses,
    conditions,
    pavements,
    quarterly,
    recentProjects,
    recentRecords,
    topLgus,
    notices,
    generatedAt,
    links,
}: AdminDashboardProps) {
    const firstName = viewer.name.trim().split(/\s+/)[0] || 'Administrator';
    const snapshot = new Date(generatedAt);
    const updated = Number.isNaN(snapshot.getTime())
        ? 'current page load'
        : snapshot.toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
          });
    const completionTotal = statuses.reduce((sum, row) => sum + row.count, 0);
    const completed =
        statuses.find((row) => row.name === 'Completed')?.count ?? 0;
    const completionRate =
        completionTotal > 0
            ? Math.round((completed / completionTotal) * 100)
            : null;

    return (
        <ProjectWorkspace>
            <div className="jr-page-head flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1>Admin Dashboard</h1>
                    <p>
                        System overview, road inventory, maintenance progress,
                        and administration.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => router.reload()}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E0E7EF] bg-white px-3.5 text-sm font-semibold text-[#536782] transition hover:bg-[#F6F8FB] focus-visible:outline-2 focus-visible:outline-[#90451F]"
                >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Refresh data
                </button>
            </div>

            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-[#77899E]">
                    Welcome back,{' '}
                    <strong className="font-semibold text-[#20364B]">
                        {firstName}
                    </strong>
                    .
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#8393A8]">
                    <ShieldCheck className="size-3.5 text-[#9A5630]" />
                    Administrator <span className="text-[#C2CAD3]">·</span>{' '}
                    Updated {updated}
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                    icon={FolderKanban}
                    title="Maintenance Projects"
                    value={number(stats.projects)}
                    subline="Registered long-term projects"
                    featured
                />
                <Metric
                    icon={RoadIcon}
                    title="Road Coverages"
                    value={number(stats.roads)}
                    subline="Complete mapped road coverages"
                />
                <Metric
                    icon={Activity}
                    title="Ongoing Maintenance"
                    value={number(stats.ongoingRecords)}
                    subline="Maintenance Records marked Ongoing"
                />
                <Metric
                    icon={MapPinned}
                    title="Recorded Road Length"
                    value={length(stats.kilometers)}
                    subline="Kilometers stored in Road Coverage"
                />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { label: 'LGUs', value: stats.lgus, icon: Building2 },
                    {
                        label: 'Engineers',
                        value: stats.engineers,
                        icon: HardHat,
                    },
                    {
                        label: 'Active Accounts',
                        value: stats.activeAccounts,
                        icon: Users,
                    },
                    {
                        label: 'Maintenance Records',
                        value: stats.maintenanceRecords,
                        icon: ClipboardList,
                    },
                ].map(({ label, value, icon: Icon }) => (
                    <div
                        key={label}
                        className="flex items-center gap-3 rounded-xl border border-[#E5EBF2] bg-[#FAFBFD] px-4 py-3"
                    >
                        <Icon
                            className="size-[19px] shrink-0 text-[#9B6A4D]"
                            aria-hidden="true"
                        />
                        <div>
                            <p className="text-xs text-[#7B8DA4]">{label}</p>
                            <p className="text-lg font-semibold text-[#24364B] tabular-nums">
                                {number(value)}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {notices.length > 0 && (
                <div className="mt-5 space-y-2">
                    {notices.map((notice) => (
                        <div
                            key={notice}
                            role="note"
                            className="flex items-start gap-2 rounded-xl border border-[#EBD9C6] bg-[#FFF9F2] p-3.5 text-[13px] leading-6 text-[#85522C]"
                        >
                            <CircleHelp className="mt-0.5 size-4 shrink-0" />
                            <p>{notice}</p>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-6 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                <Panel>
                    <Heading
                        title="Maintenance activity by quarter"
                        note="Distribution of recorded maintenance occurrences by year and quarter"
                    />
                    <ActivityChart data={quarterly} />
                </Panel>
                <Panel>
                    <Heading
                        title="Maintenance status"
                        note="Current status of all Maintenance Records"
                    />
                    <Donut
                        values={statuses}
                        colors={statusColors}
                        centerLabel="Records"
                    />
                    <div className="mt-5 border-t border-[#EEF1F5] pt-3 text-xs text-[#8697AA]">
                        {completionRate === null
                            ? 'Completion rate unavailable until maintenance records exist.'
                            : `${completionRate}% of recorded maintenance activities are marked Completed.`}
                    </div>
                </Panel>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <Panel>
                    <Heading
                        title="Road condition overview"
                        note="Number of complete Road Coverages by reported condition"
                    />
                    <Donut
                        values={conditions}
                        colors={conditionColors}
                        centerLabel="Coverages"
                    />
                </Panel>
                <Panel>
                    <Heading
                        title="Pavement distribution"
                        note="Count of coverages by recorded pavement type"
                    />
                    <BarBreakdown values={pavements} colors={pavementColors} />
                </Panel>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                <Panel>
                    <Heading
                        title="Recent maintenance projects"
                        note="Latest projects registered in JaiROADS"
                        action={
                            <SmallLink href={links.projects}>
                                View all
                            </SmallLink>
                        }
                    />
                    {recentProjects.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[440px] text-left text-[13px]">
                                <thead className="border-b border-[#E9EDF3] bg-[#F8FAFC] text-[11px] tracking-wide text-[#8293A9] uppercase">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="px-3 py-3 font-semibold"
                                        >
                                            Project
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-3 py-3 font-semibold"
                                        >
                                            LGU
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-3 py-3 text-right font-semibold"
                                        >
                                            Length
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#EDF1F6]">
                                    {recentProjects.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="hover:bg-[#FAFBFD]"
                                        >
                                            <td className="px-3 py-3.5">
                                                <div className="font-semibold text-[#213449]">
                                                    {links.projects ? (
                                                        <Link
                                                            href={`/maintenance-projects/${item.id}`}
                                                            className="hover:text-[#90451F] hover:underline"
                                                        >
                                                            {item.title}
                                                        </Link>
                                                    ) : (
                                                        item.title
                                                    )}
                                                </div>
                                                <div className="mt-1 text-xs text-[#9AA8B8]">
                                                    Project #{item.id}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3.5 text-[#65788F]">
                                                {item.municipality ??
                                                    'Not mapped'}
                                            </td>
                                            <td className="px-3 py-3.5 text-right text-[#65788F] tabular-nums">
                                                {item.kilometers === null
                                                    ? '—'
                                                    : `${item.kilometers.toFixed(2)} km`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <Empty text="No Maintenance Projects have been recorded yet." />
                    )}
                </Panel>
                <Panel>
                    <Heading
                        title="Recent maintenance activity"
                        note="Most recently recorded maintenance periods"
                    />
                    {recentRecords.length ? (
                        <div className="space-y-1">
                            {recentRecords.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between gap-3 border-b border-[#EEF1F5] py-3 last:border-0"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-[13px] font-semibold text-[#24384D]">
                                            {item.projectTitle}
                                        </p>
                                        <p className="mt-1 text-xs text-[#8A9AAE]">
                                            {item.period} · Record #{item.id}
                                        </p>
                                    </div>
                                    <StatusBadge status={item.status} />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Empty text="No maintenance activities have been recorded yet." />
                    )}
                </Panel>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <Panel>
                    <Heading
                        title="LGU coverage overview"
                        note="LGUs ranked by number of Road Coverages"
                        action={
                            <SmallLink href={links.lgus}>View LGUs</SmallLink>
                        }
                    />
                    {topLgus.length ? (
                        <div className="space-y-3">
                            {topLgus.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-3 rounded-lg bg-[#F8FAFC] px-3 py-2.5"
                                >
                                    <Building2
                                        className="size-4 shrink-0 text-[#AB7559]"
                                        aria-hidden="true"
                                    />
                                    <span className="flex-1 text-[13px] font-medium text-[#526880]">
                                        {item.name}{' '}
                                        <span className="text-xs text-[#A2AFC0]">
                                            #{item.id}
                                        </span>
                                    </span>
                                    <span className="text-xs text-[#8293A6] tabular-nums">
                                        {item.kilometers.toLocaleString()} km
                                    </span>
                                    <strong className="min-w-9 text-right text-[13px] text-[#24374D] tabular-nums">
                                        {item.roads}
                                    </strong>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Empty text="No LGU road coverage data is available." />
                    )}
                </Panel>
                <Panel>
                    <Heading
                        title="Administration snapshot"
                        note="Operational support and account inventory"
                    />
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            {
                                label: 'Total accounts',
                                value: stats.accounts,
                                icon: Users,
                            },
                            {
                                label: 'Inactive accounts',
                                value: stats.inactiveAccounts,
                                icon: ShieldCheck,
                            },
                            {
                                label: 'Monthly reports',
                                value: stats.monthlyUpdates,
                                icon: CalendarDays,
                            },
                            {
                                label: 'Formal documents',
                                value: stats.documents,
                                icon: FileText,
                            },
                        ].map(({ label, value, icon: Icon }) => (
                            <div
                                key={label}
                                className="rounded-xl bg-[#F7F9FC] p-3.5"
                            >
                                <Icon className="mb-2 size-[17px] text-[#A37358]" />
                                <p className="text-xs text-[#8B9AAD]">
                                    {label}
                                </p>
                                <p className="mt-1 text-xl font-semibold text-[#25374E] tabular-nums">
                                    {number(value)}
                                </p>
                            </div>
                        ))}
                    </div>
                    <p className="mt-4 text-xs leading-5 text-[#96A2B2]">
                        Monthly reports and documents are inventory totals;
                        their legacy relationships may require review against
                        the newer data dictionary.
                    </p>
                </Panel>
            </div>

            <Panel className="mt-4">
                <Heading
                    title="Quick access"
                    note="Navigate to frequently used administration and maintenance modules"
                />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <QuickLink
                        icon={FolderKanban}
                        title="Maintenance Projects"
                        description="View projects and their records"
                        href={links.projects}
                    />
                    <QuickLink
                        icon={RoadIcon}
                        title="Road Sections"
                        description="Mapped roads and their conditions"
                        href={links.roads}
                    />
                    <QuickLink
                        icon={Users}
                        title="User Management"
                        description="Manage operational accounts"
                        href={links.accounts}
                    />
                    <QuickLink
                        icon={Building2}
                        title="LGU"
                        description="Municipal reference information"
                        href={links.lgus}
                    />
                    <QuickLink
                        icon={CalendarDays}
                        title="Monthly Updates"
                        description="Maintenance progress reports"
                        href={links.updates}
                    />
                    <QuickLink
                        icon={FileText}
                        title="Project Documents"
                        description="Formal maintenance files"
                        href={links.documents}
                    />
                </div>
            </Panel>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#E9EEF5] pt-4 text-xs text-[#93A1B3]">
                <span>
                    <CheckCircle2 className="mr-1 inline size-3.5" />
                    Read-only statistics from the connected JaiROADS database
                </span>
                <span>
                    <TrendingUp className="mr-1 inline size-3.5" />
                    Updated when refreshed · No database changes
                </span>
            </div>
        </ProjectWorkspace>
    );
}

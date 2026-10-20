import {
    ChevronLeft,
    ChevronRight,
    Info,
    Link2,
    MoreHorizontal,
    Plus,
    Search,
    ShieldAlert,
    X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

/** UI name: Road Sections; actual entity: a *whole* RoadCoverage. */
type Pavement = 'Concrete' | 'Asphalt' | 'Gravel' | 'Earth';
type Condition = 'Good' | 'Fair' | 'Bad';
export type RoadCoverageSummary = {
    id: number;
    roadName: string;
    lguId: number;
    kilometers: number;
    pavementType: string;
    stateCategory: string;
    geojson: unknown;
    createdByEngineerId: number | null;
    projectId: number | null;
    projectTitle: string | null;
    localDraft?: boolean;
};
export type RoadSectionsPageProps = {
    initialCoverages?: RoadCoverageSummary[];
    lgus?: { id: number; name: string }[];
    schemaNotice?: string | null;
    canPreviewDraft?: boolean;
};
type Point = [number, number];
type Line = Point[];
const PAVEMENTS: Pavement[] = ['Concrete', 'Asphalt', 'Gravel', 'Earth'];
const CONDITIONS: Condition[] = ['Good', 'Fair', 'Bad'];
const button =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm font-medium text-[#405572] transition hover:bg-[#F8FAFD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#994C29] disabled:cursor-not-allowed disabled:opacity-50';
const input =
    'min-h-10 w-full rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm text-[#20324A] outline-none placeholder:text-[#91A2BA] focus:border-[#98512D] focus:ring-2 focus:ring-[#F6E6DA]';
const perPage = 8;

function getPoint(value: unknown): Point | null {
    if (!Array.isArray(value) || value.length < 2) {
        return null;
    }

    const lon = Number(value[0]);
    const lat = Number(value[1]);

    if (
        !Number.isFinite(lon) ||
        !Number.isFinite(lat) ||
        Math.abs(lat) > 90 ||
        Math.abs(lon) > 180
    ) {
        return null;
    }

    return [lon, lat];
}
function getLines(value: unknown): Line[] {
    let data: unknown = value;

    if (typeof value === 'string') {
        try {
            data = JSON.parse(value);
        } catch {
            return [];
        }
    }

    if (!data || typeof data !== 'object') {
        return [];
    }

    const geo = data as Record<string, unknown>;

    if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
        return geo.features.flatMap(getLines);
    }

    if (geo.type === 'GeometryCollection' && Array.isArray(geo.geometries)) {
        return geo.geometries.flatMap(getLines);
    }

    if (geo.type === 'Feature') {
        return getLines(geo.geometry);
    }

    if (geo.type === 'LineString' && Array.isArray(geo.coordinates)) {
        const points = geo.coordinates.map(getPoint);

        return points.length >= 2 && points.every(Boolean)
            ? [points as Point[]]
            : [];
    }

    if (geo.type === 'MultiLineString' && Array.isArray(geo.coordinates)) {
        return geo.coordinates.flatMap((coords) =>
            getLines({ type: 'LineString', coordinates: coords }),
        );
    }

    return [];
}
function haversine(a: Point, b: Point): number {
    const rad = Math.PI / 180;
    const dLat = (b[1] - a[1]) * rad;
    const dLon = (b[0] - a[0]) * rad;
    const n =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;

    return (
        6371.0088 * 2 * Math.atan2(Math.sqrt(n), Math.sqrt(Math.max(0, 1 - n)))
    );
}
function calculateKm(lines: Line[]): number {
    return lines.reduce(
        (total, line) =>
            total +
            line
                .slice(1)
                .reduce((km, point, i) => km + haversine(line[i], point), 0),
        0,
    );
}
function GeometryPreview({ geojson }: { geojson: unknown }) {
    const lines = useMemo(() => getLines(geojson), [geojson]);
    const paths = useMemo(() => {
        const points = lines.flat();

        if (!points.length) {
            return [];
        }

        const xs = points.map((p) => p[0]);
        const ys = points.map((p) => p[1]);
        const minX = Math.min(...xs),
            maxX = Math.max(...xs);
        const minY = Math.min(...ys),
            maxY = Math.max(...ys);
        const spanX = Math.max(maxX - minX, 0.00001),
            spanY = Math.max(maxY - minY, 0.00001);
        const scale = Math.min(410 / spanX, 190 / spanY);
        const width = (maxX - minX) * scale,
            height = (maxY - minY) * scale;
        const xPad = (480 - width) / 2,
            yPad = (260 - height) / 2;

        return lines.map((line) =>
            line
                .map(
                    ([lon, lat], i) =>
                        `${i === 0 ? 'M' : 'L'} ${(xPad + (lon - minX) * scale).toFixed(2)} ${(260 - (yPad + (lat - minY) * scale)).toFixed(2)}`,
                )
                .join(' '),
        );
    }, [lines]);

    return (
        <div className="overflow-hidden rounded-2xl border border-[#DFE6EF] bg-[#F4F7FA]">
            <svg
                viewBox="0 0 480 260"
                className="w-full"
                role="img"
                aria-label={
                    paths.length
                        ? 'Road geometry preview without a geographic basemap'
                        : 'Road geometry not available'
                }
            >
                <defs>
                    <pattern
                        id="jr-road-grid"
                        width="32"
                        height="32"
                        patternUnits="userSpaceOnUse"
                    >
                        <path
                            d="M 32 0 L 0 0 0 32"
                            fill="none"
                            stroke="#DFE7EF"
                            strokeWidth="1"
                        />
                    </pattern>
                </defs>
                <rect width="480" height="260" fill="url(#jr-road-grid)" />
                {paths.length ? (
                    paths.map((d, i) => (
                        <g key={i}>
                            <path
                                d={d}
                                fill="none"
                                stroke="#FFF"
                                strokeWidth="9"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d={d}
                                fill="none"
                                stroke="#994C29"
                                strokeWidth="5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </g>
                    ))
                ) : (
                    <>
                        <circle cx="240" cy="111" r="25" fill="#E4EBF3" />
                        <path
                            d="M229 113l7-9 7 7 7-12"
                            fill="none"
                            stroke="#8296AC"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <text
                            x="240"
                            y="166"
                            textAnchor="middle"
                            fontSize="13"
                            fill="#75869D"
                        >
                            No mapped road geometry available
                        </text>
                    </>
                )}
            </svg>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#DFE6EF] px-4 py-2.5 text-xs text-[#7488A3]">
                <span>
                    {paths.length
                        ? `${paths.length} line geometry${paths.length === 1 ? '' : ' segments'}`
                        : 'Geometry not provided'}
                </span>
                <span>Geometry-only preview · Not a basemap</span>
            </div>
        </div>
    );
}
function Pill({
    children,
    tone = 'neutral',
}: {
    children: ReactNode;
    tone?: 'good' | 'fair' | 'bad' | 'warm' | 'neutral';
}) {
    const color = {
        good: 'bg-[#E8F6ED] text-[#188155]',
        fair: 'bg-[#FFF2DF] text-[#9A6621]',
        bad: 'bg-[#FDECEC] text-[#B94F4F]',
        warm: 'bg-[#FFF0E5] text-[#9B4C24]',
        neutral: 'bg-[#F0F3F8] text-[#61748E]',
    }[tone];

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${color}`}
        >
            {children}
        </span>
    );
}
function Modal({
    titleId,
    onClose,
    children,
}: {
    titleId: string;
    onClose: () => void;
    children: ReactNode;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#162438]/55 px-4 py-6"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            >
                {children}
            </section>
        </div>
    );
}
export default function RoadSectionsPage({
    initialCoverages = [],
    lgus = [],
    schemaNotice = null,
    canPreviewDraft = false,
}: RoadSectionsPageProps) {
    const [drafts, setDrafts] = useState<RoadCoverageSummary[]>([]);
    const [search, setSearch] = useState('');
    const [lguFilter, setLguFilter] = useState('all');
    const [pavementFilter, setPavementFilter] = useState('all');
    const [conditionFilter, setConditionFilter] = useState('all');
    const [projectFilter, setProjectFilter] = useState('all');
    const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<RoadCoverageSummary | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [name, setName] = useState('');
    const [lguId, setLguId] = useState('');
    const [pavement, setPavement] = useState<Pavement>('Concrete');
    const [condition, setCondition] = useState<Condition>('Good');
    const [geojsonText, setGeojsonText] = useState('');
    const [kmOverride, setKmOverride] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    const all = useMemo(
        () => [...drafts, ...initialCoverages],
        [drafts, initialCoverages],
    );
    const linkedCount = all.filter((item) => item.projectId !== null).length;
    const mappedCount = all.filter(
        (item) => getLines(item.geojson).length > 0,
    ).length;
    const kilometersTotal = all.reduce(
        (total, item) =>
            total + (Number.isFinite(item.kilometers) ? item.kilometers : 0),
        0,
    );
    const lguName = useCallback(
        (id: number) =>
            lgus.find((item) => item.id === id)?.name || `LGU #${id}`,
        [lgus],
    );
    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();

        return all
            .filter(
                (item) =>
                    (!term ||
                        `${item.roadName} ${lguName(item.lguId)} ${item.projectTitle || ''} ${item.id}`
                            .toLowerCase()
                            .includes(term)) &&
                    (lguFilter === 'all' || String(item.lguId) === lguFilter) &&
                    (pavementFilter === 'all' ||
                        item.pavementType === pavementFilter) &&
                    (conditionFilter === 'all' ||
                        item.stateCategory === conditionFilter) &&
                    (projectFilter === 'all' ||
                        (projectFilter === 'linked'
                            ? item.projectId !== null
                            : item.projectId === null)),
            )
            .sort((a, b) =>
                sort === 'name'
                    ? a.roadName.localeCompare(b.roadName)
                    : sort === 'oldest'
                      ? a.id - b.id
                      : b.id - a.id,
            );
    }, [
        all,
        search,
        lguFilter,
        pavementFilter,
        conditionFilter,
        projectFilter,
        sort,
        lguName,
    ]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
    const currentPage = Math.min(page, pageCount);
    const visible = filtered.slice(
        (currentPage - 1) * perPage,
        currentPage * perPage,
    );
    const changeFilter = (setter: (value: string) => void, value: string) => {
        setter(value);
        setPage(1);
    };
    const parsed = useMemo(() => {
        try {
            return JSON.parse(geojsonText);
        } catch {
            return null;
        }
    }, [geojsonText]);
    const draftLines = useMemo(() => getLines(parsed), [parsed]);
    const measured = calculateKm(draftLines);
    const resetDraft = () => {
        setName('');
        setLguId('');
        setPavement('Concrete');
        setCondition('Good');
        setGeojsonText('');
        setKmOverride('');
        setError('');
    };
    const addDraft = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canPreviewDraft) {
            setError('Read-only view: adding drafts is unavailable.');

            return;
        }

        if (!name.trim()) {
            setError('Road name is required.');

            return;
        }

        if (!lguId || !lgus.some((lgu) => String(lgu.id) === lguId)) {
            setError('Select an LGU.');

            return;
        }

        if (!draftLines.length) {
            setError(
                'Provide valid LineString/MultiLineString GeoJSON for a complete road coverage.',
            );

            return;
        }

        const km = kmOverride.trim() ? Number(kmOverride) : measured;

        if (!Number.isFinite(km) || km <= 0 || km > 99999999) {
            setError('Length must be greater than zero.');

            return;
        }

        const id = Math.min(0, ...drafts.map((draft) => draft.id)) - 1;
        const newDraft: RoadCoverageSummary = {
            id,
            roadName: name.trim(),
            lguId: Number(lguId),
            kilometers: Math.round(km * 100) / 100,
            pavementType: pavement,
            stateCategory: condition,
            geojson: parsed,
            createdByEngineerId: null,
            projectId: null,
            projectTitle: null,
            localDraft: true,
        };
        setDrafts((previous) => [newDraft, ...previous]);
        setAddOpen(false);
        resetDraft();
        setPage(1);
        setNotice(
            'Road Coverage added to this browser preview only. It has NOT been saved to Supabase.',
        );
    };

    return (
        <ProjectWorkspace>
            <div className="jr-page-head">
                <div>
                    <h1>Road Sections</h1>
                    <p>
                        Browse complete mapped road coverages and their linked
                        maintenance projects.
                    </p>
                </div>
                {canPreviewDraft && (
                    <button
                        type="button"
                        className="jr-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                        onClick={() => {
                            resetDraft();
                            setAddOpen(true);
                        }}
                    >
                        <Plus className="size-4" /> Add Road Coverage
                    </button>
                )}
            </div>
            <div
                role="status"
                className="mb-5 flex items-start gap-2 rounded-xl border border-[#F0DBC9] bg-[#FFF9F4] px-4 py-3 text-sm text-[#96512D]"
            >
                <Info className="mt-0.5 size-4 shrink-0" />
                <span>
                    {canPreviewDraft ? (
                        <>
                            <strong>Frontend preview.</strong> Existing
                            coverages are read from Supabase, but new drafts
                            stay in this browser only. Map drawing, saves,
                            editing and deletion require approved Laravel
                            policies and EngineerLGU authorization.
                        </>
                    ) : (
                        <>
                            <strong>Read-only RoadCoverage directory.</strong>{' '}
                            You may view complete road coverage regardless of
                            your active LGU assignments. Creating and editing
                            RoadCoverage as an Engineer requires an active
                            EngineerLGU assignment and separately verified
                            server-side workflows; none are offered in this
                            preview.
                        </>
                    )}
                </span>
            </div>
            {schemaNotice && (
                <div
                    role="status"
                    className="mb-5 flex gap-2 rounded-xl border border-[#DFE6EF] bg-[#F7FAFD] px-4 py-3 text-sm text-[#526981]"
                >
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    {schemaNotice}
                </div>
            )}
            {notice && (
                <div
                    role="status"
                    className="mb-5 flex gap-2 rounded-xl border border-[#D4E8DD] bg-[#F0FAF4] px-4 py-3 text-sm text-[#24764F]"
                >
                    <Info className="mt-0.5 size-4 shrink-0" />
                    {notice}
                </div>
            )}
            <section
                aria-label="Road coverage overview"
                className="mb-5 grid gap-3 sm:grid-cols-3"
            >
                <div className="rounded-2xl border border-[#E2E8F1] bg-gradient-to-br from-[#FFFAF4] to-white p-5 shadow-sm">
                    <p className="text-xs font-semibold tracking-wider text-[#98502D] uppercase">
                        Road coverages
                    </p>
                    <p className="mt-2 text-3xl font-bold text-[#20344D]">
                        {all.length}
                    </p>
                    <p className="mt-1 text-xs text-[#8294AA]">
                        {drafts.length
                            ? `${drafts.length} browser-only drafts`
                            : 'Saved coverage inventory'}
                    </p>
                </div>
                <div className="rounded-2xl border border-[#E2E8F1] bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold tracking-wider text-[#7389A3] uppercase">
                        Linked projects
                    </p>
                    <p className="mt-2 text-3xl font-bold text-[#20344D]">
                        {linkedCount}
                    </p>
                    <p className="mt-1 text-xs text-[#8294AA]">
                        Coverages assigned to projects
                    </p>
                </div>
                <div className="rounded-2xl border border-[#E2E8F1] bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold tracking-wider text-[#7389A3] uppercase">
                        Coverage length
                    </p>
                    <p className="mt-2 text-3xl font-bold text-[#20344D]">
                        {kilometersTotal.toFixed(2)}{' '}
                        <span className="text-sm font-medium text-[#7990A8]">
                            km
                        </span>
                    </p>
                    <p className="mt-1 text-xs text-[#8294AA]">
                        {mappedCount} with road-line geometry
                    </p>
                </div>
            </section>
            <section
                aria-label="Filter road coverages"
                className="rounded-2xl border border-[#E4EAF2] bg-[#FAFBFD] p-3 shadow-sm sm:p-4"
            >
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-[#283F59]">
                        Find a road coverage
                    </h2>
                    <button
                        type="button"
                        className="text-xs font-semibold text-[#9C522B] hover:underline"
                        onClick={() => {
                            setSearch('');
                            setLguFilter('all');
                            setPavementFilter('all');
                            setConditionFilter('all');
                            setProjectFilter('all');
                            setSort('newest');
                            setPage(1);
                        }}
                    >
                        Clear filters
                    </button>
                </div>
                <label className="relative mt-3 block">
                    <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-[#8CA0B9]" />
                    <input
                        className={`${input} pl-11`}
                        placeholder="Search roads, municipalities, or linked projects..."
                        aria-label="Search road coverages"
                        value={search}
                        onChange={(e) =>
                            changeFilter(setSearch, e.target.value)
                        }
                    />
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="sr-only" htmlFor="road-lgu-filter">
                        Municipality
                    </label>
                    <select
                        id="road-lgu-filter"
                        className={input}
                        value={lguFilter}
                        onChange={(e) =>
                            changeFilter(setLguFilter, e.target.value)
                        }
                    >
                        <option value="all">All municipalities</option>
                        {lgus.map((lgu) => (
                            <option key={lgu.id} value={lgu.id}>
                                {lgu.name}
                            </option>
                        ))}
                    </select>
                    <label className="sr-only" htmlFor="road-pavement-filter">
                        Pavement
                    </label>
                    <select
                        id="road-pavement-filter"
                        className={input}
                        value={pavementFilter}
                        onChange={(e) =>
                            changeFilter(setPavementFilter, e.target.value)
                        }
                    >
                        <option value="all">All pavement types</option>
                        {PAVEMENTS.map((value) => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                    <label className="sr-only" htmlFor="road-condition-filter">
                        Condition
                    </label>
                    <select
                        id="road-condition-filter"
                        className={input}
                        value={conditionFilter}
                        onChange={(e) =>
                            changeFilter(setConditionFilter, e.target.value)
                        }
                    >
                        <option value="all">All conditions</option>
                        {CONDITIONS.map((value) => (
                            <option key={value}>{value}</option>
                        ))}
                    </select>
                    <label className="sr-only" htmlFor="road-linked-filter">
                        Project assignment
                    </label>
                    <select
                        id="road-linked-filter"
                        className={input}
                        value={projectFilter}
                        onChange={(e) =>
                            changeFilter(setProjectFilter, e.target.value)
                        }
                    >
                        <option value="all">All project links</option>
                        <option value="linked">Linked to project</option>
                        <option value="unlinked">Available / unlinked</option>
                    </select>
                    <label className="sr-only" htmlFor="road-sort">
                        Sort coverages
                    </label>
                    <select
                        id="road-sort"
                        className={input}
                        value={sort}
                        onChange={(e) => {
                            setSort(e.target.value as typeof sort);
                            setPage(1);
                        }}
                    >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="name">Road name A–Z</option>
                    </select>
                </div>
            </section>
            <div className="jr-table-toolbar mt-7">
                <span role="status">
                    {filtered.length} road{' '}
                    {filtered.length === 1 ? 'coverage' : 'coverages'} found
                </span>
                <span className="text-xs text-[#7E91A9]">
                    Whole road coverage · Not fragmented road sections
                </span>
            </div>
            <div className="jr-table-wrap overflow-x-auto">
                <table className="jr-table min-w-[920px]">
                    <thead>
                        <tr>
                            <th>Road Coverage</th>
                            <th>Municipality</th>
                            <th>Length</th>
                            <th>Pavement</th>
                            <th>Condition</th>
                            <th>Project</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <button
                                        type="button"
                                        className="text-left"
                                        onClick={() => setSelected(item)}
                                    >
                                        <strong className="jr-project-title block">
                                            {item.roadName}
                                        </strong>
                                        <span className="jr-project-id">
                                            {item.localDraft
                                                ? 'Browser-only draft'
                                                : `Coverage ID: ${item.id}`}
                                        </span>
                                    </button>
                                </td>
                                <td>{lguName(item.lguId)}</td>
                                <td>{item.kilometers.toFixed(2)} km</td>
                                <td>{item.pavementType}</td>
                                <td>
                                    <Pill
                                        tone={
                                            item.stateCategory === 'Good'
                                                ? 'good'
                                                : item.stateCategory === 'Fair'
                                                  ? 'fair'
                                                  : item.stateCategory === 'Bad'
                                                    ? 'bad'
                                                    : 'neutral'
                                        }
                                    >
                                        {item.stateCategory}
                                    </Pill>
                                </td>
                                <td>
                                    {item.projectId === null ? (
                                        <Pill>Not linked</Pill>
                                    ) : (
                                        <span
                                            className="text-xs font-medium text-[#637C9A]"
                                            title={item.projectTitle || ''}
                                        >
                                            <Link2 className="mr-1 inline size-3.5" />
                                            {item.projectTitle ||
                                                `Project #${item.projectId}`}
                                        </span>
                                    )}
                                </td>
                                <td className="text-right">
                                    <button
                                        type="button"
                                        className={`${button} px-2.5 py-2`}
                                        title={`View ${item.roadName}`}
                                        aria-label={`View coverage ${item.roadName}`}
                                        onClick={() => setSelected(item)}
                                    >
                                        <MoreHorizontal className="size-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {visible.length === 0 && (
                    <div className="jr-empty">
                        <strong>
                            {all.length
                                ? 'No matching road coverages.'
                                : 'No road coverages yet.'}
                        </strong>
                        <p>
                            {all.length
                                ? 'Try changing your search or filters.'
                                : canPreviewDraft
                                  ? 'Existing RoadCoverages from Supabase will appear here. You can also create a browser-only draft for review.'
                                  : 'Existing RoadCoverages from Supabase will appear here when available.'}
                        </p>
                        {all.length > 0 && (
                            <button
                                className={button}
                                type="button"
                                onClick={() => {
                                    setSearch('');
                                    setLguFilter('all');
                                    setPavementFilter('all');
                                    setConditionFilter('all');
                                    setProjectFilter('all');
                                    setPage(1);
                                }}
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}
            </div>
            <footer className="jr-table-footer">
                <span>
                    {filtered.length
                        ? `Showing ${(currentPage - 1) * perPage + 1}–${Math.min(currentPage * perPage, filtered.length)} of ${filtered.length} coverages`
                        : '0 coverages'}
                    {drafts.length
                        ? ` · ${drafts.length} local draft${drafts.length === 1 ? '' : 's'}`
                        : ''}
                </span>
                <nav
                    aria-label="Road Coverage pagination"
                    className="flex gap-1"
                >
                    <button
                        type="button"
                        className={`${button} px-2.5`}
                        disabled={currentPage === 1}
                        onClick={() => setPage(currentPage - 1)}
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <span className="flex min-w-9 items-center justify-center rounded-lg bg-[#FFF0E2] text-sm text-[#9A4E28]">
                        {currentPage}
                    </span>
                    <button
                        type="button"
                        className={`${button} px-2.5`}
                        disabled={currentPage === pageCount}
                        onClick={() => setPage(currentPage + 1)}
                        aria-label="Next page"
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </nav>
            </footer>
            {selected && (
                <Modal
                    titleId="road-detail-title"
                    onClose={() => setSelected(null)}
                >
                    <div className="flex items-start justify-between gap-4 border-b border-[#E5EBF2] px-6 py-5">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-[#8497AF] uppercase">
                                {selected.localDraft
                                    ? 'Preview draft'
                                    : `Road Coverage #${selected.id}`}
                            </p>
                            <h2
                                id="road-detail-title"
                                className="mt-1 text-xl font-semibold text-[#1B2D43]"
                            >
                                {selected.roadName}
                            </h2>
                        </div>
                        <button
                            className={button}
                            onClick={() => setSelected(null)}
                            aria-label="Close details"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                    <div className="space-y-5 px-6 py-5">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <p className="text-xs text-[#8195AC]">
                                    Municipality
                                </p>
                                <p className="mt-1 font-medium text-[#263C55]">
                                    {lguName(selected.lguId)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-[#8195AC]">
                                    Road length
                                </p>
                                <p className="mt-1 font-medium text-[#263C55]">
                                    {selected.kilometers.toFixed(2)} km
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-[#8195AC]">
                                    Pavement / Condition
                                </p>
                                <p className="mt-1 font-medium text-[#263C55]">
                                    {selected.pavementType} ·{' '}
                                    {selected.stateCategory}
                                </p>
                            </div>
                        </div>
                        <GeometryPreview geojson={selected.geojson} />
                        <div className="rounded-xl bg-[#F7F9FC] p-4 text-sm text-[#526882]">
                            <p className="font-medium text-[#20354E]">
                                Maintenance Project
                            </p>
                            <p className="mt-1">
                                {selected.projectTitle ||
                                    (selected.projectId === null
                                        ? 'No Maintenance Project is linked to this Road Coverage.'
                                        : `Project #${selected.projectId}`)}
                            </p>
                            <p className="mt-3 text-xs">
                                {selected.localDraft
                                    ? 'Browser-only draft. Not saved or assigned to an Engineer.'
                                    : `Attributed to Engineer #${selected.createdByEngineerId ?? 'unknown'} in the database.`}{' '}
                                Linked coverages cannot be deleted without
                                resolving the project first.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end border-t border-[#E5EBF2] px-6 py-4">
                        <button
                            type="button"
                            className={button}
                            onClick={() => setSelected(null)}
                        >
                            Close
                        </button>
                    </div>
                </Modal>
            )}
            {canPreviewDraft && addOpen && (
                <Modal
                    titleId="add-road-title"
                    onClose={() => {
                        setAddOpen(false);
                        resetDraft();
                    }}
                >
                    <form onSubmit={addDraft}>
                        <div className="flex items-start justify-between gap-4 border-b border-[#E5EBF2] px-6 py-5">
                            <div>
                                <p className="text-xs font-semibold tracking-wide text-[#9D592C] uppercase">
                                    Browser-only prototype
                                </p>
                                <h2
                                    id="add-road-title"
                                    className="mt-1 text-xl font-semibold text-[#1B2D43]"
                                >
                                    Add Road Coverage
                                </h2>
                                <p className="mt-1 text-sm text-[#7186A0]">
                                    Draft one complete road coverage; no
                                    database changes.
                                </p>
                            </div>
                            <button
                                type="button"
                                className={button}
                                aria-label="Close form"
                                onClick={() => {
                                    setAddOpen(false);
                                    resetDraft();
                                }}
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        <div className="space-y-4 px-6 py-5">
                            <div>
                                <label
                                    htmlFor="road-name"
                                    className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                >
                                    Road name *
                                </label>
                                <input
                                    id="road-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    maxLength={255}
                                    className={input}
                                    placeholder="e.g. Panabo-Compostela-Davao"
                                    required
                                />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="road-lgu"
                                        className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                    >
                                        Municipality (LGU) *
                                    </label>
                                    <select
                                        id="road-lgu"
                                        value={lguId}
                                        onChange={(e) =>
                                            setLguId(e.target.value)
                                        }
                                        className={input}
                                        required
                                    >
                                        <option value="">Select an LGU</option>
                                        {lgus.map((lgu) => (
                                            <option key={lgu.id} value={lgu.id}>
                                                {lgu.name} · #{lgu.id}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label
                                        htmlFor="road-pavement"
                                        className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                    >
                                        Pavement type
                                    </label>
                                    <select
                                        id="road-pavement"
                                        value={pavement}
                                        onChange={(e) =>
                                            setPavement(
                                                e.target.value as Pavement,
                                            )
                                        }
                                        className={input}
                                    >
                                        {PAVEMENTS.map((value) => (
                                            <option key={value}>{value}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="road-condition"
                                        className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                    >
                                        Road condition
                                    </label>
                                    <select
                                        id="road-condition"
                                        value={condition}
                                        onChange={(e) =>
                                            setCondition(
                                                e.target.value as Condition,
                                            )
                                        }
                                        className={input}
                                    >
                                        {CONDITIONS.map((value) => (
                                            <option key={value}>{value}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label
                                        htmlFor="road-km"
                                        className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                    >
                                        Length (km)
                                    </label>
                                    <input
                                        id="road-km"
                                        type="number"
                                        min="0.01"
                                        max="99999999"
                                        step="0.01"
                                        value={kmOverride}
                                        onChange={(e) =>
                                            setKmOverride(e.target.value)
                                        }
                                        className={input}
                                        placeholder={
                                            draftLines.length
                                                ? `Calculated: ${measured.toFixed(2)}`
                                                : 'Calculated from geometry'
                                        }
                                    />
                                </div>
                            </div>
                            <div>
                                <label
                                    htmlFor="road-geojson"
                                    className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                >
                                    Complete road GeoJSON *
                                </label>
                                <textarea
                                    id="road-geojson"
                                    className={`${input} min-h-28 font-mono text-xs`}
                                    spellCheck={false}
                                    value={geojsonText}
                                    onChange={(e) =>
                                        setGeojsonText(e.target.value)
                                    }
                                    placeholder={
                                        '{"type":"LineString","coordinates":[[125.9,7.5],[125.91,7.52]]}'
                                    }
                                    required
                                />
                                <p className="mt-1.5 text-xs leading-relaxed text-[#8597AD]">
                                    Paste an actual GeoJSON LineString,
                                    MultiLineString, or FeatureCollection
                                    containing road lines. The example
                                    coordinates are only illustrative.
                                    Interactive road drawing is not yet
                                    available in this preview. This field
                                    accepts an existing road-line geometry only;
                                    nothing is saved to Supabase.
                                </p>
                            </div>
                            <div className="rounded-xl border border-[#E2E8EF] p-2">
                                <GeometryPreview geojson={parsed} />
                            </div>
                            <p className="text-xs text-[#7186A0]">
                                {draftLines.length
                                    ? `Approximate geodesic length: ${measured.toFixed(2)} km. You may override the length manually.`
                                    : 'A valid full road-line geometry is required before previewing a draft.'}
                            </p>
                            {error && (
                                <p
                                    role="alert"
                                    className="rounded-lg bg-[#FDF0EE] px-3 py-2 text-sm text-[#B74646]"
                                >
                                    {error}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 border-t border-[#E5EBF2] px-6 py-4">
                            <button
                                className={button}
                                type="button"
                                onClick={() => {
                                    setAddOpen(false);
                                    resetDraft();
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="jr-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                            >
                                <Plus className="size-4" /> Add Preview Draft
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </ProjectWorkspace>
    );
}

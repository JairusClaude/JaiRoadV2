import { requestOperation } from "@/pages/dd-phase3/requests";
import { RoadCoverageMap } from "@/components/maintenance-projects/road-coverage-map";
import RoadTraceMap from "@/pages/dd-phase3/RoadTraceMap";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Map,
  ChevronLeft,
  ChevronRight,
  Info,
  Link2,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { ProjectWorkspace } from "@/components/maintenance-projects/project-workspace";
/** UI name: Road Sections; actual entity: a *whole* RoadCoverage. */
type Pavement = "Concrete" | "Asphalt" | "Gravel" | "Earth";
type Condition = "Good" | "Fair" | "Bad";
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
export type DdRoadSectionsProps = {
  initialCoverages?: RoadCoverageSummary[];
  lgus?: {
    id: number;
    name: string;
  }[];
  schemaNotice?: string | null;
  // Manager-only options are limited to active EngineerLGU relationships.
  roadCreatorChoices?: { id: number; lgu_id: number; first_name: string; last_name: string }[];
  canCreate: boolean;
  canEdit: boolean;
  canManage: boolean;
};
type Point = [number, number];
type Line = Point[];
const PAVEMENTS: Pavement[] = ["Concrete", "Asphalt", "Gravel", "Earth"];
const CONDITIONS: Condition[] = ["Good", "Fair", "Bad"];
const button =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm font-medium text-[#405572] transition hover:bg-[#F8FAFD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#994C29] disabled:cursor-not-allowed disabled:opacity-50";
const input =
  "min-h-10 w-full rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm text-[#20324A] outline-none placeholder:text-[#91A2BA] focus:border-[#98512D] focus:ring-2 focus:ring-[#F6E6DA]";
const perPage = 8;
function getPoint(value: unknown): Point | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const lon = Number(value[0]);
  const lat = Number(value[1]);
  if (
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    return null;
  return [lon, lat];
}
function getLines(value: unknown): Line[] {
  let data: unknown = value;
  if (typeof value === "string") {
    try {
      data = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!data || typeof data !== "object") return [];
  const geo = data as Record<string, unknown>;
  if (geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
    return geo.features.flatMap(getLines);
  }
  if (geo.type === "GeometryCollection" && Array.isArray(geo.geometries)) {
    return geo.geometries.flatMap(getLines);
  }
  if (geo.type === "Feature") return getLines(geo.geometry);
  if (geo.type === "LineString" && Array.isArray(geo.coordinates)) {
    const points = geo.coordinates.map(getPoint);
    return points.length >= 2 && points.every(Boolean)
      ? [points as Point[]]
      : [];
  }
  if (geo.type === "MultiLineString" && Array.isArray(geo.coordinates)) {
    return geo.coordinates.flatMap((coords) =>
      getLines({ type: "LineString", coordinates: coords }),
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
      line.slice(1).reduce((km, point, i) => km + haversine(line[i], point), 0),
    0,
  );
}
function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "good" | "fair" | "bad" | "warm" | "neutral";
}) {
  const color = {
    good: "bg-[#E8F6ED] text-[#188155]",
    fair: "bg-[#FFF2DF] text-[#9A6621]",
    bad: "bg-[#FDECEC] text-[#B94F4F]",
    warm: "bg-[#FFF0E5] text-[#9B4C24]",
    neutral: "bg-[#F0F3F8] text-[#61748E]",
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
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        {children}
      </section>
    </div>
  );
}
export default function DdRoadSections({
  initialCoverages = [],
  lgus = [],
  schemaNotice = null,
  roadCreatorChoices = [],
  canCreate,
  canEdit,
  canManage,
}: DdRoadSectionsProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [lguFilter, setLguFilter] = useState("all");
  const [pavementFilter, setPavementFilter] = useState("all");
  const [conditionFilter, setConditionFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");
  const [page, setPage] = useState(1);
  const [showRoadMap, setShowRoadMap] = useState(true);
  const [selected, setSelected] = useState<RoadCoverageSummary | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [lguId, setLguId] = useState("");
  const [createdByEngineerId, setCreatedByEngineerId] = useState("");
  const isManagerCreatorFlow = roadCreatorChoices.length > 0;
  const creatorsForLgu = roadCreatorChoices.filter((entry) => String(entry.lgu_id) === lguId);
  const [pavement, setPavement] = useState<Pavement>("Concrete");
  const [condition, setCondition] = useState<Condition>("Good");
  const [geojsonText, setGeojsonText] = useState("");
  // A first map click is a single point and therefore not yet valid LineString.
  // Keep tracing points independent from validated imported geometry.
  const [manualPoints, setManualPoints] = useState<Point[] | null>(null);
  const [kmOverride, setKmOverride] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const all = initialCoverages;
  const linkedCount = all.filter((item) => item.projectId !== null).length;
  const mappedCount = all.filter(
    (item) => getLines(item.geojson).length > 0,
  ).length;
  const kilometersTotal = all.reduce(
    (total, item) =>
      total + (Number.isFinite(item.kilometers) ? item.kilometers : 0),
    0,
  );
  const lguName = (id: number) =>
    lgus.find((item) => item.id === id)?.name || `LGU #${id}`;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter(
        (item) =>
          (!term ||
            `${item.roadName} ${lguName(item.lguId)} ${item.projectTitle || ""} ${item.id}`
              .toLowerCase()
              .includes(term)) &&
          (lguFilter === "all" || String(item.lguId) === lguFilter) &&
          (pavementFilter === "all" || item.pavementType === pavementFilter) &&
          (conditionFilter === "all" ||
            item.stateCategory === conditionFilter) &&
          (projectFilter === "all" ||
            (projectFilter === "linked"
              ? item.projectId !== null
              : item.projectId === null)),
      )
      .sort((a, b) =>
        sort === "name"
          ? a.roadName.localeCompare(b.roadName)
          : sort === "oldest"
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
    lgus,
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
  const tracedPoints = manualPoints ?? (draftLines[0] ?? []);
  const measured = calculateKm(draftLines);
  const editTrace = (points: Point[]) => {
    // The single road keeps a single GeoJSON LineString. Three or more vertices
    // are waypoints along the same road, not separate RoadCoverage entities.
    setManualPoints(points);
    setGeojsonText(JSON.stringify({ type: "LineString", coordinates: points }));
    setKmOverride("");
    setError("");
  };
  const resetDraft = () => {
    setName("");
    setLguId("");
    setCreatedByEngineerId("");
    setPavement("Concrete");
    setCondition("Good");
    setGeojsonText("");
    setManualPoints(null);
    setKmOverride("");
    setError("");
  };
  const addDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !(editingId === null ? canCreate : canEdit)) return;
    if (!name.trim()) {
      setError("Road name is required.");
      return;
    }
    if (!lguId || !lgus.some((lgu) => String(lgu.id) === lguId)) {
      setError("Select an LGU.");
      return;
    }
    if (editingId === null && roadCreatorChoices.length > 0 && !creatorsForLgu.some((entry) => String(entry.id) === createdByEngineerId)) {
      setError("Choose the active Engineer who prepared this coverage for the selected LGU.");
      return;
    }
    if (!draftLines.length) {
      setError(
        "Provide valid LineString/MultiLineString GeoJSON for a complete road coverage.",
      );
      return;
    }
    const km = kmOverride.trim() ? Number(kmOverride) : measured;
    if (!Number.isFinite(km) || km <= 0 || km > 99999999) {
      setError("Length must be greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await requestOperation(
        `/dd-phase3/ops/roads${editingId === null ? "" : `/${editingId}`}`,
        {
          road_name: name.trim(),
          lgu_id: lguId,
          kilometers: String(km),
          pavement_type: pavement,
          state_category: condition,
          geojson: geojsonText,
          ...(editingId === null && roadCreatorChoices.length > 0
            ? { created_by_engineer_id: createdByEngineerId }
            : {}),
        },
        editingId === null ? "post" : "put",
      );
      setAddOpen(false);
      resetDraft();
      setEditingId(null);
      setPage(1);
      setNotice("Road coverage saved.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to save road coverage.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <ProjectWorkspace>
      <div className="jr-page-head">
        <div>
          <h1>Road Sections</h1>
          <p>
            Browse complete mapped road coverages and their linked maintenance
            projects.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="jr-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            onClick={() => {
              resetDraft();
              setEditingId(null);
              setAddOpen(true);
            }}
          >
            <Plus className="size-4" /> Add Road Coverage
          </button>
        )}
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
          <p className="text-xs font-semibold uppercase tracking-wider text-[#98502D]">
            Road coverages
          </p>
          <p className="mt-2 text-3xl font-bold text-[#20344D]">{all.length}</p>
          <p className="mt-1 text-xs text-[#8294AA]">
            Saved coverage inventory
          </p>
        </div>
        <div className="rounded-2xl border border-[#E2E8F1] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7389A3]">
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
          <p className="text-xs font-semibold uppercase tracking-wider text-[#7389A3]">
            Coverage length
          </p>
          <p className="mt-2 text-3xl font-bold text-[#20344D]">
            {kilometersTotal.toFixed(2)}{" "}
            <span className="text-sm font-medium text-[#7990A8]">km</span>
          </p>
          <p className="mt-1 text-xs text-[#8294AA]">
            {mappedCount} with road-line geometry
          </p>
        </div>
      </section>
      {mappedCount > 0 && (
        <section className="mb-5 rounded-2xl border border-[#e2e8f1] bg-white p-4 shadow-sm" aria-label="Saved road coverages on map">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-bold text-[#263e59]">Saved road coverage map</h2>
              <p className="text-xs text-[#7488a3]">View all road lines loaded into this directory. New lines are also overlaid in Add Road Coverage.</p>
            </div>
            <button type="button" className={button} aria-expanded={showRoadMap} onClick={() => setShowRoadMap((current) => !current)}>
              {showRoadMap ? "Hide map" : "Show map"}
            </button>
          </div>
          {showRoadMap && (
            <RoadCoverageMap
              coverages={all.map((road) => ({
                id: road.id,
                road_name: road.roadName,
                municipality: lguName(road.lguId),
                kilometers: String(road.kilometers),
                geojson: road.geojson,
                assigned: road.projectId !== null,
              }))}
              selectedId={null}
              selectionDisabled
              onSelectCoverage={() => {}}
            />
          )}
        </section>
      )}
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
              setSearch("");
              setLguFilter("all");
              setPavementFilter("all");
              setConditionFilter("all");
              setProjectFilter("all");
              setSort("newest");
              setPage(1);
            }}
          >
            Clear filters
          </button>
        </div>
        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#8CA0B9]" />
          <input
            className={`${input} pl-11`}
            placeholder="Search roads, municipalities, or linked projects..."
            aria-label="Search road coverages"
            value={search}
            onChange={(e) => changeFilter(setSearch, e.target.value)}
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
            onChange={(e) => changeFilter(setLguFilter, e.target.value)}
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
            onChange={(e) => changeFilter(setPavementFilter, e.target.value)}
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
            onChange={(e) => changeFilter(setConditionFilter, e.target.value)}
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
            onChange={(e) => changeFilter(setProjectFilter, e.target.value)}
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
          {filtered.length} road{" "}
          {filtered.length === 1 ? "coverage" : "coverages"} found
        </span>
        <span className="text-xs text-[#7E91A9]">Mapped road inventory</span>
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
                      {`Coverage ID: ${item.id}`}
                    </span>
                  </button>
                </td>
                <td>{lguName(item.lguId)}</td>
                <td>{item.kilometers.toFixed(2)} km</td>
                <td>{item.pavementType}</td>
                <td>
                  <Pill
                    tone={
                      item.stateCategory === "Good"
                        ? "good"
                        : item.stateCategory === "Fair"
                          ? "fair"
                          : item.stateCategory === "Bad"
                            ? "bad"
                            : "neutral"
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
                      title={item.projectTitle || ""}
                    >
                      <Link2 className="mr-1 inline size-3.5" />
                      {item.projectTitle || `Project #${item.projectId}`}
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
                                  {visible.length === 0 && (
              <tr className="jr-dd-empty-row">
                <td colSpan={7}>
                  <div className="jr-dd-empty-content" role="status">
                    <span className="jr-dd-empty-icon" aria-hidden="true"><Map className="h-6 w-6" /></span>
                    <strong>{all.length ? "No matching road coverages" : "No road coverages yet"}</strong>
                    <p>{all.length ? "Try another filter or keyword." : "Create an LGU and map a road coverage to populate this table."}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="jr-table-footer">
        <span>
          {filtered.length
            ? `Showing ${(currentPage - 1) * perPage + 1}–${Math.min(currentPage * perPage, filtered.length)} of ${filtered.length} coverages`
            : "0 coverages"}
        </span>
        <nav aria-label="Road Coverage pagination" className="flex gap-1">
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
        <Modal titleId="road-detail-title" onClose={() => setSelected(null)}>
          <div className="flex items-start justify-between gap-4 border-b border-[#E5EBF2] px-6 py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#8497AF]">
                {`Road Coverage #${selected.id}`}
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
                <p className="text-xs text-[#8195AC]">Municipality</p>
                <p className="mt-1 font-medium text-[#263C55]">
                  {lguName(selected.lguId)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8195AC]">Road length</p>
                <p className="mt-1 font-medium text-[#263C55]">
                  {selected.kilometers.toFixed(2)} km
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8195AC]">Pavement / Condition</p>
                <p className="mt-1 font-medium text-[#263C55]">
                  {selected.pavementType} · {selected.stateCategory}
                </p>
              </div>
            </div>
            <RoadCoverageMap
              coverages={[
                {
                  id: selected.id,
                  road_name: selected.roadName,
                  municipality: lguName(selected.lguId),
                  kilometers: String(selected.kilometers),
                  geojson: selected.geojson,
                  assigned: selected.projectId !== null,
                },
              ]}
              selectedId={selected.id}
              onSelectCoverage={() => {}}
              selectionDisabled
            />
            <div className="rounded-xl bg-[#F7F9FC] p-4 text-sm text-[#526882]">
              <p className="font-medium text-[#20354E]">Maintenance Project</p>
              <p className="mt-1">
                {selected.projectTitle ||
                  (selected.projectId === null
                    ? "No Maintenance Project is linked to this Road Coverage."
                    : `Project #${selected.projectId}`)}
              </p>
              <p className="mt-3 text-xs">
                {`Responsible Engineer #${selected.createdByEngineerId ?? "unknown"}.`}{" "}
                Linked coverages cannot be deleted without resolving the project
                first.
              </p>
            </div>
          </div>
          <div className="flex justify-end border-t border-[#E5EBF2] px-6 py-4">
            {canEdit && (
              <button
                type="button"
                className={`${button} mr-2`}
                onClick={() => {
                  setEditingId(selected.id);
                  setName(selected.roadName);
                  setLguId(String(selected.lguId));
                  setPavement(selected.pavementType as Pavement);
                  setCondition(selected.stateCategory as Condition);
                  setManualPoints(null);
                  setGeojsonText(
                    typeof selected.geojson === "string"
                      ? selected.geojson
                      : JSON.stringify(selected.geojson),
                  );
                  setKmOverride(String(selected.kilometers));
                  setError("");
                  setSelected(null);
                  setAddOpen(true);
                }}
              >
                Edit coverage
              </button>
            )}
            {canManage && (
              <button
                type="button"
                className={`${button} mr-2 text-red-700`}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Delete ${selected.roadName}? Linked projects will prevent deletion.`,
                    )
                  )
                    return;
                  try {
                    await requestOperation(
                      `/dd-phase3/ops/roads/${selected.id}`,
                      {},
                      "delete",
                    );
                    setSelected(null);
                  } catch (failure) {
                    setNotice(
                      failure instanceof Error
                        ? failure.message
                        : "Unable to delete coverage.",
                    );
                  }
                }}
              >
                Delete
              </button>
            )}
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
      {(canCreate || canEdit) && addOpen && (
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
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9D592C]">
                  Road coverage
                </p>
                <h2
                  id="add-road-title"
                  className="mt-1 text-xl font-semibold text-[#1B2D43]"
                >
                  {editingId === null
                    ? "Add Road Coverage"
                    : "Edit Road Coverage"}
                </h2>
                <p className="mt-1 text-sm text-[#7186A0]">
                  Select your road path on the interactive map, or import its GeoJSON.
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
              {editingId === null && schemaNotice && roadCreatorChoices.length === 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Admins can create RoadCoverages without a personal Engineer link, but must select an active, LGU-assigned mapping Engineer. Create the EngineerLGU assignment first.
                </p>
              )}
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
                    onChange={(e) => {
                      setLguId(e.target.value);
                      setCreatedByEngineerId("");
                    }}
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
                {editingId === null && isManagerCreatorFlow && (
                  <div>
                    <label
                      htmlFor="road-created-by-engineer"
                      className="mb-1.5 block text-sm font-medium text-[#263B53]"
                    >
                      Mapping Engineer (CreatedBy) *
                    </label>
                    <select
                      id="road-created-by-engineer"
                      className={input}
                      value={createdByEngineerId}
                      onChange={(e) => setCreatedByEngineerId(e.target.value)}
                      required
                    >
                      <option value="">Select the actual mapping Engineer</option>
                      {creatorsForLgu.map((engineer) => (
                        <option key={`${engineer.id}-${engineer.lgu_id}`} value={engineer.id}>
                          {engineer.first_name} {engineer.last_name} · #{engineer.id}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#7186A0]">
                      Select the active Engineer who actually prepared the mapped coverage for this LGU.
                      JaiROADS records you as the Admin/SuperAdmin actor in AuditLog.
                      {!creatorsForLgu.length && lguId
                        ? " No active Engineer is assigned to this LGU; add an active EngineerLGU assignment first."
                        : ""}
                    </p>
                  </div>
                )}
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
                    onChange={(e) => setPavement(e.target.value as Pavement)}
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
                    onChange={(e) => setCondition(e.target.value as Condition)}
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
                    onChange={(e) => setKmOverride(e.target.value)}
                    className={input}
                    placeholder={
                      draftLines.length
                        ? `Calculated: ${measured.toFixed(2)}`
                        : "Calculated from geometry"
                    }
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="road-geojson"
                  className="mb-1.5 block text-sm font-medium text-[#263B53]"
                >
                  Road geometry *
                </label>
                <input
                  type="file"
                  accept=".geojson,.json,application/geo+json,application/json"
                  aria-label="Import road geometry"
                  className={`${input} mb-3`}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setError("Choose a geometry file smaller than 5 MB.");
                      return;
                    }
                    try {
                      const text = await file.text();
                      JSON.parse(text);
                      setManualPoints(null);
                      setGeojsonText(text);
                      setError("");
                    } catch {
                      setError("This file does not contain valid GeoJSON.");
                    }
                  }}
                />
                <textarea
                  id="road-geojson"
                  className={`${input} min-h-28 font-mono text-xs`}
                  spellCheck={false}
                  value={geojsonText}
                  onChange={(e) => { setManualPoints(null); setGeojsonText(e.target.value); }}
                  placeholder={
                    '{"type":"LineString","coordinates":[[125.9,7.5],[125.91,7.52]]}'
                  }
                  required
                />
                <p className="mt-1.5 text-xs leading-relaxed text-[#8597AD]">
                  Trace a route by clicking the live map, or paste/import a complete
                  GeoJSON LineString. Add at least three points for a start,
                  intermediate location and destination; additional turns are allowed.
                  Points are part of one RoadCoverage, not separate records.
                </p>
              </div>
              {draftLines.length > 1 && (
                <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  Imported MultiLineString has {draftLines.length} segments. All segments are shown. Clicking to trace will replace the import with one continuous LineString.
                </p>
              )}
              <RoadTraceMap
                roads={all.filter((coverage) => coverage.id !== editingId).map((coverage) => ({
                  id: coverage.id,
                  name: coverage.roadName,
                  geometry: coverage.geojson,
                }))}
                draftPoints={tracedPoints}
                draftLines={draftLines}
                selectedLguName={lgus.find((lgu) => String(lgu.id) === lguId)?.name ?? null}
                onAppendPoint={(point) => editTrace([...tracedPoints, point])}
                onReplacePoint={(index, point) => editTrace(tracedPoints.map((item, i) => i === index ? point : item))}
                onInsertPoint={(index, point) => editTrace([...tracedPoints.slice(0, index), point, ...tracedPoints.slice(index)])}
                onRemovePoint={(index) => editTrace(tracedPoints.filter((_, i) => i !== index))}
                onUndo={() => editTrace(tracedPoints.slice(0, -1))}
                onClear={() => editTrace([])}
              />
              <p className="text-xs text-[#7186A0]">
                {draftLines.length
                  ? `Approximate geodesic length: ${measured.toFixed(2)} km. You may override the length manually.`
                  : "Import a mapped road line to calculate its length."}
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
                disabled={saving}
                className="jr-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus className="size-4" />{" "}
                {saving ? "Saving…" : "Save Road Coverage"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </ProjectWorkspace>
  );
}

import L from 'leaflet';
import {
    Maximize2,
    Minimize2,
    PanelRightClose,
    PanelRightOpen,
    Layers,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    distanceKm,
    lineCoordinates,
    mappingData,
    routeFeature,
    samePoint,
} from '@/lib/road-coverages/geometry.mjs';
import type { Point } from '@/lib/road-coverages/geometry.mjs';
import type { RoadCoverage } from '@/types/road-coverages';
import 'leaflet/dist/leaflet.css';

type Leg = { line: Point[]; manual: boolean; status: string; message?: string };
type Draft = {
    points: Point[];
    legs: Leg[];
    legacy: Point[] | null;
    original: object | null;
    changed: boolean;
};
type Operation = {
    kind: 'trace' | 'edit' | 'alternatives';
    leg: number;
    line: Point[];
    choices: Point[][];
    vertex: number | null;
    insert: boolean;
    undo: Point[][];
};
const ll = (p: Point): L.LatLngTuple => [p[1], p[0]];
const point = (p: L.LatLng): Point => [
    p.wrap().lng,
    Math.max(-85.05112878, Math.min(85.05112878, p.lat)),
];
// OSRM GeoJSON ~6 decimals: two independently rounded points differ by <=0.158m.
// This 0.16m tolerance reconciles numerical rounding only; never road-network snapping.
const connects = (line: Point[], a: Point, b: Point) =>
    line.length > 1 &&
    distanceKm([a, line[0]]) * 1000 <= 0.16 &&
    distanceKm([b, line[line.length - 1]]) * 1000 <= 0.16;
const automatic = (line: Point[], a: Point, b: Point): Leg =>
    connects(line, a, b)
        ? { line: [a, ...line.slice(1, -1), b], manual: false, status: 'Ready' }
        : {
              line,
              manual: false,
              status: 'Needs correction',
              message:
                  'Route endpoints differ from the selected locations. Move a marker or edit the path. Your markers have not moved.',
          };
const nearest = (line: Point[], p: Point) => {
    let best = { index: 0, p: line[0], distance: Infinity };
    line.slice(1).forEach((b, i) => {
        const a = line[i],
            cos = Math.cos((p[1] * Math.PI) / 180),
            dx = (b[0] - a[0]) * cos,
            dy = b[1] - a[1];
        const t = Math.max(
            0,
            Math.min(
                1,
                ((p[0] - a[0]) * cos * dx + (p[1] - a[1]) * dy) /
                    (dx * dx + dy * dy || 1),
            ),
        );
        const q: Point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
        const d = distanceKm([q, p]);

        if (d < best.distance) {
            best = { index: i, p: q, distance: d };
        }
    });

    return best;
};
let serviceQueue = Promise.resolve();
let lastRequest = 0;
async function json(url: string, signal: AbortSignal) {
    const task = serviceQueue
        .catch(() => {})
        .then(async () => {
            await new Promise((r) =>
                setTimeout(r, Math.max(0, 1100 - (Date.now() - lastRequest))),
            );
            signal.throwIfAborted();
            lastRequest = Date.now();
            const r = await fetch(url, {
                signal: AbortSignal.any([signal, AbortSignal.timeout(18000)]),
            });

            if (!r.ok) {
                throw new Error(
                    'Map service unavailable. Retry or trace the road manually.',
                );
            }

            return r.json();
        });
    serviceQueue = task.then(
        () => {},
        () => {},
    );

    return task;
}
export function CoverageMapEditor({
    initial,
    referenceCoverages,
    disabled,
    onChange,
    information,
    lengthFields,
    municipality,
    municipalities,
    editing,
    onPending,
    onWorkingDirty,
    services,
}: {
    initial: object | null;
    referenceCoverages: RoadCoverage[];
    disabled: boolean;
    onChange: (value: object | null) => void;
    information?: ReactNode;
    lengthFields?: ReactNode;
    municipality?: string;
    municipalities?: { id: number; municipality_name: string }[];
    editing?: boolean;
    onPending?: (pending: boolean) => void;
    onWorkingDirty?: (dirty: boolean) => void;
    services?: { routing: string; geocoding: string };
}) {
    const [draft, setDraft] = useState<Draft>(() => {
        const data = mappingData(initial);

        return {
            points: data?.points ?? [],
            legs: [0, 1].map((i) => ({
                line: data?.legs[i] ?? [],
                manual:
                    (
                        initial as {
                            properties?: {
                                jairoads_editor?: { manual?: boolean[] };
                            };
                        } | null
                    )?.properties?.jairoads_editor?.manual?.[i] ?? true,
                status: data ? 'Ready' : 'Awaiting locations',
            })),
            legacy: data ? null : lineCoordinates(initial),
            original: initial,
            changed: false,
        };
    });
    const current = useRef(draft),
        root = useRef<HTMLDivElement>(null),
        node = useRef<HTMLDivElement>(null),
        map = useRef<L.Map | null>(null),
        active = useRef<L.LayerGroup | null>(null),
        references = useRef<L.LayerGroup | null>(null);
    const [tilesReady, setTilesReady] = useState(false);
    const [placing, setPlacing] = useState(!editing),
        [infoOpen, setInfoOpen] = useState(true),
        [hidden, setHidden] = useState(false),
        [selected, setSelected] = useState(0),
        [op, setOp] = useState<Operation | null>(null),
        [undo, setUndo] = useState<Draft | null>(null),
        [notice, setNotice] = useState(''),
        [identify, setIdentify] = useState(false),
        [showRoads, setShowRoads] = useState(true),
        [all, setAll] = useState(false),
        [layers, setLayers] = useState(false),
        [full, setFull] = useState(false),
        [query, setQuery] = useState(''),
        [results, setResults] = useState<{ label: string; p: Point }[]>([]),
        [searchNotice, setSearchNotice] = useState('');
    const controllers = useRef<(AbortController | null)[]>([null, null]),
        generations = useRef([0, 0]),
        alternativeRequest = useRef<AbortController | null>(null);
    const apply = (next: Draft) => {
        current.current = next;
        setDraft(next);
        const feature =
            next.changed && next.legs.every((x) => x.status === 'Ready')
                ? routeFeature(
                      next.points,
                      next.legs.map((x) => x.line),
                  )
                : null;

        if (feature) {
            feature.properties.jairoads_editor = {
                version: 1,
                manual: next.legs.map((x) => x.manual),
            };
        }

        onChange(next.changed ? feature : next.original);
        onWorkingDirty?.(
            next.changed &&
                (JSON.stringify(next.points) !==
                    JSON.stringify(mappingData(initial)?.points ?? []) ||
                    JSON.stringify(next.legs.map((x) => x.line)) !==
                        JSON.stringify(mappingData(initial)?.legs ?? [[], []])),
        );
    };
    const remember = () => setUndo(structuredClone(current.current));
    const route = async (
        i: number,
        state = current.current,
        alternatives = false,
    ) => {
        if (!state.points[i + 1]) {
            return;
        }

        controllers.current[i]?.abort();
        const c = new AbortController();
        controllers.current[i] = c;
        const generation = ++generations.current[i];

        if (alternatives) {
            alternativeRequest.current = c;
            setNotice('Looking for other routes…');
        } else {
            const next = structuredClone(current.current);
            next.legs[i] = {
                ...next.legs[i],
                status: 'Routing…',
                manual: false,
            };
            next.changed = true;
            apply(next);
        }

        try {
            if (!services?.routing) {
                throw new Error(
                    'Routing is not configured. Trace this portion manually.',
                );
            }

            const a = state.points[i],
                b = state.points[i + 1];
            const response = await json(
                `${services.routing}/${a.join(',')};${b.join(',')}?overview=full&geometries=geojson&alternatives=${alternatives}&steps=false`,
                c.signal,
            );

            if (c.signal.aborted || generation !== generations.current[i]) {
                return;
            }

            const lines = (response.routes ?? [])
                .map((x: { geometry: object }) => lineCoordinates(x.geometry))
                .filter((x: Point[] | null): x is Point[] => !!x);

            if (response.code !== 'Ok' || !lines.length) {
                throw new Error(
                    'No usable road route returned. Retry or trace this portion manually.',
                );
            }

            if (alternatives) {
                if (lines.length < 2) {
                    setNotice(
                        'No alternative routes returned. You can edit or trace the path.',
                    );

                    return;
                }

                setOp({
                    kind: 'alternatives',
                    leg: i,
                    line: lines[1],
                    choices: lines.slice(1),
                    vertex: null,
                    insert: false,
                    undo: [],
                });
                setNotice('Preview only. Apply to replace this portion.');
            } else {
                const next = structuredClone(current.current);
                next.legs[i] = automatic(lines[0], a, b);
                apply(next);
            }
        } catch (e) {
            if (c.signal.aborted || generation !== generations.current[i]) {
                return;
            }

            const message = e instanceof Error ? e.message : 'Routing failed.';

            if (alternatives) {
                setNotice(message);
            } else {
                const next = structuredClone(current.current);
                next.legs[i] = {
                    ...next.legs[i],
                    status: 'Routing unavailable',
                    message,
                };
                apply(next);
            }
        }
    };
    const changeVertex = (line: Point[], vertex: number | null = null) => {
        if (op) {
            setOp({ ...op, line, vertex, undo: [...op.undo, op.line] });
        }
    };
    const click = (p: Point) => {
        if (disabled) {
            return;
        }

        if (identify && draft.legacy) {
            const line = draft.legacy,
                hit = nearest(line, p);

            if (
                samePoint(hit.p, line[0]) ||
                samePoint(hit.p, line[line.length - 1])
            ) {
                setNotice('Choose B between the endpoints.');

                return;
            }

            const left = line.slice(0, hit.index + 1),
                right = line.slice(hit.index + 1);

            if (!samePoint(left.at(-1), hit.p)) {
                left.push(hit.p);
            }

            if (!samePoint(right[0], hit.p)) {
                right.unshift(hit.p);
            }

            remember();
            apply({
                ...draft,
                points: [line[0], hit.p, line[line.length - 1]],
                legs: [left, right].map((line) => ({
                    line,
                    manual: true,
                    status: 'Ready',
                })),
                legacy: null,
                changed: true,
            });
            setIdentify(false);

            return;
        }

        if (op?.kind === 'trace') {
            if (!samePoint(op.line.at(-1), p)) {
                changeVertex([...op.line, p]);
            }

            return;
        }

        if (op || !placing || current.current.points.length === 3) {
            return;
        }

        if (current.current.points.some((q) => samePoint(p, q))) {
            setNotice('Choose distinct locations.');

            return;
        }

        remember();
        const next = structuredClone(current.current);
        next.points.push(p);
        next.changed = true;
        apply(next);

        if (next.points.length > 1) {
            setSelected(next.points.length - 2);
            void route(next.points.length - 2, next);
        }

        if (next.points.length === 3) {
            setPlacing(false);
        }
    };
    const move = (i: number, p: Point) => {
        if (disabled || op) {
            return;
        }

        remember();
        const next = structuredClone(current.current);
        next.points[i] = p;
        next.changed = true;
        next.legs.forEach((leg, j) => {
            if ((i === j || i === j + 1) && next.points[j + 1]) {
                if (leg.manual) {
                    leg.status = 'Needs correction';
                    leg.message =
                        'Location moved. Correct this manual connection or undo the move.';
                } else {
                    leg.status = 'Routing…';
                }
            }
        });
        apply(next);
        next.legs.forEach((leg, j) => {
            if ((i === j || i === j + 1) && !leg.manual) {
                void route(j, next);
            }
        });
    };
    const lineClick = (i: number, p: Point) => {
        if (identify || placing || op?.kind === 'trace') {
            click(p);

            return;
        }

        if (op?.kind === 'edit' && op.leg === i) {
            if (op.insert) {
                const hit = nearest(op.line, p),
                    line = [...op.line];
                line.splice(hit.index + 1, 0, hit.p);
                changeVertex(line, hit.index + 1);
            } else {
                let vertex = 1,
                    d = Infinity;
                op.line.slice(1, -1).forEach((q, j) => {
                    const value = distanceKm([q, p]);

                    if (value < d) {
                        d = value;
                        vertex = j + 1;
                    }
                });

                if (op.line.length > 2) {
                    setOp({ ...op, vertex });
                } else {
                    setNotice('Use Insert vertex to add a point.');
                }
            }
        } else if (!op) {
            setSelected(i);
        }
    };
    const handlers = useRef({ click, move, lineClick, changeVertex });
    useEffect(() => {
        handlers.current = { click, move, lineClick, changeVertex };
    });
    useEffect(() => {
        if (!node.current) {
            return;
        }

        const instance = L.map(node.current, {
            center: [7.603, 125.967],
            zoom: 13,
            scrollWheelZoom: true,
            doubleClickZoom: false,
        });
        map.current = instance;
        const tiles = L.tileLayer(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors · Routing: OSRM',
            },
        ).addTo(instance);
        tiles.on('tileload', () => setTilesReady(true));
        L.control.scale({ imperial: false }).addTo(instance);
        active.current = L.layerGroup().addTo(instance);
        references.current = L.layerGroup().addTo(instance);
        instance.on('click', (e) => handlers.current.click(point(e.latlng)));
        const line = lineCoordinates(current.current.original);

        if (line) {
            instance.fitBounds(L.latLngBounds(line.map(ll)), {
                padding: [35, 35],
                maxZoom: 17,
            });
        }

        const resize = new ResizeObserver(() =>
            instance.invalidateSize({ pan: false }),
        );
        resize.observe(node.current);
        const fullscreen = () =>
            setFull(document.fullscreenElement === root.current);
        document.addEventListener('fullscreenchange', fullscreen);

        const pendingControllers = controllers.current;

        return () => {
            pendingControllers.forEach((c) => c?.abort());
            resize.disconnect();
            document.removeEventListener('fullscreenchange', fullscreen);
            instance.remove();
        };
    }, []);
    useEffect(() => {
        onPending?.(!!op || draft.legs.some((x) => x.status === 'Routing…'));
    }, [op, draft, onPending]);
    useEffect(() => {
        const layer = active.current;

        if (!layer) {
            return;
        }

        layer.clearLayers();
        const draw = (line: Point[], i: number, ready: boolean) => {
            if (line.length > 1) {
                L.polyline(line.map(ll), {
                    color: i === selected ? '#843b12' : '#b8784b',
                    weight: 5,
                    dashArray: ready ? undefined : '7 5',
                    bubblingMouseEvents: false,
                })
                    .on('click', (e) =>
                        handlers.current.lineClick(i, point(e.latlng)),
                    )
                    .addTo(layer);
            }
        };

        if (draft.legacy) {
            draw(draft.legacy, 0, true);
        }

        draft.legs.forEach((leg, i) =>
            draw(
                op?.leg === i ? op.line : leg.line,
                i,
                op?.leg === i || leg.status === 'Ready',
            ),
        );
        draft.points.forEach((p, i) => {
            const marker = L.marker(ll(p), {
                draggable: !disabled && !op,
                title: `Location ${'ABC'[i]} — drag to move`,
                icon: L.divIcon({
                    className: 'jr-control-location',
                    html: 'ABC'[i],
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                }),
            }).addTo(layer);
            marker.on('dragend', () =>
                handlers.current.move(i, point(marker.getLatLng())),
            );
        });

        if (
            op?.kind === 'edit' &&
            op.vertex !== null &&
            op.vertex > 0 &&
            op.vertex < op.line.length - 1
        ) {
            const i = op.vertex,
                marker = L.marker(ll(op.line[i]), {
                    draggable: true,
                    title: 'Selected path vertex',
                    icon: L.divIcon({
                        className: 'jr-trace-vertex',
                        iconSize: [14, 14],
                    }),
                }).addTo(layer);
            marker.on('dragend', () => {
                const line = [...op.line];
                line[i] = point(marker.getLatLng());
                handlers.current.changeVertex(line, i);
            });
        }
    }, [draft, selected, op, disabled]);
    useEffect(() => {
        const layer = references.current;

        if (!layer) {
            return;
        }

        layer.clearLayers();

        if (!showRoads) {
            return;
        }

        referenceCoverages.forEach((road) => {
            const line = lineCoordinates(road.geojson);

            if (
                !line ||
                (municipality && !all && String(road.lgus_id) !== municipality)
            ) {
                return;
            }

            const content = document.createElement('div');
            [
                road.road_name,
                municipalities?.find((x) => x.id === road.lgus_id)
                    ?.municipality_name ?? 'Municipality unavailable',
                `${road.kilometers} km · ${road.pavement_type} · ${road.state_category}`,
            ].forEach((value) => {
                const row = document.createElement('div');
                row.textContent = value;
                content.append(row);
            });
            L.polyline(line.map(ll), {
                color: '#71818b',
                weight: 4,
                dashArray: '5 5',
                opacity: 0.65,
                interactive: !placing && !op && !identify,
            })
                .bindPopup(content)
                .addTo(layer);
        });
    }, [
        referenceCoverages,
        municipality,
        municipalities,
        showRoads,
        all,
        placing,
        op,
        identify,
    ]);
    const start = (kind: 'trace' | 'edit') => {
        alternativeRequest.current?.abort();
        controllers.current[selected]?.abort();
        generations.current[selected]++;

        if (current.current.legs[selected].status === 'Routing…') {
            const next = structuredClone(current.current);
            next.legs[selected].status = 'Routing unavailable';
            next.legs[selected].message =
                'Routing paused for manual editing. Retry routing if you cancel.';
            apply(next);
        }

        setPlacing(false);
        setOp({
            kind,
            leg: selected,
            line:
                kind === 'trace'
                    ? [draft.points[selected]]
                    : structuredClone(draft.legs[selected].line),
            choices: [],
            vertex: null,
            insert: false,
            undo: [],
        });
    };
    const finish = () => {
        if (!op) {
            return;
        }

        const line = [...op.line];
        const i = op.leg;

        if (
            op.kind === 'trace' &&
            !samePoint(line.at(-1), draft.points[i + 1])
        ) {
            line.push(draft.points[i + 1]);
        }

        if (
            !connects(line, draft.points[i], draft.points[i + 1]) ||
            distanceKm(line) <= 0 ||
            line.slice(1).some((p, j) => samePoint(p, line[j]))
        ) {
            setNotice(
                'Correct this path so it connects both locations without repeated adjacent vertices.',
            );

            return;
        }

        remember();
        const next = structuredClone(current.current);
        next.legs[i] =
            op.kind === 'alternatives'
                ? automatic(line, draft.points[i], draft.points[i + 1])
                : { line, manual: true, status: 'Ready' };
        next.changed = true;
        apply(next);
        setOp(null);
        setNotice('Working path updated. Save to retain it.');
    };
    const instruction = identify
        ? 'Click the saved road to identify B.'
        : op?.kind === 'trace'
          ? `Click along the road. Finish Trace connects to ${'ABC'[op.leg + 1]}.`
          : op?.kind === 'edit'
            ? 'Click the path to select a vertex; drag its handle to adjust.'
            : op?.kind === 'alternatives'
              ? 'Review the alternative, then Apply or Cancel.'
              : placing
                ? `Click the map to place Location ${'ABC'[draft.points.length] ?? 'C'}.`
                : 'Review the road or select a portion to correct.';
    const actions = op && (
        <div className="jr-map-actions">
            {op.kind !== 'alternatives' && (
                <Button
                    type="button"
                    variant="outline"
                    disabled={!op.undo.length}
                    onClick={() =>
                        setOp({
                            ...op,
                            line: op.undo.at(-1)!,
                            undo: op.undo.slice(0, -1),
                            vertex: null,
                        })
                    }
                >
                    Undo
                </Button>
            )}
            <Button
                type="button"
                variant="outline"
                onClick={() => {
                    setOp(null);
                    setNotice('Temporary edits canceled.');
                }}
            >
                Cancel editing
            </Button>
            <Button type="button" className="jr-primary" onClick={finish}>
                {op.kind === 'trace' ? 'Finish Trace' : 'Apply Changes'}
            </Button>
        </div>
    );

    return (
        <div
            ref={root}
            className={`jr-map-workspace ${hidden ? 'panel-hidden' : ''}`}
        >
            <div className="jr-map-stage">
                <div
                    ref={node}
                    className="jr-leaflet-map"
                    aria-label="Road coverage map"
                    tabIndex={0}
                />
                <div className="jr-map-search">
                    <input
                        aria-label="Search places"
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setResults([]);
                                setSearchNotice('');
                            }

                            if (e.key === 'Enter') {
                                e.preventDefault();
                                document
                                    .getElementById('jr-place-search')
                                    ?.click();
                            }
                        }}
                        placeholder="Search a place or landmark…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                        id="jr-place-search"
                        type="button"
                        onClick={async () => {
                            try {
                                if (!services?.geocoding) {
                                    throw new Error(
                                        'Location search is not configured.',
                                    );
                                }

                                setSearchNotice('Searching…');
                                const data = await json(
                                    `${services.geocoding}?q=${encodeURIComponent(query)}&limit=5&lat=7.6&lon=125.96`,
                                    new AbortController().signal,
                                );
                                setResults(
                                    (data.features ?? []).map(
                                        (f: {
                                            geometry: { coordinates: Point };
                                            properties: Record<string, string>;
                                        }) => ({
                                            p: f.geometry.coordinates,
                                            label: [
                                                f.properties.name,
                                                f.properties.city,
                                                f.properties.state,
                                                f.properties.country,
                                            ]
                                                .filter(Boolean)
                                                .join(', '),
                                        }),
                                    ),
                                );
                                setSearchNotice(
                                    data.features?.length
                                        ? ''
                                        : 'No matching places.',
                                );
                            } catch (e) {
                                setSearchNotice(
                                    e instanceof Error
                                        ? e.message
                                        : 'Search unavailable.',
                                );
                            }
                        }}
                    >
                        Search
                    </button>
                    {(results.length > 0 || searchNotice) && (
                        <div className="jr-place-results">
                            {results.map((r, i) => (
                                <button
                                    type="button"
                                    key={i}
                                    onClick={() => {
                                        map.current?.setView(ll(r.p), 15);
                                        setResults([]);
                                    }}
                                >
                                    {r.label}
                                </button>
                            ))}
                            <small>
                                {searchNotice} Place search: Photon /
                                OpenStreetMap
                            </small>
                        </div>
                    )}
                </div>
                <div className="jr-map-tools">
                    <button
                        type="button"
                        onClick={() => setLayers(!layers)}
                        aria-label="Existing road layers"
                    >
                        <Layers size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setHidden(!hidden)}
                        aria-label={
                            hidden
                                ? 'Expand mapping panel'
                                : 'Collapse mapping panel'
                        }
                    >
                        {hidden ? (
                            <PanelRightOpen size={18} />
                        ) : (
                            <PanelRightClose size={18} />
                        )}
                    </button>
                </div>
                {layers && (
                    <div className="jr-map-layers">
                        <label>
                            <input
                                type="checkbox"
                                checked={showRoads}
                                onChange={(e) => setShowRoads(e.target.checked)}
                            />{' '}
                            Show mapped roads
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={all}
                                onChange={(e) => setAll(e.target.checked)}
                            />{' '}
                            All municipalities
                        </label>
                        <small>Only saved, valid geometry is shown.</small>
                    </div>
                )}
                <div className="jr-map-instruction" role="status">
                    {instruction}
                    {!tilesReady && (
                        <small style={{ display: 'block', marginTop: 4 }}>
                            Map tiles are loading. If this persists, check
                            access to OpenStreetMap; your work is retained.
                        </small>
                    )}
                </div>
                {hidden && op && (
                    <div className="jr-map-floating-actions">{actions}</div>
                )}
                <button
                    type="button"
                    className="jr-map-fullscreen"
                    aria-label={
                        full ? 'Exit fullscreen' : 'Fullscreen map workspace'
                    }
                    onClick={async () => {
                        try {
                            if (document.fullscreenElement) {
                                await document.exitFullscreen();
                            } else {
                                await root.current?.requestFullscreen();
                            }
                        } catch {
                            setNotice(
                                'Fullscreen is unavailable in this browser.',
                            );
                        }
                    }}
                >
                    {full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
            </div>
            <aside hidden={hidden} className="jr-map-panel">
                <section>
                    <button
                        type="button"
                        className="jr-map-section-toggle"
                        aria-label="Road Information"
                        aria-expanded={infoOpen}
                        onClick={() => setInfoOpen(!infoOpen)}
                    >
                        Road Information <span>{infoOpen ? '⌄' : '›'}</span>
                    </button>
                    <div hidden={!infoOpen}>{information}</div>
                </section>
                <section>
                    <h2>Mapping</h2>
                    <p className="jr-field-hint">{instruction}</p>
                    <div className="jr-map-location-list">
                        {'ABC'.split('').map((label, i) => (
                            <div key={label}>
                                <b>{label}</b>
                                <span>
                                    {draft.points[i]
                                        ? `${draft.points[i][1].toFixed(6)}, ${draft.points[i][0].toFixed(6)}`
                                        : 'Not placed'}
                                </span>
                            </div>
                        ))}
                    </div>
                    {draft.legacy && (
                        <>
                            <p className="jr-field-hint">
                                Saved geometry retained. Identify B only to edit
                                portions.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={disabled}
                                onClick={() => setIdentify(!identify)}
                            >
                                {identify
                                    ? 'Cancel identifying B'
                                    : 'Identify B on saved road'}
                            </Button>
                        </>
                    )}
                    {!draft.legacy && draft.points.length < 3 && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={disabled || !!op}
                            onClick={() => setPlacing(!placing)}
                        >
                            {placing ? 'Pause placement' : 'Resume placement'}
                        </Button>
                    )}
                    <div className="jr-map-portions">
                        {draft.legs.map((leg, i) => (
                            <button
                                type="button"
                                key={i}
                                aria-pressed={selected === i}
                                disabled={!!op}
                                onClick={() => setSelected(i)}
                            >
                                <strong>{i === 0 ? 'A–B' : 'B–C'}</strong>
                                <span>
                                    {leg.status === 'Ready'
                                        ? `${leg.manual ? 'Manual' : 'Automatic'} · ${distanceKm(leg.line).toFixed(2)} km`
                                        : leg.status}
                                </span>
                            </button>
                        ))}
                    </div>
                    {!op && draft.points[selected + 1] && (
                        <div className="jr-map-actions">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={disabled}
                                onClick={() => start('trace')}
                            >
                                Trace Road
                            </Button>
                            {draft.legs[selected].line.length > 1 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={() => start('edit')}
                                >
                                    Edit Road Path
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                disabled={disabled}
                                onClick={() => {
                                    remember();
                                    void route(selected);
                                }}
                            >
                                Retry Routing
                            </Button>
                            {draft.legs[selected].line.length > 1 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={() => {
                                        setPlacing(false);
                                        void route(selected, draft, true);
                                    }}
                                >
                                    Other Routes
                                </Button>
                            )}
                        </div>
                    )}
                    {op?.kind === 'alternatives' &&
                        op.choices.map((line, i) => (
                            <button
                                type="button"
                                className="jr-map-choice"
                                key={i}
                                aria-pressed={op.line === line}
                                onClick={() => setOp({ ...op, line })}
                            >
                                Route {i + 1} · {distanceKm(line).toFixed(2)} km
                            </button>
                        ))}
                    {op?.kind === 'edit' && (
                        <div className="jr-map-actions">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    setOp({
                                        ...op,
                                        insert: !op.insert,
                                        vertex: null,
                                    })
                                }
                            >
                                {op.insert ? 'Select vertex' : 'Insert vertex'}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={op.vertex === null}
                                onClick={() =>
                                    changeVertex(
                                        op.line.filter(
                                            (_, i) => i !== op.vertex,
                                        ),
                                    )
                                }
                            >
                                Remove vertex
                            </Button>
                            {!connects(
                                op.line,
                                draft.points[op.leg],
                                draft.points[op.leg + 1],
                            ) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        changeVertex([
                                            draft.points[op.leg],
                                            ...op.line.slice(1, -1),
                                            draft.points[op.leg + 1],
                                        ])
                                    }
                                >
                                    Align endpoints to locations
                                </Button>
                            )}
                        </div>
                    )}
                    {actions}
                    {undo && !op && (
                        <button
                            type="button"
                            className="jr-length-reset"
                            disabled={disabled}
                            onClick={() => {
                                controllers.current.forEach((c) => c?.abort());
                                generations.current = generations.current.map(
                                    (x) => x + 1,
                                );
                                const previous = structuredClone(undo);
                                previous.legs.forEach((leg) => {
                                    if (leg.status === 'Routing…') {
                                        leg.status = 'Routing unavailable';
                                        leg.message =
                                            'Previous routing was interrupted. Retry this portion.';
                                    }
                                });
                                apply(previous);
                                setUndo(null);
                            }}
                        >
                            Undo last mapping change
                        </button>
                    )}
                    {(notice || draft.legs[selected].message) && (
                        <p className="jr-map-warning" role="status">
                            {notice || draft.legs[selected].message}
                        </p>
                    )}
                </section>
                <section>{lengthFields}</section>
            </aside>
        </div>
    );
}

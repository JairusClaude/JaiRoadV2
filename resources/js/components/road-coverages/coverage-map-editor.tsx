import * as Dialog from '@radix-ui/react-dialog';
import L from 'leaflet';
import {
    Maximize2,
    Minimize2,
    PanelRightClose,
    PanelRightOpen,
    Layers,
    MousePointer2,
    Pencil,
    Undo2,
    Route,
    RotateCcw,
    X,
    Check,
    ChevronRight,
    MapPinPlus,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    undo: Point[][];
};
const ll = (p: Point): L.LatLngTuple => [p[1], p[0]];
const point = (p: L.LatLng): Point => [
    p.wrap().lng,
    Math.max(-85.05112878, Math.min(85.05112878, p.lat)),
];
// Manual traces must connect to their selected endpoints. The router's returned
// road endpoints are handled separately; ordinary network snapping is not an error.
const connects = (line: Point[], a: Point, b: Point) =>
    line.length > 1 && samePoint(line[0], a) && samePoint(line.at(-1), b);
const portionName = (i: number) => (i === 0 ? 'A–B' : 'B–C');
const notMapped = (): Leg => ({
    line: [],
    manual: false,
    status: 'Not yet mapped',
});
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
            legs: (data?.legs ?? []).map((_, i) => ({
                line: data?.legs[i] ?? [],
                manual:
                    (
                        initial as {
                            properties?: {
                                jairoads_editor?: { manual?: boolean[] };
                            };
                        } | null
                    )?.properties?.jairoads_editor?.manual?.[i] ?? true,
                status: 'Complete',
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
        references = useRef<L.LayerGroup | null>(null),
        operationLine = useRef<L.Polyline | null>(null),
        suppressMapClick = useRef(false),
        explicitPlacement = useRef(false),
        confirmationReturnFocus = useRef<HTMLElement | null>(null);
    const [portalContainer, setPortalContainer] =
        useState<HTMLDivElement | null>(null);
    const workspaceRef = useCallback((element: HTMLDivElement | null) => {
        root.current = element;
        setPortalContainer(element);
    }, []);
    const [tilesReady, setTilesReady] = useState(false);
    const [placing, setPlacing] = useState(!editing),
        [infoOpen, setInfoOpen] = useState(true),
        [hidden, setHidden] = useState(false),
        [selectedLocation, setSelectedLocation] = useState<number | null>(null),
        [drawMenu, setDrawMenu] = useState(false),
        [confirmation, setConfirmation] = useState<{
            index: number | null;
            title: string;
            description: string;
        } | null>(null),
        [selected, setSelected] = useState<number | null>(null),
        [anchor, setAnchor] = useState<Point | null>(null),
        [popupPosition, setPopupPosition] = useState({ left: 12, top: 120 }),
        [op, setOp] = useState<Operation | null>(null),
        [undo, setUndo] = useState<Draft | null>(null),
        [notice, setNotice] = useState(''),
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
        const feature =
            next.changed && next.legs.every((x) => x.status === 'Complete')
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

        if (
            next.changed &&
            next.legs.length &&
            next.legs.every((x) => x.status === 'Complete') &&
            !feature
        ) {
            const affected =
                next.legs.find(
                    (leg) =>
                        leg.line.length > 1000 ||
                        leg.line
                            .slice(1)
                            .some((p, i) => samePoint(p, leg.line[i])),
                ) ?? next.legs.at(-1)!;
            affected.status = 'Needs correction';
            const merged = next.legs.flatMap((leg, i) =>
                i ? leg.line.slice(1) : leg.line,
            );
            const repeated = next.points.findIndex(
                (p) => merged.filter((q) => samePoint(p, q)).length > 1,
            );
            affected.message =
                repeated >= 0
                    ? `The road passes Location ${'ABC'[repeated]} more than once. Review or redraw this portion to keep one continuous route.`
                    : merged.length > 1000
                      ? 'This road exceeds the 1,000-point limit. Draw it with fewer tracing points.'
                      : 'The path contains a repeated tracing point or missing connection. Adjust or redraw this portion.';
        }

        current.current = next;
        setDraft(next);
        onChange(next.changed ? feature : next.original);
        onWorkingDirty?.(
            next.changed &&
                (JSON.stringify(next.points) !==
                    JSON.stringify(mappingData(initial)?.points ?? []) ||
                    JSON.stringify(next.legs.map((x) => x.line)) !==
                        JSON.stringify(mappingData(initial)?.legs ?? [])),
        );
    };
    const remember = () => setUndo(structuredClone(current.current));
    const abortRouting = () => {
        controllers.current.forEach((c) => c?.abort());
        alternativeRequest.current?.abort();
        generations.current = generations.current.map((x) => x + 1);
    };
    const clearSelection = () => {
        setSelected(null);
        setSelectedLocation(null);
        setAnchor(null);
        setDrawMenu(false);
    };
    const activatePlacement = () => {
        if (
            disabled ||
            op ||
            confirmation ||
            draft.legacy ||
            draft.points.length >= 3
        ) {
            return;
        }

        clearSelection();
        explicitPlacement.current = true;
        setPlacing(true);
        setNotice('');
    };
    const removeWorkingLocations = (index: number | null) => {
        if (disabled || op) {
            return;
        }

        abortRouting();
        explicitPlacement.current = false;
        remember();
        const next = structuredClone(current.current);
        const count = next.points.length;

        if (index === null) {
            next.points = [];
            next.legs = [];
            next.legacy = null;
        } else if (count === 3) {
            next.points.splice(index, 1);

            if (index === 0) {
                next.legs = [next.legs[1]];
            } else if (index === 2) {
                next.legs = [next.legs[0]];
            } else {
                next.legs = [
                    {
                        ...notMapped(),
                        message:
                            'Locations changed. Select A–B to retry routing or draw the new connection.',
                    },
                ];
            }
        } else {
            next.points.splice(index, 1);
            next.legs = [];
        }

        next.legs.forEach((leg) => {
            if (leg.status === 'Calculating route') {
                leg.status = 'Route unavailable';
                leg.message =
                    'Routing was interrupted by a location change. Retry or draw this portion.';
            }
        });
        next.changed = true;
        apply(next);
        clearSelection();
        setPlacing(next.points.length < 2);
        setNotice(
            index === null
                ? 'Locations cleared. Road information was kept. Place Location A to start again.'
                : 'Location removed. Remaining locations were relabeled in order.',
        );
    };
    const requestRemoval = (index: number | null) => {
        const count = draft.points.length;
        const discarded =
            index === null
                ? draft.legs
                : count < 3 || index === 1
                  ? draft.legs
                  : [draft.legs[index === 0 ? 0 : 1]];
        const confirm =
            index === null
                ? count > 0 || !!draft.legacy
                : (count === 3 && index === 1) ||
                  discarded.some((leg) => leg.line.length > 1);

        if (!confirm) {
            removeWorkingLocations(index);

            return;
        }

        confirmationReturnFocus.current = document.activeElement as HTMLElement;
        setConfirmation({
            index,
            title:
                index === null
                    ? 'Clear all locations?'
                    : `Remove Location ${'ABC'[index]}?`,
            description:
                index === null
                    ? 'Clear the working map and start again at A. Road Information will be kept. This does not delete the saved RoadCoverage.'
                    : count === 3 && index === 1
                      ? 'Both road portions will be discarded. A and C stay in place as the new A and B. Rebuild their connection using routing or drawing.'
                      : count === 3 && index === 0
                        ? 'Remove A and its A–B portion. The former B–C road will be kept as the new A–B, with its existing geometry.'
                        : count === 3 && index === 2
                          ? 'Remove C and its B–C portion. The existing A–B road will be kept.'
                          : 'Remove this location and the road connecting it. The remaining location becomes A. Add a new B to rebuild the road.',
        });
    };
    const focusMap = (coordinates: Point[], location = false) => {
        const instance = map.current;

        if (!instance || !coordinates.length) {
            return;
        }

        instance.invalidateSize({ pan: false });

        if (location) {
            const zoom = instance.getZoom();
            instance.setView(
                ll(coordinates[0]),
                zoom >= 14 && zoom <= 17 ? zoom : 16,
                { animate: false },
            );
        } else {
            instance.fitBounds(L.latLngBounds(coordinates.map(ll)), {
                paddingTopLeft: [48, window.innerWidth <= 480 ? 155 : 112],
                paddingBottomRight: [48, 68],
                maxZoom: 16,
                animate: false,
            });
        }

        if (window.innerWidth <= 800) {
            node.current?.scrollIntoView({
                block: 'start',
                behavior: 'smooth',
            });
        }
    };
    const markerClick = (index: number, navigate = false) => {
        if (
            op ||
            confirmation ||
            suppressMapClick.current ||
            !current.current.points[index]
        ) {
            return;
        }

        const location = current.current.points[index];
        explicitPlacement.current = false;
        setPlacing(false);
        setDrawMenu(false);
        setSelected(null);
        setSelectedLocation(index);
        setAnchor(location);
        setNotice('');

        if (navigate) {
            focusMap([location], true);
        }
    };
    const selectPortion = (i: number, location?: Point, navigate = false) => {
        if (op || confirmation) {
            return;
        }

        const state = current.current;
        const line =
            lineCoordinates({
                type: 'LineString',
                coordinates: state.legs[i]?.line,
            }) ?? [];
        const endpoints = state.points.slice(i, i + 2);

        if (!line.length && !endpoints.length) {
            return;
        }

        explicitPlacement.current = false;
        setSelectedLocation(null);
        setDrawMenu(false);
        alternativeRequest.current?.abort();
        setPlacing(false);
        setSelected(i);
        setAnchor(
            location ??
                (line.length
                    ? line[Math.floor(line.length / 2)]
                    : endpoints[0]),
        );
        setNotice('');

        if (navigate) {
            focusMap(line.length ? line : endpoints);
        }
    };
    const acceptAutomatic = (next: Draft, i: number, line: Point[]) => {
        const endPoints = [line[0], line.at(-1)!];

        for (const [j, endpoint] of endPoints.entries()) {
            const index = i + j;
            const offset = distanceKm([next.points[index], endpoint]) * 1000;
            const adjacent = next.legs.find(
                (leg, k) =>
                    k !== i &&
                    (k === index || k + 1 === index) &&
                    leg.line.length > 1 &&
                    leg.status === 'Complete',
            );

            if (offset > 50 || (adjacent && offset > 0.16)) {
                next.legs[i] = {
                    line,
                    manual: false,
                    status: 'Needs correction',
                    message:
                        offset > 50
                            ? `Location ${'ABC'[index]} is too far from this mapped road. Move it closer or draw the road manually.`
                            : `Connection missing at Location ${'ABC'[index]}. This route ends on a different road. The adjacent portion was preserved; redraw this portion or move the location deliberately.`,
                };

                return;
            }
        }

        let snapped = false;
        const result = [...line];
        endPoints.forEach((endpoint, j) => {
            const index = i + j;
            const shared = next.legs.some(
                (leg, k) =>
                    k !== i &&
                    (k === index || k + 1 === index) &&
                    leg.line.length > 1 &&
                    leg.status === 'Complete',
            );

            if (shared) {
                result[j ? result.length - 1 : 0] = next.points[index];
            } else {
                snapped ||=
                    distanceKm([next.points[index], endpoint]) * 1000 > 0.16;
                next.points[index] = endpoint;
            }
        });
        next.legs[i] = { line: result, manual: false, status: 'Complete' };

        if (snapped) {
            setNotice(
                'Locations aligned to the mapped road. Review the markers before saving.',
            );
        }
    };
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
                status: 'Calculating route',
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
                `${services.routing}/${a.join(',')};${b.join(',')}?overview=full&geometries=geojson&alternatives=${alternatives}&steps=false&radiuses=50;50`,
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
                    undo: [],
                });
                setNotice('Preview only. Apply to replace this portion.');
            } else {
                const next = structuredClone(current.current);
                acceptAutomatic(next, i, lines[0]);
                apply(next);
            }
        } catch (e) {
            if (c.signal.aborted || generation !== generations.current[i]) {
                return;
            }

            const message =
                'Automatic route unavailable. Move the locations closer to a mapped road, retry, or draw manually.';
            void e;

            if (alternatives) {
                setNotice(message);
            } else {
                const next = structuredClone(current.current);
                next.legs[i] = {
                    ...next.legs[i],
                    status: 'Route unavailable',
                    message,
                };
                apply(next);
            }
        }
    };
    const changeVertex = (line: Point[], vertex: number | null = null) => {
        if (op) {
            setNotice('');
            setOp({ ...op, line, vertex, undo: [...op.undo, op.line] });
        }
    };
    const click = (p: Point) => {
        if (disabled || confirmation || suppressMapClick.current) {
            return;
        }

        setDrawMenu(false);

        if (op?.kind === 'trace') {
            if (!samePoint(op.line.at(-1), p)) {
                changeVertex([...op.line, p]);
            }

            return;
        }

        if (op || !placing || current.current.points.length === 3) {
            if (!op) {
                clearSelection();
            }

            return;
        }

        if (current.current.points.some((q) => samePoint(p, q))) {
            setNotice('Choose distinct locations.');

            return;
        }

        remember();
        const next = structuredClone(current.current);
        next.points.push(p);

        if (next.points.length > 1) {
            next.legs.push(notMapped());
        }

        next.changed = true;
        apply(next);

        if (next.points.length > 1) {
            void route(next.points.length - 2, next);
        }

        if (
            next.points.length === 3 ||
            (next.points.length === 2 && !explicitPlacement.current)
        ) {
            explicitPlacement.current = false;
            setPlacing(false);
            setSelected(null);
            setAnchor(null);
        }
    };
    const move = (i: number, p: Point) => {
        if (disabled || op || confirmation) {
            return false;
        }

        if (current.current.points.some((q, j) => j !== i && samePoint(q, p))) {
            setNotice(
                'Choose a location different from the other road locations.',
            );
            setDraft(structuredClone(current.current));

            return false;
        }

        remember();
        const next = structuredClone(current.current);
        next.points[i] = p;
        next.changed = true;
        next.legs.forEach((leg, j) => {
            if ((i === j || i === j + 1) && next.points[j + 1]) {
                if (leg.manual) {
                    leg.status = connects(
                        leg.line,
                        next.points[j],
                        next.points[j + 1],
                    )
                        ? 'Complete'
                        : 'Needs correction';
                    leg.message =
                        leg.status === 'Complete'
                            ? undefined
                            : `Connection missing at Location ${'ABC'[i]}. The manual path was retained. Redraw this portion or undo the location move.`;
                } else {
                    leg.status = 'Calculating route';
                }
            }
        });
        apply(next);
        next.legs.forEach((leg, j) => {
            if ((i === j || i === j + 1) && !leg.manual) {
                void route(j, next);
            }
        });
        setSelectedLocation(null);
        setAnchor(null);
        setNotice(
            `Location ${'ABC'[i]} updated. Review the affected road portions.`,
        );

        return true;
    };
    const lineClick = (i: number, p: Point) => {
        if (current.current.legacy) {
            setNotice(
                'Saved alignment retained. Use saved endpoints in Road Mapping to edit it.',
            );

            return;
        }

        if (placing || op?.kind === 'trace') {
            click(p);

            return;
        }

        if (op?.kind === 'edit' && op.leg === i && op.line.length > 2) {
            const closest = op.line
                .slice(1, -1)
                .reduce(
                    (best, q, j) =>
                        distanceKm([q, p]) < distanceKm([op.line[best], p])
                            ? j + 1
                            : best,
                    1,
                );
            setOp({ ...op, vertex: closest });
        } else if (!op) {
            selectPortion(i, p);
        }
    };
    const handlers = useRef({
        click,
        move,
        lineClick,
        changeVertex,
        markerClick,
    });
    useEffect(() => {
        handlers.current = {
            click,
            move,
            lineClick,
            changeVertex,
            markerClick,
        };
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
                animate: false,
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
        onPending?.(
            !!op ||
                !!confirmation ||
                draft.legs.some((x) => x.status === 'Calculating route'),
        );
    }, [op, draft, confirmation, onPending]);
    useEffect(() => {
        const layer = active.current;

        if (!layer) {
            return;
        }

        layer.clearLayers();
        operationLine.current = null;
        const draw = (line: Point[], i: number, ready: boolean) => {
            if (line.length > 1) {
                const path = L.polyline(line.map(ll), {
                    color:
                        i === selected || op?.leg === i ? '#2563eb' : '#843b12',
                    weight: i === selected ? 6 : 5,
                    dashArray: ready ? undefined : '7 5',
                    className: `jr-road-line jr-road-line-${i}`,
                    bubblingMouseEvents: false,
                })
                    .on('click', (e) =>
                        handlers.current.lineClick(i, point(e.latlng)),
                    )
                    .addTo(layer);

                if (op?.leg === i) {
                    operationLine.current = path;
                }
            }
        };

        if (draft.legacy) {
            draw(draft.legacy, 0, true);
        }

        draft.legs.forEach((leg, i) => {
            if (
                op?.leg === i &&
                op.kind !== 'alternatives' &&
                leg.line.length > 1
            ) {
                L.polyline(leg.line.map(ll), {
                    color: '#94a3b8',
                    weight: 4,
                    dashArray: '4 6',
                    opacity: 0.65,
                    interactive: false,
                }).addTo(layer);
            }

            draw(
                op?.leg === i ? op.line : leg.line,
                i,
                op?.leg !== i && leg.status === 'Complete',
            );
        });
        draft.points.forEach((p, i) => {
            const marker = L.marker(ll(p), {
                draggable: !disabled && !op && !confirmation,
                bubblingMouseEvents: false,
                title: `Location ${'ABC'[i]} — drag to move`,
                icon: L.divIcon({
                    className: `jr-control-location ${selectedLocation === i ? 'jr-location-selected' : ''}`,
                    html: 'ABC'[i],
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                }),
            }).addTo(layer);
            marker.on('click', () => handlers.current.markerClick(i));
            marker.on('dragstart', () => {
                suppressMapClick.current = true;
            });
            marker.on('dragend', () => {
                handlers.current.move(i, point(marker.getLatLng()));
                setTimeout(() => {
                    suppressMapClick.current = false;
                }, 180);
            });
        });

        if (op && op.kind !== 'alternatives') {
            (op.kind === 'trace'
                ? op.line.slice(1)
                : op.line.slice(1, -1)
            ).forEach((p, j) => {
                const i = j + 1;

                if (
                    op.kind === 'edit' &&
                    op.line.length > 62 &&
                    op.vertex !== i
                ) {
                    return;
                }

                const marker = L.marker(ll(p), {
                    draggable: true,
                    bubblingMouseEvents: false,
                    keyboard: true,
                    title:
                        op.kind === 'edit'
                            ? `Tracing point ${i} — drag to adjust`
                            : `Drawing point ${i} — drag to adjust`,
                    icon: L.divIcon({
                        className: 'jr-trace-vertex',
                        iconSize: [14, 14],
                        iconAnchor: [7, 7],
                    }),
                }).addTo(layer);
                marker.on('dragstart', () => {
                    suppressMapClick.current = true;
                });
                marker.on('drag', () => {
                    const line = [...op.line];
                    line[i] = point(marker.getLatLng());
                    operationLine.current?.setLatLngs(line.map(ll));
                });
                marker.on('dragend', () => {
                    const line = [...op.line];
                    line[i] = point(marker.getLatLng());
                    handlers.current.changeVertex(line, i);
                    setTimeout(() => {
                        suppressMapClick.current = false;
                    }, 180);
                });
            });
        }
    }, [draft, selected, selectedLocation, op, disabled, confirmation]);
    useEffect(() => {
        const instance = map.current;

        if (!instance || !anchor) {
            return;
        }

        const position = () => {
            const pos = instance.latLngToContainerPoint(ll(anchor));
            const size = instance.getSize();
            const popup =
                root.current?.querySelector<HTMLElement>('.jr-road-context');
            const width = popup?.offsetWidth ?? Math.min(236, size.x - 24);
            const height = popup?.offsetHeight ?? 180;
            const minTop = window.innerWidth <= 480 ? 150 : 112;
            let left = pos.x + 14;
            let top = pos.y - 30;

            if (left + width > size.x - 12) {
                left = pos.x - width - 14;

                if (left < 12) {
                    left = Math.max(
                        12,
                        Math.min(pos.x - width / 2, size.x - width - 12),
                    );

                    if (pos.y - height - 18 >= minTop) {
                        top = pos.y - height - 18;
                    } else {
                        top = pos.y + 22;
                    }
                }
            }

            top = Math.max(minTop, Math.min(top, size.y - height - 24));
            left = Math.max(
                Math.min(
                    top < (window.innerWidth <= 480 ? 220 : 190) ? 56 : 12,
                    size.x - width - 12,
                ),
                Math.min(left, size.x - width - 12),
            );
            setPopupPosition({ left, top });
        };
        position();
        instance.on('move zoom resize', position);

        return () => {
            instance.off('move zoom resize', position);
        };
    }, [anchor, hidden, selected, selectedLocation, draft, op]);
    useEffect(() => {
        if ((selected === null && selectedLocation === null) || !anchor || op) {
            return;
        }

        root.current
            ?.querySelector<HTMLButtonElement>('.jr-road-context > button')
            ?.focus({ preventScroll: true });
    }, [selected, selectedLocation, anchor, op]);
    useEffect(() => {
        const escape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') {
                return;
            }

            if (confirmation) {
                return;
            }

            if (drawMenu) {
                setDrawMenu(false);
                root.current
                    ?.querySelector<HTMLButtonElement>('#jr-draw-tool')
                    ?.focus();

                return;
            }

            if (op) {
                setOp(null);
                setNotice(
                    'Drawing or editing canceled. Previous path retained.',
                );
            } else {
                clearSelection();
            }
        };
        document.addEventListener('keydown', escape);

        return () => document.removeEventListener('keydown', escape);
    }, [op, drawMenu, confirmation]);
    useEffect(() => {
        if (!drawMenu) {
            return;
        }

        root.current
            ?.querySelector<HTMLButtonElement>('.jr-draw-targets button')
            ?.focus();
        const dismiss = (event: PointerEvent) => {
            if (!(event.target as HTMLElement).closest('.jr-draw-tool')) {
                setDrawMenu(false);
            }
        };
        document.addEventListener('pointerdown', dismiss);

        return () => document.removeEventListener('pointerdown', dismiss);
    }, [drawMenu]);
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
                interactive: !placing && !op && !confirmation,
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
        confirmation,
    ]);
    const start = (kind: 'trace' | 'edit', target?: number) => {
        if (disabled || op || confirmation) {
            return;
        }

        const i = target ?? selected ?? (draft.legs.length === 1 ? 0 : null);

        if (i === null || !draft.points[i + 1]) {
            if (kind === 'trace' && draft.legs.length === 2) {
                setDrawMenu(true);
                setPlacing(false);
                setSelectedLocation(null);
                setAnchor(null);
            } else {
                setNotice('Place at least A and B before drawing.');
            }

            return;
        }

        if (kind === 'edit' && !draft.legs[i].manual) {
            return;
        }

        explicitPlacement.current = false;
        setNotice('');
        setDrawMenu(false);
        setSelectedLocation(null);
        setSelected(i);
        alternativeRequest.current?.abort();
        controllers.current[i]?.abort();
        generations.current[i]++;

        if (current.current.legs[i].status === 'Calculating route') {
            const next = structuredClone(current.current);
            next.legs[i].status = 'Route unavailable';
            next.legs[i].message =
                'Routing paused for manual editing. Retry routing if you cancel.';
            apply(next);
        }

        setPlacing(false);
        setOp({
            kind,
            leg: i,
            line:
                kind === 'trace'
                    ? [draft.points[i]]
                    : structuredClone(draft.legs[i].line),
            choices: [],
            vertex: null,
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
            (op.kind !== 'alternatives' &&
                !connects(line, draft.points[i], draft.points[i + 1])) ||
            distanceKm(line) <= 0 ||
            line.slice(1).some((p, j) => samePoint(p, line[j]))
        ) {
            setNotice(
                'Correct this path so it connects both locations without repeated adjacent vertices.',
            );

            return;
        }

        if (op.kind !== 'alternatives') {
            const repeated = draft.points.findIndex((location, j) =>
                line.some(
                    (p, k) =>
                        samePoint(p, location) &&
                        !(
                            (j === i && k === 0) ||
                            (j === i + 1 && k === line.length - 1)
                        ),
                ),
            );

            if (repeated >= 0) {
                setNotice(
                    `The trace crosses Location ${'ABC'[repeated]} again. Adjust or undo this tracing point before finishing.`,
                );

                return;
            }

            const total =
                line.length +
                draft.legs.reduce(
                    (n, leg, j) => n + (j === i ? 0 : leg.line.length),
                    0,
                ) -
                (draft.legs.length - 1);

            if (line.length > 1000 || total > 1000) {
                setNotice(
                    'This road exceeds the 1,000-point limit. Undo points or redraw with fewer points before finishing.',
                );

                return;
            }
        }

        remember();
        const next = structuredClone(current.current);

        if (op.kind === 'alternatives') {
            acceptAutomatic(next, i, line);
        } else {
            next.legs[i] = { line, manual: true, status: 'Complete' };
        }

        next.changed = true;
        apply(next);
        setOp(null);
        setNotice(
            next.legs[i].status === 'Complete'
                ? 'Road portion complete. Save to retain it.'
                : (next.legs[i].message ??
                      'Review this road connection before saving.'),
        );
    };
    const instruction =
        op?.kind === 'trace'
            ? `Click along the road. Finish Drawing connects to ${'ABC'[op.leg + 1]}.`
            : op?.kind === 'edit'
              ? op.line.length > 62
                  ? 'Click the path to choose a tracing point, then drag its handle.'
                  : 'Drag a tracing point to correct this portion. Other portions stay unchanged.'
              : op?.kind === 'alternatives'
                ? 'Review the alternative, then Apply or Cancel.'
                : placing
                  ? `Click the map to place Location ${'ABC'[draft.points.length] ?? 'C'}.`
                  : 'Select a road to inspect it, or review its information and length.';
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
                Cancel
            </Button>
            <Button type="button" className="jr-primary" onClick={finish}>
                {op.kind === 'trace'
                    ? 'Finish Drawing'
                    : op.kind === 'edit'
                      ? 'Finish Editing'
                      : 'Use This Route'}
            </Button>
        </div>
    );

    return (
        <div
            ref={workspaceRef}
            className={`jr-map-workspace ${hidden ? 'panel-hidden' : ''}`}
        >
            <div className="jr-map-stage">
                <div
                    ref={node}
                    className="jr-leaflet-map"
                    aria-label="Road coverage map"
                    tabIndex={0}
                />
                <div
                    className="jr-map-modebar"
                    role="group"
                    aria-label="Map editing modes"
                >
                    <button
                        type="button"
                        aria-pressed={!placing && op?.kind !== 'trace'}
                        onClick={() => {
                            if (op) {
                                setNotice(
                                    'Finish or cancel the current drawing first.',
                                );

                                return;
                            }

                            explicitPlacement.current = false;
                            setPlacing(false);
                            setDrawMenu(false);
                        }}
                    >
                        <MousePointer2 size={16} /> Select
                    </button>
                    <button
                        type="button"
                        aria-pressed={placing}
                        disabled={
                            disabled ||
                            !!op ||
                            !!confirmation ||
                            !!draft.legacy ||
                            draft.points.length >= 3
                        }
                        title={
                            draft.points.length >= 3
                                ? 'All three locations are placed'
                                : `Place Location ${'ABC'[draft.points.length]}`
                        }
                        onClick={activatePlacement}
                    >
                        <MapPinPlus size={16} /> Add Location
                    </button>
                    <div className="jr-draw-tool">
                        <button
                            id="jr-draw-tool"
                            type="button"
                            aria-pressed={op?.kind === 'trace'}
                            aria-expanded={drawMenu}
                            disabled={
                                disabled ||
                                !!op ||
                                !!confirmation ||
                                !draft.legs.length
                            }
                            onClick={() =>
                                drawMenu ? setDrawMenu(false) : start('trace')
                            }
                        >
                            <Pencil size={16} /> Draw
                        </button>
                        {drawMenu && (
                            <div
                                className="jr-draw-targets"
                                role="group"
                                aria-label="Choose road portion to draw"
                            >
                                <strong>
                                    Which road portion would you like to draw?
                                </strong>
                                {draft.legs.map((_, i) => (
                                    <button
                                        type="button"
                                        key={i}
                                        onClick={() => start('trace', i)}
                                    >
                                        <Pencil size={16} /> Draw{' '}
                                        {portionName(i)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {(undo || op) && op?.kind !== 'alternatives' && (
                        <button
                            type="button"
                            disabled={
                                !!confirmation ||
                                (op ? !op.undo.length : disabled)
                            }
                            onClick={() => {
                                if (op) {
                                    setOp({
                                        ...op,
                                        line: op.undo.at(-1)!,
                                        undo: op.undo.slice(0, -1),
                                        vertex: null,
                                    });

                                    return;
                                }

                                controllers.current.forEach((c) => c?.abort());
                                generations.current = generations.current.map(
                                    (x) => x + 1,
                                );
                                const previous = structuredClone(undo!);
                                previous.legs.forEach((leg) => {
                                    if (leg.status === 'Calculating route') {
                                        leg.status = 'Route unavailable';
                                        leg.message =
                                            'Previous routing was interrupted. Retry or draw manually.';
                                    }
                                });
                                apply(previous);
                                setUndo(null);
                                explicitPlacement.current = false;
                                setNotice('Last mapping change undone.');
                                clearSelection();
                                setPlacing(
                                    previous.points.length < 2 &&
                                        !previous.legacy,
                                );
                            }}
                        >
                            <Undo2 size={16} /> Undo
                        </button>
                    )}
                </div>
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
                            } catch {
                                setSearchNotice(
                                    'Place search is unavailable. Please try again later.',
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
                {op && (
                    <div
                        className="jr-map-floating-actions"
                        aria-label="Drawing controls"
                    >
                        <strong>
                            {portionName(op.leg)} ·{' '}
                            {op.kind === 'trace'
                                ? 'Drawing in progress'
                                : op.kind === 'edit'
                                  ? 'Editing path'
                                  : 'Other routes'}
                        </strong>
                        {op.kind === 'alternatives' && (
                            <div className="jr-route-options">
                                {op.choices.map((line, i) => (
                                    <button
                                        type="button"
                                        key={i}
                                        aria-pressed={op.line === line}
                                        onClick={() => setOp({ ...op, line })}
                                    >
                                        Route {i + 1} ·{' '}
                                        {distanceKm(line).toFixed(2)} km
                                    </button>
                                ))}
                            </div>
                        )}
                        {actions}
                    </div>
                )}
                {!op &&
                    selectedLocation !== null &&
                    anchor &&
                    draft.points[selectedLocation] && (
                        <div
                            className="jr-road-context jr-marker-context"
                            style={popupPosition}
                            role="group"
                            aria-label={`Location ${'ABC'[selectedLocation]} actions`}
                        >
                            <div className="jr-road-context-heading">
                                <strong>
                                    Location {'ABC'[selectedLocation]}
                                </strong>
                                <button
                                    type="button"
                                    aria-label="Dismiss location selection"
                                    onClick={clearSelection}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <button
                                type="button"
                                disabled={disabled}
                                className="jr-marker-remove"
                                onClick={() => requestRemoval(selectedLocation)}
                            >
                                <Trash2 size={16} /> Remove Location
                            </button>
                        </div>
                    )}
                {!op && selected !== null && anchor && draft.legs[selected] && (
                    <div
                        className="jr-road-context"
                        style={popupPosition}
                        role="group"
                        aria-label={`${portionName(selected)} road actions`}
                    >
                        <div className="jr-road-context-heading">
                            <strong>
                                {portionName(selected)} ·{' '}
                                {draft.legs[selected].status}
                            </strong>
                            <button
                                type="button"
                                aria-label="Dismiss road selection"
                                onClick={() => {
                                    setSelected(null);
                                    setAnchor(null);
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {draft.legs[selected].status === 'Complete' ? (
                            <>
                                {draft.legs[selected].manual ? (
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => start('edit')}
                                    >
                                        <Pencil size={16} /> Edit Path
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => {
                                            void route(selected, draft, true);
                                        }}
                                    >
                                        <Route size={16} /> Other Routes
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => start('trace')}
                                >
                                    <Pencil size={16} /> Redraw Road
                                </button>
                            </>
                        ) : draft.legs[selected].status !==
                          'Calculating route' ? (
                            <>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => {
                                        remember();
                                        void route(selected);
                                    }}
                                >
                                    <RotateCcw size={16} /> Retry Route
                                </button>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => start('trace')}
                                >
                                    <Pencil size={16} /> Draw Road
                                </button>
                            </>
                        ) : (
                            <p>Calculating this road portion…</p>
                        )}
                        {(draft.legs[selected].message || notice) && (
                            <p role="status">
                                {draft.legs[selected].message || notice}
                            </p>
                        )}
                    </div>
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
                    <h2>Road Mapping</h2>
                    <p className="jr-field-hint">
                        {draft.legacy
                            ? 'Saved alignment retained.'
                            : draft.points.length < 2
                              ? 'Place A, then B to map your road.'
                              : `${draft.points.length} locations · ${draft.legs.filter((x, i) => x.status === 'Complete' && op?.leg !== i).length} of ${draft.legs.length} portions complete`}
                    </p>
                    <div className="jr-map-location-list">
                        {(draft.points.length < 2
                            ? ['A', 'B']
                            : draft.points.map((_, i) => 'ABC'[i])
                        ).map((label, i) => (
                            <div key={label}>
                                <b>{label}</b>
                                <span>
                                    <button
                                        type="button"
                                        className="jr-location-label"
                                        aria-pressed={selectedLocation === i}
                                        disabled={
                                            !draft.points[i] ||
                                            !!op ||
                                            !!confirmation
                                        }
                                        onClick={() => markerClick(i, true)}
                                    >
                                        Location {label}
                                    </button>
                                    <small>
                                        {draft.points[i]
                                            ? 'Placed on map'
                                            : placing &&
                                                draft.points.length === i
                                              ? 'Click the map to place'
                                              : 'Not placed'}
                                    </small>
                                </span>
                                {draft.points[i] && (
                                    <details>
                                        <summary
                                            aria-label={`Coordinates for Location ${label}`}
                                            aria-disabled={
                                                !!op || !!confirmation
                                            }
                                            onClick={(event) => {
                                                if (op || confirmation) {
                                                    event.preventDefault();
                                                } else {
                                                    markerClick(i, true);
                                                }
                                            }}
                                        >
                                            Details
                                        </summary>
                                        <span>
                                            {draft.points[i][1].toFixed(6)},{' '}
                                            {draft.points[i][0].toFixed(6)}
                                        </span>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                    {draft.legacy && (
                        <>
                            <p className="jr-field-hint">
                                Original geography is unchanged. To edit it, use
                                its saved endpoints as locations.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={disabled}
                                onClick={() => {
                                    const line = draft.legacy!;
                                    remember();
                                    apply({
                                        ...draft,
                                        points: [line[0], line.at(-1)!],
                                        legs: [
                                            {
                                                line,
                                                manual: true,
                                                status: 'Complete',
                                            },
                                        ],
                                        legacy: null,
                                        changed: true,
                                    });
                                }}
                            >
                                Use saved endpoints
                            </Button>
                        </>
                    )}
                    <div className="jr-map-portions">
                        {draft.legs.map((leg, i) => (
                            <button
                                type="button"
                                key={i}
                                aria-pressed={selected === i}
                                disabled={!!op || !!confirmation}
                                onClick={() =>
                                    selectPortion(i, undefined, true)
                                }
                            >
                                <span>
                                    <strong>{portionName(i)}</strong>
                                    <small>
                                        {leg.line.length > 1
                                            ? `${distanceKm(leg.line).toFixed(2)} km · ${leg.manual ? 'Manual' : 'Automatic'}`
                                            : 'No alignment yet'}
                                    </small>
                                </span>
                                <span className="jr-portion-state">
                                    {op?.leg === i
                                        ? op.kind === 'trace'
                                            ? 'Drawing in progress'
                                            : 'Editing'
                                        : leg.status}
                                    {leg.status === 'Complete' &&
                                    op?.leg !== i ? (
                                        <Check size={14} />
                                    ) : (
                                        <ChevronRight size={14} />
                                    )}
                                </span>
                            </button>
                        ))}
                    </div>
                    {(draft.points.length > 0 || draft.legacy) && (
                        <button
                            type="button"
                            className="jr-start-over"
                            disabled={disabled || !!op || !!confirmation}
                            onClick={() => requestRemoval(null)}
                        >
                            Start Over
                        </button>
                    )}
                    {notice && (
                        <p className="jr-map-warning" role="status">
                            {notice}
                        </p>
                    )}
                    {draft.legs.map(
                        (leg, i) =>
                            leg.message && (
                                <p
                                    className="jr-map-warning"
                                    key={i}
                                    role="status"
                                >
                                    <strong>{portionName(i)}: </strong>
                                    {leg.message} Select this portion for
                                    recovery actions.
                                </p>
                            ),
                    )}
                </section>
                <section>{lengthFields}</section>
            </aside>
            <Dialog.Root
                open={!!confirmation}
                onOpenChange={(open) => {
                    if (!open) {
                        setConfirmation(null);
                    }
                }}
            >
                <Dialog.Portal container={portalContainer}>
                    <Dialog.Overlay className="jr-location-confirm-overlay" />
                    <Dialog.Content
                        className="jr-app jr-theme jr-delete-dialog jr-location-confirm"
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();
                            (confirmationReturnFocus.current?.isConnected
                                ? confirmationReturnFocus.current
                                : root.current?.querySelector<HTMLButtonElement>(
                                      '.jr-map-modebar button',
                                  )
                            )?.focus();
                        }}
                    >
                        <Dialog.Title>{confirmation?.title}</Dialog.Title>
                        <Dialog.Description>
                            {confirmation?.description}
                        </Dialog.Description>
                        <p className="jr-field-hint">
                            This changes the working map only. Save Road
                            Coverage is still required. You can undo this
                            mapping change.
                        </p>
                        <div className="jr-dialog-actions">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setConfirmation(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                className="jr-danger"
                                onClick={() => {
                                    if (confirmation) {
                                        removeWorkingLocations(
                                            confirmation.index,
                                        );
                                    }

                                    setConfirmation(null);
                                }}
                            >
                                {confirmation?.index === null
                                    ? 'Clear Locations'
                                    : 'Remove Location'}
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}

import {
    Check,
    Eye,
    EyeOff,
    Grip,
    LocateFixed,
    MapPinned,
    MousePointer2,
    PencilLine,
    Plus,
    Search,
    Trash2,
    Undo2,
    Upload,
} from 'lucide-react';
import {
    Map as MapLibreMap,
    Marker,
    NavigationControl,
    ScaleControl,
    setWorkerUrl,
} from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

import {
    DAVAO_DE_ORO_BOUNDS,
    DAVAO_DE_ORO_CENTER,
    insideDavaoDeOro,
} from '@/components/maintenance-projects/davao-de-oro-boundary';

// Municipal outlines are a *reference* overlay only; never used for authorization,
// LGU attribution, or storage. RoadCoverage remains exactly one GeoJSON LineString.
setWorkerUrl(mapWorkerUrl);

type Point = [number, number];
type ExistingRoad = { id: number; name: string; geometry: unknown };
type EditorMode = 'pan' | 'draw' | 'edit';
type SearchResult = {
    place_id: number;
    display_name: string;
    lon: string;
    lat: string;
};
type RegionGeometry = { type: string; coordinates: unknown };
type RegionFeature = {
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: RegionGeometry;
};
type RegionCollection = {
    type: 'FeatureCollection';
    features: RegionFeature[];
};
type Props = {
    roads: ExistingRoad[];
    draftPoints: Point[];
    draftLines: Point[][];
    selectedLguName?: string | null;
    onAppendPoint: (point: Point) => void;
    onReplacePoint: (index: number, point: Point) => void;
    onInsertPoint: (index: number, point: Point) => void;
    onRemovePoint: (index: number) => void;
    onUndo: () => void;
    onClear: () => void;
};

const SAVED = 'dd-road-trace-saved';
const TRACE = 'dd-road-trace-active';
const POINTS = 'dd-road-trace-vertices';
const VICINITY = 'dd-road-trace-vicinity';
const FILL_LAYER = 'dd-road-trace-vicinity-fill';
const BORDER_LAYER = 'dd-road-trace-vicinity-border';
const LABEL_LAYER = 'dd-road-trace-vicinity-label';
const TOWNS = [
    'Compostela',
    'Laak',
    'Mabini',
    'Maco',
    'Maragusan',
    'Mawab',
    'Monkayo',
    'Montevista',
    'Nabunturan',
    'New Bataan',
    'Pantukan',
] as const;
const COLORS = [
    '#f5c0a9',
    '#e2b7ad',
    '#b9d4e6',
    '#e4b8ab',
    '#c1b5db',
    '#f5d5a6',
    '#fbec9c',
    '#b6cef1',
    '#f1e2af',
    '#d6c7e6',
    '#c3dfa6',
];
const boundaryUrl =
    'https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/';
const empty = { type: 'FeatureCollection' as const, features: [] };
const bigButton =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d8e0ed] bg-white px-4 py-2.5 text-sm font-semibold text-[#263c56] shadow-sm transition hover:bg-[#f3f7fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-45';

function validPoint(value: unknown): value is Point {
    return (
        Array.isArray(value) &&
        value.length >= 2 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number' &&
        Number.isFinite(value[0]) &&
        Number.isFinite(value[1]) &&
        Math.abs(value[0]) <= 180 &&
        Math.abs(value[1]) <= 90
    );
}
function extractLines(value: unknown): Point[][] {
    if (typeof value === 'string') {
        try {
            return extractLines(JSON.parse(value));
        } catch {
            return [];
        }
    }

    if (!value || typeof value !== 'object') {
        return [];
    }

    const geo = value as Record<string, unknown>;

    if (geo.type === 'Feature') {
        return extractLines(geo.geometry);
    }

    if (geo.type === 'FeatureCollection' && Array.isArray(geo.features)) {
        return geo.features.flatMap(extractLines);
    }

    if (geo.type === 'GeometryCollection' && Array.isArray(geo.geometries)) {
        return geo.geometries.flatMap(extractLines);
    }

    if (
        geo.type === 'LineString' &&
        Array.isArray(geo.coordinates) &&
        geo.coordinates.every(validPoint)
    ) {
        return geo.coordinates.length >= 2
            ? [geo.coordinates.map((p) => [p[0], p[1]])]
            : [];
    }

    if (geo.type === 'MultiLineString' && Array.isArray(geo.coordinates)) {
        return geo.coordinates.flatMap((line) =>
            extractLines({ type: 'LineString', coordinates: line }),
        );
    }

    return [];
}
function lineCollection(lines: Point[][], names?: string[]) {
    return {
        type: 'FeatureCollection' as const,
        features: lines.map((line, index) => ({
            type: 'Feature' as const,
            properties: { name: names?.[index] ?? '' },
            geometry: { type: 'LineString' as const, coordinates: line },
        })),
    };
}
function normalized(value: string) {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z ]/g, '')
        .replace(/\s+/g, ' ');
}
function nameForFeature(feature: RegionFeature) {
    const value =
        feature.properties.shapeName ??
        feature.properties.name ??
        feature.properties.NAME_3 ??
        feature.properties.ADM3_EN;

    return typeof value === 'string' ? value : '';
}
function geometryBounds(
    value: unknown,
): [[number, number], [number, number]] | null {
    let count = 0;
    let minLng = Infinity,
        minLat = Infinity,
        maxLng = -Infinity,
        maxLat = -Infinity;
    const walk = (item: unknown): void => {
        if (validPoint(item)) {
            count++;
            minLng = Math.min(minLng, item[0]);
            maxLng = Math.max(maxLng, item[0]);
            minLat = Math.min(minLat, item[1]);
            maxLat = Math.max(maxLat, item[1]);

            return;
        }

        if (Array.isArray(item)) {
            item.forEach(walk);
        }
    };
    walk(value);

    return count
        ? [
              [minLng, minLat],
              [maxLng, maxLat],
          ]
        : null;
}
function municipalityFeatures(data: unknown): RegionCollection {
    if (!data || typeof data !== 'object') {
        throw new Error('Expected a municipality GeoJSON FeatureCollection.');
    }

    const collection = data as { type?: unknown; features?: unknown };

    if (
        collection.type !== 'FeatureCollection' ||
        !Array.isArray(collection.features)
    ) {
        throw new Error(
            'The selected file is not a GeoJSON FeatureCollection.',
        );
    }

    const chosen = new Set<string>();
    const features: RegionFeature[] = [];

    for (const value of collection.features) {
        if (!value || typeof value !== 'object') {
            continue;
        }

        const item = value as RegionFeature;

        if (
            item.type !== 'Feature' ||
            !item.properties ||
            !item.geometry ||
            !['Polygon', 'MultiPolygon'].includes(item.geometry.type)
        ) {
            continue;
        }

        const municipality = TOWNS.find(
            (name) => normalized(name) === normalized(nameForFeature(item)),
        );

        if (!municipality || chosen.has(municipality)) {
            continue;
        }

        const bounds = geometryBounds(item.geometry.coordinates);

        if (!bounds) {
            continue;
        }

        // A municipality name may occur in more than one Philippine province.
        const longitude = (bounds[0][0] + bounds[1][0]) / 2;
        const latitude = (bounds[0][1] + bounds[1][1]) / 2;

        if (
            longitude < 125.5 ||
            longitude > 126.5 ||
            latitude < 6.95 ||
            latitude > 8.2
        ) {
            continue;
        }

        const index = TOWNS.indexOf(municipality);
        features.push({
            type: 'Feature',
            geometry: item.geometry,
            properties: {
                municipality,
                shade: COLORS[index],
                sourceName: nameForFeature(item),
            },
        });
        chosen.add(municipality);
    }

    if (!features.length) {
        throw new Error(
            'No Davao de Oro municipality polygons were found in this dataset.',
        );
    }

    return { type: 'FeatureCollection', features };
}

export default function RoadTraceMap({
    roads,
    draftPoints,
    draftLines,
    selectedLguName,
    onAppendPoint,
    onReplacePoint,
    onInsertPoint,
    onRemovePoint,
    onUndo,
    onClear,
}: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const markers = useRef<Marker[]>([]);
    const actions = useRef({ onAppendPoint, onReplacePoint, onInsertPoint });
    const modeRef = useRef<EditorMode>('pan');
    const pointCountRef = useRef(draftPoints.length);
    const suppressClickUntil = useRef(0);
    const restoreFocusIndex = useRef<number | null>(null);
    const lastSearch = useRef(0);
    const [loaded, setLoaded] = useState(false);
    const [mapError, setMapError] = useState('');
    const [mode, setMode] = useState<EditorMode>('pan');
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [vicinityShown, setVicinityShown] = useState(false);
    const [vicinityData, setVicinityData] = useState<RegionCollection | null>(
        null,
    );
    const [vicinityBusy, setVicinityBusy] = useState(false);
    const [vicinityError, setVicinityError] = useState('');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searchBusy, setSearchBusy] = useState(false);
    const [searchError, setSearchError] = useState('');
    const saved = useMemo(() => {
        const lines: Point[][] = [],
            names: string[] = [];
        roads.forEach((road) =>
            extractLines(road.geometry).forEach((line) => {
                lines.push(line);
                names.push(road.name);
            }),
        );

        return lineCollection(lines, names);
    }, [roads]);
    const coloredVicinity = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: (vicinityData?.features ?? []).map((feature) => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    shade:
                        selectedLguName &&
                        normalized(selectedLguName) ===
                            normalized(String(feature.properties.municipality))
                            ? '#efb24a'
                            : feature.properties.shade,
                },
            })),
        }),
        [vicinityData, selectedLguName],
    );
    useEffect(() => {
        actions.current = { onAppendPoint, onReplacePoint, onInsertPoint };
        modeRef.current = mode;
        pointCountRef.current = draftPoints.length;
    }, [
        onAppendPoint,
        onReplacePoint,
        onInsertPoint,
        mode,
        draftPoints.length,
    ]);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        let disposed = false;
        const map = new MapLibreMap({
            container: containerRef.current,
            style: 'https://tiles.openfreemap.org/styles/liberty',
            center: DAVAO_DE_ORO_CENTER,
            zoom: 10,
            maxBounds: [
                [
                    DAVAO_DE_ORO_BOUNDS[0][0] - 0.08,
                    DAVAO_DE_ORO_BOUNDS[0][1] - 0.08,
                ],
                [
                    DAVAO_DE_ORO_BOUNDS[1][0] + 0.08,
                    DAVAO_DE_ORO_BOUNDS[1][1] + 0.08,
                ],
            ],
            attributionControl: {},
        });
        mapRef.current = map;
        map.addControl(new NavigationControl(), 'top-right');
        map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
        map.on('load', () => {
            if (disposed) {
                return;
            }

            try {
                map.addSource(VICINITY, { type: 'geojson', data: empty });
                map.addLayer({
                    id: FILL_LAYER,
                    type: 'fill',
                    source: VICINITY,
                    layout: { visibility: 'none' },
                    paint: {
                        'fill-color': ['get', 'shade'],
                        'fill-opacity': 0.42,
                    },
                });
                map.addLayer({
                    id: BORDER_LAYER,
                    type: 'line',
                    source: VICINITY,
                    layout: { visibility: 'none' },
                    paint: {
                        'line-color': '#42546b',
                        'line-width': 1.7,
                        'line-opacity': 0.9,
                    },
                });
                map.addLayer({
                    id: LABEL_LAYER,
                    type: 'symbol',
                    source: VICINITY,
                    layout: {
                        visibility: 'none',
                        'text-field': ['get', 'municipality'],
                        'text-size': 13,
                        'text-allow-overlap': false,
                    },
                    paint: {
                        'text-color': '#263447',
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 1.3,
                    },
                });
                map.addSource(SAVED, { type: 'geojson', data: empty });
                map.addSource(TRACE, { type: 'geojson', data: empty });
                map.addSource(POINTS, { type: 'geojson', data: empty });
                map.addLayer({
                    id: 'dd-road-saved-halo',
                    type: 'line',
                    source: SAVED,
                    paint: { 'line-color': '#fff', 'line-width': 8 },
                });
                map.addLayer({
                    id: 'dd-road-saved-lines',
                    type: 'line',
                    source: SAVED,
                    paint: {
                        'line-color': '#176caa',
                        'line-width': 4.5,
                        'line-opacity': 0.95,
                    },
                });
                map.addLayer({
                    id: 'dd-road-active-halo',
                    type: 'line',
                    source: TRACE,
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#fff', 'line-width': 13 },
                });
                map.addLayer({
                    id: 'dd-road-active-line',
                    type: 'line',
                    source: TRACE,
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': '#c55320', 'line-width': 7 },
                });
                map.addLayer({
                    id: 'dd-road-active-points',
                    type: 'circle',
                    source: POINTS,
                    paint: {
                        'circle-radius': 14,
                        'circle-color': '#b54c1f',
                        'circle-stroke-color': '#fff',
                        'circle-stroke-width': 3,
                    },
                });
                map.addLayer({
                    id: 'dd-road-active-numbers',
                    type: 'symbol',
                    source: POINTS,
                    layout: {
                        'text-field': ['to-string', ['get', 'order']],
                        'text-size': 14,
                    },
                    paint: { 'text-color': '#fff' },
                });
                setLoaded(true);
            } catch {
                setMapError(
                    'Map layers could not load. You can still paste or import road GeoJSON.',
                );
            }
        });
        map.on('error', () => {
            if (!disposed) {
                setMapError(
                    'Map tiles may be unavailable. Try your connection or import GeoJSON.',
                );
            }
        });
        map.on('click', (event) => {
            if (
                modeRef.current !== 'draw' ||
                Date.now() < suppressClickUntil.current
            ) {
                return;
            }

            const point: Point = [
                Number(event.lngLat.lng.toFixed(6)),
                Number(event.lngLat.lat.toFixed(6)),
            ];

            if (!insideDavaoDeOro(...point)) {
                setMapError(
                    'Choose a location inside the configured Davao de Oro mapping area.',
                );

                return;
            }

            if (pointCountRef.current >= 1000) {
                setMapError('The 1,000-point editor limit has been reached.');

                return;
            }

            setMapError('');
            actions.current.onAppendPoint(point);
        });

        return () => {
            disposed = true;
            markers.current.forEach((marker) => marker.remove());
            markers.current = [];
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!loaded) {
            return;
        }

        void (
            mapRef.current?.getSource(SAVED) as GeoJSONSource | undefined
        )?.setData(saved as never);
    }, [loaded, saved]);
    useEffect(() => {
        if (!loaded) {
            return;
        }

        void (
            mapRef.current?.getSource(TRACE) as GeoJSONSource | undefined
        )?.setData(lineCollection(draftLines) as never);
        void (
            mapRef.current?.getSource(POINTS) as GeoJSONSource | undefined
        )?.setData({
            type: 'FeatureCollection',
            features: draftPoints.map((point, index) => ({
                type: 'Feature',
                properties: { order: index + 1 },
                geometry: { type: 'Point', coordinates: point },
            })),
        } as never);
    }, [loaded, draftLines, draftPoints]);
    useEffect(() => {
        if (!loaded || !mapRef.current) {
            return;
        }

        void (
            mapRef.current.getSource(VICINITY) as GeoJSONSource | undefined
        )?.setData(coloredVicinity as never);

        for (const layer of [FILL_LAYER, BORDER_LAYER, LABEL_LAYER]) {
            mapRef.current.setLayoutProperty(
                layer,
                'visibility',
                vicinityShown ? 'visible' : 'none',
            );
        }
    }, [loaded, vicinityShown, coloredVicinity]);
    useEffect(() => {
        if (!loaded || !mapRef.current) {
            return;
        }

        if (mode === 'draw') {
            mapRef.current.doubleClickZoom.disable();
        } else {
            mapRef.current.doubleClickZoom.enable();
        }
    }, [loaded, mode]);
    useEffect(() => {
        const map = mapRef.current;
        markers.current.forEach((marker) => marker.remove());
        markers.current = [];

        if (!loaded || !map || mode !== 'edit') {
            return;
        }

        markers.current = draftPoints.map((point, index) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'dd-road-edit-marker';
            el.textContent = String(index + 1);
            el.title = `Drag point ${index + 1} to refine this road (arrow keys also work)`;
            el.style.cssText =
                'width:42px;height:42px;border-radius:9999px;background:#b84b19;color:white;border:4px solid white;box-shadow:0 3px 12px #0006;font-weight:800;font-size:16px;cursor:move;touch-action:none;';
            el.setAttribute(
                'aria-label',
                `Move or select road point ${index + 1}`,
            );
            el.setAttribute('aria-pressed', 'false');
            el.tabIndex = 0;
            el.addEventListener('click', (event) => {
                event.stopPropagation();
                suppressClickUntil.current = Date.now() + 350;
                setSelectedIndex(index);
            });
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedIndex(index);
                }

                const delta: Record<string, [number, number]> = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                };
                const move = delta[event.key];

                if (move) {
                    event.preventDefault();
                    event.stopPropagation();
                    const screen = map.project(point);
                    const shifted = map.unproject([
                        screen.x + move[0] * (event.shiftKey ? 10 : 3),
                        screen.y + move[1] * (event.shiftKey ? 10 : 3),
                    ]);
                    const next: Point = [
                        Number(shifted.lng.toFixed(6)),
                        Number(shifted.lat.toFixed(6)),
                    ];

                    if (insideDavaoDeOro(...next)) {
                        restoreFocusIndex.current = index;
                        actions.current.onReplacePoint(index, next);
                    }
                }
            });
            const marker = new Marker({
                element: el,
                draggable: true,
                anchor: 'center',
            })
                .setLngLat(point)
                .addTo(map);
            marker.on('dragstart', () => {
                suppressClickUntil.current = Date.now() + 3000;
                setSelectedIndex(index);
            });
            marker.on('dragend', () => {
                suppressClickUntil.current = Date.now() + 450;
                const position = marker.getLngLat();
                const next: Point = [
                    Number(position.lng.toFixed(6)),
                    Number(position.lat.toFixed(6)),
                ];

                if (insideDavaoDeOro(...next)) {
                    actions.current.onReplacePoint(index, next);
                    setMapError('');
                } else {
                    marker.setLngLat(point);
                    setMapError('That point is outside the mapping area.');
                }
            });

            return marker;
        });
        // Large, discoverable + handles make adding bends easier than carefully
        // re-tracing a full road. These remain one LineString when saved.
        draftPoints.slice(0, -1).forEach((start, index) => {
            const end = draftPoints[index + 1];
            const midpoint: Point = [
                Number(((start[0] + end[0]) / 2).toFixed(6)),
                Number(((start[1] + end[1]) / 2).toFixed(6)),
            ];
            const el = document.createElement('button');
            el.type = 'button';
            el.textContent = '+';
            el.title = `Add a bend between point ${index + 1} and point ${index + 2}`;
            el.setAttribute('aria-label', el.title);
            el.style.cssText =
                'width:38px;height:38px;border-radius:9999px;background:#fff;color:#1c6183;border:3px solid #1c6183;box-shadow:0 2px 10px #0005;font-size:24px;line-height:28px;font-weight:bold;cursor:pointer;';
            el.addEventListener('click', (event) => {
                event.stopPropagation();
                suppressClickUntil.current = Date.now() + 350;
                actions.current.onInsertPoint(index + 1, midpoint);
                setSelectedIndex(index + 1);
            });
            markers.current.push(
                new Marker({ element: el, anchor: 'center' })
                    .setLngLat(midpoint)
                    .addTo(map),
            );
        });

        if (restoreFocusIndex.current !== null) {
            const index = restoreFocusIndex.current;
            restoreFocusIndex.current = null;
            markers.current[index]?.getElement().focus();
        }
    }, [loaded, mode, draftPoints]);
    useEffect(() => {
        markers.current
            .slice(0, draftPoints.length)
            .forEach((marker, index) => {
                marker
                    .getElement()
                    .setAttribute(
                        'aria-pressed',
                        String(index === selectedIndex),
                    );
            });
    }, [loaded, mode, draftPoints, selectedIndex]);

    if (selectedIndex !== null && selectedIndex >= draftPoints.length) {
        setSelectedIndex(null);
    }

    const focus = (points: Point[]) => {
        const map = mapRef.current;

        if (!map || !points.length) {
            return;
        }

        if (points.length === 1) {
            map.flyTo({ center: points[0], zoom: 15 });

            return;
        }

        const bounds = geometryBounds(points);

        if (bounds) {
            map.fitBounds(bounds, { padding: 65, maxZoom: 16 });
        }
    };
    const loadVicinity = async () => {
        if (vicinityData) {
            setVicinityShown(true);

            return;
        }

        setVicinityBusy(true);
        setVicinityError('');

        try {
            const metadataResponse = await fetch(boundaryUrl, {
                headers: { Accept: 'application/json' },
            });

            if (!metadataResponse.ok) {
                throw new Error(
                    'Municipal boundary directory could not be reached.',
                );
            }

            const metadata: unknown = await metadataResponse.json();
            const link = (metadata as { simplifiedGeometryGeoJSON?: unknown })
                ?.simplifiedGeometryGeoJSON;

            if (typeof link !== 'string' || !link.startsWith('https://')) {
                throw new Error('Municipality data URL was not provided.');
            }

            const boundariesResponse = await fetch(link, {
                headers: { Accept: 'application/json' },
            });

            if (!boundariesResponse.ok) {
                throw new Error(
                    'Municipality polygons could not be downloaded.',
                );
            }

            const dataset: unknown = await boundariesResponse.json();
            const collection = municipalityFeatures(dataset);
            setVicinityData(collection);
            setVicinityShown(true);

            if (collection.features.length < TOWNS.length) {
                setVicinityError(
                    `Loaded ${collection.features.length} of 11 municipal reference polygons. Some names may be missing from the map source.`,
                );
            }
        } catch (failure) {
            setVicinityError(
                failure instanceof Error
                    ? `${failure.message} Import a verified municipality GeoJSON file instead.`
                    : 'Municipality layer unavailable. Import GeoJSON instead.',
            );
            setVicinityShown(false);
        } finally {
            setVicinityBusy(false);
        }
    };
    const importVicinity = async (file: File | undefined) => {
        if (!file) {
            return;
        }

        if (file.size > 35 * 1024 * 1024) {
            setVicinityError('Choose a GeoJSON file below 35 MB.');

            return;
        }

        setVicinityBusy(true);
        setVicinityError('');

        try {
            const collection = municipalityFeatures(
                JSON.parse(await file.text()) as unknown,
            );
            setVicinityData(collection);
            setVicinityShown(true);

            if (collection.features.length < TOWNS.length) {
                setVicinityError(
                    `Imported ${collection.features.length} of 11 municipalities. Check boundary coverage before operational use.`,
                );
            }
        } catch (error) {
            setVicinityError(
                error instanceof Error
                    ? error.message
                    : 'The imported municipality GeoJSON is invalid.',
            );
        } finally {
            setVicinityBusy(false);
        }
    };
    const searchPlace = async () => {
        const term = query.trim();

        if (term.length < 3) {
            setSearchError('Enter at least three characters.');

            return;
        }

        if (Date.now() - lastSearch.current < 1200) {
            setSearchError('Please wait a moment before searching again.');

            return;
        }

        lastSearch.current = Date.now();
        setSearchBusy(true);
        setSearchError('');
        setResults([]);

        try {
            const params = new URLSearchParams({
                q: term,
                format: 'jsonv2',
                limit: '5',
                countrycodes: 'ph',
            });
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?${params}`,
                { headers: { Accept: 'application/json' } },
            );

            if (!response.ok) {
                throw new Error('Place search is temporarily unavailable.');
            }

            const rows: unknown = await response.json();

            if (!Array.isArray(rows)) {
                throw new Error('Place search returned an invalid response.');
            }

            const options = rows.filter(
                (item): item is SearchResult =>
                    item &&
                    typeof item === 'object' &&
                    typeof item.display_name === 'string' &&
                    typeof item.lon === 'string' &&
                    typeof item.lat === 'string' &&
                    typeof item.place_id === 'number',
            );
            setResults(options);

            if (!options.length) {
                setSearchError(
                    'No matching places. Try a nearby municipality or landmark.',
                );
            }
        } catch (e) {
            setSearchError(
                e instanceof Error ? e.message : 'Place search failed.',
            );
        } finally {
            setSearchBusy(false);
        }
    };
    const clearConfirmed = () => {
        if (
            draftPoints.length > 1 &&
            !window.confirm(
                `Clear all ${draftPoints.length} road points? This cannot be undone.`,
            )
        ) {
            return;
        }

        onClear();
        setSelectedIndex(null);
    };
    const insertMidpoint = (index: number) => {
        const one = draftPoints[index],
            two = draftPoints[index + 1];

        if (!one || !two) {
            return;
        }

        onInsertPoint(index + 1, [
            Number(((one[0] + two[0]) / 2).toFixed(6)),
            Number(((one[1] + two[1]) / 2).toFixed(6)),
        ]);
        setMode('edit');
        setSelectedIndex(index + 1);
    };

    return (
        <section
            className="overflow-hidden rounded-2xl border border-[#d4dfec] bg-white"
            aria-label="Accessible road tracing editor"
        >
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e1e8f1] bg-[#f6f8fb] px-4 py-3">
                <div className="flex items-center gap-2 font-bold text-[#263e59]">
                    <MapPinned className="h-5 w-5 text-[#aa4c1c]" /> Draw a Road
                    Coverage
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-[#526780]">
                    <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-800">
                        Blue = saved roads
                    </span>
                    <span className="rounded-full bg-orange-50 px-3 py-1 font-semibold text-orange-800">
                        Orange = new road
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">
                        {draftPoints.length} points
                    </span>
                </div>
            </header>
            <div className="border-b border-[#e5ebf1] bg-white p-4">
                <div className="mb-2 text-sm font-semibold text-slate-800">
                    1. Choose what you want to do
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                    {(
                        [
                            {
                                value: 'pan',
                                title: 'Move map',
                                tip: 'Drag to find your road',
                                icon: Grip,
                            },
                            {
                                value: 'draw',
                                title: 'Draw road',
                                tip: 'Click the road to add points',
                                icon: PencilLine,
                            },
                            {
                                value: 'edit',
                                title: 'Adjust points',
                                tip: 'Drag numbered markers',
                                icon: MousePointer2,
                            },
                        ] as const
                    ).map(({ value, title, tip, icon: Icon }) => (
                        <button
                            type="button"
                            key={value}
                            aria-pressed={mode === value}
                            onClick={() => setMode(value)}
                            className={`min-h-[66px] rounded-xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${mode === value ? 'border-orange-500 bg-[#fff1e4] text-[#853910] ring-2 ring-orange-200' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                            <span className="flex items-center gap-2 text-sm font-bold">
                                <Icon className="h-5 w-5" />
                                {title}
                                {mode === value && (
                                    <Check className="ml-auto h-4 w-4" />
                                )}
                            </span>
                            <span className="mt-1 block text-xs">{tip}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex flex-wrap gap-2 border-b border-[#e5ebf1] px-4 py-3">
                <label className="min-w-[210px] flex-1">
                    <span className="mb-1 block text-sm font-semibold text-slate-700">
                        2. Find a place (optional)
                    </span>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void searchPlace();
                            }
                        }}
                        placeholder="Search municipality, road, or landmark…"
                        className="min-h-12 w-full rounded-xl border border-[#d4dfed] px-4 text-base outline-none focus:border-orange-500"
                    />
                </label>
                <button
                    type="button"
                    onClick={() => {
                        void searchPlace();
                    }}
                    disabled={searchBusy}
                    className={`${bigButton} self-end`}
                >
                    <Search className="h-5 w-5" />
                    {searchBusy ? 'Searching…' : 'Search'}
                </button>
            </div>
            {results.length > 0 && (
                <div
                    className="max-h-48 overflow-auto border-b border-slate-200 p-3"
                    role="group"
                    aria-label="Place search results"
                >
                    {results.map((item) => (
                        <button
                            key={item.place_id}
                            type="button"
                            onClick={() => {
                                const p: Point = [
                                    Number(item.lon),
                                    Number(item.lat),
                                ];

                                if (!insideDavaoDeOro(...p)) {
                                    setSearchError(
                                        'This place is outside the configured Davao de Oro mapping area.',
                                    );

                                    return;
                                }

                                mapRef.current?.flyTo({ center: p, zoom: 15 });
                                setResults([]);
                                setSearchError('');
                                setMode('pan');
                            }}
                            className="block min-h-11 w-full rounded-xl px-3 py-2 text-left text-sm text-[#35536e] hover:bg-blue-50"
                        >
                            {item.display_name}
                        </button>
                    ))}
                </div>
            )}
            {searchError && (
                <p role="status" className="px-4 py-2 text-sm text-amber-800">
                    {searchError}
                </p>
            )}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[#f8fafc] px-4 py-3">
                <span className="mr-2 text-sm font-semibold text-slate-800">
                    3. Map tools
                </span>
                <button
                    type="button"
                    onClick={onUndo}
                    disabled={!draftPoints.length}
                    className={bigButton}
                >
                    <Undo2 className="h-5 w-5" />
                    Undo point
                </button>
                <button
                    type="button"
                    onClick={() => {
                        if (selectedIndex !== null) {
                            onRemovePoint(selectedIndex);
                            setSelectedIndex(null);
                        }
                    }}
                    disabled={selectedIndex === null}
                    className={bigButton}
                >
                    <Trash2 className="h-5 w-5" />
                    Delete selected
                </button>
                <button
                    type="button"
                    onClick={clearConfirmed}
                    disabled={!draftPoints.length}
                    className={bigButton}
                >
                    Clear all
                </button>
                <button
                    type="button"
                    onClick={() => focus(draftPoints)}
                    disabled={!draftPoints.length}
                    className={bigButton}
                >
                    <LocateFixed className="h-5 w-5" />
                    Focus trace
                </button>
                <button
                    type="button"
                    onClick={() =>
                        focus(
                            saved.features.flatMap(
                                (f) => f.geometry.coordinates,
                            ),
                        )
                    }
                    disabled={!saved.features.length}
                    className={bigButton}
                >
                    <Eye className="h-5 w-5" />
                    Saved roads
                </button>
                <button
                    type="button"
                    aria-pressed={vicinityShown}
                    disabled={vicinityBusy}
                    className={`${bigButton} ${vicinityShown ? 'border-orange-400 bg-orange-50' : ''}`}
                    onClick={() => {
                        if (vicinityShown) {
                            setVicinityShown(false);
                        } else {
                            void loadVicinity();
                        }
                    }}
                >
                    {vicinityShown ? (
                        <EyeOff className="h-5 w-5" />
                    ) : (
                        <MapPinned className="h-5 w-5" />
                    )}
                    {vicinityBusy
                        ? 'Loading vicinity…'
                        : vicinityShown
                          ? 'Hide vicinity'
                          : 'Show vicinity'}
                </button>
                <label
                    className={`${bigButton} cursor-pointer`}
                    title="Import municipal boundary GeoJSON as a reference layer"
                >
                    <Upload className="h-5 w-5" />
                    Import vicinity
                    <input
                        type="file"
                        accept=".json,.geojson,application/json,application/geo+json"
                        className="sr-only"
                        onChange={(e) => {
                            void importVicinity(e.target.files?.[0]);
                            e.currentTarget.value = '';
                        }}
                    />
                </label>
            </div>
            {vicinityError && (
                <p
                    role="status"
                    className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
                >
                    {vicinityError}
                </p>
            )}
            {vicinityShown && (
                <div className="border-b border-[#e3eaf2] bg-[#fffef9] px-4 py-3">
                    <div className="mb-2 text-sm font-bold text-slate-800">
                        Davao de Oro municipality vicinity (reference only)
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                        {TOWNS.map((town, index) => {
                            const available = vicinityData?.features.some(
                                (item) =>
                                    String(item.properties.municipality) ===
                                    town,
                            );

                            return (
                                <span
                                    key={town}
                                    className={`inline-flex items-center gap-1.5 text-xs ${available ? 'text-slate-700' : 'text-slate-400'}`}
                                >
                                    <span
                                        className="inline-block h-3 w-3 rounded-sm border border-slate-500/30"
                                        style={{ background: COLORS[index] }}
                                    />
                                    {town}
                                    {!available ? ' (not loaded)' : ''}
                                </span>
                            );
                        })}
                    </div>
                </div>
            )}
            <div className="relative">
                <div
                    ref={containerRef}
                    className={`h-[480px] w-full bg-[#edf1f6] sm:h-[550px] ${mode === 'draw' ? 'cursor-crosshair' : ''}`}
                    aria-label="Interactive road map. Choose Draw road to click and add points, or Adjust points to drag markers."
                />
                <div
                    className="pointer-events-none absolute bottom-8 left-3 max-w-[90%] rounded-xl bg-white/95 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-md"
                    role="status"
                    aria-live="polite"
                >
                    {mode === 'pan'
                        ? 'Move map: drag or zoom to find the road. Select Draw road to add points.'
                        : mode === 'draw'
                          ? `Drawing: click along the chosen route. ${draftPoints.length} point(s) added.`
                          : 'Adjust points: drag an orange number, or use arrow keys on a focused point.'}
                </div>
            </div>
            {mapError && (
                <p
                    role="status"
                    className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                    {mapError}
                </p>
            )}
            <div className="border-t border-slate-200 bg-[#f8fafc] px-4 py-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                        4. Your road points
                    </h3>
                    <span className="text-sm text-slate-500">
                        {draftPoints.length} recorded · 3 or more recommended
                        for turns
                    </span>
                </div>
                {draftPoints.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
                        Select <strong>Draw road</strong>, then click the road
                        on the map to create point 1. Click again for point 2,
                        and add point 3 or more for bends or intermediate
                        destinations.
                    </p>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {draftPoints.map((point, index) => (
                            <div
                                key={`${index}-${point.join('-')}`}
                                className={`rounded-xl border px-3 py-3 ${selectedIndex === index ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white'}`}
                            >
                                <button
                                    type="button"
                                    className="flex w-full items-center gap-2 text-left"
                                    onClick={() => {
                                        setSelectedIndex(index);
                                        setMode('edit');
                                        const map = mapRef.current;

                                        if (map) {
                                            map.flyTo({
                                                center: point,
                                                zoom: Math.max(
                                                    map.getZoom(),
                                                    14,
                                                ),
                                            });
                                        }
                                    }}
                                >
                                    <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#b84b19] font-bold text-white">
                                        {index + 1}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-slate-800">
                                            {index === 0
                                                ? 'Point 1'
                                                : index ===
                                                    draftPoints.length - 1
                                                  ? `Point ${index + 1}`
                                                  : `Intermediate point ${index + 1}`}
                                        </span>
                                        <span className="block text-xs text-slate-500">
                                            {point[1].toFixed(5)},{' '}
                                            {point[0].toFixed(5)}
                                        </span>
                                    </span>
                                </button>
                                {index < draftPoints.length - 1 && (
                                    <button
                                        type="button"
                                        className="mt-2 flex min-h-10 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        onClick={() => insertMidpoint(index)}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add bend after point {index + 1}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <p className="px-4 pt-2 pb-4 text-xs leading-relaxed text-[#627a91]">
                Map: OpenFreeMap / © OpenStreetMap contributors. Vicinity
                boundaries: geoBoundaries gbOpen / NAMRIA, PSA, OCHA reference
                dataset (2020 boundaries; not cadastral). Search: OpenStreetMap
                Nominatim (manual only). Tracing uses straight segments between
                user-chosen points; no automatic routing, street snapping, or
                survey certification.
            </p>
        </section>
    );
}

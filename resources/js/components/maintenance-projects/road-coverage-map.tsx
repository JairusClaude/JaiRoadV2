import {
    Crosshair,
    Expand,
    Layers3,
    MapPin,
    Minimize2,
    Route,
    X,
} from 'lucide-react';
import {
    Map as MapLibreMap,
    Marker,
    NavigationControl,
    Popup,
    ScaleControl,
    setWorkerUrl,
} from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../../../css/jairoads-road-map.css';
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { CoverageChoice } from '@/types/maintenance-projects';
import {
    DAVAO_DE_ORO_BOUNDS,
    DAVAO_DE_ORO_CENTER,
    insideDavaoDeOro,
} from './davao-de-oro-boundary';

// MapLibre + OpenFreeMap. Tiles are fetched by the browser; no Supabase or map API key.
setWorkerUrl(mapWorkerUrl);

const STYLE_URLS = {
    street: 'https://tiles.openfreemap.org/styles/liberty',
    clean: 'https://tiles.openfreemap.org/styles/positron',
} as const;
type MapStyle = keyof typeof STYLE_URLS;
const SOURCE_ID = 'jairoads-covered-roads';
const LINE_LAYER = 'jairoads-covered-road-lines';
const HALO_LAYER = 'jairoads-covered-road-halo';
const MAP_LOCK_BOUNDS: [[number, number], [number, number]] = [
    [DAVAO_DE_ORO_BOUNDS[0][0] - 0.08, DAVAO_DE_ORO_BOUNDS[0][1] - 0.08],
    [DAVAO_DE_ORO_BOUNDS[1][0] + 0.08, DAVAO_DE_ORO_BOUNDS[1][1] + 0.08],
];

type LineGeometry = {
    type: 'LineString' | 'MultiLineString';
    coordinates: number[][] | number[][][];
};
type RoadFeature = {
    type: 'Feature';
    geometry: LineGeometry;
    properties: {
        coverageId: number;
        roadName: string;
        municipality: string;
        assigned: boolean;
        selected: boolean;
    };
};
type RoadCollection = {
    type: 'FeatureCollection';
    features: RoadFeature[];
};

function validPair(value: unknown): value is [number, number] {
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

function extractLines(geometry: unknown): LineGeometry[] {
    if (typeof geometry === 'string') {
        try {
            return extractLines(JSON.parse(geometry));
        } catch {
            return [];
        }
    }

    if (!geometry || typeof geometry !== 'object') {
        return [];
    }

    const value = geometry as Record<string, unknown>;

    if (value.type === 'Feature') {
        return extractLines(value.geometry);
    }

    if (value.type === 'FeatureCollection' && Array.isArray(value.features)) {
        return value.features.flatMap(extractLines);
    }

    if (
        value.type === 'GeometryCollection' &&
        Array.isArray(value.geometries)
    ) {
        return value.geometries.flatMap(extractLines);
    }

    if (value.type === 'LineString' && Array.isArray(value.coordinates)) {
        const pairs = value.coordinates
            .filter(validPair)
            .map((point) => [point[0], point[1]]);

        return pairs.length >= 2
            ? [{ type: 'LineString', coordinates: pairs }]
            : [];
    }

    if (value.type === 'MultiLineString' && Array.isArray(value.coordinates)) {
        const parts = value.coordinates
            .filter(Array.isArray)
            .map((segment: unknown[]) =>
                segment.filter(validPair).map((point) => [point[0], point[1]]),
            )
            .filter((segment: number[][]) => segment.length >= 2);

        return parts.length
            ? [{ type: 'MultiLineString', coordinates: parts }]
            : [];
    }

    return [];
}

function featuresFor(
    coverages: CoverageChoice[],
    selectedId: number | null,
): RoadCollection {
    return {
        type: 'FeatureCollection',
        features: coverages.flatMap((coverage) =>
            extractLines(coverage.geojson).map((geometry) => ({
                type: 'Feature' as const,
                geometry,
                properties: {
                    coverageId: coverage.id,
                    roadName: coverage.road_name,
                    municipality:
                        coverage.municipality ?? 'Unknown municipality',
                    assigned: coverage.assigned,
                    selected: coverage.id === selectedId,
                },
            })),
        ),
    };
}

function boundsFor(
    features: RoadFeature[],
): [[number, number], [number, number]] | null {
    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;

    for (const feature of features) {
        const segments =
            feature.geometry.type === 'LineString'
                ? [feature.geometry.coordinates as number[][]]
                : (feature.geometry.coordinates as number[][][]);

        for (const segment of segments) {
            for (const [lng, lat] of segment) {
                west = Math.min(west, lng);
                east = Math.max(east, lng);
                south = Math.min(south, lat);
                north = Math.max(north, lat);
            }
        }
    }

    if (!Number.isFinite(west)) {
        return null;
    }

    // Avoid over-zooming for a very short or nearly point-like geometry.
    const longitudePad = west === east ? 0.002 : 0;
    const latitudePad = south === north ? 0.002 : 0;

    return [
        [west - longitudePad, south - latitudePad],
        [east + longitudePad, north + latitudePad],
    ];
}

// Municipality-center fallbacks are navigation references only, NOT road coordinates.
// Published municipal-center coordinates: https://www.philatlas.com/mindanao/r11/davao-de-oro/
// MapLibre coordinates use [longitude, latitude].
const MUNICIPALITY_CENTERS: Record<string, [number, number]> = {
    compostela: [126.0841, 7.6684],
    laak: [125.7895, 7.8179],
    mabini: [125.8534, 7.3084],
    maco: [125.8579, 7.3624],
    maragusan: [126.1257, 7.317],
    mawab: [125.9207, 7.5076],
    monkayo: [126.0565, 7.8324],
    montevista: [125.9884, 7.703],
    nabunturan: [125.9687, 7.6021],
    'new bataan': [126.1379, 7.5483],
    pantukan: [125.8972, 7.1314],
};

type CoveragePin = {
    position: [number, number];
    kind: 'road' | 'municipality';
    label: string;
};

function coveragePin(coverage: CoverageChoice | undefined): CoveragePin | null {
    if (!coverage) {
        return null;
    }

    const lines = extractLines(coverage.geojson);
    // For mapped roads, the pin sits ON a stored road vertex, not at an invented position.
    const segments = lines.flatMap((line) =>
        line.type === 'LineString'
            ? [line.coordinates as number[][]]
            : (line.coordinates as number[][][]),
    );
    const actualSegments = segments.filter((part) => part.length >= 2);
    const chosen = actualSegments.sort((a, b) => b.length - a.length)[0];

    if (chosen) {
        const midpoint = chosen[Math.floor(chosen.length / 2)];

        if (midpoint && insideDavaoDeOro(midpoint[0], midpoint[1])) {
            return {
                position: [midpoint[0], midpoint[1]],
                kind: 'road',
                label: coverage.road_name,
            };
        }
    }

    const municipality = coverage.municipality?.trim() ?? '';
    const key = municipality.toLocaleLowerCase().replace(/\s+/g, ' ');
    const point = MUNICIPALITY_CENTERS[key];

    if (!point || !insideDavaoDeOro(point[0], point[1])) {
        return null;
    }

    return { position: point, kind: 'municipality', label: municipality };
}

export function RoadCoverageMap({
    coverages,
    selectedId,
    onSelectCoverage,
    selectionDisabled = false,
}: {
    coverages: CoverageChoice[];
    selectedId: number | null;
    onSelectCoverage: (id: number) => void;
    selectionDisabled?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const selectedMarkerRef = useRef<Marker | null>(null);
    const selectRef = useRef(onSelectCoverage);
    const disabledRef = useRef(selectionDisabled);
    const coveragesRef = useRef(coverages);
    const featuresRef = useRef<RoadCollection>({
        type: 'FeatureCollection',
        features: [],
    });
    const [style, setStyle] = useState<MapStyle>('street');
    const [focus, setFocus] = useState(false);
    const [mapReady, setMapReady] = useState(false);
    const [mapError, setMapError] = useState('');
    const [roadsVisible, setRoadsVisible] = useState(true);
    const roadsVisibleRef = useRef(true);
    const selectedRef = useRef<number | null>(selectedId);
    const validCenterRef = useRef<[number, number]>(DAVAO_DE_ORO_CENTER);

    const features = useMemo(
        () => featuresFor(coverages, selectedId),
        [coverages, selectedId],
    );
    useLayoutEffect(() => {
        selectRef.current = onSelectCoverage;
        disabledRef.current = selectionDisabled;
        coveragesRef.current = coverages;
        selectedRef.current = selectedId;
        roadsVisibleRef.current = roadsVisible;
        featuresRef.current = features;
    }, [
        onSelectCoverage,
        selectionDisabled,
        coverages,
        selectedId,
        roadsVisible,
        features,
    ]);
    const mappedCount = useMemo(
        () =>
            coverages.filter((c) => extractLines(c.geojson).length > 0).length,
        [coverages],
    );
    const selectedCoverage = coverages.find(
        (coverage) => coverage.id === selectedId,
    );
    const selectedPin = useMemo(
        () => coveragePin(selectedCoverage),
        [selectedCoverage],
    );

    const fitProvince = useCallback(() => {
        const map = mapRef.current;

        if (!map) {
            return;
        }

        map.fitBounds(DAVAO_DE_ORO_BOUNDS, { padding: 28, duration: 550 });
    }, []);

    const fitRoads = useCallback(
        (onlySelected: boolean) => {
            const map = mapRef.current;

            if (!map) {
                return;
            }

            const candidates =
                onlySelected && selectedRef.current !== null
                    ? featuresRef.current.features.filter(
                          (f) =>
                              f.properties.coverageId === selectedRef.current,
                      )
                    : featuresRef.current.features;
            const bounds = boundsFor(candidates);

            if (bounds) {
                // Do not navigate outside the province to accommodate incorrect/out-of-area lines.
                const centerLng = (bounds[0][0] + bounds[1][0]) / 2;
                const centerLat = (bounds[0][1] + bounds[1][1]) / 2;

                if (insideDavaoDeOro(centerLng, centerLat)) {
                    map.fitBounds(bounds, {
                        padding: 54,
                        maxZoom: 16,
                        duration: 550,
                    });

                    return;
                }
            }

            // When a road has no stored line, go to its municipality center if known.
            if (onlySelected && selectedRef.current !== null) {
                const selected = coveragesRef.current.find(
                    (coverage) => coverage.id === selectedRef.current,
                );
                const pin = coveragePin(selected);

                if (pin) {
                    map.flyTo({
                        center: pin.position,
                        zoom: pin.kind === 'road' ? 15 : 12.7,
                        duration: 600,
                        essential: true,
                    });

                    return;
                }
            }

            fitProvince();
        },
        [fitProvince],
    );

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const map = new MapLibreMap({
            container: containerRef.current,
            style: STYLE_URLS.street,
            center: DAVAO_DE_ORO_CENTER,
            zoom: 9,
            maxBounds: MAP_LOCK_BOUNDS,
            attributionControl: {},
            cooperativeGestures: true,
        });
        mapRef.current = map;
        map.addControl(
            new NavigationControl({ visualizePitch: false }),
            'top-right',
        );
        map.addControl(
            new ScaleControl({ unit: 'metric', maxWidth: 110 }),
            'bottom-left',
        );

        const installRoadLayers = () => {
            // Styles are replaced when switching Streets/Light; reinstall road layers.
            // The province remains geographically locked with maxBounds + center checks,
            // but NO provincial shading or highlighted outline is drawn.
            if (!map.getSource(SOURCE_ID)) {
                map.addSource(SOURCE_ID, {
                    type: 'geojson',
                    data: featuresRef.current as never,
                });
            }

            if (!map.getLayer(HALO_LAYER)) {
                map.addLayer({
                    id: HALO_LAYER,
                    type: 'line',
                    source: SOURCE_ID,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round',
                        visibility: roadsVisibleRef.current
                            ? 'visible'
                            : 'none',
                    },
                    paint: {
                        'line-color': '#ffffff',
                        'line-width': 10,
                        'line-opacity': 0.92,
                    },
                });
            }

            if (!map.getLayer(LINE_LAYER)) {
                map.addLayer({
                    id: LINE_LAYER,
                    type: 'line',
                    source: SOURCE_ID,
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round',
                        visibility: roadsVisibleRef.current
                            ? 'visible'
                            : 'none',
                    },
                    paint: {
                        'line-color': [
                            'case',
                            ['get', 'selected'],
                            '#AA521B',
                            ['get', 'assigned'],
                            '#77869A',
                            '#167D69',
                        ],
                        'line-width': ['case', ['get', 'selected'], 7, 5],
                        'line-opacity': 0.96,
                    },
                });
            }

            setMapReady(true);
        };
        map.on('style.load', installRoadLayers);
        // Respect a preselected project road even on the first render.
        map.on('load', () => {
            if (selectedRef.current !== null) {
                fitRoads(true);
            } else {
                fitProvince();
            }
        });
        map.on('moveend', () => {
            const current = map.getCenter();

            if (insideDavaoDeOro(current.lng, current.lat)) {
                validCenterRef.current = [current.lng, current.lat];
            } else {
                // Bounds constrain the viewport, the polygon constrains its center.
                map.jumpTo({ center: validCenterRef.current });
            }
        });
        map.on('error', () => {
            if (!map.isStyleLoaded()) {
                setMapError(
                    'Map tiles could not load. Check internet access to tiles.openfreemap.org.',
                );
            }
        });
        map.on('click', LINE_LAYER, (event) => {
            const properties = event.features?.[0]?.properties;
            const id = Number(properties?.coverageId);

            if (
                !Number.isInteger(id) ||
                !insideDavaoDeOro(event.lngLat.lng, event.lngLat.lat)
            ) {
                return;
            }

            const chosen = coveragesRef.current.find(
                (coverage) => coverage.id === id,
            );

            if (!chosen) {
                return;
            }

            new Popup({ closeButton: true, maxWidth: '260px' })
                .setLngLat(event.lngLat)
                .setText(
                    chosen.assigned
                        ? `${chosen.road_name} — already assigned; view only.`
                        : disabledRef.current
                          ? `${chosen.road_name} — road preview only.`
                          : `${chosen.road_name} — selected for this project.`,
                )
                .addTo(map);

            if (!chosen.assigned && !disabledRef.current) {
                selectRef.current(id);
            }
        });
        map.on('mouseenter', LINE_LAYER, () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', LINE_LAYER, () => {
            map.getCanvas().style.cursor = '';
        });

        return () => {
            selectedMarkerRef.current?.remove();
            selectedMarkerRef.current = null;
            mapRef.current = null;
            map.remove();
        };
    }, [fitProvince, fitRoads]);

    useEffect(() => {
        const map = mapRef.current;

        if (!map) {
            return;
        }

        const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;

        if (source) {
            source.setData(features as never);
        }

        selectedMarkerRef.current?.remove();
        selectedMarkerRef.current = null;
        const selected = coveragesRef.current.find(
            (coverage) => coverage.id === selectedId,
        );
        const pin = coveragePin(selected);

        if (pin && selected) {
            const explanation =
                pin.kind === 'road'
                    ? `${selected.road_name} — pinned on its saved road line.`
                    : `${selected.road_name} — approximate ${pin.label} municipal center; exact road location has not been mapped.`;
            const marker = new Marker({ color: '#AA521B', anchor: 'bottom' })
                .setLngLat(pin.position)
                .setPopup(
                    new Popup({ offset: 22, maxWidth: '290px' }).setText(
                        explanation,
                    ),
                )
                .addTo(map);
            selectedMarkerRef.current = marker;
            marker.togglePopup();
        }

        if (selectedId !== null && map.isStyleLoaded()) {
            fitRoads(true);
        }
    }, [features, selectedId, fitRoads]);

    const activeStyleRef = useRef<MapStyle>('street');
    useEffect(() => {
        const map = mapRef.current;

        if (!map || activeStyleRef.current === style) {
            return;
        }

        activeStyleRef.current = style;
        setMapReady(false);
        map.setStyle(STYLE_URLS[style]);
    }, [style]);

    useEffect(() => {
        const map = mapRef.current;

        if (!map) {
            return;
        }

        for (const id of [LINE_LAYER, HALO_LAYER]) {
            if (map.getLayer(id)) {
                map.setLayoutProperty(
                    id,
                    'visibility',
                    roadsVisible ? 'visible' : 'none',
                );
            }
        }
    }, [roadsVisible, mapReady]);

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const observer = new ResizeObserver(() => mapRef.current?.resize());
        observer.observe(containerRef.current);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setFocus(false);
            }
        };

        if (focus) {
            window.addEventListener('keydown', onEscape);
        }

        return () => window.removeEventListener('keydown', onEscape);
    }, [focus]);

    return (
        <>
            {focus && (
                <button
                    type="button"
                    className="jr-road-map-backdrop"
                    aria-label="Close map focus view"
                    onClick={() => setFocus(false)}
                />
            )}
            <section
                className={`jr-road-map-panel${focus ? 'jr-road-map-panel--focus' : ''}`}
                aria-label="Interactive road coverage map"
            >
                <div className="jr-road-map-header">
                    <div className="jr-road-map-heading">
                        <MapPin size={17} />
                        <strong>Davao de Oro · Road coverage</strong>
                        <span className="jr-road-map-count">
                            {mappedCount} of {coverages.length} road lines
                        </span>
                        <span
                            className="jr-province-lock"
                            title="Map navigation remains restricted to the province. No boundary overlay is displayed."
                        >
                            Province locked
                        </span>
                    </div>
                    <div className="jr-road-map-actions">
                        <button
                            type="button"
                            onClick={() => fitRoads(true)}
                            disabled={selectedId === null || !selectedPin}
                            title={
                                selectedPin?.kind === 'municipality'
                                    ? 'Go to approximate municipal center'
                                    : 'Fit selected road'
                            }
                            aria-label="Locate selected road"
                        >
                            <Crosshair size={16} />
                            <span>Locate</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => fitRoads(false)}
                            title="View mapped roads within Davao de Oro"
                            aria-label="View mapped roads within Davao de Oro"
                        >
                            <Route size={16} />
                            <span>View all</span>
                        </button>
                        <button
                            type="button"
                            onClick={fitProvince}
                            title="Return to Davao de Oro province overview"
                            aria-label="Return to Davao de Oro province overview"
                        >
                            <Crosshair size={16} />
                            <span>Province</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFocus(!focus)}
                            title={
                                focus
                                    ? 'Exit focus view'
                                    : 'Widen map within JaiROADS'
                            }
                            aria-label={
                                focus
                                    ? 'Exit map focus view'
                                    : 'Widen map within JaiROADS'
                            }
                        >
                            {focus ? (
                                <Minimize2 size={16} />
                            ) : (
                                <Expand size={16} />
                            )}
                            <span>{focus ? 'Exit focus' : 'Focus view'}</span>
                        </button>
                    </div>
                </div>
                <div className="jr-road-map-toolbar">
                    <div className="jr-road-map-style">
                        <Layers3 size={15} />
                        <label htmlFor="jr-map-style">Map style</label>
                        <select
                            id="jr-map-style"
                            value={style}
                            onChange={(event) =>
                                setStyle(event.target.value as MapStyle)
                            }
                        >
                            <option value="street">Streets</option>
                            <option value="clean">Light</option>
                        </select>
                    </div>
                    <label className="jr-road-map-lines">
                        <input
                            type="checkbox"
                            checked={roadsVisible}
                            onChange={(event) =>
                                setRoadsVisible(event.target.checked)
                            }
                        />{' '}
                        Show road lines
                    </label>
                </div>
                <div
                    ref={containerRef}
                    className="jr-road-map-canvas"
                    role="application"
                    aria-label="Interactive OpenFreeMap road coverage map"
                />
                {!mapReady && !mapError && (
                    <div className="jr-road-map-loading" role="status">
                        Loading road map…
                    </div>
                )}
                {mapError && (
                    <div className="jr-road-map-warning" role="alert">
                        {mapError}
                    </div>
                )}
                <div className="jr-road-map-footer">
                    <div className="jr-road-map-legend">
                        <span>
                            <i className="jr-legend-selected" /> Selected
                        </span>
                        <span>
                            <i className="jr-legend-available" /> Available
                        </span>
                        <span>
                            <i className="jr-legend-assigned" /> Assigned
                        </span>
                    </div>
                    <small>
                        {selectedId !== null
                            ? selectedPin?.kind === 'road'
                                ? 'Pin placed on the saved road line. Ctrl+scroll to zoom.'
                                : selectedPin?.kind === 'municipality'
                                  ? `Approximate pin: ${selectedPin.label} municipal center — exact road geometry is not saved.`
                                  : 'No stored road line or recognized municipality location available.'
                            : 'Map is locked to Davao de Oro. Select a coverage to locate it. Ctrl+scroll to zoom.'}
                    </small>
                </div>
                {focus && (
                    <button
                        type="button"
                        className="jr-road-map-close"
                        onClick={() => setFocus(false)}
                        aria-label="Close expanded map"
                    >
                        <X size={17} />
                    </button>
                )}
            </section>
        </>
    );
}

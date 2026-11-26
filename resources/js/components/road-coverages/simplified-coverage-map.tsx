import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { savedRoadLines } from '@/lib/road-coverages/saved-lines';
import { RoadDetailsPanel } from './road-details-panel';
import 'leaflet/dist/leaflet.css';
import '../../../css/jairoads-road-map.css';

// Default province overview bounds (Davao de Oro)
const PROVINCE_BOUNDS: L.LatLngBoundsExpression = [
    [7.1, 125.65],
    [7.95, 126.35],
];

const ROAD_COLORS = {
    created: '#1d5db5',
    assigned: '#a94b0c',
    both: '#6d28d9',
    other: '#64748b',
} as const;

export type SimplifiedCoverageItem = {
    id: number;
    road_name: string;
    municipality?: string | null;
    lgu?: { id?: number; municipality_name?: string };
    assigned?: boolean;
    has_projects?: boolean;
    geojson: unknown;
    project_id?: number | null;
    project_title?: string | null;
    my_project?: boolean;
    created_by_me?: boolean;
    assigned_to_me?: boolean;
    my_record_count?: number;
};

export type SimplifiedCoverageMapProps = {
    coverages: SimplifiedCoverageItem[];
    className?: string;
    height?: number | string;
    engineerView?: boolean;
    viewerView?: boolean;
};

export function SimplifiedCoverageMap({
    coverages,
    className = '',
    height = 360,
    engineerView = false,
    viewerView = false,
}: SimplifiedCoverageMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const [mineOnly, setMineOnly] = useState(false);
    const [relationship, setRelationship] = useState<
        'all' | 'created' | 'assigned' | 'both'
    >('all');
    const dashboardView = engineerView || viewerView;
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const roadLayers = useRef<{ id: number; line: L.Polyline }[]>([]);

    const mappedCoverages = useMemo(() => {
        return coverages.map((coverage) => {
            const rawLines = savedRoadLines(coverage.geojson);
            const latLngLines: L.LatLngTuple[][] = rawLines.map((line) =>
                line.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
            );

            const municipality =
                coverage.municipality ??
                coverage.lgu?.municipality_name ??
                'Davao de Oro';
            const assigned =
                coverage.assigned === true || coverage.has_projects === true;

            return {
                id: coverage.id,
                name: coverage.road_name,
                municipality,
                assigned,
                projectId: coverage.project_id,
                projectTitle: coverage.project_title,
                mine:
                    coverage.created_by_me === true ||
                    coverage.assigned_to_me === true ||
                    coverage.my_project === true,
                created: coverage.created_by_me === true,
                managed:
                    coverage.assigned_to_me === true ||
                    (coverage.assigned_to_me === undefined &&
                        (coverage.my_record_count ?? 0) > 0),
                recordCount: coverage.my_record_count ?? 0,
                lines: latLngLines,
            };
        });
    }, [coverages]);

    const mappedCount = mappedCoverages.filter(
        (c) => c.lines.length > 0,
    ).length;
    const myMappedCount = mappedCoverages.filter(
        (c) => c.mine && c.lines.length > 0,
    ).length;
    const myProjectCount = mappedCoverages.filter((c) => c.mine).length;
    const createdCount = mappedCoverages.filter((c) => c.created).length;
    const assignedCount = mappedCoverages.filter((c) => c.managed).length;
    const bothCount = mappedCoverages.filter(
        (c) => c.created && c.managed,
    ).length;
    const myOnly = engineerView && mineOnly;
    const visibleCoverages = useMemo(
        () =>
            mappedCoverages.filter(
                (c) =>
                    (!myOnly || c.mine) &&
                    (!engineerView ||
                        relationship === 'all' ||
                        (relationship === 'created' && c.created) ||
                        (relationship === 'assigned' && c.managed) ||
                        (relationship === 'both' && c.created && c.managed)),
            ),
        [mappedCoverages, myOnly, engineerView, relationship],
    );

    const selected = dashboardView
        ? visibleCoverages.find((item) => item.id === selectedId)
        : undefined;

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        // Create Leaflet map instance (scrollWheelZoom enabled, clean read-only display)
        const map = L.map(containerRef.current, {
            scrollWheelZoom: true,
            zoomControl: true,
            attributionControl: true,
            // Prevent deferred Leaflet zoom/pan callbacks after SPA navigation.
            zoomAnimation: false,
            inertia: false,
        });
        mapRef.current = map;

        // Standard OpenStreetMap tile layer (identical to Road Coverage Details and Add pages)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        // Metric scale indicator in bottom-left
        L.control.scale({ imperial: false, maxWidth: 120 }).addTo(map);

        map.fitBounds(PROVINCE_BOUNDS, { animate: false });
        let resizeFrame = 0;
        const observer = new ResizeObserver(() => {
            if (mapRef.current !== map) {
                return;
            }

            if (resizeFrame) {
                cancelAnimationFrame(resizeFrame);
            }

            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;
                if (mapRef.current === map) {
                    map.invalidateSize({ pan: false });
                }
            });
        });
        observer.observe(containerRef.current);

        return () => {
            mapRef.current = null;
            observer.disconnect();

            if (resizeFrame) {
                cancelAnimationFrame(resizeFrame);
            }

            map.stop();
            map.remove();
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;

        if (!map) {
            return;
        }

        const roadGroup = L.featureGroup();
        roadLayers.current = [];

        // Draw background roads first so the engineer's highlighted roads stay on top.
        const ordered = engineerView
            ? [...visibleCoverages].sort(
                  (a, b) => Number(a.mine) - Number(b.mine),
              )
            : visibleCoverages;

        for (const item of ordered) {
            if (!item.lines.length) {
                continue;
            }

            // Use the canonical road brown (#843b12) from the Add Road Coverage editor and Details view
            const highlighted = engineerView && item.mine;
            const muted = engineerView && !item.mine;
            const category =
                item.created && item.managed
                    ? 'both'
                    : item.created
                      ? 'created'
                      : item.managed
                        ? 'assigned'
                        : 'other';
            const lineColor = engineerView
                ? ROAD_COLORS[category]
                : viewerView
                  ? '#1d5db5'
                  : '#843b12';

            for (const segment of item.lines) {
                // White halo background line for contrast and legibility
                L.polyline(segment, {
                    color: '#ffffff',
                    weight: highlighted ? 11 : muted ? 6 : 8,
                    opacity: muted ? 0.55 : 0.9,
                    smoothFactor: 0,
                    interactive: false,
                }).addTo(roadGroup);

                // Main colored road polyline matching Add Road Coverage page
                const line = L.polyline(segment, {
                    color: lineColor,
                    weight: highlighted ? 7 : muted ? 3 : 5,
                    opacity: muted ? 0.75 : 0.95,
                    className: engineerView
                        ? item.mine
                            ? 'jr-dashboard-road-mine jr-dashboard-road-' +
                              category
                            : 'jr-dashboard-road-other'
                        : 'jr-directory-road-line',
                    dashArray:
                        engineerView && category === 'created'
                            ? '12 5'
                            : engineerView && category === 'both'
                              ? '4 3'
                              : undefined,
                    smoothFactor: 0,
                    interactive: true,
                });

                if (dashboardView) {
                    line.on('click', () => setSelectedId(item.id));
                    roadLayers.current.push({ id: item.id, line });
                } else {
                    // Preserve the read-only popup for every other map.
                    const popup = document.createElement('div');
                    popup.className = 'jr-coverage-map-popup';
                    const title = document.createElement('strong');
                    title.textContent = item.name;
                    popup.append(title);
                    const detail = document.createElement('p');
                    detail.textContent = item.municipality;
                    popup.append(detail);

                    if (item.assigned) {
                        const status = document.createElement('p');
                        status.textContent = 'Linked to maintenance project';
                        popup.append(status);
                    }

                    line.bindPopup(popup, { closeButton: true });
                }

                line.addTo(roadGroup);
            }
        }

        roadGroup.addTo(map);

        // Auto-fit bounds to the road network or fall back to Davao de Oro province bounds
        if (roadGroup.getLayers().length > 0) {
            const bounds = roadGroup.getBounds();

            if (bounds.isValid()) {
                map.fitBounds(bounds.pad(0.08), { maxZoom: 15, animate: false });
            } else {
                map.fitBounds(PROVINCE_BOUNDS, { animate: false });
            }
        } else {
            map.fitBounds(PROVINCE_BOUNDS, { animate: false });
        }

        return () => {
            if (mapRef.current === map) {
                roadGroup.removeFrom(map);
            }

            roadLayers.current = [];
        };
    }, [visibleCoverages, engineerView, viewerView, dashboardView]);

    useEffect(() => {
        for (const { id, line } of roadLayers.current) {
            line.getElement()?.classList.toggle(
                'jr-dashboard-road-selected',
                id === selected?.id,
            );

            if (id === selected?.id) {
                line.bringToFront();
            }
        }
    }, [selected?.id, visibleCoverages]);

    return (
        <div className={`jr-road-map-panel w-full ${className}`}>
            <div className="jr-road-map-header">
                <div className="jr-road-map-heading">
                    <MapPin size={17} />
                    <strong>Davao de Oro · Road Coverage Map</strong>
                    <span className="jr-road-map-count">
                        {
                            visibleCoverages.filter((c) => c.lines.length > 0)
                                .length
                        }{' '}
                        mapped road line
                        {visibleCoverages.filter((c) => c.lines.length > 0)
                            .length === 1
                            ? ''
                            : 's'}
                    </span>
                </div>
                {engineerView && (
                    <label className="jr-engineer-map-toggle">
                        <input
                            type="checkbox"
                            role="switch"
                            checked={mineOnly}
                            onChange={(event) => {
                                setMineOnly(event.target.checked);

                                if (
                                    event.target.checked &&
                                    selected &&
                                    !selected.mine
                                ) {
                                    setSelectedId(null);
                                }
                            }}
                        />
                        My projects only
                    </label>
                )}
            </div>
            {dashboardView && (
                <div className="jr-road-map-toolbar">
                    <span role="status">
                        {engineerView
                            ? `${createdCount} created · ${assignedCount} assigned · ${bothCount} both (loaded roads)`
                            : `${mappedCount} mapped roads · Read-only access`}
                    </span>
                    {engineerView && (
                        <select
                            className="jr-road-inspect-select"
                            aria-label="Filter project relationship"
                            value={relationship}
                            onChange={(event) => {
                                setRelationship(
                                    event.target.value as typeof relationship,
                                );
                                setSelectedId(null);
                            }}
                        >
                            <option value="all">All relationships</option>
                            <option value="created">Created by me</option>
                            <option value="assigned">Assigned to me</option>
                            <option value="both">Created and assigned</option>
                        </select>
                    )}
                    <select
                        className="jr-road-inspect-select"
                        aria-label="Inspect a road"
                        value={selected?.id ?? ''}
                        onChange={(event) =>
                            setSelectedId(
                                event.target.value
                                    ? Number(event.target.value)
                                    : null,
                            )
                        }
                    >
                        <option value="">Inspect a road…</option>
                        {visibleCoverages
                            .filter((item) => item.lines.length > 0)
                            .map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name} · {item.municipality}
                                </option>
                            ))}
                    </select>
                </div>
            )}
            {engineerView && myMappedCount === 0 && (
                <p className="jr-engineer-map-empty" role="status">
                    {myProjectCount
                        ? 'Your created or assigned projects do not have valid mapped road lines among the loaded roads yet.'
                        : 'No created or assigned projects among the loaded roads yet.'}{' '}
                    {myOnly
                        ? 'Turn off My projects only to see all mapped roads.'
                        : ''}
                </p>
            )}

            <div
                className={
                    selected
                        ? 'jr-road-map-content jr-road-map-content--selected'
                        : 'jr-road-map-content'
                }
            >
                <div
                    ref={containerRef}
                    className="jr-road-map-canvas"
                    style={{ height, minHeight: 280 }}
                    role="application"
                    aria-label="Read-only Leaflet road coverage map"
                />
                {selected && (
                    <RoadDetailsPanel
                        key={selected.id}
                        roadId={selected.id}
                        name={selected.name}
                        municipality={selected.municipality}
                        height={height}
                        engineerView={engineerView}
                        onClose={() => setSelectedId(null)}
                    />
                )}
            </div>

            <div className="jr-road-map-footer">
                <div className="jr-road-map-legend">
                    {engineerView ? (
                        <>
                            <span>
                                <i
                                    style={{ background: ROAD_COLORS.created }}
                                />{' '}
                                Created by me (dashed)
                            </span>
                            <span>
                                <i
                                    style={{ background: ROAD_COLORS.assigned }}
                                />{' '}
                                Assigned to me (solid)
                            </span>
                            <span>
                                <i style={{ background: ROAD_COLORS.both }} />{' '}
                                Created and assigned (dotted)
                            </span>
                            {!myOnly && (
                                <span>
                                    <i
                                        style={{
                                            background: ROAD_COLORS.other,
                                        }}
                                    />{' '}
                                    Other roads
                                </span>
                            )}
                        </>
                    ) : (
                        <span>
                            <i
                                style={{
                                    background: viewerView
                                        ? '#1d5db5'
                                        : '#843b12',
                                }}
                            />{' '}
                            Road coverage
                        </span>
                    )}
                </div>
                <small>
                    {dashboardView
                        ? 'Select a road to inspect its connected maintenance data. Highlights do not grant editing permissions.'
                        : 'Clean, read-only Leaflet display map consistent with Add & Details pages.'}
                </small>
            </div>
        </div>
    );
}

export default SimplifiedCoverageMap;

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
    my_record_count?: number;
};

export type SimplifiedCoverageMapProps = {
    coverages: SimplifiedCoverageItem[];
    className?: string;
    height?: number | string;
    engineerView?: boolean;
};

export function SimplifiedCoverageMap({
    coverages,
    className = '',
    height = 360,
    engineerView = false,
}: SimplifiedCoverageMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const [mineOnly, setMineOnly] = useState(false);
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
                mine: coverage.my_project === true,
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
    const myOnly = engineerView && mineOnly;
    const visibleCoverages = useMemo(
        () => mappedCoverages.filter((c) => !myOnly || c.mine),
        [mappedCoverages, myOnly],
    );

    const selected = engineerView
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
        });
        mapRef.current = map;

        // Standard OpenStreetMap tile layer (identical to Road Coverage Details and Add pages)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        // Metric scale indicator in bottom-left
        L.control.scale({ imperial: false, maxWidth: 120 }).addTo(map);

        map.fitBounds(PROVINCE_BOUNDS);
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            map.remove();
            mapRef.current = null;
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
            const lineColor = muted ? '#64748b' : '#843b12';

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
                            ? 'jr-dashboard-road-mine'
                            : 'jr-dashboard-road-other'
                        : 'jr-directory-road-line',
                    smoothFactor: 0,
                    interactive: true,
                });

                if (engineerView) {
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
                map.fitBounds(bounds.pad(0.08), { maxZoom: 15 });
            } else {
                map.fitBounds(PROVINCE_BOUNDS);
            }
        } else {
            map.fitBounds(PROVINCE_BOUNDS);
        }

        return () => {
            roadGroup.removeFrom(map);
            roadLayers.current = [];
        };
    }, [visibleCoverages, engineerView]);

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
                        {myOnly ? myMappedCount : mappedCount} mapped road line
                        {(myOnly ? myMappedCount : mappedCount) === 1
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
            {engineerView && (
                <div className="jr-road-map-toolbar" role="status">
                    <span>
                        {myProjectCount} assigned project
                        {myProjectCount === 1 ? '' : 's'} · {myMappedCount}{' '}
                        mapped · {mappedCount - myMappedCount} other mapped
                        roads
                    </span>
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
                        ? 'Your assigned projects do not have valid mapped road lines yet.'
                        : 'No projects are assigned to you yet.'}{' '}
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
                        onClose={() => setSelectedId(null)}
                    />
                )}
            </div>

            <div className="jr-road-map-footer">
                <div className="jr-road-map-legend">
                    <span>
                        <i style={{ background: '#843b12' }} />{' '}
                        {engineerView ? 'My projects' : 'Road Coverage'}
                    </span>
                    {engineerView && !myOnly && (
                        <span>
                            <i style={{ background: '#64748b' }} /> Other roads
                        </span>
                    )}
                </div>
                <small>
                    {engineerView
                        ? 'Select a road to inspect its connected maintenance data.'
                        : 'Clean, read-only Leaflet display map consistent with Add & Details pages.'}
                </small>
            </div>
        </div>
    );
}

export default SimplifiedCoverageMap;

import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { savedRoadLines } from '@/lib/road-coverages/saved-lines';
import 'leaflet/dist/leaflet.css';
import '../../../css/jairoads-road-map.css';

// Default province overview bounds (Davao de Oro)
const PROVINCE_BOUNDS: L.LatLngBoundsExpression = [
    [7.10, 125.65],
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
};

export type SimplifiedCoverageMapProps = {
    coverages: SimplifiedCoverageItem[];
    className?: string;
    height?: number | string;
};

export function SimplifiedCoverageMap({
    coverages,
    className = '',
    height = 360,
}: SimplifiedCoverageMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

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
                lines: latLngLines,
            };
        });
    }, [coverages]);

    const mappedCount = useMemo(
        () => mappedCoverages.filter((c) => c.lines.length > 0).length,
        [mappedCoverages],
    );

    useEffect(() => {
        if (!containerRef.current) return;

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

        // Feature group for all rendered coverage lines
        const roadGroup = L.featureGroup();

        for (const item of mappedCoverages) {
            if (!item.lines.length) continue;

            // Use the canonical road brown (#843b12) from the Add Road Coverage editor and Details view
            const lineColor = '#843b12';

            for (const segment of item.lines) {
                // White halo background line for contrast and legibility
                L.polyline(segment, {
                    color: '#ffffff',
                    weight: 8,
                    opacity: 0.9,
                    smoothFactor: 0,
                    interactive: false,
                }).addTo(roadGroup);

                // Main colored road polyline matching Add Road Coverage page
                const line = L.polyline(segment, {
                    color: lineColor,
                    weight: 5,
                    opacity: 0.95,
                    smoothFactor: 0,
                    interactive: true,
                });

                // Read-only click popup with road and municipality details
                line.bindPopup(
                    `<div style="font-family: inherit; padding: 2px 4px; font-size: 13px; min-width: 170px;">
                        <strong style="color: #1e293b; font-size: 13px; display: block; margin-bottom: 2px;">${item.name}</strong>
                        <div style="color: #64748b; font-size: 12px;">${item.municipality}</div>
                        ${item.assigned ? '<div style="font-size: 11px; margin-top: 5px; font-weight: 500; color: #64748b;">Linked to maintenance project</div>' : ''}
                    </div>`,
                    { closeButton: true },
                );

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

        // Handle container resizing smoothly
        const observer = new ResizeObserver(() => {
            map.invalidateSize();
        });
        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
            map.remove();
            mapRef.current = null;
        };
    }, [mappedCoverages]);

    return (
        <div className={`jr-road-map-panel w-full ${className}`}>
            <div className="jr-road-map-header">
                <div className="jr-road-map-heading">
                    <MapPin size={17} />
                    <strong>Davao de Oro · Road Coverage Map</strong>
                    <span className="jr-road-map-count">
                        {mappedCount} mapped road line{mappedCount === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            <div
                ref={containerRef}
                className="jr-road-map-canvas"
                style={{ height, minHeight: 280 }}
                role="application"
                aria-label="Read-only Leaflet road coverage map"
            />

            <div className="jr-road-map-footer">
                <div className="jr-road-map-legend">
                    <span>
                        <i style={{ background: '#843b12' }} /> Road Coverage
                    </span>
                </div>
                <small>
                    Clean, read-only Leaflet display map consistent with Add & Details pages.
                </small>
            </div>
        </div>
    );
}

export default SimplifiedCoverageMap;

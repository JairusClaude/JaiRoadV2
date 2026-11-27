import L from 'leaflet';
import { Download, Map, Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { watchBasemap } from '@/lib/road-coverages/basemap';
import type { BasemapStatus } from '@/lib/road-coverages/basemap';
import { mappingData } from '@/lib/road-coverages/geometry.mjs';
import {
    savedLineMetrics,
    savedRoadLines,
} from '@/lib/road-coverages/saved-lines';
import 'leaflet/dist/leaflet.css';
import '../../../css/road-coverage-details.css';

// A display-only map: never initialize the editor, call routing, or change data.
export function CoverageMapPreview({ geojson }: { geojson: unknown | null }) {
    const parsed = useMemo(() => {
        if (typeof geojson === 'string') {
            try {
                return JSON.parse(geojson) as object;
            } catch {
                return null;
            }
        }

        return geojson && typeof geojson === 'object' ? geojson : null;
    }, [geojson]);
    const lines = useMemo(() => savedRoadLines(parsed), [parsed]);

    if (!lines.length) {
        return (
            <div className="jr-map-placeholder jr-detail-map jr-coverage-map-empty">
                <Map className="size-[18px]" aria-hidden="true" />
                <strong>Map preview unavailable</strong>
                <span>
                    This road coverage does not have valid geographical data
                    available for display.
                </span>
            </div>
        );
    }

    return <SavedCoverageMap geojson={parsed!} lines={lines} />;
}

function SavedCoverageMap({
    geojson,
    lines,
}: {
    geojson: object;
    lines: ReturnType<typeof savedRoadLines>;
}) {
    const container = useRef<HTMLDivElement>(null);
    const node = useRef<HTMLDivElement>(null);
    const [full, setFull] = useState(false);
    const [notice, setNotice] = useState('');
    const [basemap, setBasemap] = useState<BasemapStatus>('loading');
    const tileMonitor = useRef<ReturnType<typeof watchBasemap> | null>(null);

    useEffect(() => {
        if (!node.current || !lines.length) {
            return;
        }

        const map = L.map(node.current, {
            scrollWheelZoom: true,
            zoomAnimation: false,
            inertia: false,
        });
        const tiles = L.tileLayer(
            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors',
            },
        );
        const monitor = watchBasemap(tiles, setBasemap);
        tileMonitor.current = monitor;
        tiles.addTo(map);
        L.control.scale({ imperial: false }).addTo(map);
        L.polyline(
            lines.map((line) =>
                line.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
            ),
            {
                color: '#843b12',
                weight: 5,
                interactive: false,
                // Display every stored vertex, including at wider zoom levels.
                smoothFactor: 0,
                className: 'jr-saved-coverage-line',
            },
        ).addTo(map);
        // Show only verified saved waypoints. A legacy line needs no invented B/C.
        mappingData(geojson)?.points.forEach(([lng, lat], i) => {
            const label = String.fromCharCode(65 + i);
            L.marker([lat, lng], {
                draggable: false,
                keyboard: false,
                interactive: false,
                icon: L.divIcon({
                    className: 'jr-saved-location',
                    html: label,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14],
                }),
                title: `Location ${label}`,
            }).addTo(map);
        });
        map.fitBounds(
            L.latLngBounds(
                lines.flat().map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
            ),
            {
                padding: [35, 35],
                maxZoom: 17,
                animate: false,
            },
        );
        let disposed = false;
        const resize = new ResizeObserver(() => {
            if (!disposed) {
                map.invalidateSize({ pan: false });
            }
        });
        resize.observe(node.current);
        const fullscreen = () =>
            setFull(document.fullscreenElement === container.current);
        document.addEventListener('fullscreenchange', fullscreen);

        return () => {
            disposed = true;
            monitor.dispose();
            tileMonitor.current = null;
            resize.disconnect();
            document.removeEventListener('fullscreenchange', fullscreen);
            map.stop();
            map.remove();
        };
    }, [geojson, lines]);
    const metrics = useMemo(() => savedLineMetrics(lines), [lines]);

    return (
        <div className="jr-coverage-map-preview" ref={container}>
            <div
                ref={node}
                className="jr-saved-coverage-map"
                role="region"
                aria-label="Saved road coverage map. Use arrow keys to pan and plus or minus to zoom."
            />
            <button
                type="button"
                className="jr-map-geometry-download"
                aria-label="Download saved road geometry (GeoJSON)"
                title="Download GeoJSON"
                onClick={() => {
                    const geometry = {
                        type: 'MultiLineString',
                        coordinates: lines,
                    };
                    const url = URL.createObjectURL(
                        new Blob([JSON.stringify(geometry)], {
                            type: 'application/geo+json',
                        }),
                    );
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'jairoads-road-geometry.geojson';
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}
            >
                <Download size={18} aria-hidden="true" />
            </button>
            <button
                type="button"
                className="jr-map-fullscreen"
                aria-label={
                    full ? 'Exit fullscreen' : 'Fullscreen road coverage map'
                }
                onClick={async () => {
                    try {
                        if (document.fullscreenElement === container.current) {
                            await document.exitFullscreen();
                        } else {
                            await container.current?.requestFullscreen();
                        }
                    } catch {
                        setNotice('Fullscreen is unavailable in this browser.');
                    }
                }}
            >
                {full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <div
                className="jr-map-geometry-facts"
                aria-label="Saved geometry measurements"
            >
                Approx. {metrics.kilometers.toFixed(2)} km · {metrics.segments}{' '}
                line(s) · {metrics.vertices} vertices
            </div>
            {(notice || basemap === 'unavailable') && (
                <div className="jr-coverage-map-notice">
                    {notice && <p role="status">{notice}</p>}
                    {basemap === 'unavailable' && (
                        <>
                            <p role="status">
                                Background map unavailable. Saved road geometry
                                remains available.
                            </p>
                            <button
                                type="button"
                                className="font-semibold underline"
                                onClick={() => tileMonitor.current?.retry()}
                            >
                                Retry map tiles
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

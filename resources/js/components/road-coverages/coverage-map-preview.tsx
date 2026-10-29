import L from 'leaflet';
import { Map, Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    distanceKm,
    lineCoordinates,
    mappingData,
} from '@/lib/road-coverages/geometry.mjs';
import 'leaflet/dist/leaflet.css';

// A display-only map: never initialize the editor, call routing, or change data.
export function CoverageMapPreview({ geojson }: { geojson: object | null }) {
    const line = lineCoordinates(geojson);

    if (!line || distanceKm(line) <= 0) {
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

    return <SavedCoverageMap geojson={geojson!} />;
}

function SavedCoverageMap({ geojson }: { geojson: object }) {
    const container = useRef<HTMLDivElement>(null);
    const node = useRef<HTMLDivElement>(null);
    const [full, setFull] = useState(false);
    const [notice, setNotice] = useState('');

    useEffect(() => {
        const line = lineCoordinates(geojson);

        if (!node.current || !line) {
            return;
        }

        const map = L.map(node.current, { scrollWheelZoom: true });
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);
        L.control.scale({ imperial: false }).addTo(map);
        L.polyline(
            line.map(([lng, lat]) => [lat, lng]),
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
        map.fitBounds(L.latLngBounds(line.map(([lng, lat]) => [lat, lng])), {
            padding: [35, 35],
            maxZoom: 17,
            animate: false,
        });
        const resize = new ResizeObserver(() =>
            map.invalidateSize({ pan: false }),
        );
        resize.observe(node.current);
        const fullscreen = () =>
            setFull(document.fullscreenElement === container.current);
        document.addEventListener('fullscreenchange', fullscreen);

        return () => {
            resize.disconnect();
            document.removeEventListener('fullscreenchange', fullscreen);
            map.remove();
        };
    }, [geojson]);

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
            {notice && (
                <p className="jr-coverage-map-notice" role="status">
                    {notice}
                </p>
            )}
        </div>
    );
}

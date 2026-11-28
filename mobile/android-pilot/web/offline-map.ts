import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DAVAO_DE_ORO_RING } from '../../../resources/js/components/maintenance-projects/davao-de-oro-boundary';
import { savedRoadLines } from '../../../resources/js/lib/road-coverages/saved-lines';
import type { Row } from './queue';

let map: L.Map | undefined;
let group: L.FeatureGroup | undefined;
let currentInput: HTMLTextAreaElement | null = null;
let signature = '';

function parse(value: unknown) {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value) as unknown; } catch { return null; }
}

export function updateOfflineMap(container: HTMLElement, roads: Row[], coordinates: HTMLTextAreaElement | null) {
    currentInput = coordinates && !coordinates.readOnly ? coordinates : null;
    if (!map) {
        map = L.map(container, { attributionControl: true, zoomControl: true, maxZoom: 19, minZoom: 6 });
        map.attributionControl.setPrefix('Leaflet');
        map.attributionControl.addAttribution('Approximate provincial outline · Saved JaiROADS data');
        const boundary = L.polygon(DAVAO_DE_ORO_RING.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
            { color: '#94a3b8', weight: 1, fillColor: '#cbd5e1', fillOpacity: 0.12, interactive: false }).addTo(map);
        map.fitBounds(boundary.getBounds(), { padding: [15, 15], animate: false });
        L.control.scale({ imperial: false }).addTo(map);
        group = L.featureGroup().addTo(map);
        map.on('click', (event: L.LeafletMouseEvent) => {
            if (!currentInput) return;
            const point = event.latlng.lng.toFixed(6) + ', ' + event.latlng.lat.toFixed(6);
            currentInput.value = [currentInput.value.trim(), point].filter(Boolean).join('\n');
            currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
    requestAnimationFrame(() => map?.invalidateSize({ pan: false }));
    const next = JSON.stringify([roads.map((r) => [r.id, r.road_name, r.geojson]), currentInput?.value ?? '']);
    if (signature === next) return;
    signature = next;
    group!.clearLayers();
    const accent = getComputedStyle(container).getPropertyValue('--jr-role-accent').trim() || '#a94b0c';
    for (const road of roads) {
        for (const line of savedRoadLines(parse(road.geojson))) {
            const layer = L.polyline(line.map(([lng, lat]) => [lat, lng] as L.LatLngTuple), { color: accent, weight: 4 });
            const name = document.createElement('span');
            name.textContent = String(road.road_name ?? 'Road coverage');
            layer.bindPopup(name).addTo(group!);
        }
    }
    const points = (currentInput?.value ?? '').split('\n').map((line) => line.split(',').map((n) => Number(n.trim())))
        .filter((p) => p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 85)
        .map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
    if (points.length) {
        L.polyline(points, { color: '#2563eb', weight: 4, dashArray: '6 5' }).addTo(group!);
        for (const point of points) L.circleMarker(point, { radius: 5, color: '#2563eb' }).addTo(group!);
    }
}

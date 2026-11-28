import L from 'leaflet';
import { DAVAO_DE_ORO_RING } from '@/components/maintenance-projects/davao-de-oro-boundary';
import { androidWorkspace } from '@/lib/android-workspace-bridge';
import type { BasemapStatus } from '@/lib/road-coverages/basemap';
import {
    packedMapLayer,
    readyMapPacks,
    prepareOfflineMapPacks,
} from '@/lib/road-coverages/offline-map-packs';

export function attachFieldBasemap(
    map: L.Map,
    tiles: L.TileLayer,
    setStatus: (status: BasemapStatus) => void,
) {
    const bridge = androidWorkspace();

    if (!bridge) {
        return;
    }

    const boundary = L.polygon(
        DAVAO_DE_ORO_RING.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
        { color: '#94a3b8', weight: 1, fillOpacity: 0.08, interactive: false },
    );
    let layers: L.GridLayer[] = [];
    let control: L.Control.Layers | undefined;
    let offline = false;
    let sequence = 0;
    const clear = () => {
        control?.remove();
        control = undefined;

        for (const layer of layers) {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }

        layers = [];
    };
    const update = async () => {
        const next = bridge.status().offline;

        if (next === offline) {
            return;
        }

        offline = next;
        const token = ++sequence;

        if (!next) {
            clear();

            if (map.hasLayer(boundary)) {
                map.removeLayer(boundary);
            }

            if (!map.hasLayer(tiles)) {
                tiles.addTo(map);
            }

            void prepareOfflineMapPacks(() => !bridge.status().offline);

            return;
        }

        if (map.hasLayer(tiles)) {
            map.removeLayer(tiles);
        }

        if (!map.hasLayer(boundary)) {
            boundary.addTo(map);
            boundary.bringToBack();
        }

        const packs = await readyMapPacks();

        if (token !== sequence || !offline) {
            return;
        }

        clear();

        if (!packs.length) {
            setStatus('unavailable');

            return;
        }

        const choices: Record<string, L.Layer> = {
            'Saved road geometry': boundary,
        };

        for (const pack of packs) {
            const layer = packedMapLayer(pack);
            layers.push(layer);
            choices[
                pack.label.replace(
                    /[&<>"']/g,
                    (char) =>
                        ({
                            '&': '&amp;',
                            '<': '&lt;',
                            '>': '&gt;',
                            '"': '&quot;',
                            "'": '&#39;',
                        })[char] ?? char,
                )
            ] = layer;
        }

        if (map.hasLayer(boundary)) {
            map.removeLayer(boundary);
        }

        layers[0].addTo(map);
        control = L.control
            .layers(choices, {}, { position: 'topright' })
            .addTo(map);
        setStatus('ready');
    };
    const listener = () => void update();

    for (const event of ['jairoads-field-status', 'online', 'offline']) {
        window.addEventListener(event, listener);
    }

    if (bridge.status().offline) {
        offline = false;
        void update();
    } else {
        void prepareOfflineMapPacks(() => !bridge.status().offline);
    }

    map.once('unload', () => {
        sequence++;

        for (const event of ['jairoads-field-status', 'online', 'offline']) {
            window.removeEventListener(event, listener);
        }
    });
}

import L from 'leaflet';

const root = '/offline-maps/';
const metaPath = root + 'manifest.json';
const bundledRoot = '/jairoads-android-pilot/bundled-maps/';
const metaCache = 'jairoads-offline-map-index-v1';
const packPrefix = 'jairoads-offline-map-v1-';
const maxBytes = 512 * 1024 * 1024;
type Tile = { z: number; x: number; y: number; bytes: number; sha256: string };
export type MapPack = {
    id: string;
    version: string;
    label: string;
    attribution: string;
    format: 'png' | 'jpg' | 'webp';
    minZoom: number;
    maxZoom: number;
    tiles: Tile[];
};
const validName = (s: unknown): s is string =>
    typeof s === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(s);
const key = (pack: MapPack) => packPrefix + pack.id + '-' + pack.version;
function tilePath(pack: MapPack, tile: Pick<Tile, 'z' | 'x' | 'y'>) {
    return (
        root +
        pack.id +
        '/' +
        pack.version +
        '/' +
        tile.z +
        '/' +
        tile.x +
        '/' +
        tile.y +
        '.' +
        pack.format
    );
}
function validPack(value: unknown): value is MapPack {
    const p = value as MapPack;

    if (
        !p ||
        !validName(p.id) ||
        !validName(p.version) ||
        typeof p.label !== 'string' ||
        p.label.length > 60 ||
        typeof p.attribution !== 'string' ||
        !p.attribution.trim() ||
        p.attribution.length > 200 ||
        !['png', 'jpg', 'webp'].includes(p.format) ||
        !Number.isInteger(p.minZoom) ||
        !Number.isInteger(p.maxZoom) ||
        p.minZoom < 0 ||
        p.maxZoom > 19 ||
        p.minZoom > p.maxZoom ||
        !Array.isArray(p.tiles) ||
        !p.tiles.length ||
        p.tiles.length > 60000
    ) {
        return false;
    }

    const seen = new Set<string>();
    let size = 0;

    for (const t of p.tiles) {
        if (
            !t ||
            !Number.isInteger(t.z) ||
            t.z < p.minZoom ||
            t.z > p.maxZoom ||
            !Number.isInteger(t.x) ||
            !Number.isInteger(t.y) ||
            t.x < 0 ||
            t.y < 0 ||
            t.x >= 2 ** t.z ||
            t.y >= 2 ** t.z ||
            !Number.isInteger(t.bytes) ||
            t.bytes < 1 ||
            t.bytes > 1024 * 1024 ||
            !/^[0-9a-f]{64}$/.test(t.sha256)
        ) {
            return false;
        }

        const id = t.z + '/' + t.x + '/' + t.y;

        if (seen.has(id)) {
            return false;
        }

        seen.add(id);
        size += t.bytes;

        if (size > maxBytes) {
            return false;
        }
    }

    return true;
}
function manifest(value: unknown): MapPack[] {
    const packs = (value as { packs?: unknown })?.packs;

    if (
        !Array.isArray(packs) ||
        packs.length > 2 ||
        !packs.every(validPack) ||
        new Set(packs.map((p) => p.id)).size !== packs.length
    ) {
        return [];
    }

    return packs.reduce(
        (n, p) => n + p.tiles.reduce((sum, t) => sum + t.bytes, 0),
        0,
    ) <= maxBytes
        ? packs
        : [];
}
async function verified(response: Response, tile: Tile) {
    const blob = await response.blob();

    if (
        blob.size !== tile.bytes ||
        !/^image\/(png|jpeg|webp)$/.test(blob.type)
    ) {
        return false;
    }

    const bytes = await blob.arrayBuffer();
    const sha = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (b) => b.toString(16).padStart(2, '0'),
    ).join('');

    return sha === tile.sha256;
}
async function downloadedMapPacks(): Promise<MapPack[]> {
    if (!('caches' in window)) {
        return [];
    }

    try {
        const meta = await caches.open(metaCache);
        const saved = await meta.match(metaPath);

        return saved ? manifest(await saved.json()) : [];
    } catch {
        return [];
    }
}
let bundled: Promise<MapPack[]> | undefined;
function bundledMapPacks(): Promise<MapPack[]> {
    bundled ??= (async () => {
        try {
            const response = await fetch(bundledRoot + 'manifest.json', {
                credentials: 'omit',
                redirect: 'error',
                signal: AbortSignal.timeout(5000),
            });

            return response.ok ? manifest(await response.json()) : [];
        } catch {
            return [];
        }
    })();

    return bundled;
}

export async function readyMapPacks(): Promise<MapPack[]> {
    const installed = await bundledMapPacks();
    const downloaded = await downloadedMapPacks();
    const combined = [...installed];

    for (const pack of downloaded) {
        const index = combined.findIndex((entry) => entry.id === pack.id);

        if (index >= 0) {
            combined[index] = pack;
        } else {
            combined.push(pack);
        }
    }

    return combined.length <= 2 ? combined : installed;
}
let running: Promise<void> | undefined;
let lastAttempt = 0;
export function prepareOfflineMapPacks(connected: () => boolean) {
    if (running) {
        return running;
    }

    if (
        !connected() ||
        !('caches' in window) ||
        Date.now() - lastAttempt < 60_000
    ) {
        return Promise.resolve();
    }

    lastAttempt = Date.now();
    running = (async () => {
        try {
            const res = await fetch(metaPath, {
                cache: 'no-store',
                credentials: 'omit',
                redirect: 'error',
                signal: AbortSignal.timeout(20000),
            });

            if (
                !res.ok ||
                !res.headers.get('content-type')?.includes('application/json')
            ) {
                return;
            }

            const raw = await res.text();

            if (raw.length > 12 * 1024 * 1024) {
                return;
            }

            const packs = manifest(JSON.parse(raw));

            if (!packs.length) {
                return;
            }

            const old = await downloadedMapPacks();
            const complete = [...old];

            for (const pack of packs) {
                if (!connected()) {
                    return;
                }

                if (old.some((p) => key(p) === key(pack))) {
                    continue;
                }

                const cache = await caches.open(key(pack));

                for (const tile of pack.tiles) {
                    if (!connected()) {
                        return;
                    }

                    const path = tilePath(pack, tile);
                    const previous = await cache.match(path);

                    if (previous && (await verified(previous, tile))) {
                        continue;
                    }

                    const result = await fetch(path, {
                        credentials: 'omit',
                        redirect: 'error',
                        cache: 'no-store',
                        signal: AbortSignal.timeout(20000),
                    });

                    if (!result.ok || !(await verified(result.clone(), tile))) {
                        throw new Error(
                            'Map pack tile unavailable or changed.',
                        );
                    }

                    await cache.put(path, result);
                }

                const index = complete.findIndex((p) => p.id === pack.id);

                if (index >= 0) {
                    complete[index] = pack;
                } else {
                    complete.push(pack);
                }

                // Activation is atomic. Old complete versions stay usable until the replacement is ready.
                const meta = await caches.open(metaCache);
                await meta.put(
                    metaPath,
                    new Response(JSON.stringify({ packs: complete }), {
                        headers: { 'Content-Type': 'application/json' },
                    }),
                );

                for (const p of old.filter(
                    (p) => p.id === pack.id && key(p) !== key(pack),
                )) {
                    await caches.delete(key(p));
                }

                window.dispatchEvent(new Event('jairoads-map-packs-ready'));
            }
        } catch {
            /* Keep all previously completed packs and resume on a later online attempt. */
        }
    })().finally(() => {
        running = undefined;
    });

    return running;
}

const safe = (value: string) =>
    value.replace(
        /[&<>"']/g,
        (ch) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[ch] ?? ch,
    );
export function packedMapLayer(pack: MapPack): L.GridLayer {
    class PackedLayer extends L.GridLayer {
        protected createTile(coords: L.Coords, done: L.DoneCallback) {
            const tile = document.createElement('img');
            tile.alt = '';
            tile.style.background = '#e7e9eb';
            void (async () => {
                try {
                    const path = tilePath(pack, coords);
                    let response: Response | undefined;

                    if ('caches' in window) {
                        const cache = await caches.open(key(pack));
                        response = await cache.match(path);
                    }

                    if (
                        !response &&
                        (await bundledMapPacks()).some(
                            (entry) => key(entry) === key(pack),
                        )
                    ) {
                        const tileInfo = pack.tiles.find(
                            (entry) =>
                                entry.z === coords.z &&
                                entry.x === coords.x &&
                                entry.y === coords.y,
                        );

                        if (tileInfo) {
                            const candidate = await fetch(
                                bundledRoot + path.slice(root.length),
                                {
                                    credentials: 'omit',
                                    redirect: 'error',
                                },
                            );

                            if (
                                candidate.ok &&
                                (await verified(candidate.clone(), tileInfo))
                            ) {
                                response = candidate;
                            }
                        }
                    }

                    if (!response) {
                        done(undefined, tile);

                        return;
                    }

                    const url = URL.createObjectURL(await response.blob());
                    tile.onload = () => {
                        URL.revokeObjectURL(url);
                        done(undefined, tile);
                    };
                    tile.onerror = () => {
                        URL.revokeObjectURL(url);
                        done(undefined, tile);
                    };
                    tile.src = url;
                } catch {
                    done(undefined, tile);
                }
            })();

            return tile;
        }
    }

    return new PackedLayer({
        minNativeZoom: pack.minZoom,
        maxNativeZoom: pack.maxZoom,
        minZoom: 0,
        maxZoom: 19,
        noWrap: true,
        attribution: safe(pack.attribution),
    });
}

import type { Point } from './geometry.mjs';

/** Display projection only. Separate stored lines stay separate, with every vertex. */
export function savedRoadLines(value: unknown, depth = 0): Point[][] {
    if (!value || typeof value !== 'object' || depth > 12) {
        return [];
    }

    const geo = value as Record<string, unknown>;
    const line = (points: unknown): Point[] | null => {
        if (!Array.isArray(points) || points.length < 2) {
            return null;
        }

        if (
            !points.every(
                (p) =>
                    Array.isArray(p) &&
                    p.length >= 2 &&
                    p.every(
                        (n) => typeof n === 'number' && Number.isFinite(n),
                    ) &&
                    Math.abs(p[0]) <= 180 &&
                    Math.abs(p[1]) <= 90,
            )
        ) {
            return null;
        }

        return points.map((p) => [p[0], p[1]]);
    };

    if (geo.type === 'LineString') {
        const points = line(geo.coordinates);

        return points ? [points] : [];
    }

    if (geo.type === 'MultiLineString' && Array.isArray(geo.coordinates)) {
        const lines = geo.coordinates.map(line);

        return lines.every((l) => l !== null) ? lines : [];
    }

    if (geo.type === 'Feature') {
        return savedRoadLines(geo.geometry, depth + 1);
    }

    const children =
        geo.type === 'FeatureCollection'
            ? geo.features
            : geo.type === 'GeometryCollection'
              ? geo.geometries
              : null;

    if (!Array.isArray(children) || !children.length) {
        return [];
    }

    const lines = children.map((child) => savedRoadLines(child, depth + 1));

    return lines.every((l) => l.length > 0) ? lines.flat() : [];
}

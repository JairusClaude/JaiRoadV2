// Shared browser/preview geometry contract. GeoJSON coordinates are [longitude, latitude].
export const coordinate = (p) =>
    Array.isArray(p) &&
    p.length === 2 &&
    p.every(Number.isFinite) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 85.05112878;
export const samePoint = (a, b) =>
    coordinate(a) &&
    coordinate(b) &&
    Math.abs(a[0] - b[0]) < 1e-8 &&
    Math.abs(a[1] - b[1]) < 1e-8;
export function lineCoordinates(value) {
    const geometry = value?.type === 'Feature' ? value.geometry : value;
    const points =
        geometry?.type === 'LineString' ? geometry.coordinates : null;

    return Array.isArray(points) &&
        points.length >= 2 &&
        points.length <= 1000 &&
        points.every(coordinate)
        ? points
        : null;
}
export function distanceKm(points) {
    const rad = (x) => (x * Math.PI) / 180;

    return points.slice(1).reduce((sum, b, i) => {
        const a = points[i];
        const h =
            Math.sin(rad(b[1] - a[1]) / 2) ** 2 +
            Math.cos(rad(a[1])) *
                Math.cos(rad(b[1])) *
                Math.sin(rad(b[0] - a[0]) / 2) ** 2;

        return sum + 6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
    }, 0);
}
export function mappingData(value) {
    const line = lineCoordinates(value),
        metadata =
            value?.type === 'Feature'
                ? value.properties?.jairoads_mapping
                : null;

    if (
        !line ||
        metadata?.version !== 1 ||
        metadata.method !== 'manual' ||
        !Array.isArray(metadata.control_points) ||
        ![2, 3].includes(metadata.control_points.length) ||
        !metadata.control_points.every(coordinate)
    ) {
        return null;
    }

    const indices = metadata.control_point_indices;

    if (
        !Array.isArray(indices) ||
        indices.length !== metadata.control_points.length ||
        !indices.every(Number.isInteger) ||
        indices[0] !== 0 ||
        indices.at(-1) !== line.length - 1 ||
        indices.some((index, i) => i > 0 && index <= indices[i - 1]) ||
        !indices.every((index, i) =>
            samePoint(line[index], metadata.control_points[i]),
        )
    ) {
        return null;
    }

    if (
        metadata.control_points.some((point, i) =>
            metadata.control_points
                .slice(i + 1)
                .some((other) => samePoint(point, other)),
        )
    ) {
        return null;
    }

    if (
        metadata.control_points.some((point, i) =>
            line.some((p, j) => samePoint(p, point) && j !== indices[i]),
        )
    ) {
        return null;
    }

    if (
        line.slice(1).some((point, i) => samePoint(point, line[i])) ||
        distanceKm(line) <= 0
    ) {
        return null;
    }

    return {
        points: metadata.control_points,
        legs: indices.slice(1).map((end, i) => line.slice(indices[i], end + 1)),
    };
}
export function routeFeature(points, legs) {
    if (
        ![2, 3].includes(points.length) ||
        legs.length !== points.length - 1 ||
        legs.some((leg) => leg.length < 2)
    ) {
        return null;
    }

    const value = {
        type: 'Feature',
        properties: {
            jairoads_mapping: {
                version: 1,
                method: 'manual',
                control_points: points,
                control_point_indices: [
                    0,
                    ...legs.map((_, i) =>
                        legs
                            .slice(0, i + 1)
                            .reduce((n, leg) => n + leg.length - 1, 0),
                    ),
                ],
            },
        },
        geometry: {
            type: 'LineString',
            coordinates: legs.flatMap((leg, i) => (i ? leg.slice(1) : leg)),
        },
    };

    return mappingData(value) ? value : null;
}
export function validateCoverage(data, lgus, existing = null) {
    const errors = {};

    if (typeof data.road_name !== 'string' || !data.road_name.trim()) {
        errors.road_name = 'Road coverage name is required.';
    } else if (data.road_name.trim().length > 255) {
        errors.road_name = 'Use no more than 255 characters.';
    }

    if (!lgus.some((lgu) => String(lgu.id) === String(data.lgus_id))) {
        errors.lgus_id = 'Select a valid municipality.';
    }

    if (
        !['Concrete', 'Asphalt', 'Gravel', 'Earth'].includes(data.pavement_type)
    ) {
        errors.pavement_type = 'Select a pavement type.';
    }

    if (!['Good', 'Fair', 'Bad'].includes(data.state_category)) {
        errors.state_category = 'Select a road condition.';
    }

    const numeric =
        typeof data.kilometers === 'number'
            ? String(data.kilometers)
            : data.kilometers;

    if (
        typeof numeric !== 'string' ||
        !/^\d+(?:\.\d{1,2})?$/.test(numeric) ||
        Number(numeric) <= 0 ||
        Number(numeric) > 99999999.99
    ) {
        errors.kilometers =
            'Enter a positive length with up to two decimal places.';
    }

    // An unmigrated but valid legacy line may be retained unchanged for metadata edits.
    const retainLegacy =
        existing &&
        lineCoordinates(existing.geojson) &&
        !mappingData(existing.geojson) &&
        JSON.stringify(data.geojson) === JSON.stringify(existing.geojson);

    if (!mappingData(data.geojson) && !retainLegacy) {
        errors.geojson =
            'Place two or three distinct locations and complete each road portion before saving.';
    }

    return errors;
}

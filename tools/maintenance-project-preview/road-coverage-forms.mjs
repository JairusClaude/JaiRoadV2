import { createHash } from 'node:crypto';
import process from 'node:process';
import {
    lineCoordinates,
    validateCoverage,
} from '../../resources/js/lib/road-coverages/geometry.mjs';
export const canEditRoadCoverage = (actor) =>
    ['Admin', 'SuperAdmin'].includes(actor?.account_type); // Fail closed until active EngineerLGU assignments are provided.
const token = (value) =>
    createHash('sha256')
        .update(JSON.stringify(value ?? null))
        .digest('hex');
function returnTo(url) {
    const raw = url.searchParams.get('return_to');

    if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
        return '/road-coverages';
    }

    try {
        const result = new URL(raw, 'http://jairoads.local');
        const coverageId = url.pathname.match(
            /^\/road-coverages\/(\d+)(?:\/edit)?$/,
        )?.[1];

        return result.origin === 'http://jairoads.local' &&
            (result.pathname === '/road-coverages' ||
                (coverageId &&
                    result.pathname === `/road-coverages/${coverageId}`))
            ? result.pathname + result.search
            : '/road-coverages';
    } catch {
        return '/road-coverages';
    }
}
export function roadCoverageFormPage(url, records, lgus, actor) {
    const edit = url.pathname.match(/^\/road-coverages\/(\d+)\/edit$/);

    if (url.pathname !== '/road-coverages/create' && !edit) {
        return null;
    }

    const coverage = edit
        ? records.find((record) => record.id === Number(edit[1]))
        : null;

    if (edit && !coverage) {
        return null;
    }

    return {
        component: edit ? 'RoadCoverages/Edit' : 'RoadCoverages/Create',
        props: {
            coverage,
            municipalities: lgus,
            referenceCoverages: records.filter(
                (record) => record.id !== coverage?.id,
            ),
            canEdit: canEditRoadCoverage(actor),
            cancelUrl: returnTo(url),
            geometryToken: token(coverage?.geojson),
            mapServices: {
                routing:
                    process.env.JAIROADS_ROUTING_URL ??
                    'https://router.project-osrm.org/route/v1/driving',
                geocoding:
                    process.env.JAIROADS_GEOCODING_URL ??
                    'https://photon.komoot.io/api/',
            },
        },
    };
}
export function mutateRoadCoverage(
    method,
    url,
    data,
    records,
    lgus,
    actor,
    engineers,
) {
    const match = url.pathname.match(/^\/road-coverages\/(\d+)$/);

    if (
        !(method === 'POST' && url.pathname === '/road-coverages') &&
        !(method === 'PUT' && match)
    ) {
        return null;
    }

    const existing = match
        ? records.find((record) => record.id === Number(match[1]))
        : null;

    if (match && !existing) {
        return null;
    }

    const location = existing
        ? `/road-coverages/${existing.id}/edit${url.search}`
        : `/road-coverages/create${url.search}`;

    if (!canEditRoadCoverage(actor)) {
        return {
            errors: {
                road_name: 'You do not have permission to save road coverages.',
            },
            location,
        };
    }

    const changing = !existing || data.geometry_changed !== false;
    const candidate = {
        ...data,
        geojson: changing ? data.geojson : existing.geojson,
    };
    const errors = validateCoverage(candidate, lgus, existing);

    if (existing && changing && data.geometry_token !== token(existing.geojson)) {
errors.geojson =
            'This road geometry changed in another session. Your work is retained; compare the latest alignment before saving.';
}

    const geometryChanged =
        existing &&
        JSON.stringify(lineCoordinates(candidate.geojson)) !==
            JSON.stringify(lineCoordinates(existing.geojson));

    if (
        geometryChanged &&
        (!data.correction_reason?.trim() ||
            data.correction_reason.trim().length > 255)
    ) {
errors.correction_reason =
            'Enter a correction reason (1–255 characters).';
}

    if (!engineers.some((engineer) => engineer.id === 1)) {
        errors.road_name = 'A valid preview creator is required.';
    }

    if (Object.keys(errors).length) {
        return { errors, location };
    }

    const values = {
        road_name: data.road_name.trim(),
        lgus_id: Number(data.lgus_id),
        kilometers: Number(data.kilometers).toFixed(2),
        pavement_type: data.pavement_type,
        state_category: data.state_category,
        geojson: structuredClone(candidate.geojson),
        length_override: data.length_override === true,
    };
    const now = new Date().toISOString();

    if (existing) {
        Object.assign(existing, values, { updated_at: now });
    } else {
        records.push({
            id: Math.max(0, ...records.map((record) => record.id)) + 1,
            ...values,
            created_by: 1,
            created_at: now,
            updated_at: now,
        });
    }

    // ID, attribution and all external MaintenanceProject foreign keys are retained on edit.
    return { location: returnTo(url) };
}

// Same process-local records and foreign keys used by the directory and editor.
// This adapter does not route, mutate geometry, or simulate database persistence.
import { canEditRoadCoverage } from './road-coverage-forms.mjs';

export function roadCoverageDetailsPage(
    url,
    records,
    lgus,
    engineers,
    projects,
    actor,
) {
    const match = url.pathname.match(/^\/road-coverages\/(\d+)$/);

    if (!match) {
        return null;
    }

    const record = records.find((record) => record.id === Number(match[1]));

    if (!record) {
        return null;
    }

    const lgu = lgus.find((lgu) => lgu.id === record.lgus_id);
    const creator = engineers.find(
        (engineer) => engineer.id === record.created_by,
    );
    const project = projects.find(
        (project) => project.road_coverage_id === record.id,
    );
    // Only a directory URL may be used for the contextual back link.
    let backUrl = '/road-coverages';

    try {
        const origin = url.searchParams.get('return_to');
        const parsed =
            origin?.startsWith('/') && !origin.startsWith('//')
                ? new URL(origin, 'http://jairoads.local')
                : null;

        if (
            parsed?.origin === 'http://jairoads.local' &&
            parsed.pathname === '/road-coverages'
        ) {
            backUrl = parsed.pathname + parsed.search;
        }
    } catch {
        /* Retain the safe directory fallback. */
    }

    return {
        component: 'RoadCoverages/Show',
        props: {
            coverage: {
                ...record,
                lgu: lgu
                    ? { id: lgu.id, municipality_name: lgu.municipality_name }
                    : null,
            },
            createdByName: creator
                ? [creator.first_name, creator.middle_name, creator.last_name]
                      .filter(Boolean)
                      .join(' ') || null
                : null,
            associatedProject: project
                ? { id: project.id, project_title: project.project_title }
                : null,
            canEdit: canEditRoadCoverage(actor),
            backUrl,
        },
    };
}

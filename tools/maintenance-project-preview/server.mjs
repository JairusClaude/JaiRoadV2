import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
    documentsForRecord,
    documentPage,
    mutateDocument,
    serveDocument,
    pruneDocumentBytes,
    initializeDocumentPreview,
} from './documents.mjs';
import { createLguReviewContext } from './lgu-review-context.mjs';
import {
    initializeLguPreview,
    lguPage,
    mutateLgu,
    lguPreviewOptions,
} from './lgus.mjs';

import {
    pruneMediaBytes,
    servePreviewMedia,
    uploadBodyLimit,
    monthlyMediaPreview,
} from './media.mjs';
import {
    monthlyUpdatesForRecord,
    initializeMonthlyPreview,
    monthlyDirectoryData,
    monthlyDetailData,
    deleteMonthlyPreview,
    createMonthlyPreview,
} from './monthly-updates.mjs';
import {
    recordDirectoryData,
    recordDirectoryReturn,
} from './record-directory.mjs';
import {
    engineers,
    monthlyUpdates,
    records,
    recordSummaries,
    createPreviewRecord,
    deletePreviewRecords,
    dependentCounts,
} from './records.mjs';
import {
    initializeRoadCoveragePreview,
    roadCoverageDirectoryData,
} from './road-coverage-directory.mjs';
import {
    roadCoverageFormPage,
    mutateRoadCoverage,
} from './road-coverage-forms.mjs';

// Explicitly isolated UI fixtures. This server never invokes Laravel, SQL, or
// production authentication. Sample edits live only for this Node process.
const root = fileURLToPath(new URL('../../', import.meta.url));
const publicRoot = path.join(root, 'public');
let manifest;

try {
    manifest = JSON.parse(
        await readFile(path.join(publicRoot, 'build/manifest.json'), 'utf8'),
    );
} catch {
    console.error('Build with npm run build before starting this preview.');
    process.exit(1);
}

const samples = [
    ['Alegria – Panag – Camanlangan', 'New Bataan'],
    ['Nabunturan – Compostela', 'Nabunturan'],
    ['Montevista – New Visayas', 'Montevista'],
    ['Gabi – Compostela', 'Compostela'],
    ['Mawab – Sawangan', 'Mawab'],
    ['Andap – New Bataan', 'New Bataan'],
    ['Laak – San Isidro', 'Laak'],
    ['Pantukan – Kingking', 'Pantukan'],
    ['Poblacion – Nabunturan', 'Nabunturan'],
    ['Compostela – San Miguel', 'Compostela'],
    ['Montevista – New Dalaguete', 'Montevista'],
    ['Mawab – Bawani', 'Mawab'],
    ['New Bataan – San Roque', 'New Bataan'],
    ['Nabunturan – Mainit', 'Nabunturan'],
];
const municipalities = [...new Set(samples.map(([, name]) => name))].map(
    (name, index) => ({ id: index + 1, municipality_name: name }),
);
const coverages = samples.map(([road, municipality], index) => ({
    id: index + 1,
    road_name: road,
    municipality,
    kilometers: '4.20',
}));
coverages.push(
    {
        id: 201,
        road_name: 'Andap – Upper New Bataan',
        municipality: 'New Bataan',
        kilometers: '4.20',
    },
    {
        id: 202,
        road_name: 'Compostela – Gabi',
        municipality: 'Compostela',
        kilometers: '6.00',
    },
    {
        id: 203,
        road_name: 'Laak – Banbanon',
        municipality: 'Laak',
        kilometers: '3.25',
    },
);
const projects = samples.map(([road], index) => ({
    id: index + 101,
    project_title: `Project Maintenance ${road}`,
    road_coverage_id: index + 1,
    description: null,
    created_by: 'demoAdmin',
    created_at: '2026-10-01T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
}));
initializeLguPreview(municipalities);
const lguReviewContext = createLguReviewContext();
initializeRoadCoveragePreview(
    coverages,
    lguPreviewOptions(),
    engineers,
    lguReviewContext.relationships,
);
initializeMonthlyPreview();
await initializeDocumentPreview(projects);
let nextId = 115;
const sessions = new Map();
const demoCredentials = {
    email: 'demo@example.test',
    password: 'JaiROADS-Demo-2026!',
};
const shared = {
    auth: {
        user: {
            id: 1,
            name: 'demoAdmin',
            email: 'demo@example.test',
            email_verified_at: null,
            created_at: '',
            updated_at: '',
        },
    },
    name: 'JaiROADS',
    sidebarOpen: true,
    previewOnly: true,
};
function coverageChoices() {
    const lgus = lguPreviewOptions();

    return lguReviewContext.relationships.roadCoverages.map((c) => ({
        ...c,
        municipality:
            lgus.find((lgu) => lgu.id === c.lgus_id)?.municipality_name ?? null,
    }));
}
const summary = (project) => ({
    ...project,
    ...Object.fromEntries(
        ['road_name', 'municipality'].map((key) => [
            key,
            coverageChoices().find((c) => c.id === project.road_coverage_id)?.[
                key
            ] ?? null,
        ]),
    ),
    maintenance_records_count: records.filter(
        (r) => r.project_id === project.id,
    ).length,
    deletion_counts: dependentCounts(
        records
            .filter((record) => record.project_id === project.id)
            .map((record) => record.id),
    ),
    can_edit: true,
    can_delete: true,
});
function choices(currentId) {
    return coverageChoices().map((c) => ({
        ...c,
        assigned: projects.some(
            (p) => p.road_coverage_id === c.id && p.id !== currentId,
        ),
    }));
}
function pageFor(url, errors = {}, session = {}) {
    const pending = url.searchParams.get('pending') === '1';
    const integration = {
        ready: !pending,
        message: pending
            ? 'Project access requires a verified account link and approved database structure.'
            : null,
    };
    const match = url.pathname.match(
        /^\/maintenance-projects\/(\d+)(\/edit|\/records\/create|\/records\/\d+(?:\/edit)?)?$/,
    );
    let component = 'MaintenanceProjects/Index',
        props;

    const navigationPreview = url.pathname.match(
        /^\/maintenance-projects\/design-exploration(?:\/espresso)?\/navigation\/([a-z-]+)$/,
    );
    const navigationTitles = {
        dashboard: 'Dashboard',
        'user-accounts': 'User Management',
        'monthly-updates': 'Monthly Updates',
        'project-documents': 'Maintenance Documents',
        'maintenance-documents': 'Maintenance Documents',
        roads: 'Road Sections',
        lgus: 'LGU',
        settings: 'Settings',
        'maintenance-records': 'Maintenance Records',
    };
    const documentsPage = documentPage(url, projects, summary);
    const coverageForm = roadCoverageFormPage(
        url,
        lguReviewContext.relationships.roadCoverages,
        lguPreviewOptions(),
        lguReviewContext.actor,
    );

    if (url.pathname === '/login') {
        component = 'auth/login';
        props = {
            canResetPassword: false,
            demoEmail: demoCredentials.email,
            demoPassword: demoCredentials.password,
            oldEmail: session.oldEmail ?? '',
        };
    } else if (coverageForm) {
        component = coverageForm.component;
        props = coverageForm.props;
    } else if (url.pathname === '/road-coverages') {
        component = 'RoadCoverages/Index';
        props = {
            ...roadCoverageDirectoryData(
                lguReviewContext.relationships.roadCoverages,
                lguPreviewOptions(),
                url,
            ),
            canEdit: ['Admin', 'SuperAdmin', 'Engineer'].includes(
                lguReviewContext.actor.account_type,
            ),
        };
    } else if (url.pathname.startsWith('/lgus')) {
        const result = lguPage(
            url,
            lguReviewContext.relationships,
            lguReviewContext.actor,
        );

        if (!result) {
            return null;
        }

        component = result.component;
        props = result.props;
    } else if (url.pathname.startsWith('/maintenance-documents')) {
        if (!documentsPage) {
            return null;
        }

        component = documentsPage.component;
        props = documentsPage.props;
    } else if (navigationPreview) {
        const navigationSection = navigationPreview[1];
        const navigationTitle = navigationTitles[navigationSection];

        if (!navigationTitle) {
            return null;
        }

        component = 'MaintenanceProjects/NavigationPreview';
        props = { navigationSection, navigationTitle };
    } else if (url.pathname === '/maintenance-records') {
        component = 'MaintenanceRecords/Index';
        props = recordDirectoryData(projects, summary, url, integration);
    } else if (url.pathname === '/maintenance-records/create') {
        component = 'MaintenanceProjects/Records/Create';
        props = {
            projects: projects.map(summary),
            engineers,
            records: projects.flatMap((p) => recordSummaries(p.id)),
            cancelUrl: '/maintenance-records',
        };
    } else if (/^\/monthly-updates\/\d+\/edit$/.test(url.pathname)) {
        const id = Number(url.pathname.split('/')[2]);
        const detail = monthlyDetailData(
            projects,
            new URL(`/monthly-updates/${id}`, url),
        );

        if (!detail) {
            return null;
        }

        component = 'MonthlyUpdates/Edit';
        props = {
            projects: projects.map((item) => {
                const p = summary(item);

                return {
                    id: p.id,
                    project_title: p.project_title,
                    municipality: p.municipality,
                };
            }),
            records: records.map(({ id, project_id, year, quarter }) => ({
                id,
                project_id,
                year,
                quarter,
            })),
            existingUpdates: monthlyUpdates.map(
                ({ id, maintenance_id, update_month }) => ({
                    id,
                    maintenance_id,
                    update_month,
                }),
            ),
            contextRecordId: detail.update.maintenance_id,
            update: detail.update,
            media: monthlyMediaPreview(id),
            submitUrl: `/monthly-updates/${id}${url.search}`,
            cancelUrl: `/monthly-updates/${id}`,
        };
    } else if (url.pathname === '/monthly-updates/create') {
        const contextId = url.searchParams.get('record');
        const record = contextId
            ? records.find((item) => String(item.id) === contextId)
            : undefined;

        if (
            contextId &&
            (!record || !projects.some((item) => item.id === record.project_id))
        ) {
            return null;
        }

        const suffix = record ? `?record=${record.id}` : '';
        component = 'MonthlyUpdates/Create';
        props = {
            projects: projects.map((item) => {
                const p = summary(item);

                return {
                    id: p.id,
                    project_title: p.project_title,
                    municipality: p.municipality,
                };
            }),
            records: records.map(({ id, project_id, year, quarter }) => ({
                id,
                project_id,
                year,
                quarter,
            })),
            existingUpdates: monthlyUpdates.map(
                ({ id, maintenance_id, update_month }) => ({
                    id,
                    maintenance_id,
                    update_month,
                }),
            ),
            contextRecordId: record?.id,
            submitUrl: `/monthly-updates${suffix}`,
            cancelUrl: record
                ? `/maintenance-projects/${record.project_id}/records/${record.id}`
                : '/monthly-updates',
        };
    } else if (/^\/monthly-updates\/\d+$/.test(url.pathname)) {
        component = 'MonthlyUpdates/Show';
        props = monthlyDetailData(projects, url);

        if (!props) {
            return null;
        }
    } else if (url.pathname === '/monthly-updates') {
        component = 'MonthlyUpdates/Index';
        props = monthlyDirectoryData(projects, url);
    } else if (url.pathname === '/maintenance-projects/create') {
        component = 'MaintenanceProjects/Create';
        props = { coverages: pending ? [] : choices(), integration };
    } else if (match) {
        const project = projects.find((p) => p.id === Number(match[1]));

        if (!project) {
            return null;
        }

        const recordMatch = match[2]?.match(/^\/records\/(\d+)(\/edit)?$/);

        if (recordMatch) {
            const record = recordSummaries(project.id).find(
                (item) => item.id === Number(recordMatch[1]),
            );

            if (!record) {
                return null;
            }

            component = recordMatch[2]
                ? 'MaintenanceProjects/Records/Edit'
                : 'MaintenanceProjects/Records/Show';
            props = {
                project: summary(project),
                record,
                documents: documentsForRecord(projects, summary, record.id),
                updates: monthlyUpdatesForRecord(projects, record.id),
                monthlyUpdateCreateUrl: pending
                    ? undefined
                    : `/monthly-updates/create?record=${record.id}`,
                engineers,
                records: recordSummaries(project.id),
                submitUrl: pending ? undefined : record.delete_url,
            };
        } else if (match[2] === '/records/create') {
            component = 'MaintenanceProjects/Records/Create';
            props = {
                cancelUrl:
                    url.searchParams.get('from') === 'records'
                        ? '/maintenance-records'
                        : undefined,
                project: summary(project),
                engineers,
                records: recordSummaries(project.id),
                submitUrl: pending
                    ? undefined
                    : `/maintenance-projects/${project.id}/records`,
            };
        } else if (match[2] === '/edit') {
            component = 'MaintenanceProjects/Edit';
            props = {
                project: summary(project),
                coverages: choices(project.id),
                integration,
            };
        } else {
            component = 'MaintenanceProjects/Show';
            props = {
                project: summary(project),
                records: recordSummaries(project.id),
                recordCreateUrl: pending
                    ? undefined
                    : `/maintenance-projects/${project.id}/records/create`,
                expandedYear:
                    Number(url.searchParams.get('record_year')) || undefined,
            };
        }
    } else {
        const alternative = [
            '/maintenance-projects/design-exploration',
            '/maintenance-projects/design-exploration/espresso',
        ].includes(url.pathname);

        if (url.pathname !== '/maintenance-projects' && !alternative) {
            return null;
        }

        if (alternative) {
            component = 'MaintenanceProjects/DirectoryAlternative';
        }

        const filters = {
            search: url.searchParams.get('search') || '',
            municipality: url.searchParams.get('municipality') || '',
            sort:
                url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest',
        };
        let rows = pending
            ? []
            : projects
                  .map(summary)
                  .filter(
                      (p) =>
                          p.project_title
                              .toLowerCase()
                              .includes(filters.search.toLowerCase()) &&
                          (!filters.municipality ||
                              p.municipality ===
                                  municipalities.find(
                                      (m) =>
                                          String(m.id) === filters.municipality,
                                  )?.municipality_name),
                  );
        rows.sort((a, b) =>
            filters.sort === 'oldest'
                ? a.created_at.localeCompare(b.created_at) || a.id - b.id
                : b.created_at.localeCompare(a.created_at) || b.id - a.id,
        );
        const lastPage = Math.max(1, Math.ceil(rows.length / 10)),
            currentPage = Math.max(
                1,
                Math.min(lastPage, Number(url.searchParams.get('page')) || 1),
            );
        props = {
            projects: {
                data: rows.slice((currentPage - 1) * 10, currentPage * 10),
                total: rows.length,
                current_page: currentPage,
                last_page: lastPage,
                from: rows.length ? (currentPage - 1) * 10 + 1 : null,
                to: Math.min(currentPage * 10, rows.length),
                links: [],
            },
            municipalities,
            filters,
            integration,
            canCreate: !pending,
            canBulkDelete: !pending,
        };
    }

    return {
        component,
        encryptHistory: true,
        clearHistory: url.pathname === '/login',
        props: {
            ...shared,
            auth: { user: session.user ?? null },
            ...props,
            errors,
            ...(url.pathname.startsWith(
                '/maintenance-projects/design-exploration/espresso',
            )
                ? { sidebarTheme: 'espresso' }
                : {}),
        },
        url: url.pathname + url.search,
        version: 'frontend-crud-review',
    };
}
async function mutate(method, url, data, files = []) {
    if (url.pathname.startsWith('/road-coverages')) {
        return mutateRoadCoverage(
            method,
            url,
            data,
            lguReviewContext.relationships.roadCoverages,
            lguPreviewOptions(),
            lguReviewContext.actor,
            engineers,
        );
    }

    if (url.pathname.startsWith('/lgus')) {
        return mutateLgu(
            method,
            url,
            data,
            lguReviewContext.relationships,
            lguReviewContext.actor,
        );
    }

    if (url.pathname.startsWith('/maintenance-documents')) {
        return mutateDocument(method, url, data, files, projects);
    }

    if (method === 'POST' && url.pathname === '/monthly-updates') {
        const result = await createMonthlyPreview(
            projects,
            data,
            files,
            url.searchParams.get('record'),
        );

        return result.errors
            ? { ...result, location: `/monthly-updates/create${url.search}` }
            : result;
    }

    const monthlyEdit = url.pathname.match(/^\/monthly-updates\/(\d+)$/);

    if (method === 'PUT' && monthlyEdit) {
        const result = await createMonthlyPreview(
            projects,
            data,
            files,
            undefined,
            Number(monthlyEdit[1]),
        );

        return result?.errors
            ? {
                  ...result,
                  location: `/monthly-updates/${monthlyEdit[1]}/edit${url.search}`,
              }
            : result;
    }

    const updateMatch = url.pathname.match(/^\/monthly-updates\/(bulk|\d+)$/);

    if (method === 'DELETE' && updateMatch) {
        const ids =
            updateMatch[1] === 'bulk'
                ? data.update_ids
                : [Number(updateMatch[1])];
        const parent = records.find(
            (r) => String(r.id) === url.searchParams.get('record'),
        );
        const back =
            parent &&
            Array.isArray(ids) &&
            ids.every((id) =>
                monthlyUpdates.some(
                    (u) =>
                        u.id === Number(id) && u.maintenance_id === parent.id,
                ),
            )
                ? `/maintenance-projects/${parent.project_id}/records/${parent.id}`
                : null;
        const errors = deleteMonthlyPreview(ids);
        const page = monthlyDirectoryData(projects, url).updates.current_page;
        const query = new URLSearchParams(url.searchParams);
        query.set('page', String(page));

        return {
            location: !errors && back ? back : `/monthly-updates?${query}`,
            ...(errors ? { errors } : {}),
        };
    }

    const recordMatch = url.pathname.match(
        /^\/maintenance-projects\/(\d+)\/records\/(\d+)$/,
    );

    if (recordMatch) {
        const projectId = Number(recordMatch[1]);
        const record = records.find(
            (item) =>
                item.id === Number(recordMatch[2]) &&
                item.project_id === projectId,
        );

        if (!record || !projects.some((item) => item.id === projectId)) {
            return null;
        }

        if (method === 'PUT') {
            return createPreviewRecord(projectId, data, record);
        }

        if (method === 'DELETE') {
            const year = record.year;
            deletePreviewRecords([record.id]);

            return {
                location:
                    recordDirectoryReturn(url) ??
                    `/maintenance-projects/${projectId}?record_year=${year}`,
            };
        }

        return null;
    }

    const recordProject = url.pathname.match(
        /^\/maintenance-projects\/(\d+)\/records$/,
    );

    if (method === 'POST' && recordProject) {
        const projectId = Number(recordProject[1]);

        if (!projects.some((project) => project.id === projectId)) {
            return null;
        }

        const result = createPreviewRecord(projectId, data);

        if (!result.errors && url.searchParams.get('from') === 'records') {
            result.location = `/maintenance-projects/${projectId}/records/${result.record_id}`;
        }

        return result;
    }

    const match = url.pathname.match(/^\/maintenance-projects\/(\d+)$/);
    const current = match
        ? projects.find((p) => p.id === Number(match[1]))
        : null;

    if (method === 'DELETE') {
        const ids =
            url.pathname === '/maintenance-projects/bulk'
                ? data.project_ids
                : current
                  ? [current.id]
                  : [];
        const selected = Array.isArray(ids)
            ? projects.filter((p) => ids.map(Number).includes(p.id))
            : [];
        let error;

        if (
            !Array.isArray(ids) ||
            !ids.length ||
            ids.length > 100 ||
            new Set(ids.map(Number)).size !== ids.length ||
            selected.length !== ids.length
        ) {
            error = 'Select valid existing projects.';
        }

        if (error) {
            return {
                location: current
                    ? `/maintenance-projects/${current.id}`
                    : '/maintenance-projects',
                errors: { project_ids: error },
            };
        }

        // Validate the entire selection before changing any collection.
        const selectedIds = new Set(selected.map((project) => project.id));
        deletePreviewRecords(
            records
                .filter((record) => selectedIds.has(record.project_id))
                .map((record) => record.id),
        );

        for (const project of selected) {
            projects.splice(projects.indexOf(project), 1);
        }

        return { location: '/maintenance-projects' };
    }

    if (
        (method === 'POST' && url.pathname === '/maintenance-projects') ||
        (method === 'PUT' && current)
    ) {
        const errors = {},
            coverage = coverageChoices().find(
                (c) => c.id === Number(data.road_coverage_id),
            );
        const title = String(data.project_title || '').trim();

        if (!title || title.length > 255) {
            errors.project_title =
                'Enter a project title of 255 characters or fewer.';
        }

        if (
            !coverage ||
            projects.some(
                (p) =>
                    p.road_coverage_id === coverage.id && p.id !== current?.id,
            )
        ) {
            errors.road_coverage_id =
                'This road coverage is already assigned or unavailable.';
        }

        if (
            current &&
            current.road_coverage_id !== coverage?.id &&
            records.some((r) => r.project_id === current.id)
        ) {
            errors.road_coverage_id =
                'Road coverage cannot change because this project has maintenance history.';
        }

        for (const field of ['created_by', 'created_at', 'updated_at']) {
            if (data[field] !== undefined) {
                errors[field] = 'This value is determined by the backend.';
            }
        }

        const location = current
            ? `/maintenance-projects/${current.id}/edit`
            : '/maintenance-projects/create';

        if (Object.keys(errors).length) {
            return { location, errors };
        }

        const values = {
            project_title: title,
            description: String(data.description || '').trim() || null,
            road_coverage_id: coverage.id,
            updated_at: new Date().toISOString(),
        };

        if (current) {
            Object.assign(current, values);
        } else {
            const now = new Date().toISOString();
            projects.push({
                id: nextId++,
                created_by: 'demoAdmin',
                created_at: now,
                ...values,
            });
        }

        return {
            location: `/maintenance-projects/${current?.id ?? nextId - 1}`,
        };
    }

    return null;
}
function html(page) {
    const css = new Set();
    const visited = new Set();
    const add = (key) => {
        if (visited.has(key)) {
            return;
        }

        visited.add(key);
        const entry = manifest[key];

        if (!entry) {
            return;
        }

        for (const file of entry.css || []) {
            css.add(file);
        }

        for (const imported of entry.imports || []) {
            add(imported);
        }
    };
    add('resources/js/app.tsx');
    css.add(manifest['resources/css/app.css'].file);

    for (const entry of Object.values(manifest)) {
        if (entry.file.endsWith('.css') && /fonts-/.test(entry.file)) {
            css.add(entry.file);
        }
    }

    const json = JSON.stringify(page).replaceAll('<', '\\u003c');

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="csrf-token" content="preview-only"><title>JaiROADS React review</title>${[...css].map((file) => `<link rel="stylesheet" href="/build/${file}">`).join('')}<script type="module" src="/build/${manifest['resources/js/app.tsx'].file}"></script></head><body class="font-sans antialiased"><script data-page="app" type="application/json">${json}</script><div id="app"></div></body></html>`;
}
export const server = createServer(async (request, response) => {
    try {
        const url = new URL(request.url, 'http://localhost');

        if (
            request.method === 'GET' &&
            (url.pathname.startsWith('/build/') ||
                url.pathname === '/images/jairoads/road-rehabilitation.jpg')
        ) {
            const file = path.resolve(
                publicRoot,
                '.' + decodeURIComponent(url.pathname),
            );

            if (
                !file.startsWith(publicRoot + path.sep) ||
                !(await stat(file)).isFile()
            ) {
                throw new Error('Asset unavailable');
            }

            const mime = {
                '.jpg': 'image/jpeg',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.svg': 'image/svg+xml',
                '.woff2': 'font/woff2',
                '.woff': 'font/woff',
            };
            response
                .writeHead(200, {
                    'Content-Type':
                        mime[path.extname(file)] || 'application/octet-stream',
                })
                .end(await readFile(file));

            return;
        }

        let sessionId = request.headers.cookie?.match(
            /jr_review_session=([a-f0-9-]+)/,
        )?.[1];

        if (!sessionId || !sessions.has(sessionId)) {
            sessionId = randomUUID();
            sessions.set(sessionId, {});
            response.setHeader(
                'Set-Cookie',
                `jr_review_session=${sessionId}; HttpOnly; SameSite=Strict; Path=/`,
            );
        }

        const session = sessions.get(sessionId);
        response.setHeader('Cache-Control', 'no-store');

        if (url.pathname === '/preview/session' && request.method === 'GET') {
            response
                .writeHead(200, { 'Content-Type': 'application/json' })
                .end(JSON.stringify({ authenticated: Boolean(session.user) }));

            return;
        }

        if (
            url.pathname === '/' ||
            (url.pathname === '/login' && session.user)
        ) {
            response
                .writeHead(302, {
                    Location: session.user ? '/maintenance-projects' : '/login',
                })
                .end();

            return;
        }

        if (!session.user && url.pathname !== '/login') {
            response.writeHead(303, { Location: '/login' }).end();

            return;
        }

        const documentFileMatch = url.pathname.match(
            /^\/preview-documents\/(\d+)$/,
        );

        if (documentFileMatch && ['GET', 'HEAD'].includes(request.method)) {
            serveDocument(request, response, Number(documentFileMatch[1]), url);

            return;
        }

        const mediaMatch = url.pathname.match(/^\/preview-media\/(\d+)$/);

        if (mediaMatch && ['GET', 'HEAD'].includes(request.method)) {
            servePreviewMedia(request, response, Number(mediaMatch[1]));

            return;
        }

        if (request.method !== 'GET') {
            // Only local review origins may mutate explicitly labelled sample data.
            const origin = request.headers.origin;

            if (
                origin &&
                !['http://localhost:5179', 'http://127.0.0.1:5179'].includes(
                    origin,
                )
            ) {
                response.writeHead(403).end();

                return;
            }

            if (url.pathname === '/logout' && request.method === 'POST') {
                sessions.delete(sessionId);
                response.setHeader(
                    'Set-Cookie',
                    'jr_review_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0',
                );
                response.writeHead(303, { Location: '/login' }).end();

                return;
            }

            if (url.pathname === '/login') {
                if (request.method !== 'POST') {
                    response.writeHead(405).end();

                    return;
                }

                let body = '';

                for await (const chunk of request) {
                    body += chunk;

                    if (Buffer.byteLength(body) > 100000) {
                        response.writeHead(413).end();

                        return;
                    }
                }

                const data = request.headers['content-type']?.includes(
                    'application/json',
                )
                    ? JSON.parse(body || '{}')
                    : Object.fromEntries(new URLSearchParams(body));
                const email =
                    typeof data.email === 'string'
                        ? data.email.trim().toLowerCase()
                        : '';

                if (
                    email !== demoCredentials.email ||
                    data.password !== demoCredentials.password
                ) {
                    session.oldEmail =
                        typeof data.email === 'string' ? data.email : '';
                    session.errors = {
                        email: 'Invalid demo credentials. Use the sample account shown above.',
                    };
                    response.writeHead(303, { Location: '/login' }).end();

                    return;
                }

                sessions.delete(sessionId);
                sessionId = randomUUID();
                sessions.set(sessionId, { user: { ...shared.auth.user } });
                response.setHeader(
                    'Set-Cookie',
                    `jr_review_session=${sessionId}; HttpOnly; SameSite=Strict; Path=/${data.remember ? '; Max-Age=604800' : ''}`,
                );
                response
                    .writeHead(303, { Location: '/maintenance-projects' })
                    .end();

                return;
            }

            const monthlyCreate =
                ['POST', 'PUT'].includes(request.method) &&
                (url.pathname === '/monthly-updates' ||
                    /^\/monthly-updates\/\d+$/.test(url.pathname));
            const documentUpload =
                ['POST', 'PUT'].includes(request.method) &&
                /^\/maintenance-documents(?:\/\d+)?$/.test(url.pathname);
            const fileUpload = monthlyCreate || documentUpload;
            const chunks = [];
            let length = 0;
            let tooLarge = false;

            for await (const chunk of request) {
                length += chunk.length;

                if (length > (fileUpload ? uploadBodyLimit : 100000)) {
                    tooLarge = true;
                    chunks.length = 0;
                }

                if (!tooLarge) {
                    chunks.push(chunk);
                }
            }

            if (tooLarge) {
                if (!fileUpload) {
                    throw new Error('Request too large');
                }

                session.errors = {
                    [documentUpload ? 'attachment' : 'attachments']:
                        'This local preview accepts requests up to 64 MiB including form data. Remove files and retry. This is a temporary technical safeguard, not a JaiROADS attachment policy.',
                };
                response
                    .writeHead(303, {
                        Location: `${request.method === 'PUT' ? url.pathname + '/edit' : documentUpload ? '/maintenance-documents/create' : '/monthly-updates/create'}${url.search}`,
                    })
                    .end();

                return;
            }

            const body = Buffer.concat(chunks);
            let data,
                files = [];

            if (
                fileUpload &&
                request.headers['content-type']?.includes('multipart/form-data')
            ) {
                const form = await new Request(
                    'http://localhost/monthly-updates',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': request.headers['content-type'],
                        },
                        body,
                    },
                ).formData();
                data = {};

                for (const [key, value] of form.entries()) {
                    if (
                        key === 'attachment' ||
                        /^attachments(?:\[\d*\])?$/.test(key)
                    ) {
                        if (typeof value !== 'string') {
                            files.push(value);
                        }
                    } else if (
                        /^removed_media_ids(?:\[\d*\])?$/.test(key) &&
                        typeof value === 'string'
                    ) {
                        (data.removed_media_ids ??= []).push(value);
                    } else if (typeof value === 'string') {
                        data[key] = value;
                    }
                }
            } else {
                data = request.headers['content-type']?.includes(
                    'application/json',
                )
                    ? JSON.parse(body.toString() || '{}')
                    : Object.fromEntries(new URLSearchParams(body.toString()));
            }

            const action = await mutate(request.method, url, data, files);

            if (action?.errors && url.searchParams.has('return_to')) {
                const target = new URL(
                    url.searchParams.get('from') === 'records'
                        ? '/maintenance-records/create'
                        : action.location,
                    url,
                );
                target.searchParams.set(
                    'return_to',
                    url.searchParams.get('return_to'),
                );
                action.location = target.pathname + target.search;
            }

            pruneMediaBytes();
            pruneDocumentBytes();

            if (!action) {
                response.writeHead(404).end('Review action unavailable.');

                return;
            }

            session.errors = action.errors || {};
            response.writeHead(303, { Location: action.location }).end();

            return;
        }

        if (
            url.pathname !== '/login' &&
            !url.pathname.startsWith('/road-coverages') &&
            !url.pathname.startsWith('/lgus') &&
            !url.pathname.startsWith('/maintenance-documents') &&
            !url.pathname.startsWith('/maintenance-projects') &&
            ![
                '/road-coverages',
                '/monthly-updates',
                '/monthly-updates/create',
                '/maintenance-records',
                '/maintenance-records/create',
            ].includes(url.pathname) &&
            !/^\/monthly-updates\/\d+(?:\/edit)?$/.test(url.pathname)
        ) {
            response
                .writeHead(404)
                .end(
                    'This review serves Maintenance Projects and Monthly Updates directory, Add form and Details.',
                );

            return;
        }

        const page = pageFor(url, session.errors || {}, session);
        session.errors = {};

        if (!page) {
            response
                .writeHead(404, { 'Content-Type': 'text/plain' })
                .end(
                    url.pathname.startsWith('/monthly-updates')
                        ? 'Monthly update not found. It may have been deleted or reset with the preview server.'
                        : 'The sample project no longer exists.',
                );

            return;
        }

        if (request.headers['x-inertia']) {
            response
                .writeHead(200, {
                    'Content-Type': 'application/json',
                    'X-Inertia': 'true',
                    Vary: 'X-Inertia',
                    'Cache-Control': 'no-store',
                })
                .end(JSON.stringify(page));
        } else {
            response
                .writeHead(200, {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'no-store',
                })
                .end(html(page));
        }
    } catch (error) {
        response
            .writeHead(400, { 'Content-Type': 'text/plain' })
            .end('Local review error: ' + error.message);
    }
});
server.listen(5179, '127.0.0.1', () =>
    console.log(
        'JaiROADS React review: http://localhost:5179 — SAMPLE DATA ONLY; no Laravel or database connection.',
    ),
);

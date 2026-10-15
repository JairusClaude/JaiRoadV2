import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

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
const records = [
    { id: 1, project_id: 101, year: 2026, quarter: 'Q1', status: 'Completed' },
    { id: 2, project_id: 101, year: 2026, quarter: 'Q2', status: 'Ongoing' },
];
let nextId = 115;
const sessions = new Map();
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
const summary = (project) => ({
    ...project,
    ...Object.fromEntries(
        ['road_name', 'municipality'].map((key) => [
            key,
            coverages.find((c) => c.id === project.road_coverage_id)?.[key] ??
                null,
        ]),
    ),
    maintenance_records_count: records.filter(
        (r) => r.project_id === project.id,
    ).length,
    can_edit: true,
    can_delete: true,
});
function choices(currentId) {
    return coverages.map((c) => ({
        ...c,
        assigned: projects.some(
            (p) => p.road_coverage_id === c.id && p.id !== currentId,
        ),
    }));
}
function pageFor(url, errors = {}) {
    const pending = url.searchParams.get('pending') === '1';
    const integration = {
        ready: !pending,
        message: pending
            ? 'Project access requires a verified account link and approved database structure.'
            : null,
    };
    const match = url.pathname.match(
        /^\/maintenance-projects\/(\d+)(\/edit)?$/,
    );
    let component = 'MaintenanceProjects/Index',
        props;

    if (url.pathname === '/maintenance-projects/create') {
        component = 'MaintenanceProjects/Create';
        props = { coverages: pending ? [] : choices(), integration };
    } else if (match) {
        const project = projects.find((p) => p.id === Number(match[1]));

        if (!project) {
            return null;
        }

        if (match[2]) {
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
                records: records.filter((r) => r.project_id === project.id),
            };
        }
    } else {
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
        props: { ...shared, ...props, errors },
        url: url.pathname + url.search,
        version: 'frontend-crud-review',
    };
}
function mutate(method, url, data) {
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
        const blocked = selected.filter((p) =>
            records.some((r) => r.project_id === p.id),
        );
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

        if (blocked.length) {
            error =
                'Nothing was deleted. Maintenance history prevents deletion of: ' +
                blocked.map((p) => `#${p.id} ${p.project_title}`).join('; ') +
                '. Adjust your selection.';
        }

        if (error) {
            return {
                location: current
                    ? `/maintenance-projects/${current.id}`
                    : '/maintenance-projects',
                errors: { project_ids: error },
            };
        }

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
            coverage = coverages.find(
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

        if (url.pathname === '/') {
            response
                .writeHead(302, { Location: '/maintenance-projects' })
                .end();

            return;
        }

        if (request.method === 'GET' && url.pathname.startsWith('/build/')) {
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
                '.js': 'text/javascript',
                '.css': 'text/css',
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

            let body = '';

            for await (const chunk of request) {
                body += chunk;

                if (body.length > 100000) {
                    throw new Error('Request too large');
                }
            }

            const data = request.headers['content-type']?.includes(
                'application/json',
            )
                ? JSON.parse(body || '{}')
                : Object.fromEntries(new URLSearchParams(body));
            const action = mutate(request.method, url, data);

            if (!action) {
                response.writeHead(404).end('Review action unavailable.');

                return;
            }

            session.errors = action.errors || {};
            response.writeHead(303, { Location: action.location }).end();

            return;
        }

        if (!url.pathname.startsWith('/maintenance-projects')) {
            response
                .writeHead(404)
                .end('This review only serves Maintenance Projects.');

            return;
        }

        const page = pageFor(url, session.errors || {});
        session.errors = {};

        if (!page) {
            response.writeHead(404).end('The sample project no longer exists.');

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

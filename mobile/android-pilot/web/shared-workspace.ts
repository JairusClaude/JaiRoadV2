import type { HttpRequestConfig, HttpResponse, Page } from '@inertiajs/core';
import type { FieldBridge } from '../../../resources/js/lib/android-workspace-bridge';
import { validRoadGeometry } from '../../../resources/js/lib/road-coverages/geometry.mjs';
import { validateFields } from './field-forms';
import { exportLocalFile } from './host-mode';
import { attachmentMime } from './queue';
import type { Vault, Kind, Fields } from './queue';
import {
    cachedRow,
    fieldsFrom,
    findFile,
    isLocalId,
    offlinePage,
    offlineResource,
    presentationId,
    projectData,
    rawId,
} from './shared-data';

const BASE = '/workspace/ui';
const localMessage =
    'Saved locally — Waiting for internet connection to synchronize.';
const allowed =
    /^\/workspace\/ui\/(maintenance-projects|maintenance-records|road-coverages|monthly-updates|maintenance-documents)(?:\/|$)/;
type Options = {
    status: FieldBridge['status'];
    offlineSignIn: boolean;
    onSaved: () => void;
    onUnavailable: () => void;
    onOnline: () => void;
    onLock: () => void;
};
function parsePage(raw: string): Page | null {
    try {
        const data = JSON.parse(raw);

        return typeof data?.component === 'string' &&
            typeof data?.url === 'string' &&
            data?.props &&
            typeof data.props === 'object'
            ? (data as Page)
            : null;
    } catch {
        return null;
    }
}
function dashboardMatches(vault: Vault, page: Page | null): page is Page {
    const props = page?.props as Record<string, any> | undefined;

    return Boolean(
        page?.component === 'RoleDashboard/Canonical' &&
        props?.canonicalFrontend === true &&
        Number(props?.auth?.user?.canonical_user_account_id) ===
            vault.state.snapshot.accountId &&
        props?.jairoadsIdentity?.role ===
            vault.state.snapshot.role.toLowerCase(),
    );
}
async function loadDashboard(vault: Vault) {
    const response = await fetch('/dashboard', {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
    });

    if (!response.ok || new URL(response.url).origin !== location.origin) {
        throw new Error('Dashboard unavailable.');
    }

    const doc = new DOMParser().parseFromString(
        await response.text(),
        'text/html',
    );
    const raw =
        doc.querySelector('script[data-page="app"][type="application/json"]')
            ?.textContent ??
        doc.querySelector('#app')?.getAttribute('data-page') ??
        '';
    const page = parsePage(raw);

    if (!dashboardMatches(vault, page)) {
        throw new Error('Dashboard identity could not be verified.');
    }

    return page;
}
function responsePage(page: Page): HttpResponse {
    return {
        status: 200,
        data: JSON.stringify(page),
        headers: { 'x-inertia': 'true', 'content-type': 'application/json' },
    };
}
function plainData(value: unknown): Record<string, unknown> {
    if (Object.prototype.toString.call(value) === '[object FormData]') {
        return Object.fromEntries((value as FormData).entries());
    }

    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }

    return value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
}
const text = (value: unknown) =>
    value === null || value === undefined ? '' : String(value);
const bool = (value: unknown) =>
    value === true || value === '1' || value === 1 || value === 'true';
function ensure(test: unknown, message: string): asserts test {
    if (!test) {
        throw new Error(message);
    }
}
async function readAttachment(
    file: unknown,
): Promise<{ name: string; data: string }> {
    const selected = file as File | undefined;
    ensure(
        selected &&
            typeof selected.name === 'string' &&
            selected.size > 0 &&
            selected.size <= 20 * 1024 * 1024 &&
            attachmentMime(selected.name),
        'Choose a supported photo or document up to 20 MB.',
    );
    const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
            reject(new Error('Could not read the attachment.'));
        reader.readAsDataURL(
            new Blob([selected], { type: attachmentMime(selected.name) }),
        );
    });

    return { name: selected.name, data };
}
function bytes(data: string) {
    const split = data.indexOf(',');

    if (
        !data.startsWith('data:') ||
        split < 0 ||
        !data.slice(0, split).endsWith(';base64')
    ) {
        throw new Error('Invalid local file.');
    }

    const binary = atob(data.slice(split + 1));

    return new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))], {
        type: data.slice(5, split - 7),
    });
}

export async function openSharedWorkspace(
    vault: Vault,
    frame: HTMLIFrameElement,
    options: Options,
) {
    let dashboard = vault.state.dashboard as Page | null;

    if (!options.offlineSignIn) {
        try {
            dashboard = await loadDashboard(vault);
            await vault.cacheDashboard({ ...dashboard, encryptHistory: true });
        } catch {
            /* An earlier encrypted dashboard can still be opened. */
        }
    }

    if (!dashboardMatches(vault, dashboard)) {
        return false;
    }

    const initial = {
        ...dashboard,
        encryptHistory: true,
        props: { ...dashboard.props, errors: {} },
    } as Page;
    let current = initial;
    let lastDashboard = initial;
    let active = true;
    const errorPage = (message: string, field = 'offline') =>
        responsePage({
            ...current,
            props: {
                ...current.props,
                errors: { [field]: message },
                status: '',
            },
            encryptHistory: true,
        });
    const localPage = (url: URL, status = '') =>
        offlinePage(vault, lastDashboard, url, status);
    const urlFor = (path: string) => new URL(path, location.origin);
    const userMessage = (message: string) => {
        try {
            frame.contentWindow?.dispatchEvent(
                new CustomEvent('jairoads-field-message', { detail: message }),
            );
        } catch {
                // Preserve local data when the optional network operation fails.
            }
    };
    async function mutate(
        url: URL,
        config: HttpRequestConfig,
    ): Promise<HttpResponse> {
        const snapshot = vault.state.snapshot;
        ensure(
            snapshot.canWrite && snapshot.role === 'Engineer',
            'This workspace is read only.',
        );
        const data = plainData(config.data);
        const path = url.pathname.slice(BASE.length);
        const parts = path.split('/').filter(Boolean);
        const [section, first, nested, fourth] = parts;
        const method = text(data._method || config.method).toLowerCase();
        ensure(
            ['post', 'put'].includes(method),
            'This action requires an online connection.',
        );
        ensure(
            !bool(data.remove_attachment) &&
                (!Array.isArray(data.removed_media_ids) ||
                    !data.removed_media_ids.length) &&
                !Object.keys(data).some((key) =>
                    /^removed_media_ids\[/.test(key),
                ),
            'Removing files requires an online connection.',
        );
        let kind: Kind;
        let row: ReturnType<typeof cachedRow>;
        let fields: Fields;
        let destination: string;
        const projection = projectData(vault, lastDashboard);

        if (
            section === 'maintenance-documents' &&
            !first &&
            method === 'post'
        ) {
            const record = rawId(vault, data.maintenance_id);
            ensure(
                projection.records.some(
                    (r) => r.id === presentationId(record) && r.edit_url,
                ),
                'Select a maintenance record assigned to you.',
            );
            ensure(
                text(data.document_title).trim() &&
                    text(data.document_title).length <= 255,
                'Enter a document title.',
            );
            const file = await readAttachment(data.attachment);
            ensure(
                /\.(pdf|docx|xlsx|pptx)$/i.test(file.name),
                'Choose a supported document.',
            );
            await vault.attach(
                record,
                file.name,
                text(data.description),
                file.data,
                'document',
                record,
                text(data.document_title),
            );
            destination = BASE + '/maintenance-documents';
        } else if (
            section === 'monthly-updates' &&
            first &&
            nested === 'media' &&
            method === 'post'
        ) {
            const report = cachedRow(vault, 'monthly', first);
            ensure(report, 'This monthly update is not available locally.');
            ensure(
                projection.records.some(
                    (r) =>
                        r.id ===
                            presentationId(
                                rawId(vault, report.maintenance_id),
                            ) && r.edit_url,
                ),
                'Select a maintenance record assigned to you.',
            );
            const file = await readAttachment(data.file);
            ensure(
                /\.(jpe?g|png|webp)$/i.test(file.name),
                'Choose a supported photo.',
            );
            await vault.attach(
                rawId(vault, report.maintenance_id),
                file.name,
                '',
                file.data,
                'media',
                String(report.id),
                file.name,
            );
            destination = BASE + '/monthly-updates/' + first;
        } else {
            if (section === 'road-coverages' && !nested) {
                kind = 'road';
                row = first ? cachedRow(vault, kind, first) : undefined;
                ensure(!first || row, 'Road is not cached.');
                fields = fieldsFrom(data, [
                    'road_name',
                    'kilometers',
                    'pavement_type',
                    'state_category',
                    'correction_reason',
                ]);
                fields.lgu_id = text(data.lgu_id ?? data.lgus_id);
                ensure(
                    fields.road_name?.trim() && fields.road_name.length <= 255,
                    'Enter a road name.',
                );
                ensure(
                    snapshot.municipalities.some(
                        (m) => String(m.id) === fields.lgu_id,
                    ),
                    'Choose a municipality.',
                );
                ensure(
                    !row || String(row.lgu_id) === fields.lgu_id,
                    'Changing municipality requires an online review.',
                );
                ensure(
                    ['Concrete', 'Asphalt', 'Gravel', 'Earth'].includes(
                        fields.pavement_type,
                    ) &&
                        ['Good', 'Fair', 'Bad'].includes(fields.state_category),
                    'Choose a pavement and road condition.',
                );
                ensure(
                    fields.kilometers !== '' &&
                        Number.isFinite(Number(fields.kilometers)) &&
                        Number(fields.kilometers) >= 0,
                    'Enter a valid road length.',
                );

                if (data.geojson !== undefined && data.geojson !== null) {
                    const geometry =
                        typeof data.geojson === 'string'
                            ? JSON.parse(data.geojson)
                            : data.geojson;
                    ensure(
                        validRoadGeometry(geometry),
                        'Enter valid road line geometry.',
                    );
                    fields.geojson = JSON.stringify(geometry);
                    ensure(
                        fields.geojson.length <= 2 * 1024 * 1024,
                        'Road geometry is too large.',
                    );
                }

                ensure(row || fields.geojson, 'Draw a road alignment.');
                destination = BASE + '/road-coverages';
            } else if (section === 'maintenance-projects' && !nested) {
                kind = 'project';
                row = first ? cachedRow(vault, kind, first) : undefined;
                ensure(!first || row, 'Project is not cached.');
                fields = fieldsFrom(data, ['project_title', 'description']);
                fields.road_coverage_id = rawId(vault, data.road_coverage_id);
                ensure(
                    cachedRow(vault, 'road', fields.road_coverage_id),
                    'Choose a cached road coverage.',
                );
                ensure(
                    fields.project_title?.trim() &&
                        fields.project_title.length <= 255,
                    'Enter a project title.',
                );
                const road = projection
                    .coverages(row ? presentationId(row.id) : undefined)
                    .find(
                        (r) => r.id === presentationId(fields.road_coverage_id),
                    );
                ensure(
                    road && !road.assigned,
                    'Choose a road without another linked project.',
                );
                destination = BASE + '/maintenance-projects';
            } else if (
                section === 'maintenance-projects' &&
                nested === 'records'
            ) {
                kind = 'record';
                row = fourth ? cachedRow(vault, kind, fourth) : undefined;
                ensure(!fourth || row, 'Maintenance record is not cached.');
                const project = rawId(vault, first);
                ensure(
                    cachedRow(vault, 'project', project),
                    'Choose a cached project.',
                );
                ensure(
                    !row || String(row.project_id) === project,
                    'Record project cannot be changed offline.',
                );
                ensure(
                    Number(data.engineers_id ?? data.managing_engineer_id) ===
                        projection.engineer,
                    'Offline records must be assigned to the signed-in engineer.',
                );
                fields = fieldsFrom(data, [
                    'maintenance_year',
                    'quarter',
                    'start_date',
                    'estimated_duration_days',
                    'complete_date',
                    'status',
                    'description',
                ]);
                fields.project_id = project;
                ensure(
                    /^\d{4}$/.test(fields.maintenance_year ?? '') &&
                        Number(fields.maintenance_year) >= 2000 &&
                        Number(fields.maintenance_year) <= 2100,
                    'Enter a valid year.',
                );
                ensure(
                    ['Q1', 'Q2', 'Q3', 'Q4'].includes(fields.quarter) &&
                        ['Ongoing', 'Completed'].includes(fields.status),
                    'Choose the quarter and status.',
                );
                ensure(
                    /^\d{4}-\d{2}-\d{2}$/.test(fields.start_date ?? '') &&
                        Number.isInteger(
                            Number(fields.estimated_duration_days),
                        ) &&
                        Number(fields.estimated_duration_days) > 0,
                    'Enter valid dates and duration.',
                );
                ensure(
                    !vault
                        .rows('record')
                        .some(
                            (r) =>
                                String(r.id) !== String(row?.id) &&
                                String(r.project_id) === project &&
                                String(r.maintenance_year) ===
                                    fields.maintenance_year &&
                                r.quarter === fields.quarter,
                        ),
                    'A record for that project and period already exists.',
                );
                fields.complete_date ||= '';
                validateFields(kind, fields, row);
                destination = BASE + '/maintenance-projects/' + first;
            } else if (section === 'monthly-updates' && !nested) {
                kind = 'monthly';
                row = first ? cachedRow(vault, kind, first) : undefined;
                ensure(!first || row, 'Monthly update is not cached.');
                ensure(
                    !row || row.version || isLocalId(presentationId(row.id)),
                    'This older cached report must be refreshed before editing.',
                );
                fields = fieldsFrom(data, [
                    'update_month',
                    'progress_percentage',
                    'summary_of_text_reports',
                ]);
                fields.maintenance_id = rawId(vault, data.maintenance_id);
                ensure(
                    !row ||
                        rawId(vault, row.maintenance_id) ===
                            fields.maintenance_id,
                    'The maintenance record cannot change.',
                );
                ensure(
                    projection.records.some(
                        (r) =>
                            r.id === presentationId(fields.maintenance_id) &&
                            r.edit_url,
                    ),
                    'Select a maintenance record assigned to you.',
                );
                ensure(
                    /^\d{4}-(0[1-9]|1[0-2])$/.test(fields.update_month ?? '') &&
                        /^(?:\d+)(?:\.\d{1,2})?$/.test(
                            fields.progress_percentage ?? '',
                        ) &&
                        Number(fields.progress_percentage) >= 0 &&
                        Number(fields.progress_percentage) <= 100,
                    'Enter a valid reporting month and progress.',
                );
                ensure(
                    [...(fields.summary_of_text_reports ?? '')].length <= 20000,
                    'Report exceeds 20,000 characters.',
                );
                ensure(
                    !vault
                        .rows('monthly')
                        .some(
                            (r) =>
                                String(r.id) !== String(row?.id) &&
                                rawId(vault, r.maintenance_id) ===
                                    fields.maintenance_id &&
                                String(r.update_month).slice(0, 7) ===
                                    fields.update_month,
                        ),
                    'A report for this month is already available.',
                );
                destination = BASE + '/monthly-updates';
            } else {
                throw new Error(
                    'This action requires internet. No changes were discarded.',
                );
            }

            const photos: { name: string; data: string }[] = [];

            if (kind === 'monthly') {
                const files = Array.isArray(data.attachments)
                    ? data.attachments
                    : Object.entries(data)
                          .filter(([key]) => /^attachments\[\d*\]$/.test(key))
                          .map(([, file]) => file);

                for (const file of files) {
                    const photo = await readAttachment(file);
                    ensure(
                        /\.(jpe?g|png|webp)$/i.test(photo.name),
                        'Choose a supported photo.',
                    );
                    photos.push(photo);
                }
            }

            const id = await vault.save(kind!, fields!, row, photos);

            if (kind === 'monthly') {
                destination = BASE + '/monthly-updates/' + presentationId(id);
            } else if (row && kind === 'project') {
                destination =
                    BASE + '/maintenance-projects/' + presentationId(id);
            } else if (row && kind === 'road') {
                destination = BASE + '/road-coverages/' + presentationId(id);
            }
        }

        options.onSaved();
        const next = localPage(urlFor(destination), localMessage);
        ensure(
            next,
            'Saved locally. Open the directory to view the saved work.',
        );

        return responsePage(next);
    }
    const bridge: FieldBridge = {
        initial,
        async request(config, fallback = false) {
            if (!active) {
                return errorPage('Workspace locked.');
            }

            const url = urlFor(config.url);

            if (url.origin !== location.origin) {
                return null;
            }

            const method = config.method.toLowerCase();

            if (url.pathname === '/logout' && method === 'post') {
                if (!options.status().offline) {
                    const token = document.cookie
                        .split('; ')
                        .find((c) => c.startsWith('XSRF-TOKEN='))
                        ?.slice(11);

                    if (token) {
                        await fetch('/logout', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                Accept: 'application/json',
                                'X-XSRF-TOKEN': decodeURIComponent(token),
                            },
                            signal: AbortSignal.timeout(8000),
                        }).catch(() => {});
                    }
                }

                active = false;
                options.onLock();

                return errorPage('Workspace locked.');
            }

            if (fallback) {
                options.onUnavailable();
            }

            const virtual = [
                ...url.pathname.split('/'),
                ...url.searchParams.values(),
            ].some((part) => /^\d+$/.test(part) && isLocalId(part));
            const values = plainData(config.data);
            const localRelation = [
                'project_id',
                'maintenance_id',
                'road_coverage_id',
            ].some((key) => isLocalId(values[key]));
            const offline =
                options.status().offline ||
                fallback ||
                virtual ||
                localRelation ||
                (method !== 'get' &&
                    allowed.test(url.pathname) &&
                    (current.props.offlineSnapshot === true ||
                        bool(values._jairoads_local)));

            if (!offline) {
                return null;
            }

            if (method === 'get') {
                try {
                    const page = localPage(url);

                    if (page) {
                        return responsePage(page);
                    }
                } catch {
                // Preserve local data when the optional network operation fails.
            }

                userMessage(
                    'This page was not prepared for offline use. Connect to access it.',
                );

                return errorPage('This page requires an internet connection.');
            }

            if (!allowed.test(url.pathname)) {
                userMessage('This operation requires internet.');

                return errorPage('This operation requires internet.');
            }

            try {
                return await mutate(url, config);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Local save failed. Your entries are still available.';
                userMessage(message);

                return errorPage(message);
            }
        },
        observe(response) {
            if (!active) {
                return false;
            }

            if (response.headers['x-inertia']) {
                const page = parsePage(response.data);
                const props = page?.props as Record<string, any> | undefined;
                const auth = props?.auth;

                if (
                    page?.component.startsWith('auth/') ||
                    (auth &&
                        (!auth.user ||
                            Number(auth.user.canonical_user_account_id) !==
                                vault.state.snapshot.accountId)) ||
                    (props?.jairoadsIdentity?.role &&
                        props.jairoadsIdentity.role !==
                            vault.state.snapshot.role.toLowerCase())
                ) {
                    active = false;
                    options.onLock();

                    return false;
                }

                if (dashboardMatches(vault, page)) {
                    lastDashboard = { ...page, encryptHistory: true };
                    void vault.cacheDashboard(lastDashboard).catch(() => {});
                }
            }

            if (response.status >= 200 && response.status < 400) {
                options.onOnline();
            }

            return true;
        },
        current(page) {
            current = page;
        },
        async resource(raw, force = false) {
            if (!active) {
                return new Response(null, { status: 403 });
            }

            const url = urlFor(raw);

            if (url.origin !== location.origin) {
                return null;
            }

            const file = url.pathname.match(
                /^\/workspace\/files\/(document|media)\/(\d+)$/,
            );

            if (file) {
                const found = findFile(
                    vault,
                    file[1] as 'document' | 'media',
                    Number(file[2]),
                );
                const local = await found?.read();

                if (local) {
                    const blob = bytes(local);

                    return new Response(blob, {
                        headers: {
                            'Content-Type': blob.type,
                            'Cache-Control': 'private, no-store',
                        },
                    });
                }

                if (force || options.status().offline) {
                    return new Response(null, { status: 503 });
                }

                if (found?.ref) {
                    try {
                        await vault.cacheFile(found.ref);
                        const cached = findFile(
                            vault,
                            file[1] as 'document' | 'media',
                            Number(file[2]),
                        );
                        const data = await cached?.read();

                        if (data) {
                            const blob = bytes(data);

                            return new Response(blob, {
                                headers: {
                                    'Content-Type': blob.type,
                                    'Cache-Control': 'private, no-store',
                                },
                            });
                        }
                    } catch {
                // Preserve local data when the optional network operation fails.
            }
                }

                return null;
            }

            if (
                !force &&
                !options.status().offline &&
                ![
                    ...url.pathname.split('/'),
                    ...url.searchParams.values(),
                ].some((part) => isLocalId(part))
            ) {
                return null;
            }

            const data = offlineResource(vault, lastDashboard, url);

            if (data !== undefined) {
                return new Response(JSON.stringify(data), {
                    headers: { 'Content-Type': 'application/json' },
                });
            }

            return new Response(null, { status: 503 });
        },
        hasLocalFile(raw) {
            const url = urlFor(raw);
            const file = url.pathname.match(
                /^\/workspace\/files\/(document|media)\/(\d+)$/,
            );

            return Boolean(
                active &&
                url.origin === location.origin &&
                file &&
                findFile(
                    vault,
                    file[1] as 'document' | 'media',
                    Number(file[2]),
                )?.available,
            );
        },
        async exportFile(raw) {
            const url = urlFor(raw);
            const file = url.pathname.match(
                /^\/workspace\/files\/(document|media)\/(\d+)$/,
            );

            if (!active || url.origin !== location.origin || !file) {
                return false;
            }

            let found = findFile(
                vault,
                file[1] as 'document' | 'media',
                Number(file[2]),
            );

            if (found?.ref && !found.available && !options.status().offline) {
                try {
                    await vault.cacheFile(found.ref);
                } catch {
                // Preserve local data when the optional network operation fails.
            }

                found = findFile(
                    vault,
                    file[1] as 'document' | 'media',
                    Number(file[2]),
                );
            }

            const data = await found?.read();

            if (!found || !data) {
                userMessage(
                    'No local file copy is available. Connect to download this file.',
                );

                return false;
            }

            exportLocalFile(found.name, data);

            return true;
        },
        status: options.status,
        ready() {
            frame.dataset.ready = 'true';
        },
        fail() {
            frame.dataset.failed = 'true';
            userMessage('Could not start the shared workspace.');
        },
        lock() {
            active = false;
            options.onLock();
        },
    };
    (
        window as Window & { JaiRoadsSharedWorkspace?: FieldBridge }
    ).JaiRoadsSharedWorkspace = bridge;

    return true;
}

// Isolated preview records. Municipality names reuse existing preview choices;
// all mayor names are fictional. No database or relationship mutations.
let lgus = [];
let nextId = 1;
const fields = ['municipality_name', 'province', 'region', 'mayor_first_name', 'mayor_middle_name', 'mayor_last_name'];
export function initializeLguPreview(municipalities) {
    if (lgus.length) {
return;
}

    lgus = municipalities.map(({ id, municipality_name }, i) => ({ id, municipality_name, province: 'Davao de Oro', region: 'Region XI — Davao Region', mayor_first_name: ['Alex', 'Andrea', 'Miguel'][i % 3], mayor_middle_name: i % 2 ? '' : 'M.', mayor_last_name: ['Santos', 'Cruz', 'Reyes'][i % 3] }));
    nextId = Math.max(0, ...lgus.map(lgu => lgu.id)) + 1;

    for (const [municipality_name, province, region] of [
        ['Asuncion', 'Davao del Norte', 'Region XI — Davao Region'],
        ['Kapalong', 'Davao del Norte', 'Region XI — Davao Region'],
        ['Caraga', 'Davao Oriental', 'Region XI — Davao Region'],
        ['Manay', 'Davao Oriental', 'Region XI — Davao Region'],
        ['Sample Municipality', 'Sample Province', 'Sample Region'],
    ]) {
lgus.push({ id: nextId++, municipality_name, province, region, mayor_first_name: 'Sample', mayor_middle_name: '', mayor_last_name: 'Mayor' });
}
}
const compare = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
const unique = key => [...new Set(lgus.map(lgu => lgu[key]))].sort(compare);
const mayor = lgu => [lgu.mayor_first_name, lgu.mayor_middle_name, lgu.mayor_last_name].filter(Boolean).join(' ');
// Never infer LGU associations from names or from legacy Road Sections.
// Optional collections must contain explicit relationship IDs. The current
// startup preview supplies none, so it reports unavailable data honestly.
export function lguRelatedData(lguId, { roadCoverages, engineerLgus, engineers } = {}) {
    const relatedCoverages = (roadCoverages ?? []).filter(coverage => coverage.lgus_id === lguId).map(coverage => ({
        id: coverage.id, road_name: coverage.road_name, kilometers: coverage.kilometers ?? null,
        pavement_type: coverage.pavement_type ?? null, state_category: coverage.state_category ?? null,
    }));
    const assignedEngineers = (engineerLgus ?? []).filter(assignment => assignment.lgus_id === lguId).flatMap(assignment => {
        const engineer = (engineers ?? []).find(engineer => engineer.id === assignment.engineer_id);

        if (!engineer) {
return [];
}

        return [{ engineer_id: engineer.id, full_name: [engineer.first_name, engineer.middle_name, engineer.last_name].filter(Boolean).join(' '), rank: engineer.rank ?? null,
            assignment_is_active: assignment.is_active === true || assignment.is_active === 1 ? true : assignment.is_active === false || assignment.is_active === 0 ? false : null }];
    });

    return { roadCoverages: relatedCoverages, assignedEngineers, relationshipDataAvailable: { roadCoverages: Array.isArray(roadCoverages), engineerAssignments: Array.isArray(engineerLgus) && Array.isArray(engineers) } };
}
function directoryReturn(url, id) {
    try {
        const origin = url.searchParams.get('return_to');

        if (!origin || !origin.startsWith('/') || origin.startsWith('//')) {
return '/lgus';
}

        const target = new URL(origin, 'http://jairoads.local');

        if (target.origin !== 'http://jairoads.local') {
return '/lgus';
}

        if (target.pathname === '/lgus') {
return target.pathname + target.search;
}

        if (target.pathname === `/lgus/${id}`) {
return directoryReturn(target, id);
}
    } catch { /* Malformed return URLs fall back to the local directory below. */ }

    return '/lgus';
}
function lguPageData(url, relationships) {
    if (url.pathname === '/lgus/create') {
return { component: 'LGUs/Create', props: {} };
}

    const details = url.pathname.match(/^\/lgus\/(\d+)$/);

    if (details) {
        const lgu = lgus.find(lgu => lgu.id === Number(details[1]));

        return lgu ? { component: 'LGUs/Show', props: { lgu: { ...lgu, deletion_check: lguDependencyCheck(lgu.id, relationships) }, ...lguRelatedData(lgu.id, relationships), directoryUrl: directoryReturn(url, lgu.id), message: url.searchParams.get('saved') === 'updated' ? 'LGU updated successfully.' : undefined } } : null;
    }

    const match = url.pathname.match(/^\/lgus\/(\d+)\/edit$/);

    if (match) {
        const lgu = lgus.find(lgu => lgu.id === Number(match[1]));

        return lgu ? { component: 'LGUs/Edit', props: { lgu } } : null;
    }

    if (url.pathname !== '/lgus') {
return null;
}

    const filters = { search: (url.searchParams.get('search') || '').slice(0, 255), province: url.searchParams.get('province') || '', region: url.searchParams.get('region') || '', sort: url.searchParams.get('sort') === 'desc' ? 'desc' : 'asc' };
    const search = filters.search.trim().toLowerCase();
    const rows = lgus.filter(lgu => (!filters.province || lgu.province === filters.province) && (!filters.region || lgu.region === filters.region) && `${lgu.id}\n${lgu.municipality_name}\n${lgu.province}\n${lgu.region}\n${mayor(lgu)}`.toLowerCase().includes(search));
    rows.sort((a, b) => (compare(a.municipality_name, b.municipality_name) || a.id - b.id) * (filters.sort === 'desc' ? -1 : 1));
    const last = Math.max(1, Math.ceil(rows.length / 10));
    const requested = Number(url.searchParams.get('page'));
    const page = Number.isFinite(requested) ? Math.min(last, Math.max(1, Math.trunc(requested))) : 1;

    return { component: 'LGUs/Index', props: { lgus: { data: rows.slice((page - 1) * 10, page * 10).map(lgu => ({ ...lgu, deletion_check: lguDependencyCheck(lgu.id, relationships) })), total: rows.length, current_page: page, last_page: last, from: rows.length ? (page - 1) * 10 + 1 : null, to: rows.length ? Math.min(page * 10, rows.length) : null }, filters, provinces: unique('province'), regions: unique('region'), message: url.searchParams.get('deleted') === '1' ? 'LGU deleted successfully.' : ['created','updated'].includes(url.searchParams.get('saved')) ? `LGU ${url.searchParams.get('saved')} successfully.` : undefined } };
}
export function lguPermissionsFor(actor) {
    const authorized = ['Admin', 'SuperAdmin'].includes(actor?.account_type);

    return { can_edit: authorized, can_delete: authorized };
}
export function lguDependencyCheck(id, relationships) {
    return {
        available: Array.isArray(relationships?.roadCoverages) && Array.isArray(relationships?.engineerLgus),
        road_coverages: (relationships?.roadCoverages ?? []).filter(coverage => coverage.lgus_id === id).length,
        // Count all assignments, including inactive and orphaned engineer references.
        engineer_assignments: (relationships?.engineerLgus ?? []).filter(assignment => assignment.lgus_id === id).length,
    };
}
export function lguPage(url, relationships, actor) {
    const page = lguPageData(url, relationships);

    return page ? { ...page, props: { ...page.props, lguPermissions: lguPermissionsFor(actor), lguReviewNotice: relationships?.fixture_notice } } : null;
}
function deletionReturn(url, id) {
    try {
        const origin = url.searchParams.get('return_to');

        if (!origin || !origin.startsWith('/') || origin.startsWith('//')) {
return '/lgus';
}

        const target = new URL(origin, 'http://jairoads.local');

        if (target.origin === 'http://jairoads.local' && [ `/lgus/${id}`, '/lgus' ].includes(target.pathname)) {
return target.pathname + target.search;
}
    } catch { /* Malformed return URLs fall back to the local directory below. */ }

    return '/lgus';
}
export function mutateLgu(method, url, data, relationships, actor) {
    const match = url.pathname.match(/^\/lgus\/(\d+)$/);

    if (method === 'DELETE' && match) {
        const id = Number(match[1]);
        const location = deletionReturn(url, id);

        if (!lguPermissionsFor(actor).can_delete) {
return { location, errors: { lgu: 'Only Admin and SuperAdmin can delete LGU records.' } };
}

        const index = lgus.findIndex(lgu => lgu.id === id);

        if (index < 0) {
return { location: directoryReturn(url, id), errors: { lgu: 'This LGU is no longer available.' } };
}

        const check = lguDependencyCheck(id, relationships);

        if (!check.available) {
return { location, errors: { lgu: 'Dependency information is unavailable. LGU deletion is blocked until RoadCoverage and EngineerLGU records can be checked.' } };
}

        if (check.road_coverages || check.engineer_assignments) {
return { location, errors: { lgu: `Deletion blocked: ${check.road_coverages} associated RoadCoverage records and ${check.engineer_assignments} EngineerLGU assignments. Handle these records first; nothing was deleted or detached.` } };
}

        // No async gap between the authoritative recheck and the single-row removal.
        lgus.splice(index, 1);
        const target = new URL(directoryReturn(url, id), 'http://jairoads.local');
        target.searchParams.delete('saved'); target.searchParams.set('deleted', '1');

        return { location: target.pathname + target.search };
    }

    if (!(method === 'POST' && url.pathname === '/lgus') && !(method === 'PUT' && match)) {
return null;
}

    if (!lguPermissionsFor(actor).can_edit) {
return { location: '/lgus', errors: { lgu: 'Only Admin and SuperAdmin can manage LGU records.' } };
}

    const current = match ? lgus.find(lgu => lgu.id === Number(match[1])) : null;

    if (match && !current) {
return null;
}

    const errors = {}, values = {};
    const labels = ['Municipality Name', 'Province', 'Region', 'Mayor’s First Name', 'Mayor’s Middle Name', 'Mayor’s Last Name'];
    fields.forEach((key, i) => {
        if (data[key] != null && typeof data[key] !== 'string') {
 errors[key] = 'Enter a text value.';

 return;
}

        values[key] = (data[key] || '').trim();

        if (key !== 'mayor_middle_name' && !values[key]) {
errors[key] = `${labels[i]} is required.`;
} else if (values[key].length > 255) {
errors[key] = 'Use 255 characters or fewer.';
}
    });

    if (Object.keys(errors).length) {
return { location: current ? `/lgus/${current.id}/edit${url.search}` : `/lgus/create${url.search}`, errors };
}

    if (current) {
Object.assign(current, values);
} else {
lgus.push({ id: nextId++, ...values });
}

    return current
        ? { location: `/lgus/${current.id}?${new URLSearchParams({ return_to: directoryReturn(url, current.id), saved: 'updated' })}` }
        : { location: `/lgus?${new URLSearchParams({ search: values.municipality_name, sort: 'asc', saved: 'created' })}` };
}

// Read-only reference data for related preview directories. Never expose mutable LGU storage.
export function lguPreviewOptions() {
    return lgus.map(({ id, municipality_name }) => ({ id, municipality_name }));
}

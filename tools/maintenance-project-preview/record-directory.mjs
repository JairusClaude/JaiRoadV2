import { records, recordSummaries } from './records.mjs';

// A read-only projection of the same process-local ownership graph used by
// Project Details and the existing Add/Edit/Delete preview workflows.
export function recordDirectoryData(projects, summary, url, integration) {
    const joined = projects.flatMap(project => recordSummaries(project.id).map(record => ({
        ...record,
        project: { id: project.id, project_title: project.project_title, municipality: summary(project).municipality },
    })));
    const filters = {
        search: (url.searchParams.get('search') || '').slice(0, 255),
        municipality: url.searchParams.get('municipality') || '',
        year: url.searchParams.get('year') || '',
        quarter: url.searchParams.get('quarter') || '',
        status: url.searchParams.get('status') || '',
        sort: url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest',
    };
    const query = filters.search.trim().toLocaleLowerCase();
    const rows = integration.ready ? joined.filter(record => {
        const engineer = record.managing_engineer;
        const name = engineer ? [engineer.first_name, engineer.middle_name, engineer.last_name].filter(Boolean).join(' ') : '';

        return (!query || [record.project.project_title, String(record.id), `Record ID: ${record.id}`, name].some(value => value.toLocaleLowerCase().includes(query)))
            && (!filters.municipality || filters.municipality === record.project.municipality)
            && (!filters.year || String(record.year) === filters.year)
            && (!filters.quarter || record.quarter === filters.quarter)
            && (!filters.status || record.status === filters.status);
    }) : [];
    rows.sort((a, b) => {
        const period = a.year - b.year || a.quarter.localeCompare(b.quarter) || a.id - b.id;

        return filters.sort === 'oldest' ? period : -period;
    });
    const lastPage = Math.max(1, Math.ceil(rows.length / 10));
    const currentPage = Math.max(1, Math.min(lastPage, Number(url.searchParams.get('page')) || 1));

    return {
        records: { data: rows.slice((currentPage - 1) * 10, currentPage * 10), total: rows.length, current_page: currentPage, last_page: lastPage, from: rows.length ? (currentPage - 1) * 10 + 1 : null, to: rows.length ? Math.min(currentPage * 10, rows.length) : null, links: [] },
        municipalities: [...new Set(joined.map(record => record.project.municipality).filter(Boolean))].sort().map(value => ({ value, label: value })),
        years: [...new Set(records.map(record => record.year))].sort((a, b) => b - a),
        projects: integration.ready ? projects.map(project => {
 const item = summary(project);

 return { id: item.id, project_title: item.project_title, municipality: item.municipality };
}) : [],
        filters, integration, canCreate: integration.ready,
    };
}

export function recordDirectoryReturn(url) {
    const value = url.searchParams.get('return_to');

    if (!value || !/^\/maintenance-records(?:\?|$)/.test(value)) {
return null;
}

    const destination = new URL(value, 'http://preview.local');
    // Only known directory parameters survive. Never redirect to an arbitrary URL.
    const query = new URLSearchParams();

    for (const key of ['search', 'municipality', 'year', 'quarter', 'status', 'sort', 'page']) {
        if (destination.searchParams.has(key)) {
query.set(key, destination.searchParams.get(key));
}
    }

    return `/maintenance-records${query.size ? `?${query}` : ''}`;
}

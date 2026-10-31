// Whole-road development fixtures only. No legacy Road Section data or invented geometry.
export function initializeRoadCoveragePreview(choices, lgus, engineers, relationships) {
    const records = relationships.roadCoverages;

    if (!Array.isArray(records) || !engineers.length) {
throw new Error('Road Coverage preview reference data is unavailable.');
}

    const pavements = ['Concrete', 'Asphalt', 'Gravel', 'Earth'];
    const conditions = ['Good', 'Fair', 'Bad'];

    // Existing opt-in LGU dependency fixtures retain their identities and associations.
    for (const record of records) {
        record.geojson ??= null;
        record.created_by ??= engineers[0].id;
        record.created_at ??= '2026-09-30T08:00:00.000Z';
        record.updated_at ??= record.created_at;
    }

    for (const [index, choice] of choices.entries()) {
        if (records.some(record => record.id === choice.id)) {
continue;
}

        const lgu = lgus.find(lgu => lgu.municipality_name === choice.municipality);

        if (!lgu) {
throw new Error('A Road Coverage fixture has no valid LGU.');
}

        const created = new Date(Date.UTC(2026, 9, index + 1, 8)).toISOString();
        records.push({ id: choice.id, road_name: choice.road_name, lgus_id: lgu.id, kilometers: choice.kilometers,
            pavement_type: pavements[index % pavements.length], state_category: conditions[index % conditions.length],
            geojson: null, created_by: engineers[index % engineers.length].id, created_at: created, updated_at: created });
    }
}
const compare = (a,b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
export function roadCoverageDirectoryData(records, lgus, url) {
    const filterValue = (key, allowed) => allowed.includes(url.searchParams.get(key)) ? url.searchParams.get(key) : '';
    const filters = { search: (url.searchParams.get('search') || '').slice(0,255), municipality: url.searchParams.get('municipality') || '',
        condition: filterValue('condition', ['Good','Fair','Bad']), pavement: filterValue('pavement', ['Concrete','Asphalt','Gravel','Earth']),
        sort: filterValue('sort', ['newest','oldest','name-asc','name-desc']) || 'newest' };
    const joined = records.flatMap(record => {
        const lgu = lgus.find(lgu => lgu.id === record.lgus_id);

        return lgu ? [{ ...record, lgu: { id: lgu.id, municipality_name: lgu.municipality_name } }] : [];
    });
    const rows = joined.filter(record => record.road_name.toLowerCase().includes(filters.search.trim().toLowerCase()) && (!filters.municipality || String(record.lgus_id) === filters.municipality) && (!filters.condition || record.state_category === filters.condition) && (!filters.pavement || record.pavement_type === filters.pavement));
    rows.sort((a,b) => filters.sort.startsWith('name-') ? (compare(a.road_name,b.road_name) || a.id-b.id) * (filters.sort==='name-desc' ? -1 : 1) : (a.created_at.localeCompare(b.created_at) || a.id-b.id) * (filters.sort==='oldest' ? 1 : -1));
    const last = Math.max(1,Math.ceil(rows.length/10));const requested = Number(url.searchParams.get('page'));
    const page = Number.isFinite(requested) ? Math.max(1,Math.min(last,Math.trunc(requested))) : 1;

    return { coverages: { data: rows.slice((page-1)*10,page*10), total: rows.length, current_page: page, last_page: last, from: rows.length ? (page-1)*10+1 : null, to: rows.length ? Math.min(page*10,rows.length) : null }, municipalities: [...lgus].sort((a,b)=>compare(a.municipality_name,b.municipality_name)), filters };
}

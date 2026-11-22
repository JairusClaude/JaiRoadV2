// Isolated preview equivalent of the canonical allowlist.
export function relatedEditReturn(requestUrl, directory, id, record) {
    const detail = directory + '/' + id;
    const origin = requestUrl.searchParams.get('return_to');

    if (!origin || !origin.startsWith('/') || origin.startsWith('//') || [...origin].some((character) =>
        character.charCodeAt(0) <= 32 ||
        character.charCodeAt(0) === 127 ||
        character === '\\',
    )) {
return detail;
}

    try {
        const url = new URL(origin, 'http://jairoads.local');
        const parent = '/maintenance-projects/' + record.project_id + '/records/' + record.id;

        return url.origin === 'http://jairoads.local' && [directory, detail, parent].includes(url.pathname)
            ? url.pathname + url.search : detail;
    } catch {
        return detail;
    }
}

// Explicit form origins survive refresh; only the relevant directory or entity
// details can be used. Never infer an origin from the last unrelated visit.
export function editUrl(url: string, origin: string) {
    const target = new URL(url, 'http://jairoads.local');
    target.searchParams.set('return_to', origin);

    return target.pathname + target.search;
}

export function formReturn(
    pageUrl: string,
    fallback: string,
    directories: string[],
) {
    const origin = new URL(pageUrl, 'http://jairoads.local').searchParams.get(
        'return_to',
    );

    if (!origin || !origin.startsWith('/') || origin.startsWith('//')) {
        return fallback;
    }

    try {
        const parsed = new URL(origin, 'http://jairoads.local');
        const detail = new URL(fallback, 'http://jairoads.local').pathname;

        return parsed.origin === 'http://jairoads.local' &&
            (parsed.pathname === detail ||
                directories.includes(parsed.pathname))
            ? parsed.pathname + parsed.search + parsed.hash
            : fallback;
    } catch {
        return fallback;
    }
}

export function returnLabel(url: string, fallback: string) {
    const path = url.split('?')[0];

    return (
        (
            {
                '/maintenance-projects': 'Maintenance Projects',
                '/maintenance-records': 'Maintenance Records',
                '/monthly-updates': 'Monthly Updates',
            } as Record<string, string>
        )[path] ?? fallback
    );
}

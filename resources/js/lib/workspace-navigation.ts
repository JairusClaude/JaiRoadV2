const modules =
    /^\/(road-coverages|maintenance-projects|maintenance-records|monthly-updates|maintenance-documents|lgus)([/?#]|$)/;

/** Presentation URLs only. All reads/writes still require canonical server authorization. */
export function workspaceHref(url: string): string {
    if (url.startsWith('/workspace/')) {
        return url;
    }

    const canonical =
        typeof window !== 'undefined' &&
        (window.location.pathname.startsWith('/jairoads-android-pilot/workspace.html') ||
            window.location.pathname.startsWith('/workspace') ||
            window.location.pathname.startsWith('/user-management') ||
            window.location.pathname.startsWith('/audit-logs') ||
            window.location.port === '8080');

    if (!canonical) {
        return url;
    }

    const file = /^\/preview-documents\/(\d+)/.exec(url);

    if (file) {
        return `/workspace/files/document/${file[1]}`;
    }

    return modules.test(url) ? `/workspace/ui${url}` : url;
}

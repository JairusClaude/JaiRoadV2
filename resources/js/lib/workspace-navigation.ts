const modules =
    /^\/(road-coverages|maintenance-projects|maintenance-records|monthly-updates|maintenance-documents)([/?#]|$)/;

/** Presentation URLs only. All reads/writes still require canonical server authorization. */
export function workspaceHref(url: string): string {
    const canonical =
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/dd-phase3/ui/');

    if (!canonical || url.startsWith('/dd-phase3/')) {
        return url;
    }

    const file = /^\/preview-documents\/(\d+)/.exec(url);

    if (file) {
        return `/dd-phase3/files/document/${file[1]}`;
    }

    return modules.test(url) ? `/dd-phase3/ui${url}` : url;
}

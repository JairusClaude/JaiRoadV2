import { http, HttpCancelledError, HttpNetworkError, HttpResponseError } from '@inertiajs/core';
import type { HttpClient, HttpRequestConfig, HttpResponse, Page } from '@inertiajs/core';

export type FieldBridge = {
    initial: Page;
    request: (config: HttpRequestConfig, fallback?: boolean) => Promise<HttpResponse | null>;
    observe: (response: HttpResponse) => boolean;
    current: (page: Page) => void;
    resource: (url: string, force?: boolean) => Promise<Response | null>;
    exportFile: (url: string) => Promise<boolean>;
    hasLocalFile: (url:string) => boolean;
    status: () => { offline: boolean; message: string };
    ready: () => void;
    fail: () => void;
    lock: () => void;
};

export function androidWorkspace(): FieldBridge | undefined {
    if (typeof window === 'undefined' || window.parent === window || !navigator.userAgent.includes('JaiROADSField/')) return;
    try {
        if (window.parent.location.origin !== location.origin ||
            window.parent.location.pathname !== '/jairoads-android-pilot/index.html') return;
        return (window.parent as Window & { JaiRoadsSharedWorkspace?: FieldBridge }).JaiRoadsSharedWorkspace;
    } catch { return; }
}

export function fieldHttp(bridge: FieldBridge): HttpClient {
    const original = http.getClient();
    return {
        async request(config) {
            if (config.signal?.aborted) throw new HttpCancelledError('Request was cancelled', config.url);
            const local = await bridge.request(config);
            if (local) return local;
            try {
                const response = await original.request(config);
                if (!bridge.observe(response)) throw new HttpCancelledError('Workspace locked',config.url);
                return response;
            } catch (error) {
                // Never replay a failed online mutation: its result may be ambiguous.
                if (config.method.toLowerCase() === 'get' &&
                    (error instanceof HttpNetworkError || (error instanceof HttpResponseError && error.response.status >= 500))) {
                    const fallback = await bridge.request(config, true);
                    if (fallback) return fallback;
                }
                throw error;
            }
        },
    };
}

export function installFieldResources(bridge: FieldBridge) {
    const onlineFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, location.origin);
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (method === 'GET' && url.origin === location.origin && url.pathname.startsWith('/workspace/')) {
            const cached = await bridge.resource(url.href);
            if (cached) return cached;
            try {
                const response = await onlineFetch(input, init);
                if (response.status >= 500) return await bridge.resource(url.href, true) ?? response;
                return response;
            } catch (error) {
                if (init?.signal?.aborted) throw error;
                const cached = await bridge.resource(url.href, true);
                if (cached) return cached;
                throw error;
            }
        }
        return onlineFetch(input, init);
    };
    document.addEventListener('click', (event) => {
        const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
        if (!link || !/^\/workspace\/files\/(document|media)\/\d+$/.test(new URL(link.href).pathname)) return;
        if (new URL(link.href).origin !== location.origin) return;
        if (bridge.status().offline || bridge.hasLocalFile(link.href)) {
            event.preventDefault();
            void bridge.exportFile(link.href);
        }
    }, true);
}

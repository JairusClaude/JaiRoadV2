import { useSyncExternalStore } from 'react';

function viewport(query: string) {
    const media =
        typeof window === 'undefined' ? undefined : window.matchMedia(query);

    return {
        subscribe(callback: () => void) {
            media?.addEventListener('change', callback);

            return () => media?.removeEventListener('change', callback);
        },
        matches: () => media?.matches ?? false,
    };
}

// Tablets share the navigation drawer. Phone dialogs use the smaller breakpoint.
const mobile = viewport('(max-width: 1023px)');
const phone = viewport('(max-width: 639px)');
const serverSnapshot = () => false;

export function useIsMobile(): boolean {
    return useSyncExternalStore(
        mobile.subscribe,
        mobile.matches,
        serverSnapshot,
    );
}

export function useIsPhone(): boolean {
    return useSyncExternalStore(phone.subscribe, phone.matches, serverSnapshot);
}

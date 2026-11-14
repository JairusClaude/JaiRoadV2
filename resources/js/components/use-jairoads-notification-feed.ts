import { useCallback, useEffect, useRef, useState } from 'react';

export type JaiRoadsNotice = {
    id: number;
    notification_message: string;
    created_at: string;
};
export type NoticeStatus = 'idle' | 'loading' | 'ready' | 'error';
const TIMEOUT_MS = 10000;

/** Read-only personal notifications. Each attempt reaches ready or error within 10 seconds. */
export function useJaiRoadsNotificationFeed() {
    const [status, setStatus] = useState<NoticeStatus>('idle');
    const [items, setItems] = useState<JaiRoadsNotice[]>([]);
    const [message, setMessage] = useState('');
    const generation = useRef(0);
    const pending = useRef<AbortController | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mounted = useRef(true);

    const clearPending = useCallback(() => {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = null;
        pending.current?.abort();
        pending.current = null;
    }, []);

    const cancel = useCallback(() => {
        generation.current += 1;
        clearPending();

        if (mounted.current) {
            setStatus((previous) =>
                previous === 'loading' ? 'idle' : previous,
            );
        }
    }, [clearPending]);

    const refresh = useCallback(async () => {
        clearPending();
        const id = ++generation.current;
        const controller = new AbortController();
        pending.current = controller;
        setStatus('loading');
        setMessage('');
        // Independently settle the UI on timeout, even if the transport never rejects.
        timeoutRef.current = setTimeout(() => {
            if (!mounted.current || generation.current !== id) {
                return;
            }

            pending.current = null;
            timeoutRef.current = null;
            generation.current += 1;
            setStatus('error');
            setItems([]);
            setMessage(
                'The notification request timed out. Use Retry, or check /jairoads/notifications in your browser.',
            );
            controller.abort();
        }, TIMEOUT_MS);

        try {
            const response = await fetch('/jairoads/notifications', {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                signal: controller.signal,
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 419) {
                    throw new Error(
                        'Your session expired. Sign in again to view notifications.',
                    );
                }

                if (response.status === 403) {
                    throw new Error(
                        'This account is not authorized to view notifications.',
                    );
                }

                throw new Error(
                    `Notifications could not load (HTTP ${response.status}).`,
                );
            }

            if (
                !(response.headers.get('content-type') ?? '')
                    .toLowerCase()
                    .includes('application/json')
            ) {
                throw new Error(
                    'Notifications returned an HTML page instead of JSON. Verify the route and session.',
                );
            }

            const payload: unknown = await response.json();

            if (
                !payload ||
                typeof payload !== 'object' ||
                !('notifications' in payload) ||
                !Array.isArray(payload.notifications)
            ) {
                throw new Error(
                    'Notification API returned an unexpected response format.',
                );
            }

            const valid = payload.notifications.every(
                (item: unknown): item is JaiRoadsNotice =>
                    !!item &&
                    typeof item === 'object' &&
                    'id' in item &&
                    typeof item.id === 'number' &&
                    'notification_message' in item &&
                    typeof item.notification_message === 'string' &&
                    'created_at' in item &&
                    typeof item.created_at === 'string',
            );

            if (!valid) {
                throw new Error(
                    'Notification API returned invalid message fields.',
                );
            }

            if (!mounted.current || generation.current !== id) {
                return;
            }

            setItems(payload.notifications);
            setStatus('ready');
        } catch (error) {
            if (!mounted.current || generation.current !== id) {
                return;
            }

            setItems([]);
            setStatus('error');
            setMessage(
                error instanceof Error
                    ? error.message
                    : 'Notifications could not load.',
            );
        } finally {
            if (generation.current === id) {
                if (timeoutRef.current !== null) {
                    clearTimeout(timeoutRef.current);
                }

                timeoutRef.current = null;
                pending.current = null;
            }
        }
    }, [clearPending]);

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;
            generation.current += 1;
            clearPending();
        };
    }, [clearPending]);

    return { status, items, message, refresh, cancel };
}

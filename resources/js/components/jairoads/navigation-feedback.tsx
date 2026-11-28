import { router } from '@inertiajs/react';
import { WifiOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { androidWorkspace } from '@/lib/android-workspace-bridge';
import '../../../css/jairoads-navigation-ux.css';

/**
 * Global, non-blocking Inertia navigation feedback.
 * Progress remains indeterminate until the server completes the request;
 * this UI never claims a slow request is finished.
 */
export function JaiRoadsNavigationFeedback() {
    const [message, setMessage] = useState<
        'hidden' | 'loading' | 'slow' | 'very-slow'
    >('hidden');
    const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const slowRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const verySlowRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let pending = false;
        let currentPath = window.location.pathname.replace(/\/$/, '') || '/';
        let motionFrame = 0;
        let activeMotion: Animation[] = [];
        const cancelMotion = () => {
            if (motionFrame) {
                window.cancelAnimationFrame(motionFrame);
            }

            motionFrame = 0;
            activeMotion.forEach((animation) => animation.cancel());
            activeMotion = [];
        };
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        const animateDestination = () => {
            cancelMotion();

            if (
                reduced.matches ||
                document.documentElement.classList.contains('jr-reduce-motion')
            ) {
                return;
            }

            // Wait for the destination commit, not for an arbitrary animation delay.
            motionFrame = window.requestAnimationFrame(() => {
                motionFrame = window.requestAnimationFrame(() => {
                    motionFrame = 0;

                    if (
                        reduced.matches ||
                        document.documentElement.classList.contains(
                            'jr-reduce-motion',
                        )
                    ) {
                        return;
                    }

                    const content = document.querySelector<HTMLElement>(
                        'main.jr-content, main.jr-responsive-main',
                    );

                    if (!content || typeof content.animate !== 'function') {
                        return;
                    }

                    // Opacity only on the main container: preserve sticky/fixed geometry,
                    // map canvases, scroll position and the persistent navigation shell.
                    activeMotion.push(
                        content.animate([{ opacity: 0.88 }, { opacity: 1 }], {
                            duration: 180,
                            easing: 'cubic-bezier(.2,.8,.2,1)',
                        }),
                    );
                    const heading = content.querySelector<HTMLElement>('h1');

                    if (heading) {
                        activeMotion.push(
                            heading.animate(
                                [
                                    { transform: 'translateY(4px)' },
                                    { transform: 'translateY(0)' },
                                ],
                                {
                                    duration: 220,
                                    easing: 'cubic-bezier(.2,.8,.2,1)',
                                },
                            ),
                        );
                    }
                });
            });
        };
        reduced.addEventListener('change', cancelMotion);
        const clearTimers = () => {
            if (delayRef.current) {
                clearTimeout(delayRef.current);
            }

            if (slowRef.current) {
                clearTimeout(slowRef.current);
            }

            if (verySlowRef.current) {
                clearTimeout(verySlowRef.current);
            }

            delayRef.current = null;
            slowRef.current = null;
            verySlowRef.current = null;
        };
        const start = (pageNavigation: boolean) => {
            clearTimers();
            pending = true;
            setMessage('hidden');

            // Avoid flicker on fast visits and redundant indicators on local form actions.
            if (pageNavigation) {
                delayRef.current = setTimeout(() => {
                    if (pending) {
                        setMessage('loading');
                    }
                }, 350);
            }

            slowRef.current = setTimeout(() => {
                if (pending) {
                    setMessage('slow');
                }
            }, 5000);
            verySlowRef.current = setTimeout(() => {
                if (pending) {
                    setMessage('very-slow');
                }
            }, 20000);
        };
        const finish = () => {
            pending = false;
            clearTimers();
            setMessage('hidden');
        };

        // Inertia returns unsubscribe functions. Strict Mode cleans these up.
        const offStart = router.on('start', (event) => {
            cancelMotion();
            const path = window.location.pathname.replace(/\/$/, '');
            const target =
                event.detail.visit.url.pathname.replace(/\/$/, '') || '/';
            start(
                event.detail.visit.method.toLowerCase() === 'get' &&
                    target !== (path || '/'),
            );
        });
        const offNavigate = router.on('navigate', (event) => {
            const nextPath =
                new URL(
                    event.detail.page.url,
                    window.location.origin,
                ).pathname.replace(/\/$/, '') || '/';
            const changedPage = nextPath !== currentPath;
            currentPath = nextPath;

            if (changedPage) {
                animateDestination();
            }
        });
        const offFinish = router.on('finish', () => {
            finish();
        });

        return () => {
            pending = false;
            clearTimers();
            cancelMotion();
            reduced.removeEventListener('change', cancelMotion);
            offStart();
            offNavigate();
            offFinish();
        };
    }, []);

    if (message === 'hidden') {
        return null;
    }

    const slot = document.querySelector('[data-jr-navigation-status]');
    const label =
        message === 'loading'
            ? 'Opening page…'
            : message === 'slow'
              ? 'Still loading…'
              : 'Waiting for server…';
    const announcement =
        message === 'very-slow'
            ? 'Still waiting for the server. You can continue navigating.'
            : label;
    const indicator = (
        <span
            className={`jr-navigation-status${slot ? '' : 'jr-navigation-status-fallback'}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            title={announcement}
        >
            <span className="jr-navigation-status-dot" aria-hidden="true" />
            <span className="jr-navigation-status-label" aria-hidden="true">
                {label}
            </span>
            <span className="sr-only">{announcement}</span>
        </span>
    );

    // Keep feedback in the existing workspace header, never on the browser edge.
    // Outside a workspace, local form controls handle short waits.
    return slot
        ? createPortal(indicator, slot)
        : message === 'loading'
          ? null
          : indicator;
}

export function AndroidFieldFeedback() {
    const [offline, setOffline] = useState(false);
    const [fieldMessage, setFieldMessage] = useState('');

    useEffect(() => {
        if (!navigator.userAgent.includes('JaiROADSField/')) {
            return;
        }

        const update = () => {
            const workspace = document.querySelector(
                '.jr-engineer-workspace, .jr-viewer-workspace, .jr-admin-workspace, .jr-superadmin-workspace',
            );
            const status = androidWorkspace()?.status();
            const message =
                status?.message ?? (!navigator.onLine ? 'Offline Mode' : '');
            const show = Boolean(workspace) && Boolean(message);
            document.body.classList.toggle('jr-android-hosted-offline', show);
            setOffline(show);
            setFieldMessage(message);
        };
        const offNavigate = router.on('navigate', () =>
            requestAnimationFrame(update),
        );
        update();
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        window.addEventListener('jairoads-field-status', update);
        const fieldNotice = (event: Event) => {
            const message = (event as CustomEvent<string>).detail;

            if (message) {
                toast.error(message, { id: 'jr-field-local-error' });
            }
        };
        window.addEventListener('jairoads-field-message', fieldNotice);
        const stopRawError = router.on('httpException', (event) => {
            const status = event.detail.response.status;

            if (status >= 500 || status === 419 || status === 401) {
                toast.error(
                    status === 401 || status === 419
                        ? 'Your online session expired. Your local field work is still available.'
                        : 'JaiROADS could not complete that request. Try again when the server is available.',
                    { id: 'jr-android-request-error' },
                );

                return false;
            }
        });

        return () => {
            offNavigate();
            stopRawError();
            window.removeEventListener('online', update);
            window.removeEventListener('offline', update);
            window.removeEventListener('jairoads-field-status', update);
            window.removeEventListener('jairoads-field-message', fieldNotice);
            document.body.classList.remove('jr-android-hosted-offline');
        };
    }, []);

    if (!offline) {
        return null;
    }

    return createPortal(
        <div className="jr-android-hosted-banner" role="status">
            <WifiOff size={17} aria-hidden="true" />{' '}
            {fieldMessage || 'Offline Mode'}
        </div>,
        document.body,
    );
}

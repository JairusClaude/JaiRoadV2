import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import '../../../css/jairoads-navigation-ux.css';

// Presentation only: the role comes from the authenticated destination's server props.
const handoffRoles = {
    superadmin: { label: 'SuperAdmin', accent: '#51269b', deep: '#26104d' },
    admin: { label: 'Admin', accent: '#c8293d', deep: '#801827' },
    engineer: { label: 'Engineer', accent: '#a94b0c', deep: '#69310e' },
    viewer: { label: 'Viewer', accent: '#1d5db5', deep: '#163e78' },
} as const;

function showAuthenticatedHandoff(props: unknown) {
    const page = props as {
        auth?: { user?: unknown };
        jairoadsIdentity?: { role?: string };
        identity?: { role?: string };
    } | null;
    const role = (page?.jairoadsIdentity?.role ?? page?.identity?.role ?? '').toLowerCase();
    if (!page?.auth?.user || !Object.prototype.hasOwnProperty.call(handoffRoles, role) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.classList.contains('jr-reduce-motion')) {
        return;
    }
    const palette = handoffRoles[role as keyof typeof handoffRoles];
    document.querySelector('.jr-auth-handoff')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'jr-auth-handoff';
    overlay.dataset.role = role;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.style.setProperty('--jr-handoff-accent', palette.accent);
    overlay.style.setProperty('--jr-handoff-deep', palette.deep);
    const logo = document.createElement('img');
    logo.src = '/images/jairoads/peo-ddo-transparent.webp';
    logo.alt = '';
    const brand = document.createElement('strong');
    brand.textContent = 'JaiROADS';
    const status = document.createElement('span');
    status.textContent = `Opening your ${palette.label} workspace…`;
    const track = document.createElement('div');
    track.className = 'jr-auth-handoff-track';
    track.setAttribute('aria-hidden', 'true');
    overlay.append(logo, brand, status, track);
    // The new page may already be mounted; this synchronous cover prevents
    // showing the dashboard until the brief color handoff has completed.
    document.body.append(overlay);
    const cleanup = () => overlay.remove();
    overlay.addEventListener('animationend', (event) => {
        if (event.target === overlay) cleanup();
    });
    window.setTimeout(cleanup, 1100);
}

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
        let authAttempt = false;
        let currentPath = window.location.pathname.replace(/\/$/, '') || '/';
        let motionFrame = 0;
        let activeMotion: Animation[] = [];
        const cancelMotion = () => {
            if (motionFrame) window.cancelAnimationFrame(motionFrame);
            motionFrame = 0;
            activeMotion.forEach(animation => animation.cancel());
            activeMotion = [];
        };
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        const animateDestination = () => {
            cancelMotion();
            if (reduced.matches || document.documentElement.classList.contains('jr-reduce-motion')) return;
            // Wait for the destination commit, not for an arbitrary animation delay.
            motionFrame = window.requestAnimationFrame(() => {
                motionFrame = window.requestAnimationFrame(() => {
                    motionFrame = 0;
                    if (reduced.matches || document.documentElement.classList.contains('jr-reduce-motion')) return;
                    const content = document.querySelector<HTMLElement>('main.jr-content, main.jr-responsive-main');
                    if (!content || typeof content.animate !== 'function') return;
                    // Opacity only on the main container: preserve sticky/fixed geometry,
                    // map canvases, scroll position and the persistent navigation shell.
                    activeMotion.push(content.animate(
                        [{ opacity: .88 }, { opacity: 1 }],
                        { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' },
                    ));
                    const heading = content.querySelector<HTMLElement>('h1');
                    if (heading) activeMotion.push(heading.animate(
                        [{ transform: 'translateY(4px)' }, { transform: 'translateY(0)' }],
                        { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' },
                    ));
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
        const start = () => {
            clearTimers();
            pending = true;
            setMessage('hidden');
            delayRef.current = setTimeout(() => {
                if (pending) {
                    setMessage('loading');
                }
            }, 220);
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
            authAttempt = (path === '/login') &&
                event.detail.visit.method.toLowerCase() === 'post';
            start();
        });
        const offNavigate = router.on('navigate', (event) => {
            const nextPath = new URL(event.detail.page.url, window.location.origin).pathname.replace(/\/$/, '') || '/';
            const changedPage = nextPath !== currentPath;
            currentPath = nextPath;
            if (authAttempt && !event.detail.page.component.startsWith('auth/')) {
                authAttempt = false;
                cancelMotion();
                showAuthenticatedHandoff(event.detail.page.props);
            } else if (changedPage) {
                animateDestination();
            }
        });
        const offFinish = router.on('finish', () => {
            authAttempt = false;
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

    return (
        <div
            className="jr-loading-layer"
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            <div className="jr-loading-track" aria-hidden="true">
                <div className="jr-loading-track-stripe" />
            </div>
            {message === 'loading' && <span className="sr-only">Loading…</span>}
            {message !== 'loading' && <div className="jr-loading-notice">
                <span className="jr-loading-road" aria-hidden="true">
                    <span />
                </span>
                <span>
                    {message === 'very-slow'
                        ? 'Still waiting for the server. Navigation has not finished.'
                        : message === 'slow'
                          ? 'Still loading… the server is taking longer than usual.'
                          : 'Opening JaiROADS page…'}
                </span>
            </div>}
        </div>
    );
}

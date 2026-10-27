import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
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
        const offStart = router.on('start', start);
        const offFinish = router.on('finish', finish);

        return () => {
            pending = false;
            clearTimers();
            offStart();
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
            <div className="jr-loading-notice">
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
            </div>
        </div>
    );
}

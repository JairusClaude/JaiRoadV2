import { router } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import { manilaTimestamp } from '@/lib/manila-time';

export function DashboardRefresh({ className }: { className: string }) {
    const pending = useRef(false);
    const [refreshing, setRefreshing] = useState(false);
    const [updated, setUpdated] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);

    function refresh() {
        if (pending.current) {
            return;
        }

        pending.current = true;
        setRefreshing(true);
        setFailed(false);

        const fail = () => {
            setFailed(true);

            return false;
        };

        router.reload({
            onSuccess: () => setUpdated(new Date().toISOString()),
            onError: fail,
            onHttpException: fail,
            onNetworkError: fail,
            onFinish: () => {
                pending.current = false;
                setRefreshing(false);
            },
        });
    }

    return (
        <div className="jr-dashboard-refresh">
            <div role="status" className="jr-dashboard-refresh-status">
                {failed ? (
                    'Refresh failed. Previous data is still shown.'
                ) : (
                    <>
                        Last updated{' '}
                        {updated ? (
                            <time dateTime={updated}>
                                {manilaTimestamp(updated)}
                            </time>
                        ) : (
                            'on page load'
                        )}
                    </>
                )}
            </div>
            <button
                type="button"
                className={className}
                aria-label={
                    failed ? 'Retry dashboard refresh' : 'Refresh dashboard'
                }
                aria-busy={refreshing}
                disabled={refreshing}
                onClick={refresh}
            >
                <RefreshCw
                    className={
                        refreshing
                            ? 'size-4 motion-safe:animate-spin'
                            : 'size-4'
                    }
                    aria-hidden="true"
                />
                {refreshing ? 'Refreshing…' : failed ? 'Retry' : 'Refresh'}
            </button>
        </div>
    );
}

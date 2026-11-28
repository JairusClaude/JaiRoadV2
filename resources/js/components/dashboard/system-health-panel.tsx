import { manilaTimestamp } from '@/lib/manila-time';

export type SystemHealth = {
    databaseReadSucceeded: boolean;
    documentStorageConfigured: boolean;
    mediaStorageConfigured: boolean;
    recovery: {
        deletion_enabled: boolean;
        schedule_enabled: boolean;
        shared_cache_configured: boolean;
        registration_allowed: boolean;
    };
    recoveryCounts?: {
        pending: number;
        retried: number;
        completed: number;
        review_required?: number;
        retryable?: number;
        unattempted?: number;
        oldest_pending_at?: string | null;
    } | null;
    lastRecoveryRun?: {
        finished_at: string;
        trigger?: 'manual' | 'scheduled' | 'unknown';
        attempted: number;
        completed: number;
        pending: number;
        budget_reached: boolean;
        age_seconds: number;
        stale: boolean;
    } | null;
    deploymentRevision?: string | null;
    checkedAt: string;
};

export function SystemHealthPanel({ health }: { health: SystemHealth }) {
    const oldest = health.recoveryCounts?.oldest_pending_at;
    const lastRun = health.lastRecoveryRun;
    const entries = [
        {
            label: 'Database',
            detail: health.databaseReadSucceeded
                ? 'Dashboard queries succeeded'
                : 'Read not verified',
        },
        {
            label: 'Document Storage',
            detail: health.documentStorageConfigured
                ? 'Configured · access unverified'
                : 'Not configured',
        },
        {
            label: 'Monthly media Storage',
            detail: health.mediaStorageConfigured
                ? 'Configured · access unverified'
                : 'Not configured',
        },
        {
            label: 'Recovery scheduler',
            detail: health.recovery.registration_allowed
                ? 'Registration allowed · execution unverified'
                : 'Registration blocked by configuration',
        },
        {
            label: 'Last observed recovery batch',
            detail: lastRun ? (
                <>
                    <time dateTime={lastRun.finished_at}>
                        {manilaTimestamp(lastRun.finished_at)}
                    </time>
                    <p>
                        {lastRun.attempted} attempted · {lastRun.completed}{' '}
                        completed · {lastRun.pending} still pending
                    </p>
                    <p>
                        {lastRun.budget_reached
                            ? 'Time budget reached'
                            : 'Batch finished'}
                        {' · '}
                        {lastRun.trigger === 'scheduled'
                            ? 'Scheduled invocation requested'
                            : lastRun.trigger === 'manual'
                              ? 'Manual invocation'
                              : 'Invocation source unknown'}
                    </p>
                    <p>
                        {lastRun.stale
                            ? 'Evidence older than 15 minutes; verify runner.'
                            : 'Recent batch evidence; scheduler not verified.'}
                    </p>
                </>
            ) : (
                'No recent execution evidence available'
            ),
        },
        {
            label: 'Shared locking',
            detail: health.recovery.shared_cache_configured
                ? 'Compatible driver configured · lock unverified'
                : 'Shared lock driver not configured',
        },
        {
            label: 'File recovery queue',
            detail: health.recoveryCounts
                ? `${health.recoveryCounts.pending} pending · ${health.recoveryCounts.retried} previously attempted · ${health.recoveryCounts.completed} completed`
                : 'Recovery intent table unavailable',
        },
        {
            label: 'Pending recovery breakdown',
            detail: health.recoveryCounts
                ? `${health.recoveryCounts.review_required ?? 0} last failed a safeguard · ${health.recoveryCounts.retryable ?? 0} last failed Storage or finalization · ${health.recoveryCounts.unattempted ?? 0} not yet attempted`
                : 'Recovery queue unavailable',
        },
        {
            label: 'Oldest pending recovery',
            detail: health.recoveryCounts ? (
                oldest ? (
                    <time dateTime={oldest}>{manilaTimestamp(oldest)}</time>
                ) : (
                    'None recorded'
                )
            ) : (
                'Recovery queue unavailable'
            ),
        },
        {
            label: 'Deployment revision',
            detail: health.deploymentRevision ? (
                <code title={health.deploymentRevision}>
                    {health.deploymentRevision.slice(0, 12)}
                </code>
            ) : (
                'Unavailable'
            ),
        },
        {
            label: 'Backup and restore',
            detail: 'Operator evidence required',
        },
    ];

    return (
        <section
            aria-label="System health and readiness"
            className="jr-command-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 dark:border-violet-900/70 dark:bg-slate-900 dark:text-slate-100"
        >
            <h2 className="text-lg font-bold">System health and readiness</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                Read-only snapshot. Configuration is not proof of availability
                or recoverability.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {entries.map(({ label, detail }) => (
                    <div
                        key={label}
                        className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-violet-900/70"
                    >
                        <dt className="text-sm font-semibold">{label}</dt>
                        <dd className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {detail}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-300">
                Checked at{' '}
                <time dateTime={health.checkedAt}>
                    {manilaTimestamp(health.checkedAt)}
                </time>{' '}
                (Philippine time)
            </p>
        </section>
    );
}

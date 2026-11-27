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
    checkedAt: string;
};

export function SystemHealthPanel({ health }: { health: SystemHealth }) {
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
            label: 'Shared locking',
            detail: health.recovery.shared_cache_configured
                ? 'Compatible driver configured · lock unverified'
                : 'Shared lock driver not configured',
        },
        {
            label: 'Backup and restore',
            detail: 'Operator evidence required',
        },
    ];

    return (
        <section
            aria-label="System health and readiness"
            className="jr-command-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
        >
            <h2 className="text-lg font-bold">System health and readiness</h2>
            <p className="mt-1 text-sm text-slate-500">
                Read-only snapshot. Configuration is not proof of availability
                or recoverability.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {entries.map(({ label, detail }) => (
                    <div
                        key={label}
                        className="min-w-0 rounded-xl border border-slate-200 p-3"
                    >
                        <dt className="text-sm font-semibold">{label}</dt>
                        <dd className="mt-1 text-sm text-slate-600">
                            {detail}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="mt-3 text-xs text-slate-500">
                Checked at <time dateTime={health.checkedAt}>
                    {health.checkedAt}
                </time>
            </p>
        </section>
    );
}

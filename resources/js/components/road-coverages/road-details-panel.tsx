import { Link } from '@inertiajs/react';
import { ArrowUpRight, ChevronRight, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

type Details = {
    id: number;
    name: string;
    municipality: string;
    kilometers: string | number | null;
    pavement_type: string | null;
    condition: string | null;
    project: null | {
        id: number;
        title: string;
        my_project: boolean;
        record_count: number;
        recent_records: {
            id: number;
            year: number;
            quarter: string;
            status: string;
            engineer: string;
        }[];
        update_count: number;
        latest_update: null | { id: number; month: string; progress: number };
        document_count: number;
        latest_document: null | { id: number; title: string };
    };
};

const base = '/dd-phase3/ui';
const monthLabel = (month: string) => {
    const match = /^(\d{4})-(\d{2})/.exec(month);

    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
        return month;
    }

    return new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
};

export function RoadDetailsPanel({
    roadId,
    name,
    municipality,
    height,
    onClose,
}: {
    roadId: number;
    name: string;
    municipality: string;
    height: number | string;
    onClose: () => void;
}) {
    const [details, setDetails] = useState<Details | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setDetails(null);
        setError('');
        fetch('/dd-phase3/dashboard/roads/' + roadId, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(
                        'Road details are unavailable. Please try again.',
                    );
                }

                const data = (await response.json()) as Details;

                if (data.id !== roadId) {
                    throw new Error('Road details could not be verified.');
                }

                if (!controller.signal.aborted) {
                    setDetails(data);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setError(
                        'Could not load road details. Refresh or try again.',
                    );
                }
            });

        return () => controller.abort();
    }, [roadId, attempt]);

    const project = details?.project;

    return (
        <aside
            className="jr-road-details"
            aria-label="Road details"
            style={
                {
                    '--jr-detail-height':
                        typeof height === 'number' ? height + 'px' : height,
                } as CSSProperties
            }
        >
            <header className="jr-road-details-head">
                <div>
                    <span className="jr-road-details-eyebrow">
                        Road details
                    </span>
                    <h3>{details?.name ?? name}</h3>
                    <p>{details?.municipality ?? municipality}</p>
                </div>
                <button
                    type="button"
                    aria-label="Close road details"
                    onClick={onClose}
                >
                    <X size={18} />
                </button>
            </header>
            <div className="jr-road-details-body" aria-live="polite">
                {error ? (
                    <div role="alert">
                        <p>{error}</p>
                        <button
                            type="button"
                            className="jr-road-details-retry"
                            onClick={() => setAttempt((n) => n + 1)}
                        >
                            Try again
                        </button>
                    </div>
                ) : !details ? (
                    <p role="status" className="jr-road-details-muted">
                        Loading road details…
                    </p>
                ) : (
                    <>
                        <dl className="jr-road-details-facts">
                            <div>
                                <dt>Length</dt>
                                <dd>
                                    {details.kilometers == null
                                        ? '—'
                                        : details.kilometers + ' km'}
                                </dd>
                            </div>
                            <div>
                                <dt>Pavement</dt>
                                <dd>{details.pavement_type || '—'}</dd>
                            </div>
                            <div>
                                <dt>Condition</dt>
                                <dd>{details.condition || '—'}</dd>
                            </div>
                        </dl>
                        <section className="jr-road-details-section">
                            <h4>Maintenance project</h4>
                            {project ? (
                                <>
                                    <p className="jr-road-details-project">
                                        {project.title}
                                    </p>
                                    <span
                                        className={
                                            'jr-road-details-assignment' +
                                            (project.my_project
                                                ? ' is-mine'
                                                : '')
                                        }
                                    >
                                        {project.my_project
                                            ? 'My project'
                                            : 'Other project'}
                                    </span>
                                </>
                            ) : (
                                <p className="jr-road-details-muted">
                                    No linked maintenance project.
                                </p>
                            )}
                        </section>
                        {project && (
                            <>
                                <section className="jr-road-details-section">
                                    <h4>
                                        Maintenance records{' '}
                                        <span>{project.record_count}</span>
                                    </h4>
                                    {project.recent_records.length ? (
                                        <div className="jr-road-details-records">
                                            {project.recent_records.map(
                                                (record) => (
                                                    <Link
                                                        key={record.id}
                                                        href={
                                                            base +
                                                            '/maintenance-projects/' +
                                                            project.id +
                                                            '/records/' +
                                                            record.id
                                                        }
                                                        className="jr-road-details-record"
                                                    >
                                                        <div>
                                                            <strong>
                                                                {record.quarter}{' '}
                                                                {record.year}
                                                            </strong>
                                                            <small>
                                                                {record.engineer ||
                                                                    'No managing engineer'}
                                                            </small>
                                                        </div>
                                                        <span
                                                            className="jr-road-details-status"
                                                            data-status={
                                                                record.status
                                                            }
                                                        >
                                                            {record.status}
                                                        </span>
                                                        <ChevronRight
                                                            size={15}
                                                        />
                                                    </Link>
                                                ),
                                            )}
                                            {project.record_count >
                                                project.recent_records
                                                    .length && (
                                                <p className="jr-road-details-muted">
                                                    Showing the latest{' '}
                                                    {
                                                        project.recent_records
                                                            .length
                                                    }{' '}
                                                    of {project.record_count}{' '}
                                                    records.
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="jr-road-details-muted">
                                            No maintenance records yet.
                                        </p>
                                    )}
                                </section>
                                <section className="jr-road-details-section">
                                    <h4>
                                        Monthly updates{' '}
                                        <span>{project.update_count}</span>
                                    </h4>
                                    {project.latest_update ? (
                                        <Link
                                            className="jr-road-details-related"
                                            href={
                                                base +
                                                '/monthly-updates/' +
                                                project.latest_update.id
                                            }
                                        >
                                            <div>
                                                <small>
                                                    Latest reported progress
                                                </small>
                                                <strong>
                                                    {monthLabel(
                                                        project.latest_update
                                                            .month,
                                                    )}
                                                </strong>
                                            </div>
                                            <strong>
                                                {project.latest_update.progress}
                                                %
                                            </strong>
                                            <ChevronRight size={15} />
                                        </Link>
                                    ) : (
                                        <p className="jr-road-details-muted">
                                            No monthly updates yet.
                                        </p>
                                    )}
                                </section>
                                <section className="jr-road-details-section">
                                    <h4>
                                        Maintenance documents{' '}
                                        <span>{project.document_count}</span>
                                    </h4>
                                    {project.latest_document ? (
                                        <Link
                                            className="jr-road-details-related"
                                            href={
                                                base +
                                                '/maintenance-documents/' +
                                                project.latest_document.id
                                            }
                                        >
                                            <div>
                                                <small>Latest document</small>
                                                <strong>
                                                    {
                                                        project.latest_document
                                                            .title
                                                    }
                                                </strong>
                                            </div>
                                            <ChevronRight size={15} />
                                        </Link>
                                    ) : (
                                        <p className="jr-road-details-muted">
                                            No documents yet.
                                        </p>
                                    )}
                                </section>
                            </>
                        )}
                    </>
                )}
            </div>
            {details && (
                <footer className="jr-road-details-footer">
                    <Link
                        href={
                            project
                                ? base + '/maintenance-projects/' + project.id
                                : base + '/road-coverages/' + roadId
                        }
                    >
                        {project ? 'View Full Project' : 'View Road Coverage'}
                        <ArrowUpRight size={15} />
                    </Link>
                </footer>
            )}
        </aside>
    );
}

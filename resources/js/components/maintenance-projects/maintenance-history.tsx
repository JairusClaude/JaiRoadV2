import { Link, router, usePage } from '@inertiajs/react';
import {
    ChevronRight,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import {
    RecordDeletionDialog,
    useRecordDeletion,
} from '@/components/maintenance-projects/record-deletion';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { editUrl } from '@/lib/form-navigation';
import { engineerName, validRecordDate } from '@/lib/maintenance-records';
import type { MaintenanceRecordSummary } from '@/types/maintenance-records';

const startDate = (value?: string | null) =>
    value && validRecordDate(value)
        ? new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeZone: 'UTC',
          }).format(new Date(`${value}T00:00:00Z`))
        : 'Unavailable';

export type HistoryPagination = {
    page: number;
    pages: number;
    totalYears: number;
};

export function MaintenanceHistory({
    records,
    recordCreateUrl,
    expandedYear,
    pagination,
}: {
    records: MaintenanceRecordSummary[];
    recordCreateUrl?: string;
    expandedYear?: number;
    pagination?: HistoryPagination;
}) {
    const page = usePage();
    const isViewer =
        (
            page.props.jairoadsIdentity as { role?: string } | undefined
        )?.role?.toLowerCase() === 'viewer';
    const deletion = useRecordDeletion(page.url);
    const years = [...new Set(records.map((record) => record.year))].sort(
        (a, b) => b - a,
    );

    return (
        <>
            <section className="jr-detail-section jr-history-section">
                <div className="jr-section-title-row">
                    <div>
                        <h2>Maintenance History</h2>
                        <p>Records grouped by year and quarter</p>
                    </div>
                    {!isViewer && Boolean(recordCreateUrl) && (
                        <Button
                            type="button"
                            className="jr-primary"
                            disabled={!recordCreateUrl}
                            title={
                                recordCreateUrl
                                    ? undefined
                                    : 'Maintenance record creation is pending backend integration.'
                            }
                            onClick={() => {
                                if (recordCreateUrl) {
                                    router.visit(recordCreateUrl);
                                }
                            }}
                        >
                            <Plus /> Add Record
                        </Button>
                    )}
                </div>
                {records.length === 0 ? (
                    <div className="jr-history-empty">
                        No maintenance records yet.
                    </div>
                ) : (
                    <>
                        <div className="jr-history jr-history-a1">
                            {years.map((year) => (
                                <details
                                    key={year}
                                    data-year={year}
                                    open={
                                        (years.includes(expandedYear ?? NaN)
                                            ? expandedYear
                                            : years[0]) === year
                                    }
                                >
                                    <summary>
                                        <span className="jr-year-title">
                                            <ChevronRight />
                                            <strong>{year}</strong>
                                        </span>
                                        <small>
                                            {
                                                records.filter(
                                                    (record) =>
                                                        record.year === year,
                                                ).length
                                            }{' '}
                                            records
                                        </small>
                                    </summary>
                                    <div className="jr-year-contents">
                                        {records
                                            .filter(
                                                (record) =>
                                                    record.year === year,
                                            )
                                            .sort((a, b) =>
                                                b.quarter.localeCompare(
                                                    a.quarter,
                                                ),
                                            )
                                            .map((record) => (
                                                <div
                                                    key={record.id}
                                                    className="jr-record-row"
                                                    data-record-id={record.id}
                                                    data-clickable={
                                                        record.details_url
                                                            ? 'true'
                                                            : undefined
                                                    }
                                                    title={
                                                        !record.details_url
                                                            ? 'Maintenance Record Details is pending backend integration.'
                                                            : undefined
                                                    }
                                                    onClick={() => {
                                                        if (
                                                            record.details_url
                                                        ) {
                                                            router.visit(
                                                                record.details_url,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    <span className="jr-record-quarter">
                                                        {record.details_url ? (
                                                            <Link
                                                                aria-label={`Open ${record.quarter} ${year} maintenance record details`}
                                                                href={
                                                                    record.details_url
                                                                }
                                                                onClick={(
                                                                    event,
                                                                ) =>
                                                                    event.stopPropagation()
                                                                }
                                                            >
                                                                {record.quarter}
                                                            </Link>
                                                        ) : (
                                                            record.quarter
                                                        )}
                                                    </span>
                                                    <span
                                                        className="jr-status"
                                                        data-status={
                                                            record.status
                                                        }
                                                    >
                                                        {record.status}
                                                    </span>
                                                    <span className="jr-record-meta">
                                                        <strong>
                                                            {record.managing_engineer
                                                                ? engineerName(
                                                                      record.managing_engineer,
                                                                  )
                                                                : 'NULL (unassigned)'}
                                                        </strong>
                                                        <small>
                                                            Managing Engineer
                                                        </small>
                                                    </span>
                                                    <span className="jr-record-meta">
                                                        <strong>
                                                            {startDate(
                                                                record.start_date,
                                                            )}
                                                        </strong>
                                                        <small>
                                                            Start Date
                                                        </small>
                                                    </span>
                                                    <div
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                        onKeyDown={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                    >
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger
                                                                asChild
                                                            >
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="jr-action-trigger"
                                                                    aria-label={`${record.quarter} ${year} record actions`}
                                                                >
                                                                    <MoreHorizontal />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent
                                                                className="jr-theme jr-menu"
                                                                align="end"
                                                            >
                                                                <DropdownMenuItem
                                                                    disabled={
                                                                        !record.edit_url
                                                                    }
                                                                    onSelect={() => {
                                                                        if (
                                                                            record.edit_url
                                                                        ) {
                                                                            router.visit(
                                                                                editUrl(
                                                                                    record.edit_url,
                                                                                    page.url,
                                                                                ),
                                                                            );
                                                                        }
                                                                    }}
                                                                >
                                                                    <Pencil />{' '}
                                                                    Edit Record
                                                                    {!record.edit_url &&
                                                                        ' — unavailable'}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
                                                                    variant="destructive"
                                                                    disabled={
                                                                        !record.delete_url
                                                                    }
                                                                    onSelect={() =>
                                                                        deletion.open(
                                                                            record,
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2 />{' '}
                                                                    Delete
                                                                    Record
                                                                    {!record.delete_url &&
                                                                        ' — pending'}
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                        {pagination && pagination.pages > 1 && (
                            <nav
                                aria-label="Maintenance history years"
                                className="mt-4 flex flex-wrap items-center gap-3"
                            >
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={pagination.page <= 1}
                                    onClick={() =>
                                        router.get(
                                            page.url.split('?')[0],
                                            {
                                                history_page:
                                                    pagination.page - 1,
                                            },
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    Newer years
                                </Button>
                                <span className="text-sm" role="status">
                                    Page {pagination.page} of {pagination.pages}{' '}
                                    · {pagination.totalYears} years
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                        pagination.page >= pagination.pages
                                    }
                                    onClick={() =>
                                        router.get(
                                            page.url.split('?')[0],
                                            {
                                                history_page:
                                                    pagination.page + 1,
                                            },
                                            { preserveScroll: true },
                                        )
                                    }
                                >
                                    Older years
                                </Button>
                            </nav>
                        )}
                        {records.some((record) => !record.details_url) && (
                            <p className="jr-history-pending">
                                Maintenance Record Details and record actions
                                are pending backend integration.
                            </p>
                        )}
                    </>
                )}
            </section>
            <RecordDeletionDialog deletion={deletion} />
        </>
    );
}

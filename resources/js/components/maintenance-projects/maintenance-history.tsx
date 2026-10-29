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

export function MaintenanceHistory({
    records,
    recordCreateUrl,
    expandedYear,
}: {
    records: MaintenanceRecordSummary[];
    recordCreateUrl?: string;
    expandedYear?: number;
}) {
    const page = usePage();
    const deletion = useRecordDeletion();
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
                                    open={expandedYear === year}
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
                                                                : 'Unavailable'}
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
                                                                        ' — pending'}
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem
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

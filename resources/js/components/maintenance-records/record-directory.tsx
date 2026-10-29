import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { RefObject } from 'react';
import {
    DirectoryFilter,
    DirectoryPagination,
    DirectorySelectionToolbar,
} from '@/components/directory-controls';
import {
    IntegrationNotice,
    ProjectWorkspace,
} from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { engineerName, validRecordDate } from '@/lib/maintenance-records';
import type {
    RecordDirectoryFilters,
    RecordDirectoryProps,
    RecordDirectoryRow,
} from '@/types/maintenance-record-directory';

const date = (value?: string | null) =>
    value && validRecordDate(value)
        ? new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeZone: 'UTC',
          }).format(new Date(`${value}T00:00:00Z`))
        : 'Unavailable';

export function RecordDirectory({
    records,
    municipalities,
    years,
    filters,
    integration,
    canCreate,
    busy,
    onSearch,
    onFilters,
    onPage,
    onNavigate,
    onAdd,
    onDelete,
    addButtonRef,
}: RecordDirectoryProps & {
    busy: boolean;
    addButtonRef: RefObject<HTMLButtonElement | null>;
    onSearch: (search: string) => void;
    onFilters: (filters: RecordDirectoryFilters) => void;
    onPage: (page: number, search: string) => void;
    onNavigate: (url: string) => void;
    onAdd: () => void;
    onDelete: (record: RecordDirectoryRow) => void;
}) {
    const [search, setSearch] = useState(filters.search);
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const scope = JSON.stringify([
        records.current_page,
        filters,
        records.data.map((item) => item.id),
    ]);
    const [previousScope, setPreviousScope] = useState(scope);

    if (scope !== previousScope) {
        setPreviousScope(scope);
        setSelecting(false);
        setSelected(new Set());
    }

    const clear = () => setSelected(new Set());
    const toggle = (id: number) =>
        setSelected((old) => {
            const next = new Set(old);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    const all =
        records.data.length > 0 &&
        records.data.every((item) => selected.has(item.id));
    const apply = (next: RecordDirectoryFilters) => {
        clear();
        onFilters(next);
    };
    const filter = (
        key: 'municipality' | 'year' | 'quarter' | 'status',
        label: string,
        options: { value: string; label: string }[],
    ) => (
        <DirectoryFilter
            label={`${label} filter`}
            value={filters[key] || 'all'}
            disabled={!integration.ready || busy}
            onChange={(value) =>
                apply({
                    ...filters,
                    search,
                    [key]: value === 'all' ? '' : value,
                })
            }
            options={[
                {
                    value: 'all',
                    label: `All ${key === 'municipality' ? 'Municipalities' : key === 'year' ? 'Years' : key === 'quarter' ? 'Quarters' : 'Statuses'}`,
                },
                ...options,
            ]}
        />
    );
    const hasFilters = Boolean(
        filters.search ||
        filters.municipality ||
        filters.year ||
        filters.quarter ||
        filters.status,
    );

    return (
        <ProjectWorkspace>
            <div className="jr-page-head">
                <div>
                    <h1>Maintenance Records</h1>
                    <p>
                        Browse and manage quarterly maintenance records across
                        projects.
                    </p>
                </div>
                <Button
                    className="jr-primary"
                    disabled={!integration.ready || !canCreate || busy}
                    ref={addButtonRef}
                    onClick={onAdd}
                >
                    <Plus />
                    Add Record
                </Button>
            </div>
            <IntegrationNotice integration={integration} />
            <form
                className="jr-filters"
                onSubmit={(event) => {
                    event.preventDefault();
                    apply({ ...filters, search });
                }}
            >
                <div className="jr-search">
                    <Search className="size-[18px]" />
                    <Input
                        type="search"
                        maxLength={255}
                        aria-label="Search maintenance projects or managing engineers"
                        placeholder="Search maintenance projects or managing engineers..."
                        value={search}
                        disabled={!integration.ready || busy}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            clear();
                            onSearch(event.target.value);
                        }}
                    />
                </div>
                <div className="jr-filter-row">
                    {filter('municipality', 'Municipality', municipalities)}
                    {filter(
                        'year',
                        'Reporting Year',
                        years.map((year) => ({
                            value: String(year),
                            label: String(year),
                        })),
                    )}
                    {filter(
                        'quarter',
                        'Quarter',
                        ['Q1', 'Q2', 'Q3', 'Q4'].map((value) => ({
                            value,
                            label: value,
                        })),
                    )}
                    {filter(
                        'status',
                        'Status',
                        ['Ongoing', 'Completed'].map((value) => ({
                            value,
                            label: value,
                        })),
                    )}
                    <DirectoryFilter
                        label="Sort records"
                        value={filters.sort}
                        disabled={!integration.ready || busy}
                        options={[
                            { value: 'newest', label: 'Newest first' },
                            { value: 'oldest', label: 'Oldest first' },
                        ]}
                        onChange={(sort) =>
                            apply({
                                ...filters,
                                search,
                                sort: sort as 'newest' | 'oldest',
                            })
                        }
                    />
                </div>
                <span className="sr-only">
                    Search results update automatically while typing.
                </span>
            </form>
            <DirectorySelectionToolbar
                selecting={selecting}
                selectedCount={selected.size}
                total={records.total}
                singular="record"
                plural="records"
                canDelete={false}
                disabled={!integration.ready || busy}
                onSelect={() => setSelecting(true)}
                onCancel={() => {
                    setSelecting(false);
                    clear();
                }}
                onDelete={() => {}}
            />
            {selecting && (
                <p className="jr-record-selection-note" role="note">
                    Bulk record deletion is not available. Use each record’s
                    Delete action.
                </p>
            )}
            <div
                className="jr-table-wrap"
                aria-busy={busy}
                role="region"
                aria-label="Maintenance Records table"
                tabIndex={0}
            >
                <table className="jr-table">
                    <colgroup>
                        {[27, 12, 9, 10, 14, 20, 8].map((width, index) => (
                            <col key={index} style={{ width: `${width}%` }} />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            <th>
                                <div className="jr-project-line">
                                    {selecting && (
                                        <Checkbox
                                            aria-label="Select all records on this page"
                                            checked={
                                                all
                                                    ? true
                                                    : selected.size
                                                      ? 'indeterminate'
                                                      : false
                                            }
                                            onCheckedChange={(checked) =>
                                                setSelected(
                                                    checked
                                                        ? new Set(
                                                              records.data.map(
                                                                  (item) =>
                                                                      item.id,
                                                              ),
                                                          )
                                                        : new Set(),
                                                )
                                            }
                                        />
                                    )}
                                    <span>Maintenance Project</span>
                                </div>
                            </th>
                            <th>Municipality</th>
                            <th>Period</th>
                            <th>Status</th>
                            <th>Managing Engineer</th>
                            <th>Maintenance Timeline</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {records.data.map((record) => (
                            <tr
                                key={record.id}
                                data-record-id={record.id}
                                data-selected={selected.has(record.id)}
                                onClick={() =>
                                    selecting
                                        ? toggle(record.id)
                                        : record.details_url &&
                                          onNavigate(record.details_url)
                                }
                            >
                                <td>
                                    <div className="jr-project-line">
                                        {selecting && (
                                            <Checkbox
                                                aria-label={`Select Record ID: ${record.id}`}
                                                checked={selected.has(
                                                    record.id,
                                                )}
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                                onCheckedChange={() =>
                                                    toggle(record.id)
                                                }
                                            />
                                        )}
                                        <div className="min-w-0">
                                            {selecting ? (
                                                <button
                                                    className="jr-project-title text-left"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggle(record.id);
                                                    }}
                                                >
                                                    {
                                                        record.project
                                                            .project_title
                                                    }
                                                </button>
                                            ) : (
                                                <a
                                                    className="jr-project-title"
                                                    href={
                                                        record.details_url ||
                                                        undefined
                                                    }
                                                    onClick={(event) => {
                                                        event.stopPropagation();

                                                        if (
                                                            !event.ctrlKey &&
                                                            !event.metaKey &&
                                                            !event.shiftKey &&
                                                            event.button ===
                                                                0 &&
                                                            record.details_url
                                                        ) {
                                                            event.preventDefault();
                                                            onNavigate(
                                                                record.details_url,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {
                                                        record.project
                                                            .project_title
                                                    }
                                                </a>
                                            )}
                                            <div className="jr-project-id">
                                                Record ID: {record.id}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {record.project.municipality ?? (
                                        <span className="jr-muted">
                                            Coverage not mapped
                                        </span>
                                    )}
                                </td>
                                <td className="jr-record-period">
                                    {record.quarter} {record.year}
                                </td>
                                <td>
                                    <span
                                        className="jr-status"
                                        data-status={record.status}
                                    >
                                        {record.status}
                                    </span>
                                </td>
                                <td>
                                    {record.managing_engineer
                                        ? engineerName(record.managing_engineer)
                                        : 'Unavailable'}
                                </td>
                                <td>
                                    <span>{date(record.start_date)}</span>
                                    <div className="jr-project-id">
                                        {record.status === 'Completed'
                                            ? `Completed: ${date(record.complete_date)}`
                                            : `Estimated: ${Number.isInteger(record.estimated_duration_days) && record.estimated_duration_days > 0 ? `${record.estimated_duration_days} ${record.estimated_duration_days === 1 ? 'day' : 'days'}` : 'Unavailable'}`}
                                    </div>
                                </td>
                                <td
                                    className="text-right"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    {!selecting && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="jr-action-trigger"
                                                    aria-label={`Actions for Record ID: ${record.id}`}
                                                >
                                                    <MoreHorizontal className="size-[18px]" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                className="jr-theme jr-menu"
                                                align="end"
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                            >
                                                <DropdownMenuItem
                                                    disabled={
                                                        !record.edit_url || busy
                                                    }
                                                    onSelect={() =>
                                                        record.edit_url &&
                                                        onNavigate(
                                                            record.edit_url,
                                                        )
                                                    }
                                                >
                                                    <Pencil />
                                                    Edit Maintenance Record
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={
                                                        !record.delete_url ||
                                                        busy
                                                    }
                                                    onSelect={() =>
                                                        onDelete(record)
                                                    }
                                                >
                                                    <Trash2 />
                                                    Delete Maintenance Record
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {records.data.length === 0 && (
                    <div className="jr-empty">
                        <strong>
                            {!integration.ready
                                ? 'Record data is not available yet.'
                                : hasFilters
                                  ? 'No matching records.'
                                  : 'No maintenance records yet.'}
                        </strong>
                        <p>
                            {!integration.ready
                                ? 'Record access is pending backend integration.'
                                : hasFilters
                                  ? 'Try another search or filter.'
                                  : 'Add a quarterly record to an existing maintenance project.'}
                        </p>
                        {integration.ready && hasFilters && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSearch('');
                                    apply({
                                        search: '',
                                        municipality: '',
                                        year: '',
                                        quarter: '',
                                        status: '',
                                        sort: 'newest',
                                    });
                                }}
                            >
                                Clear filters
                            </Button>
                        )}
                    </div>
                )}
            </div>
            <DirectoryPagination
                total={records.total}
                from={records.from}
                to={records.to}
                currentPage={records.current_page}
                lastPage={records.last_page}
                plural="records"
                label="Record pagination"
                ready={integration.ready}
                busy={busy}
                onPage={(page) => {
                    clear();
                    onPage(page, search);
                }}
            />
        </ProjectWorkspace>
    );
}

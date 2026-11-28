import { usePage } from '@inertiajs/react';
import {
    CalendarDays,
    ClipboardList,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import {
    DirectoryFilter,
    DirectoryFilterHeading,
    DirectoryFilterField,
    DirectoryPagination,
    DirectorySelectionToolbar,
} from '@/components/directory-controls';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { MetricCard } from '@/components/metric-card';
import { MonthlyProgress } from '@/components/monthly-updates/monthly-progress';
import { MonthlyProjectFilter } from '@/components/monthly-updates/project-filter';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { manilaDate } from '@/lib/manila-time';
import { updateMonth } from '@/lib/monthly-updates';
import type {
    MonthlyDirectoryRow,
    MonthlyUpdateFilters,
    MonthlyUpdatePage,
} from '@/types/monthly-updates';

export { updateMonth } from '@/lib/monthly-updates';
const modifiedDate = manilaDate;

export type MonthlyDirectoryProps = {
    totalReports?: number;
    reportsThisMonth?: number;
    updates: MonthlyUpdatePage;
    projects: { id: number; project_title: string }[];
    projectFilterUrl?: string;
    years: number[];
    filters: MonthlyUpdateFilters;
};

export function MonthlyUpdateDirectory({
    totalReports,
    reportsThisMonth,
    updates,
    projects,
    projectFilterUrl,
    years,
    filters,
    busy,
    onSearch,
    onFilters,
    onPage,
    onDelete,
    onAction,
}: MonthlyDirectoryProps & {
    busy: boolean;
    onSearch: (search: string) => void;
    onFilters: (filters: MonthlyUpdateFilters) => void;
    onPage: (page: number, search: string) => void;
    onDelete: (updates: MonthlyDirectoryRow[], bulk: boolean) => void;
    onAction: (
        action: 'Add' | 'Details' | 'Edit',
        update?: MonthlyDirectoryRow,
    ) => void;
}) {
    const page = usePage();
    const isViewer =
        (
            page.props.jairoadsIdentity as { role?: string } | undefined
        )?.role?.toLowerCase() === 'viewer';
    const canonical = page.props.canonicalFrontend === true;
    const canWrite = !isViewer && (!canonical || page.props.canWrite === true);
    const [search, setSearch] = useState(filters.search);
    const [previousSearch, setPreviousSearch] = useState(filters.search);

    if (previousSearch !== filters.search) {
        setPreviousSearch(filters.search);
        setSearch(filters.search);
    }

    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const scope = JSON.stringify([
        updates.current_page,
        filters,
        updates.data.map((item) => item.id),
    ]);
    const [previousScope, setPreviousScope] = useState(scope);

    if (previousScope !== scope) {
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
    const apply = (next: MonthlyUpdateFilters) => {
        clear();
        onFilters(next);
    };
    const all =
        updates.data.length > 0 &&
        updates.data.every((item) => selected.has(item.id));
    const hasFilters = Boolean(
        filters.search ||
        (filters.project && filters.project !== 'all') ||
        (filters.year && filters.year !== 'all'),
    );

    const displayedTotalReports =
        totalReports ?? updates?.total ?? updates?.data?.length ?? 0;
    const currentMonthPrefix = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
    }).format(new Date());
    const thisMonthMatches =
        updates?.data?.filter((u) =>
            u.update_month?.startsWith(currentMonthPrefix),
        ).length ?? 0;
    const displayedReportsThisMonth = reportsThisMonth ?? thisMonthMatches;

    return (
        <ProjectWorkspace>
            <div className="jr-monthly-directory">
                <div className="jr-page-head">
                    <div>
                        <h1>Monthly Updates</h1>
                        <p>
                            {isViewer
                                ? 'Browse monthly maintenance progress reports.'
                                : 'Manage monthly maintenance progress reports.'}
                        </p>
                    </div>
                    {canWrite && (
                        <Button
                            className="jr-primary"
                            disabled={!canWrite}
                            onClick={() => onAction('Add')}
                        >
                            <Plus />
                            Add Monthly Update
                        </Button>
                    )}
                </div>
                <section
                    aria-label="Monthly update statistics"
                    className="jr-metrics-grid jr-directory-summary"
                >
                    <MetricCard
                        title="Total reports"
                        icon={<ClipboardList className="size-5" />}
                        value={displayedTotalReports}
                        subtitle="Submitted progress reports"
                        highlight={true}
                    />
                    <MetricCard
                        title="Reports this month"
                        icon={<CalendarDays className="size-5" />}
                        value={displayedReportsThisMonth}
                        subtitle="Current reporting period"
                    />
                </section>
                <form
                    className="jr-filters jr-directory-filter-panel"
                    onSubmit={(event) => {
                        event.preventDefault();
                        apply({ ...filters, search });
                    }}
                >
                    <DirectoryFilterHeading
                        disabled={busy}
                        onReset={
                            search || hasFilters || filters.sort !== 'newest'
                                ? () => {
                                      setSearch('');
                                      apply({
                                          search: '',
                                          project: 'all',
                                          year: '',
                                          sort: 'newest',
                                      });
                                  }
                                : undefined
                        }
                    />
                    <div className="jr-search">
                        <Search className="size-[18px]" />
                        <Input
                            type="search"
                            maxLength={255}
                            aria-label="Search monthly updates"
                            placeholder="Search monthly updates..."
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                clear();
                                onSearch(event.target.value);
                            }}
                        />
                    </div>
                    <div className="jr-filter-row">
                        <DirectoryFilterField label="Project">
                            <MonthlyProjectFilter
                                projects={projects}
                                choicesUrl={projectFilterUrl}
                                value={filters.project}
                                onChange={(value) =>
                                    apply({
                                        ...filters,
                                        search,
                                        project: value,
                                    })
                                }
                            />
                        </DirectoryFilterField>
                        <DirectoryFilter
                            label="Reporting Year filter"
                            fieldLabel="Year"
                            className="jr-monthly-year-filter"
                            value={filters.year || 'all'}
                            onChange={(value) =>
                                apply({
                                    ...filters,
                                    search,
                                    year: value === 'all' ? '' : value,
                                })
                            }
                            options={[
                                { value: 'all', label: 'All Years' },
                                ...years.map((year) => ({
                                    value: String(year),
                                    label: String(year),
                                })),
                            ]}
                        />
                        <DirectoryFilter
                            label="Sort monthly updates"
                            fieldLabel="Sort by"
                            className="jr-monthly-sort-filter"
                            value={filters.sort}
                            onChange={(sort) =>
                                apply({
                                    ...filters,
                                    search,
                                    sort: sort as MonthlyUpdateFilters['sort'],
                                })
                            }
                            options={[
                                {
                                    value: 'newest',
                                    label: 'Newest Month First',
                                },
                                {
                                    value: 'oldest',
                                    label: 'Oldest Month First',
                                },
                                {
                                    value: 'modified',
                                    label: 'Recently Modified',
                                },
                            ]}
                        />
                    </div>
                    <span className="sr-only">
                        Search results update automatically while typing.
                    </span>
                </form>
                <DirectorySelectionToolbar
                    selecting={selecting}
                    selectedCount={selected.size}
                    total={updates.total}
                    singular="update"
                    plural="updates"
                    canDelete={canWrite}
                    disabled={busy}
                    onSelect={() => setSelecting(true)}
                    onCancel={() => {
                        setSelecting(false);
                        clear();
                    }}
                    onDelete={() =>
                        onDelete(
                            updates.data.filter((item) =>
                                selected.has(item.id),
                            ),
                            true,
                        )
                    }
                />
                <div
                    className="jr-table-wrap"
                    aria-busy={busy}
                    role="region"
                    aria-label="Monthly updates table"
                    tabIndex={0}
                >
                    <table
                        role="table"
                        className="jr-table jr-mobile-table jr-monthly-table"
                    >
                        <colgroup>
                            <col style={{ width: '20%' }} />
                            <col style={{ width: isViewer ? '44%' : '35%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '18%' }} />
                            {!isViewer && <col style={{ width: '9%' }} />}
                        </colgroup>
                        <thead role="rowgroup">
                            <tr role="row">
                                <th role="columnheader">
                                    <div className="jr-project-line">
                                        {selecting && (
                                            <Checkbox
                                                aria-label="Select all updates on this page"
                                                checked={
                                                    all
                                                        ? true
                                                        : selected.size > 0
                                                          ? 'indeterminate'
                                                          : false
                                                }
                                                onCheckedChange={(checked) =>
                                                    setSelected(
                                                        checked
                                                            ? new Set(
                                                                  updates.data.map(
                                                                      (item) =>
                                                                          item.id,
                                                                  ),
                                                              )
                                                            : new Set(),
                                                    )
                                                }
                                            />
                                        )}
                                        <span>Update Month</span>
                                    </div>
                                </th>
                                <th role="columnheader">Maintenance Project</th>
                                <th role="columnheader">Progress</th>
                                <th role="columnheader">Last Updated</th>
                                {!isViewer && (
                                    <th
                                        role="columnheader"
                                        className="text-right"
                                    >
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody role="rowgroup">
                            {updates.data.map((item) => (
                                <tr
                                    role="row"
                                    key={item.id}
                                    data-update-id={item.id}
                                    data-selected={selected.has(item.id)}
                                    onClick={() =>
                                        selecting
                                            ? toggle(item.id)
                                            : onAction('Details', item)
                                    }
                                >
                                    <td role="cell" data-mobile-cell="primary">
                                        <div className="jr-project-line">
                                            {selecting && (
                                                <Checkbox
                                                    aria-label={`Select update ${item.id}`}
                                                    checked={selected.has(
                                                        item.id,
                                                    )}
                                                    onClick={(event) =>
                                                        event.stopPropagation()
                                                    }
                                                    onCheckedChange={() =>
                                                        toggle(item.id)
                                                    }
                                                />
                                            )}
                                            <button
                                                className="jr-project-title text-left"
                                                aria-label={`${selecting ? 'Select' : 'Open'} ${updateMonth(item.update_month)} update for ${item.project.project_title}`}
                                                onClick={(event) => {
                                                    event.stopPropagation();

                                                    if (selecting) {
                                                        toggle(item.id);
                                                    } else {
                                                        onAction(
                                                            'Details',
                                                            item,
                                                        );
                                                    }
                                                }}
                                            >
                                                {updateMonth(item.update_month)}
                                            </button>
                                        </div>
                                    </td>
                                    <td
                                        role="cell"
                                        data-mobile-label="Maintenance project"
                                    >
                                        <div className="jr-project-title">
                                            {item.project.project_title}
                                        </div>
                                        <div className="jr-project-id">
                                            {item.record.quarter}{' '}
                                            {item.record.year}
                                        </div>
                                    </td>
                                    <td
                                        role="cell"
                                        data-mobile-label="Progress"
                                    >
                                        <MonthlyProgress
                                            value={item.progress_percentage}
                                            label={`Progress for update ${item.id}`}
                                        />
                                    </td>
                                    <td
                                        role="cell"
                                        data-mobile-label="Last updated"
                                    >
                                        <time dateTime={item.updated_at}>
                                            {modifiedDate(item.updated_at)}
                                        </time>
                                    </td>
                                    {!isViewer && (
                                        <td
                                            role="cell"
                                            data-mobile-cell="actions"
                                            className="text-right"
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                        >
                                            {!selecting && canWrite && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger
                                                        asChild
                                                    >
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="jr-action-trigger"
                                                            aria-label={`Actions for update ${item.id}`}
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
                                                                !canWrite ||
                                                                item.can_edit ===
                                                                    false
                                                            }
                                                            onSelect={() =>
                                                                onAction(
                                                                    'Edit',
                                                                    item,
                                                                )
                                                            }
                                                        >
                                                            <Pencil />
                                                            Edit Monthly Update
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            variant="destructive"
                                                            disabled={busy}
                                                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                                            onSelect={() =>
                                                                onDelete(
                                                                    [item],
                                                                    false,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Delete Monthly
                                                            Update
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {updates.data.length === 0 && (
                        <div className="jr-empty">
                            <strong>
                                {hasFilters
                                    ? 'No matching monthly updates.'
                                    : 'No monthly updates yet.'}
                            </strong>
                            <p>
                                {hasFilters
                                    ? 'Try another search, project or reporting year.'
                                    : 'Monthly progress reports will appear here.'}
                            </p>
                            {hasFilters && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch('');
                                        apply({
                                            search: '',
                                            project: '',
                                            year: '',
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
                    {...{
                        total: updates.total,
                        from: updates.from,
                        to: updates.to,
                    }}
                    currentPage={updates.current_page}
                    lastPage={updates.last_page}
                    plural="updates"
                    label="Monthly update pagination"
                    busy={busy}
                    onPage={(page) => {
                        clear();
                        onPage(page, search);
                    }}
                />
            </div>
        </ProjectWorkspace>
    );
}

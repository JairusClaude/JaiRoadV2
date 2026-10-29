import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
    DirectoryFilter,
    DirectoryPagination,
    DirectorySelectionToolbar,
} from '@/components/directory-controls';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
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
import { updateMonth } from '@/lib/monthly-updates';
import type {
    MonthlyUpdateFilters,
    MonthlyUpdatePage,
    MonthlyUpdateSummary,
} from '@/types/monthly-updates';

export { updateMonth } from '@/lib/monthly-updates';
const modifiedDate = (value: string) =>
    new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeZone: 'UTC',
    }).format(new Date(value));

export type MonthlyDirectoryProps = {
    updates: MonthlyUpdatePage;
    projects: { id: number; project_title: string }[];
    years: number[];
    filters: MonthlyUpdateFilters;
};

export function MonthlyUpdateDirectory({
    updates,
    projects,
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
    onDelete: (updates: MonthlyUpdateSummary[], bulk: boolean) => void;
    onAction: (
        action: 'Add' | 'Details' | 'Edit',
        update?: MonthlyUpdateSummary,
    ) => void;
}) {
    const [search, setSearch] = useState(filters.search);
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
        filters.search || filters.project || filters.year,
    );

    return (
        <ProjectWorkspace>
            <div className="jr-monthly-directory">
                <div className="jr-page-head">
                    <div>
                        <h1>Monthly Updates</h1>
                        <p>
                            Browse and manage monthly maintenance progress
                            reports.
                        </p>
                    </div>
                    <Button
                        className="jr-primary"
                        onClick={() => onAction('Add')}
                    >
                        <Plus />
                        Add Monthly Update
                    </Button>
                </div>
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
                        <MonthlyProjectFilter
                            projects={projects}
                            value={filters.project}
                            onChange={(value) =>
                                apply({
                                    ...filters,
                                    search,
                                    project: value,
                                })
                            }
                        />
                        <DirectoryFilter
                            label="Reporting Year filter"
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
                    canDelete
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
                    <table className="jr-table jr-monthly-table">
                        <colgroup>
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '35%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '18%' }} />
                            <col style={{ width: '9%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>
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
                                <th>Maintenance Project</th>
                                <th>Progress</th>
                                <th>Last Updated</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {updates.data.map((item) => (
                                <tr
                                    key={item.id}
                                    data-update-id={item.id}
                                    data-selected={selected.has(item.id)}
                                    onClick={() =>
                                        selecting
                                            ? toggle(item.id)
                                            : onAction('Details', item)
                                    }
                                >
                                    <td>
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
                                    <td>
                                        <div className="jr-project-title">
                                            {item.project.project_title}
                                        </div>
                                        <div className="jr-project-id">
                                            {item.record.quarter}{' '}
                                            {item.record.year}
                                        </div>
                                    </td>
                                    <td>
                                        <MonthlyProgress
                                            value={item.progress_percentage}
                                            label={`Progress for update ${item.id}`}
                                        />
                                    </td>
                                    <td>
                                        <time dateTime={item.updated_at}>
                                            {modifiedDate(item.updated_at)}
                                        </time>
                                    </td>
                                    <td
                                        className="text-right"
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >
                                        {!selecting && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
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
                                                        onSelect={() =>
                                                            onDelete(
                                                                [item],
                                                                false,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 />
                                                        Delete Monthly Update
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </td>
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

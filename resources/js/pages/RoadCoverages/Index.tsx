import { Head, Link, router, usePage } from '@inertiajs/react';
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    DirectoryFilter,
    DirectoryPagination,
} from '@/components/directory-controls';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { editUrl } from '@/lib/form-navigation';
import { workspaceHref } from '@/lib/workspace-navigation';
import type {
    RoadCoverageDirectoryProps,
    RoadCoverageFilters,
} from '@/types/road-coverages';
import '../../../css/road-coverage-directory.css';

const length = (value: string | number | null) =>
    value !== null && Number.isFinite(Number(value))
        ? `${new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} km`
        : 'Unavailable';
export default function Index({
    coverages,
    municipalities,
    filters,
    canEdit,
}: RoadCoverageDirectoryProps) {
    const page = usePage();
    const [search, setSearch] = useState(filters.search);
    const [busy, setBusy] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const request = useRef<{ cancel: () => void } | null>(null);
    useEffect(
        () => () => {
            clearTimeout(timer.current);
            request.current?.cancel();
        },
        [],
    );
    const [previousSearch, setPreviousSearch] = useState(filters.search);

    if (previousSearch !== filters.search) {
        setPreviousSearch(filters.search);
        setSearch(filters.search);
    }

    const visit = (next: RoadCoverageFilters, current = 1) => {
        clearTimeout(timer.current);
        request.current?.cancel();
        router.get(
            workspaceHref('/road-coverages'),
            { ...next, page: current },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setBusy(true),
                onFinish: () => setBusy(false),
                onCancelToken: (token) => {
                    request.current = token;
                },
            },
        );
    };
    const filtered = !!(
        filters.search ||
        filters.municipality ||
        filters.condition ||
        filters.pavement
    );

    return (
        <div className="jr-directory-exploration jr-road-coverage-directory">
            <Head title="Road Coverages" />
            <ProjectWorkspace>
                <div className="jr-page-head">
                    <div>
                        <h1>Road Coverages</h1>
                        <p>
                            Browse complete road coverages and their associated
                            municipalities.
                        </p>
                    </div>
                    <Button
                        className="jr-primary"
                        disabled={!canEdit}
                        onClick={() =>
                            router.visit(
                                editUrl(
                                    workspaceHref('/road-coverages/create'),
                                    page.url,
                                ),
                            )
                        }
                    >
                        <Plus />
                        Add Road Coverage
                    </Button>
                </div>
                <form
                    className="jr-filters"
                    onSubmit={(event) => {
                        event.preventDefault();
                        visit({ ...filters, search });
                    }}
                >
                    <div className="jr-search">
                        <Search className="size-[18px]" />
                        <Input
                            type="search"
                            maxLength={255}
                            aria-label="Search road coverages"
                            placeholder="Search road coverage names..."
                            value={search}
                            onChange={(event) => {
                                const value = event.target.value;
                                setSearch(value);
                                clearTimeout(timer.current);
                                request.current?.cancel();
                                timer.current = setTimeout(
                                    () => visit({ ...filters, search: value }),
                                    250,
                                );
                            }}
                        />
                    </div>
                    <div className="jr-filter-row">
                        <DirectoryFilter
                            label="Municipality filter"
                            className="jr-road-municipality-filter"
                            value={filters.municipality || 'all'}
                            options={[
                                { value: 'all', label: 'All Municipalities' },
                                ...municipalities.map((lgu) => ({
                                    value: String(lgu.id),
                                    label: lgu.municipality_name,
                                })),
                            ]}
                            onChange={(value) =>
                                visit({
                                    ...filters,
                                    search,
                                    municipality: value === 'all' ? '' : value,
                                })
                            }
                        />
                        <DirectoryFilter
                            label="Road Condition filter"
                            value={filters.condition || 'all'}
                            options={[
                                { value: 'all', label: 'All Conditions' },
                                ...['Good', 'Fair', 'Bad'].map((value) => ({
                                    value,
                                    label: value,
                                })),
                            ]}
                            onChange={(value) =>
                                visit({
                                    ...filters,
                                    search,
                                    condition: value === 'all' ? '' : value,
                                })
                            }
                        />
                        <DirectoryFilter
                            label="Pavement Type filter"
                            value={filters.pavement || 'all'}
                            options={[
                                { value: 'all', label: 'All Pavements' },
                                ...[
                                    'Concrete',
                                    'Asphalt',
                                    'Gravel',
                                    'Earth',
                                ].map((value) => ({ value, label: value })),
                            ]}
                            onChange={(value) =>
                                visit({
                                    ...filters,
                                    search,
                                    pavement: value === 'all' ? '' : value,
                                })
                            }
                        />
                        <DirectoryFilter
                            label="Sort road coverages"
                            value={filters.sort}
                            options={[
                                { value: 'newest', label: 'Newest first' },
                                { value: 'oldest', label: 'Oldest first' },
                                { value: 'name-asc', label: 'Road name A–Z' },
                                { value: 'name-desc', label: 'Road name Z–A' },
                            ]}
                            onChange={(sort) =>
                                visit({
                                    ...filters,
                                    search,
                                    sort: sort as RoadCoverageFilters['sort'],
                                })
                            }
                        />
                    </div>
                </form>
                <div className="jr-table-toolbar">
                    <span role="status">
                        {coverages.total}{' '}
                        {coverages.total === 1
                            ? 'road coverage'
                            : 'road coverages'}{' '}
                        found
                    </span>
                </div>
                <div
                    className="jr-table-wrap"
                    role="region"
                    aria-label="Road coverages table"
                    aria-busy={busy}
                    tabIndex={0}
                >
                    <table className="jr-table jr-road-coverage-table">
                        <colgroup>
                            <col style={{ width: '30%' }} />
                            <col style={{ width: '19%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '7%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Road Coverage</th>
                                <th>Municipality</th>
                                <th>Length</th>
                                <th>Pavement Type</th>
                                <th>Road Condition</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {coverages.data.map((coverage) => (
                                <tr
                                    key={coverage.id}
                                    data-road-coverage-id={coverage.id}
                                    onClick={() =>
                                        router.visit(
                                            editUrl(
                                                workspaceHref(
                                                    `/road-coverages/${coverage.id}`,
                                                ),
                                                page.url,
                                            ),
                                        )
                                    }
                                >
                                    <td>
                                        <Link
                                            className="jr-project-title"
                                            href={editUrl(
                                                workspaceHref(
                                                    `/road-coverages/${coverage.id}`,
                                                ),
                                                page.url,
                                            )}
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                        >
                                            {coverage.road_name}
                                        </Link>
                                    </td>
                                    <td>{coverage.lgu.municipality_name}</td>
                                    <td className="whitespace-nowrap">
                                        {length(coverage.kilometers)}
                                    </td>
                                    <td>{coverage.pavement_type}</td>
                                    <td>
                                        <span
                                            className="jr-coverage-condition"
                                            data-condition={
                                                coverage.state_category
                                            }
                                        >
                                            {coverage.state_category}
                                        </span>
                                    </td>
                                    <td
                                        className="text-right"
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="jr-action-trigger"
                                                    aria-label={`Actions for ${coverage.road_name}`}
                                                >
                                                    <MoreHorizontal />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                className="jr-theme jr-menu"
                                                align="end"
                                            >
                                                <DropdownMenuItem
                                                    disabled={!canEdit}
                                                    onSelect={() =>
                                                        router.visit(
                                                            editUrl(
                                                                workspaceHref(
                                                                    `/road-coverages/${coverage.id}/edit`,
                                                                ),
                                                                page.url,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    <Pencil />
                                                    Edit Road Coverage
                                                </DropdownMenuItem>
                                                <DropdownMenuItem disabled>
                                                    <Trash2 />
                                                    Delete Road Coverage —
                                                    pending
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!coverages.data.length && (
                        <div className="jr-empty">
                            <strong>
                                {filtered
                                    ? 'No matching road coverages.'
                                    : 'No road coverages yet.'}
                            </strong>
                            <p>
                                {filtered
                                    ? 'Try another search or clear the filters.'
                                    : 'Road coverages will appear here when available.'}
                            </p>
                            {filtered && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch('');
                                        visit({
                                            search: '',
                                            municipality: '',
                                            condition: '',
                                            pavement: '',
                                            sort: filters.sort,
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
                    total={coverages.total}
                    from={coverages.from}
                    to={coverages.to}
                    currentPage={coverages.current_page}
                    lastPage={coverages.last_page}
                    plural="road coverages"
                    label="Road coverage pagination"
                    busy={busy}
                    ready={page.props.previewOnly === true}
                    onPage={(value) => visit({ ...filters, search }, value)}
                />
            </ProjectWorkspace>
        </div>
    );
}

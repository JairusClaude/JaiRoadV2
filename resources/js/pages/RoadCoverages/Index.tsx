import { Head, Link, router, usePage } from '@inertiajs/react';
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    DirectoryFilter,
    DirectoryPagination,
    DirectorySelectionToolbar,
} from '@/components/directory-controls';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { editUrl } from '@/lib/form-navigation';
import { workspaceHref } from '@/lib/workspace-navigation';
import { SimplifiedCoverageMap } from '@/components/road-coverages/simplified-coverage-map';
import type {
    RoadCoverageDirectoryProps,
    RoadCoverageFilters,
    RoadCoverageRow,
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
    canDelete,
    totalCoverages,
    linkedProjects,
    totalLengthKm,
    mapCoverages,
}: RoadCoverageDirectoryProps) {
    const page = usePage();
    const effectiveCanDelete = canDelete ?? canEdit;
    const displayedTotalCoverages =
        totalCoverages ?? coverages?.total ?? coverages?.data?.length ?? 0;
    const displayedLinkedProjects =
        linkedProjects ??
        coverages?.data?.filter((c) => c.has_projects)?.length ??
        0;
    const displayedTotalLengthKm =
        totalLengthKm ??
        coverages?.data?.reduce(
            (sum, c) => sum + (Number(c.kilometers) || 0),
            0,
        ) ??
        0;
    const [search, setSearch] = useState(filters.search);
    const [busy, setBusy] = useState(false);
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [deleteTargets, setDeleteTargets] = useState<RoadCoverageRow[] | null>(
        null,
    );
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const request = useRef<{ cancel: () => void } | null>(null);

    const toggle = (id: number) => {
        setSelected((previous) => {
            const next = new Set(previous);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    };

    const clearSelection = () => {
        setSelecting(false);
        setSelected(new Set());
    };

    const allSelected =
        coverages.data.length > 0 &&
        coverages.data.every((c) => selected.has(c.id));

    const confirmDelete = async () => {
        if (!deleteTargets || deleting) return;

        const blocked = deleteTargets.filter((c) => c.has_projects);

        if (blocked.length > 0) {
            setDeleteError(
                blocked.length === 1
                    ? `Cannot delete "${blocked[0].road_name}" because it is referenced by ${blocked[0].project_title || 'a maintenance project'}.`
                    : `Some selected road coverages cannot be deleted because they are referenced by maintenance projects.`,
            );

            return;
        }

        setDeleting(true);
        setDeleteError('');

        if (deleteTargets.length === 1) {
            router.delete(
                workspaceHref(`/road-coverages/${deleteTargets[0].id}`),
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        setDeleting(false);
                        setDeleteTargets(null);
                        clearSelection();
                    },
                    onError: (errors) => {
                        setDeleting(false);
                        setDeleteError(
                            Object.values(errors).join(' ') ||
                                'Deletion failed.',
                        );
                    },
                },
            );
        } else {
            router.delete(workspaceHref('/road-coverages/bulk'), {
                data: { ids: deleteTargets.map((t) => t.id) },
                preserveScroll: true,
                onSuccess: () => {
                    setDeleting(false);
                    setDeleteTargets(null);
                    clearSelection();
                },
                onError: (errors) => {
                    setDeleting(false);
                    setDeleteError(
                        Object.values(errors).join(' ') ||
                            'Bulk deletion failed.',
                    );
                },
            });
        }
    };
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

                {/* Main White Content Container matching Maintenance Documents smooth fully-rounded top corners */}
                <main className="jr-road-coverage-main-container relative -mt-3.5 -mx-7 rounded-t-[20px] bg-white px-7 pt-6 pb-8 shadow-sm">
                    {/* 1. Metric Cards */}
                    <section
                        aria-label="Road coverage statistics"
                        className="jr-metrics-grid mb-6 grid gap-4 sm:grid-cols-3"
                    >
                    <div className="jr-metric-card rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#98502D]">
                            Total Road Coverages
                        </p>
                        <p className="mt-2 text-3xl font-bold text-[#1E293B]">
                            {displayedTotalCoverages}
                        </p>
                        <p className="mt-1 text-xs text-[#64748B]">
                            Registered road coverages
                        </p>
                    </div>
                    <div className="jr-metric-card rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                            Linked Projects
                        </p>
                        <p className="mt-2 text-3xl font-bold text-[#1E293B]">
                            {displayedLinkedProjects}
                        </p>
                        <p className="mt-1 text-xs text-[#64748B]">
                            Maintenance projects linked to coverages
                        </p>
                    </div>
                    <div className="jr-metric-card rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                            Total Network Length
                        </p>
                        <p className="mt-2 text-3xl font-bold text-[#1E293B]">
                            {Number(displayedTotalLengthKm).toFixed(2)}{' '}
                            <span className="text-sm font-medium text-[#64748B]">
                                km
                            </span>
                        </p>
                        <p className="mt-1 text-xs text-[#64748B]">
                            Across all road coverages
                        </p>
                    </div>
                </section>

                {/* 2. Simplified Coverage Map (Separated Cards Layout) */}
                <section
                    aria-label="Road coverage map"
                    className="jr-map-card-container mb-6 rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:p-5 shadow-sm overflow-hidden"
                >
                    <SimplifiedCoverageMap
                        coverages={mapCoverages || coverages?.data || []}
                    />
                </section>

                {/* 3. Road Coverages Directory Table (Separated Cards Layout) */}
                <section
                    aria-label="Road coverages directory"
                    className="jr-table-card-container rounded-t-[20px] rounded-b-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm"
                >
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
                <DirectorySelectionToolbar
                    selecting={selecting}
                    selectedCount={selected.size}
                    total={coverages.total}
                    singular="road coverage"
                    plural="road coverages"
                    canDelete={effectiveCanDelete}
                    disabled={busy}
                    onSelect={() => setSelecting(true)}
                    onCancel={clearSelection}
                    onDelete={() => {
                        const targets = coverages.data.filter((c) =>
                            selected.has(c.id),
                        );
                        if (targets.length > 0) {
                            setDeleteError('');
                            setDeleteTargets(targets);
                        }
                    }}
                />
                <div
                    className="jr-table-wrap"
                    role="region"
                    aria-label="Road coverages table"
                    aria-busy={busy}
                    tabIndex={0}
                >
                    <table className="jr-table jr-road-coverage-table">
                        <colgroup>
                            {selecting && <col style={{ width: '48px' }} />}
                            <col style={{ width: selecting ? '27%' : '30%' }} />
                            <col style={{ width: '19%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '16%' }} />
                            <col style={{ width: '7%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                {selecting && (
                                    <th className="w-12 px-3 text-center">
                                        <Checkbox
                                            aria-label="Select all road coverages on this page"
                                            checked={
                                                allSelected
                                                    ? true
                                                    : selected.size > 0
                                                      ? 'indeterminate'
                                                      : false
                                            }
                                            onCheckedChange={(checked) =>
                                                setSelected(
                                                    checked
                                                        ? new Set(
                                                              coverages.data.map(
                                                                  (c) => c.id,
                                                              ),
                                                          )
                                                        : new Set(),
                                                )
                                            }
                                        />
                                    </th>
                                )}
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
                                    data-selected={selected.has(coverage.id)}
                                    onClick={() => {
                                        if (selecting) {
                                            toggle(coverage.id);
                                        } else {
                                            router.visit(
                                                editUrl(
                                                    workspaceHref(
                                                        `/road-coverages/${coverage.id}`,
                                                    ),
                                                    page.url,
                                                ),
                                            );
                                        }
                                    }}
                                >
                                    {selecting && (
                                        <td
                                            className="w-12 px-3 text-center"
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                        >
                                            <Checkbox
                                                aria-label={`Select ${coverage.road_name}`}
                                                checked={selected.has(
                                                    coverage.id,
                                                )}
                                                onCheckedChange={() =>
                                                    toggle(coverage.id)
                                                }
                                            />
                                        </td>
                                    )}
                                    <td>
                                        <Link
                                            className="jr-project-title"
                                            href={editUrl(
                                                workspaceHref(
                                                    `/road-coverages/${coverage.id}`,
                                                ),
                                                page.url,
                                            )}
                                            onClick={(event) => {
                                                if (selecting) {
                                                    event.preventDefault();
                                                    toggle(coverage.id);
                                                } else {
                                                    event.stopPropagation();
                                                }
                                            }}
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
                                                <DropdownMenuItem
                                                    disabled={
                                                        !effectiveCanDelete ||
                                                        Boolean(
                                                            coverage.has_projects,
                                                        )
                                                    }
                                                    title={
                                                        coverage.has_projects
                                                            ? `Referenced by ${coverage.project_title || 'a maintenance project'}`
                                                            : undefined
                                                    }
                                                    className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                                    onSelect={() => {
                                                        setDeleteError('');
                                                        setDeleteTargets([
                                                            coverage,
                                                        ]);
                                                    }}
                                                >
                                                    <Trash2 className="size-4" />
                                                    Delete Road Coverage
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
                    ready={true}
                    onPage={(value) => visit({ ...filters, search }, value)}
                />
                </section>
                </main>

                {deleteTargets && (
                    <DeletionDialog
                        open={Boolean(deleteTargets)}
                        title={
                            deleteTargets.length === 1
                                ? `Delete ${deleteTargets[0].road_name}?`
                                : `Delete ${deleteTargets.length} road coverages?`
                        }
                        description={
                            deleteTargets.length === 1
                                ? 'Are you sure you want to permanently delete this road coverage? This action cannot be undone.'
                                : `Are you sure you want to permanently delete these ${deleteTargets.length} road coverages? This action cannot be undone.`
                        }
                        processing={deleting}
                        error={deleteError}
                        confirmLabel={
                            deleteTargets.length === 1
                                ? 'Delete Road Coverage'
                                : `Delete ${deleteTargets.length} Road Coverages`
                        }
                        confirmDisabled={deleteTargets.some(
                            (c) => c.has_projects,
                        )}
                        onClose={() => {
                            if (!deleting) {
                                setDeleteTargets(null);
                            }
                        }}
                        onConfirm={confirmDelete}
                    >
                        <div className="my-4 text-sm text-[#405572]">
                            {deleteTargets.length === 1 ? (
                                <div>
                                    <p>
                                        Road Coverage:{' '}
                                        <strong>
                                            {deleteTargets[0].road_name}
                                        </strong>
                                        {deleteTargets[0].lgu
                                            ?.municipality_name
                                            ? ` (${deleteTargets[0].lgu.municipality_name})`
                                            : ''}
                                    </p>
                                    {deleteTargets[0].has_projects && (
                                        <p className="mt-2 text-xs text-red-600">
                                            This road coverage is referenced by{' '}
                                            {deleteTargets[0].project_title ||
                                                'a maintenance project'}{' '}
                                            and cannot be deleted.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <ul className="max-h-40 list-disc overflow-y-auto pl-5 space-y-1">
                                        {deleteTargets.map((c) => (
                                            <li key={c.id}>
                                                {c.road_name}{' '}
                                                {c.lgu?.municipality_name
                                                    ? `(${c.lgu.municipality_name})`
                                                    : ''}
                                                {c.has_projects && (
                                                    <span className="ml-1 text-xs text-red-600">
                                                        (referenced by project)
                                                    </span>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                    {deleteTargets.some(
                                        (c) => c.has_projects,
                                    ) && (
                                        <p className="mt-2 text-xs text-red-600">
                                            Records referenced by maintenance
                                            projects cannot be deleted.
                                            Deselect them to proceed.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </DeletionDialog>
                )}
            </ProjectWorkspace>
        </div>
    );
}

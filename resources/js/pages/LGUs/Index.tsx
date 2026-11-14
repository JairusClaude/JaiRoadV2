import { Head, Link, router, usePage } from '@inertiajs/react';
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    DirectoryFilter,
    DirectoryPagination,
    DirectorySelectionToolbar,
} from '@/components/directory-controls';
import {
    LguDeletionDialog,
    useLguDeletion,
} from '@/components/lgus/lgu-deletion';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { MetricCard } from '@/components/metric-card';
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
import { mayorName } from '@/lib/lgus';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { LguFilters, LguPage, LguPermissions, LguSummary } from '@/types/lgus';
import '../../../css/lgus.css';

export default function Index({
    totalMunicipalities,
    totalRoadCoverages,
    totalEngineerAssignments,
    lgus = {
        data: [],
        total: 0,
        current_page: 1,
        last_page: 1,
        from: null,
        to: null,
    },
    filters = { search: '', province: '', region: '', sort: 'asc' },
    provinces = [],
    regions = [],
    message,
    lguPermissions = { can_edit: true, can_delete: true },
    lguReviewNotice,
}: {
    totalMunicipalities?: number;
    totalRoadCoverages?: number;
    totalEngineerAssignments?: number;
    lgus: LguPage;
    filters: LguFilters;
    provinces: string[];
    regions: string[];
    message?: string;
    lguPermissions: LguPermissions;
    lguReviewNotice?: string;
}) {
    const page = usePage();
    const enabled = true;
    const deletion = useLguDeletion(
        lgus.data,
        lguPermissions.can_delete,
    );
    const [search, setSearch] = useState(filters.search);
    const [busy, setBusy] = useState(false);
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [bulkTargets, setBulkTargets] = useState<LguSummary[] | null>(null);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [bulkError, setBulkError] = useState('');
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
        lgus.data.length > 0 && lgus.data.every((l) => selected.has(l.id));

    const confirmBulkDelete = () => {
        if (!bulkTargets || bulkDeleting) return;

        const blocked = bulkTargets.filter(
            (l) =>
                (l.deletion_check?.road_coverages ?? 0) > 0 ||
                (l.deletion_check?.engineer_assignments ?? 0) > 0,
        );

        if (blocked.length > 0) {
            setBulkError(
                `Some selected LGUs have linked road coverages or engineer assignments and cannot be deleted (${blocked.map((l) => l.municipality_name).join(', ')}). Deselect them to proceed.`,
            );

            return;
        }

        setBulkDeleting(true);
        setBulkError('');

        router.delete(workspaceHref('/lgus/bulk'), {
            data: {
                ids: bulkTargets.map((l) => l.id),
                lgu_ids: bulkTargets.map((l) => l.id),
            },
            preserveScroll: true,
            onError: (errors) => {
                setBulkError(
                    Object.values(errors).join(' ') || 'Deletion failed.',
                );
                setBulkDeleting(false);
            },
            onSuccess: () => {
                setBulkTargets(null);
                setBulkDeleting(false);
                clearSelection();
            },
        });
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

    const visit = (next: LguFilters, current = 1) => {
        clearTimeout(timer.current);
        request.current?.cancel();
        router.get(
            workspaceHref('/lgus'),
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

    const displayedMunicipalities =
        totalMunicipalities ?? lgus?.total ?? lgus?.data?.length ?? 0;
    const displayedRoadCoverages =
        totalRoadCoverages ??
        lgus?.data?.reduce(
            (acc, l) => acc + (l.deletion_check?.road_coverages ?? 0),
            0,
        ) ??
        0;
    const displayedEngineerAssignments =
        totalEngineerAssignments ??
        lgus?.data?.reduce(
            (acc, l) => acc + (l.deletion_check?.engineer_assignments ?? 0),
            0,
        ) ??
        0;

    return (
        <div className="jr-directory-exploration jr-lgu-directory">
            <Head title="LGU" />
            <ProjectWorkspace>
                <div className="jr-page-head">
                    <div>
                        <h1>LGU</h1>
                        <p>
                            Browse and manage registered local government units.
                        </p>
                    </div>
                    <Button
                        className="jr-primary"
                        disabled={!enabled || !lguPermissions.can_edit}
                        onClick={() =>
                            router.visit(
                                workspaceHref(editUrl('/lgus/create', page.url)),
                            )
                        }
                    >
                        <Plus />
                        Add LGU
                    </Button>
                </div>
                {lguReviewNotice && (
                    <p role="note" className="jr-field-hint mb-4">
                        {lguReviewNotice}
                    </p>
                )}
                {message && (
                    <p className="jr-field-hint mb-4" role="status">
                        {message}
                    </p>
                )}
                <form
                    className="jr-filters"
                    onSubmit={(e) => {
                        e.preventDefault();
                        visit({ ...filters, search });
                    }}
                >
                    {/* 3 Metric Cards */}
                    <section
                        aria-label="LGU statistics"
                        className="jr-metrics-grid mb-5 grid w-full gap-4 sm:grid-cols-3"
                    >
                        <MetricCard
                            title="Municipalities"
                            value={displayedMunicipalities}
                            subtitle="Registered local government units"
                            highlight={true}
                        />
                        <MetricCard
                            title="Road Coverages"
                            value={displayedRoadCoverages}
                            subtitle="Across all municipalities"
                        />
                        <MetricCard
                            title="Engineer Assignments"
                            value={displayedEngineerAssignments}
                            subtitle="Active municipal engineers"
                        />
                    </section>
                    <div className="jr-search">
                        <Search className="size-[18px]" />
                        <Input
                            type="search"
                            maxLength={255}
                            aria-label="Search LGUs"
                            placeholder="Search municipalities, provinces, regions, or mayors..."
                            value={search}
                            onChange={(e) => {
                                const value = e.target.value;
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
                            label="Province filter"
                            value={filters.province || 'all'}
                            options={[
                                { value: 'all', label: 'All Provinces' },
                                ...provinces.map((value) => ({
                                    value,
                                    label: value,
                                })),
                            ]}
                            onChange={(value) =>
                                visit({
                                    ...filters,
                                    search,
                                    province: value === 'all' ? '' : value,
                                })
                            }
                        />
                        <DirectoryFilter
                            label="Region filter"
                            value={filters.region || 'all'}
                            options={[
                                { value: 'all', label: 'All Regions' },
                                ...regions.map((value) => ({
                                    value,
                                    label: value,
                                })),
                            ]}
                            onChange={(value) =>
                                visit({
                                    ...filters,
                                    search,
                                    region: value === 'all' ? '' : value,
                                })
                            }
                        />
                        <DirectoryFilter
                            label="Sort LGUs"
                            value={filters.sort}
                            options={[
                                { value: 'asc', label: 'Municipality A–Z' },
                                { value: 'desc', label: 'Municipality Z–A' },
                            ]}
                            onChange={(sort) =>
                                visit({
                                    ...filters,
                                    search,
                                    sort: sort as LguFilters['sort'],
                                })
                            }
                        />
                    </div>
                </form>
                <DirectorySelectionToolbar
                    selecting={selecting}
                    selectedCount={selected.size}
                    total={lgus.total}
                    singular="LGU"
                    plural="LGUs"
                    canDelete={lguPermissions.can_delete}
                    disabled={busy || bulkDeleting}
                    onSelect={() => setSelecting(true)}
                    onCancel={clearSelection}
                    onDelete={() => {
                        const targets = lgus.data.filter((l) =>
                            selected.has(l.id),
                        );
                        if (targets.length > 0) {
                            setBulkError('');
                            setBulkTargets(targets);
                        }
                    }}
                />
                <div
                    className="jr-table-wrap"
                    aria-busy={busy}
                    role="region"
                    aria-label="LGU table"
                    tabIndex={0}
                >
                    <table className="jr-table jr-lgu-table">
                        <colgroup>
                            {selecting && <col style={{ width: '48px' }} />}
                            <col style={{ width: selecting ? '25%' : '28%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '23%' }} />
                            <col style={{ width: '7%' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                {selecting && (
                                    <th className="w-12 px-3 text-center">
                                        <Checkbox
                                            aria-label="Select all LGUs on this page"
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
                                                              lgus.data.map(
                                                                  (l) => l.id,
                                                              ),
                                                          )
                                                        : new Set(),
                                                )
                                            }
                                        />
                                    </th>
                                )}
                                <th>Municipality</th>
                                <th>Province</th>
                                <th>Region</th>
                                <th>Municipal Mayor</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lgus.data.map((lgu) => (
                                <tr
                                    key={lgu.id}
                                    data-lgu-id={lgu.id}
                                    data-selected={selected.has(lgu.id)}
                                    onClick={() => {
                                        if (selecting) {
                                            toggle(lgu.id);
                                        } else {
                                            router.visit(
                                                workspaceHref(
                                                    editUrl(
                                                        `/lgus/${lgu.id}`,
                                                        page.url,
                                                    ),
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
                                                aria-label={`Select ${lgu.municipality_name}`}
                                                checked={selected.has(lgu.id)}
                                                onCheckedChange={() =>
                                                    toggle(lgu.id)
                                                }
                                            />
                                        </td>
                                    )}
                                    <td>
                                        <Link
                                            className="jr-project-title"
                                            href={workspaceHref(
                                                editUrl(
                                                    `/lgus/${lgu.id}`,
                                                    page.url,
                                                ),
                                            )}
                                            onClick={(event) => {
                                                if (selecting) {
                                                    event.preventDefault();
                                                    toggle(lgu.id);
                                                } else {
                                                    event.stopPropagation();
                                                }
                                            }}
                                        >
                                            {lgu.municipality_name}
                                        </Link>
                                    </td>
                                    <td>{lgu.province}</td>
                                    <td>{lgu.region}</td>
                                    <td>{mayorName(lgu)}</td>
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
                                                    aria-label={`Actions for ${lgu.municipality_name}`}
                                                >
                                                    <MoreHorizontal />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="jr-theme jr-menu"
                                            >
                                                <DropdownMenuItem
                                                    disabled={
                                                        !lguPermissions.can_edit
                                                    }
                                                    onSelect={() =>
                                                        router.visit(
                                                            workspaceHref(
                                                                editUrl(
                                                                    `/lgus/${lgu.id}/edit`,
                                                                    page.url,
                                                                ),
                                                            ),
                                                        )
                                                    }
                                                >
                                                    <Pencil />
                                                    Edit LGU
                                                </DropdownMenuItem>
                                                {lguPermissions.can_delete && (
                                                    <DropdownMenuItem
                                                        className="text-red-600 focus:bg-red-50 focus:text-red-700"
                                                        onSelect={() =>
                                                            deletion.open(
                                                                lgu,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="size-4" />
                                                        Delete LGU
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!lgus.data.length && (
                        <div className="jr-empty">
                            <strong>
                                {filters.search ||
                                filters.province ||
                                filters.region
                                    ? 'No matching LGUs.'
                                    : 'No LGUs yet.'}
                            </strong>
                            <p>
                                {filters.search ||
                                filters.province ||
                                filters.region
                                    ? 'Try another search or clear the filters.'
                                    : 'Add an LGU to get started.'}
                            </p>
                            {(filters.search ||
                                filters.province ||
                                filters.region) && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch('');
                                        visit({
                                            search: '',
                                            province: '',
                                            region: '',
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
                    total={lgus.total}
                    from={lgus.from}
                    to={lgus.to}
                    currentPage={lgus.current_page}
                    lastPage={lgus.last_page}
                    plural="LGUs"
                    label="LGU pagination"
                    busy={busy}
                    ready={true}
                    onPage={(value) => visit({ ...filters, search }, value)}
                />
            </ProjectWorkspace>
            <LguDeletionDialog deletion={deletion} />

            {bulkTargets && (
                <DeletionDialog
                    open={Boolean(bulkTargets)}
                    title={`Delete ${bulkTargets.length} LGUs?`}
                    description={`Are you sure you want to permanently delete these ${bulkTargets.length} municipalities? This action cannot be undone.`}
                    processing={bulkDeleting}
                    error={bulkError}
                    confirmLabel={`Delete ${bulkTargets.length} LGUs`}
                    confirmDisabled={bulkTargets.some(
                        (l) =>
                            (l.deletion_check?.road_coverages ?? 0) > 0 ||
                            (l.deletion_check?.engineer_assignments ?? 0) > 0,
                    )}
                    onClose={() => {
                        if (!bulkDeleting) {
                            setBulkTargets(null);
                        }
                    }}
                    onConfirm={confirmBulkDelete}
                >
                    <div className="my-4 text-sm text-[#405572]">
                        <ul className="max-h-40 list-disc overflow-y-auto pl-5 space-y-1">
                            {bulkTargets.map((l) => {
                                const blocked =
                                    (l.deletion_check?.road_coverages ?? 0) >
                                        0 ||
                                    (l.deletion_check?.engineer_assignments ??
                                        0) > 0;
                                return (
                                    <li key={l.id}>
                                        {l.municipality_name}
                                        {l.province ? ` (${l.province})` : ''}
                                        {blocked && (
                                            <span className="ml-1 text-xs text-red-600">
                                                (has linked roads or assignments)
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        {bulkTargets.some(
                            (l) =>
                                (l.deletion_check?.road_coverages ?? 0) > 0 ||
                                (l.deletion_check?.engineer_assignments ?? 0) >
                                    0,
                        ) && (
                            <p className="mt-2 text-xs text-red-600">
                                LGUs with linked road coverages or engineer
                                assignments cannot be deleted. Deselect them to
                                proceed.
                            </p>
                        )}
                    </div>
                </DeletionDialog>
            )}
        </div>
    );
}

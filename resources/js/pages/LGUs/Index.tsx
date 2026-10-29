import { Head, Link, router, usePage } from '@inertiajs/react';
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    DirectoryFilter,
    DirectoryPagination,
} from '@/components/directory-controls';
import {
    LguDeletionDialog,
    useLguDeletion,
} from '@/components/lgus/lgu-deletion';
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
import { mayorName } from '@/lib/lgus';
import type { LguFilters, LguPage, LguPermissions } from '@/types/lgus';
import '../../../css/lgus.css';

export default function Index({
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
    lguPermissions = { can_edit: false, can_delete: false },
    lguReviewNotice,
}: {
    lgus: LguPage;
    filters: LguFilters;
    provinces: string[];
    regions: string[];
    message?: string;
    lguPermissions: LguPermissions;
    lguReviewNotice?: string;
}) {
    const page = usePage();
    const enabled = page.props.previewOnly === true;
    const deletion = useLguDeletion(
        lgus.data,
        enabled && lguPermissions.can_delete,
    );
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

    const visit = (next: LguFilters, current = 1) => {
        clearTimeout(timer.current);
        request.current?.cancel();
        router.get(
            '/lgus',
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
                            router.visit(editUrl('/lgus/create', page.url))
                        }
                    >
                        <Plus />
                        Add LGU
                    </Button>
                </div>
                {!enabled && (
                    <p className="jr-field-error" role="note">
                        LGU data and management require backend integration
                        aligned with the approved attributes.
                    </p>
                )}
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
                    <div className="jr-search">
                        <Search className="size-[18px]" />
                        <Input
                            type="search"
                            maxLength={255}
                            aria-label="Search LGUs"
                            disabled={!enabled}
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
                            disabled={!enabled}
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
                            disabled={!enabled}
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
                            disabled={!enabled}
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
                <div className="jr-table-toolbar">
                    <span role="status">
                        {lgus.total} {lgus.total === 1 ? 'LGU' : 'LGUs'} found
                    </span>
                </div>
                <div
                    className="jr-table-wrap"
                    aria-busy={busy}
                    role="region"
                    aria-label="LGU table"
                    tabIndex={0}
                >
                    <table className="jr-table jr-lgu-table">
                        <colgroup>
                            <col style={{ width: '28%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '23%' }} />
                            <col style={{ width: '7%' }} />
                        </colgroup>
                        <thead>
                            <tr>
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
                                    onClick={() =>
                                        router.visit(
                                            editUrl(
                                                `/lgus/${lgu.id}`,
                                                page.url,
                                            ),
                                        )
                                    }
                                >
                                    <td>
                                        <Link
                                            className="jr-project-title"
                                            href={editUrl(
                                                `/lgus/${lgu.id}`,
                                                page.url,
                                            )}
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
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
                                                        !enabled ||
                                                        !lguPermissions.can_edit
                                                    }
                                                    onSelect={() =>
                                                        router.visit(
                                                            editUrl(
                                                                `/lgus/${lgu.id}/edit`,
                                                                page.url,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    <Pencil />
                                                    Edit LGU
                                                </DropdownMenuItem>
                                                {enabled &&
                                                    lguPermissions.can_delete && (
                                                        <DropdownMenuItem
                                                            onSelect={() =>
                                                                deletion.open(
                                                                    lgu,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 />
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
                                {!enabled
                                    ? 'LGU data is unavailable.'
                                    : filters.search ||
                                        filters.province ||
                                        filters.region
                                      ? 'No matching LGUs.'
                                      : 'No LGUs yet.'}
                            </strong>
                            <p>
                                {!enabled
                                    ? 'Backend integration is pending.'
                                    : filters.search ||
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
                    onPage={(value) => visit({ ...filters, search }, value)}
                />
            </ProjectWorkspace>
            <LguDeletionDialog deletion={deletion} />
        </div>
    );
}

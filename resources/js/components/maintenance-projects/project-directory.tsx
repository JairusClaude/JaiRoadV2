import { usePage } from '@inertiajs/react';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import {
    DirectoryPagination,
    DirectorySelectionToolbar,
} from '@/components/directory-controls';
import {
    ProjectActions,
    IntegrationNotice,
    ProjectWorkspace,
} from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { editUrl } from '@/lib/form-navigation';
import { workspaceHref } from '@/lib/workspace-navigation';
import type {
    IntegrationStatus,
    Pagination,
    ProjectFilters,
    ProjectSummary,
} from '@/types/maintenance-projects';

export type DirectoryProps = {
    projects: Pagination;
    municipalities: { id: number; municipality_name: string }[];
    filters: ProjectFilters;
    integration: IntegrationStatus;
    canCreate: boolean;
    canBulkDelete: boolean;
    onDelete: (projects: ProjectSummary[], bulk?: boolean) => void;
    onSearch?: (search: string) => void;
    onFilters: (filters: ProjectFilters) => void;
    onNavigate: (url: string) => void;
    busy?: boolean;
};

export function ProjectDirectory({
    projects,
    municipalities,
    filters,
    integration,
    canCreate,
    canBulkDelete,
    onDelete,
    onSearch,
    onFilters,
    onNavigate,
    busy = false,
}: DirectoryProps) {
    const page = usePage();
    const [search, setSearch] = useState(filters.search);
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const selectionScope = `${projects.current_page}:${filters.municipality}:${filters.sort}:${projects.data.map((project) => project.id).join(',')}`;
    const [previousScope, setPreviousScope] = useState(selectionScope);

    // Reset only selection when the returned scope changes. Keep the directory
    // and search input mounted so browser focus and caret position survive.
    if (previousScope !== selectionScope) {
        setPreviousScope(selectionScope);
        setSelecting(false);
        setSelected(new Set());
    }

    const allSelected =
        projects.data.length > 0 &&
        projects.data.every((project) => selected.has(project.id));

    const toggle = (id: number) =>
        setSelected((previous) => {
            const next = new Set(previous);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });
    const clearSelection = () => setSelected(new Set());
    const apply = (next: ProjectFilters) => {
        clearSelection();
        onFilters(next);
    };
    const pageUrl = (page: number) => {
        const query = new URLSearchParams({
            search: filters.search,
            municipality: String(filters.municipality || ''),
            sort: filters.sort,
            page: String(page),
        });
        clearSelection();
        onNavigate(workspaceHref(`/maintenance-projects?${query.toString()}`));
    };

    return (
        <ProjectWorkspace>
            <div className="jr-page-head">
                <div>
                    <h1>Maintenance Projects</h1>
                    <p>Browse and manage road maintenance projects.</p>
                </div>
                <Button
                    className="jr-primary"
                    disabled={integration.ready && !canCreate}
                    onClick={() =>
                        onNavigate(
                            workspaceHref('/maintenance-projects/create'),
                        )
                    }
                >
                    <Plus />
                    Add Project
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
                        aria-label="Search project titles"
                        placeholder="Search project titles..."
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            clearSelection();
                            onSearch?.(event.target.value);
                        }}
                        disabled={!integration.ready || busy}
                    />
                </div>
                <div className="jr-filter-row">
                    <Select
                        value={String(filters.municipality || 'all')}
                        onValueChange={(value) =>
                            apply({
                                ...filters,
                                search,
                                municipality: value === 'all' ? '' : value,
                            })
                        }
                        disabled={!integration.ready || busy}
                    >
                        <SelectTrigger
                            aria-label="Municipality filter"
                            className="jr-municipality-filter"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                            className="jr-theme jr-menu jr-filter-menu"
                            align="start"
                            sideOffset={4}
                        >
                            <SelectItem value="all">
                                All Municipalities
                            </SelectItem>
                            {municipalities.map((lgu) => (
                                <SelectItem key={lgu.id} value={String(lgu.id)}>
                                    {lgu.municipality_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.sort}
                        onValueChange={(value: 'newest' | 'oldest') =>
                            apply({ ...filters, search, sort: value })
                        }
                        disabled={!integration.ready || busy}
                    >
                        <SelectTrigger
                            aria-label="Sort projects"
                            className="jr-sort-filter"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                            className="jr-theme jr-menu jr-filter-menu"
                            align="start"
                            sideOffset={4}
                        >
                            <SelectItem value="newest">Newest first</SelectItem>
                            <SelectItem value="oldest">Oldest first</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <span className="sr-only">
                    Search results update automatically while typing.
                </span>
            </form>
            <DirectorySelectionToolbar
                selecting={selecting}
                selectedCount={selected.size}
                total={projects.total}
                singular="project"
                plural="projects"
                canDelete={canBulkDelete}
                disabled={!integration.ready || busy}
                onSelect={() => setSelecting(true)}
                onCancel={() => {
                    setSelecting(false);
                    clearSelection();
                }}
                onDelete={() =>
                    onDelete(
                        projects.data.filter((project) =>
                            selected.has(project.id),
                        ),
                        true,
                    )
                }
            />
            <div className="jr-table-wrap" aria-busy={busy}>
                <table className="jr-table">
                    <colgroup>
                        <col style={{ width: '60%' }} />
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>
                                <div className="jr-project-line">
                                    {selecting && (
                                        <Checkbox
                                            aria-label="Select all projects on this page"
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
                                                              projects.data.map(
                                                                  (project) =>
                                                                      project.id,
                                                              ),
                                                          )
                                                        : new Set(),
                                                )
                                            }
                                        />
                                    )}
                                    <span>Project</span>
                                </div>
                            </th>
                            <th>Municipality</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.data.map((project) => (
                            <tr
                                key={project.id}
                                data-selected={selected.has(project.id)}
                                onClick={() =>
                                    selecting
                                        ? toggle(project.id)
                                        : onNavigate(
                                              workspaceHref(
                                                  `/maintenance-projects/${project.id}`,
                                              ),
                                          )
                                }
                            >
                                <td>
                                    <div className="jr-project-line">
                                        {selecting && (
                                            <Checkbox
                                                aria-label={`Select ${project.project_title}`}
                                                checked={selected.has(
                                                    project.id,
                                                )}
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                                onCheckedChange={() =>
                                                    toggle(project.id)
                                                }
                                            />
                                        )}
                                        <div className="min-w-0">
                                            {selecting ? (
                                                <button
                                                    className="jr-project-title text-left"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggle(project.id);
                                                    }}
                                                >
                                                    {project.project_title}
                                                </button>
                                            ) : (
                                                <a
                                                    className="jr-project-title"
                                                    href={workspaceHref(
                                                        `/maintenance-projects/${project.id}`,
                                                    )}
                                                    onClick={(event) => {
                                                        if (
                                                            !event.ctrlKey &&
                                                            !event.metaKey &&
                                                            !event.shiftKey &&
                                                            event.button === 0
                                                        ) {
                                                            event.preventDefault();
                                                            event.stopPropagation();
                                                            onNavigate(
                                                                workspaceHref(
                                                                    `/maintenance-projects/${project.id}`,
                                                                ),
                                                            );
                                                        } else {
                                                            event.stopPropagation();
                                                        }
                                                    }}
                                                >
                                                    {project.project_title}
                                                </a>
                                            )}
                                            <div className="jr-project-id">
                                                Project ID: {project.id}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    {project.municipality ?? (
                                        <span className="jr-muted">
                                            Coverage not mapped
                                        </span>
                                    )}
                                </td>
                                <td
                                    className="text-right"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    {!selecting && (
                                        <ProjectActions
                                            project={project}
                                            onEdit={() =>
                                                onNavigate(
                                                    editUrl(
                                                        workspaceHref(
                                                            `/maintenance-projects/${project.id}/edit`,
                                                        ),
                                                        page.url,
                                                    ),
                                                )
                                            }
                                            onDelete={() => onDelete([project])}
                                        />
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {projects.data.length === 0 && (
                    <div className="jr-empty">
                        <strong>
                            {!integration.ready
                                ? 'Project data is not available yet.'
                                : filters.search || filters.municipality
                                  ? 'No matching projects.'
                                  : 'No maintenance projects yet.'}
                        </strong>
                        <p>
                            {!integration.ready
                                ? 'The interface is ready for approved account and database integration.'
                                : filters.search || filters.municipality
                                  ? 'Try another search or municipality.'
                                  : 'Add a project to link an existing road coverage.'}
                        </p>
                        {integration.ready &&
                            (filters.search || filters.municipality) && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch('');
                                        apply({
                                            search: '',
                                            municipality: '',
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
                total={projects.total}
                from={projects.from}
                to={projects.to}
                currentPage={projects.current_page}
                lastPage={projects.last_page}
                plural="projects"
                label="Project pagination"
                ready={integration.ready}
                busy={busy}
                readOnly={!canCreate}
                onPage={pageUrl}
            />
        </ProjectWorkspace>
    );
}

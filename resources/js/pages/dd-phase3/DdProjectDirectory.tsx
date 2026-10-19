import {
  CheckSquare,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import {
  ProjectActions,
  IntegrationNotice,
  ProjectWorkspace,
} from "@/components/maintenance-projects/project-workspace";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  IntegrationStatus,
  Pagination,
  ProjectFilters,
  ProjectSummary,
} from "@/types/maintenance-projects";

export type DirectoryProps = {
  projects: Pagination;
  municipalities: { id: number; municipality_name: string }[];
  filters: ProjectFilters;
  integration: IntegrationStatus;
  canCreate: boolean;
  canBulkDelete: boolean;
  onDelete: (projects: ProjectSummary[], bulk?: boolean) => void;
  onFilters: (filters: ProjectFilters) => void;
  onNavigate: (url: string) => void;
  busy?: boolean;
};

export function DdProjectDirectory({
  projects,
  municipalities,
  filters,
  integration,
  canCreate,
  canBulkDelete,
  onDelete,
  onFilters,
  onNavigate,
  busy = false,
}: DirectoryProps) {
  const [search, setSearch] = useState(filters.search);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
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
  const pages = Array.from(
    { length: Math.min(5, projects.last_page) },
    (_, offset) => {
      const first = Math.max(
        1,
        Math.min(projects.current_page - 2, projects.last_page - 4),
      );

      return first + offset;
    },
  );
  const pageUrl = (page: number) => {
    const query = new URLSearchParams({
      search: filters.search,
      municipality: String(filters.municipality || ""),
      sort: filters.sort,
      page: String(page),
    });
    clearSelection();
    onNavigate(`/dd-phase3/projects?${query.toString()}`);
  };

  return (
    <ProjectWorkspace>
      <div className="jr-page-head">
        <div>
          <h1>Maintenance Projects</h1>
          <p>Browse and manage road maintenance projects.</p>
        </div>
        {canCreate && (
          <Button
            className="jr-primary"
            disabled={!integration.ready || busy}
            onClick={() => onNavigate("/dd-phase3/projects?view=create")}
          >
            <Plus />
            Add Project
          </Button>
        )}
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
            onChange={(event) => setSearch(event.target.value)}
            disabled={!integration.ready || busy}
          />
        </div>
        <div className="jr-filter-row">
          <Select
            value={String(filters.municipality || "all")}
            onValueChange={(value) =>
              apply({
                ...filters,
                search,
                municipality: value === "all" ? "" : value,
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
              <SelectItem value="all">All Municipalities</SelectItem>
              {municipalities.map((lgu) => (
                <SelectItem key={lgu.id} value={String(lgu.id)}>
                  {lgu.municipality_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.sort}
            onValueChange={(value: "newest" | "oldest") =>
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
        <span className="sr-only">Press Enter to search project titles.</span>
      </form>
      <div className="jr-table-toolbar">
        <span role="status">
          {selecting
            ? `${selected.size} selected`
            : `${projects.total} ${projects.total === 1 ? "project" : "projects"} found`}
        </span>
        {selecting ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelecting(false);
                clearSelection();
              }}
            >
              Cancel selection
            </Button>
            {canBulkDelete && (
              <Button
                className="jr-danger"
                disabled={selected.size === 0 || busy}
                onClick={() =>
                  onDelete(
                    projects.data.filter((project) => selected.has(project.id)),
                    true,
                  )
                }
              >
                Delete selected
              </Button>
            )}
          </div>
        ) : (
          <Button
            variant="outline"
            disabled={!integration.ready || projects.data.length === 0}
            onClick={() => setSelecting(true)}
          >
            <CheckSquare />
            Select projects
          </Button>
        )}
      </div>
      <div className="jr-table-wrap" aria-busy={busy}>
        <table className="jr-table">
          <colgroup>
            <col style={{ width: "60%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "10%" }} />
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
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={(checked) =>
                        setSelected(
                          checked
                            ? new Set(
                                projects.data.map((project) => project.id),
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
                        `/dd-phase3/projects?view=show&project=${project.id}`,
                      )
                }
              >
                <td>
                  <div className="jr-project-line">
                    {selecting && (
                      <Checkbox
                        aria-label={`Select ${project.project_title}`}
                        checked={selected.has(project.id)}
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() => toggle(project.id)}
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
                          href={`/dd-phase3/projects?view=show&project=${project.id}`}
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
                                `/dd-phase3/projects?view=show&project=${project.id}`,
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
                    <span className="jr-muted">Coverage not mapped</span>
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
                          `/dd-phase3/projects?view=edit&project=${project.id}`,
                        )
                      }
                      onDelete={() => onDelete([project])}
                    />
                  )}
                </td>
              </tr>
            ))}
                                  {projects.data.length === 0 && (
              <tr className="jr-dd-empty-row">
                <td colSpan={3}>
                  <div className="jr-dd-empty-content" role="status">
                    <span className="jr-dd-empty-icon" aria-hidden="true"><FolderOpen className="h-6 w-6" /></span>
                    <strong>{filters.search || filters.municipality ? "No matching projects" : "No maintenance projects yet"}</strong>
                    <p>{filters.search || filters.municipality ? "Try changing your search or municipality filters." : "Add a project after road coverage is available."}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="jr-table-footer">
        <span>
          {projects.total > 0
            ? `Showing ${projects.from}–${projects.to} of ${projects.total} projects`
            : "0 projects"}
        </span>
        <nav aria-label="Project pagination" className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous page"
            disabled={busy || projects.current_page <= 1}
            onClick={() => pageUrl(projects.current_page - 1)}
          >
            <ChevronLeft />
          </Button>
          {pages.map((page) => (
            <Button
              key={page}
              variant={page === projects.current_page ? "secondary" : "ghost"}
              size="icon"
              aria-current={page === projects.current_page ? "page" : undefined}
              disabled={busy || !integration.ready}
              onClick={() => pageUrl(page)}
            >
              {page}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next page"
            disabled={busy || projects.current_page >= projects.last_page}
            onClick={() => pageUrl(projects.current_page + 1)}
          >
            <ChevronRight />
          </Button>
        </nav>
      </footer>
    </ProjectWorkspace>
  );
}

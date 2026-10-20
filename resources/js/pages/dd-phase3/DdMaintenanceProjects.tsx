import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { ProjectForm } from '@/components/maintenance-projects/project-form';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { RoadCoverageMap } from '@/components/maintenance-projects/road-coverage-map';
import { Button } from '@/components/ui/button';
import { DdProjectDirectory } from '@/pages/dd-phase3/DdProjectDirectory';
import type {
    CoverageChoice,
    IntegrationStatus,
    ProjectFilters,
    ProjectFormValues,
    ProjectSummary,
    Pagination,
} from '@/types/maintenance-projects';

type Role = 'SuperAdmin' | 'Admin' | 'Engineer' | 'Viewer';
type Coverage = {
    id: number;
    road_name: string;
    lgu_id: number;
    kilometers: number | string;
    pavement_type: 'Concrete' | 'Asphalt' | 'Gravel' | 'Earth';
    geojson: unknown | null;
};
type Lgu = { id: number; municipality_name: string };
type Project = {
    id: number;
    project_title: string;
    description: string | null;
    road_coverage_id: number;
    lgu_id: number;
    created_by: number;
};
type Record = {
    id: number;
    project_id: number;
    quarter: string;
    maintenance_year: number;
    status: string;
};
type Props = {
    role: Role;
    hasAssignment: boolean;
    canManage: boolean;
    roads: Coverage[];
    lgus: Lgu[];
    projects: Project[];
    records: Record[];
};
const integration: IntegrationStatus = { ready: true, message: null };
const HOME = '/dd-phase3/projects';

// Uses the original JaiROADS directory and project form, not a generic DD form.
// Only the URLs and source records change. No legacy business endpoint is called.
export default function DdMaintenanceProjects({
    role,
    hasAssignment,
    canManage,
    roads,
    lgus,
    projects,
    records,
}: Props) {
    const page = usePage();
    const qs = new URLSearchParams(page.url.split('?')[1] ?? '');
    const view = qs.get('view') ?? 'directory';
    const id = Number(qs.get('project') ?? 0);
    const selected = projects.find((p) => p.id === id);
    const canWrite =
        role !== 'Viewer' && (role !== 'Engineer' || hasAssignment);
    const lguNames = new Map(lgus.map((l) => [l.id, l.municipality_name]));
    const coverages: CoverageChoice[] = roads.map((r) => ({
        id: Number(r.id),
        road_name: r.road_name,
        municipality: lguNames.get(Number(r.lgu_id)) ?? null,
        kilometers: String(r.kilometers ?? 0),
        geojson: r.geojson,
        assigned: projects.some(
            (p) => Number(p.road_coverage_id) === Number(r.id),
        ),
    }));
    const countByProject = new Map<number, number>();
    records.forEach((r) =>
        countByProject.set(
            Number(r.project_id),
            (countByProject.get(Number(r.project_id)) ?? 0) + 1,
        ),
    );
    const summaries: ProjectSummary[] = projects.map((p) => {
        const road = coverages.find((c) => c.id === Number(p.road_coverage_id));

        return {
            id: Number(p.id),
            project_title: p.project_title,
            description: p.description ?? null,
            road_coverage_id: Number(p.road_coverage_id),
            road_name: road?.road_name ?? null,
            municipality: lguNames.get(Number(p.lgu_id)) ?? null,
            created_by: `UserAccount #${p.created_by}`,
            created_at: null,
            updated_at: null,
            maintenance_records_count: countByProject.get(Number(p.id)) ?? 0,
            can_edit: canWrite,
            can_delete: canManage,
        };
    });
    const filters: ProjectFilters = {
        search: qs.get('search') ?? '',
        municipality: qs.get('municipality') ?? '',
        sort: qs.get('sort') === 'oldest' ? 'oldest' : 'newest',
    };
    const currentPage = Math.max(1, Number(qs.get('page') || 1) || 1);
    const perPage = 10;
    const filtered = useMemo(
        () =>
            summaries
                .filter(
                    (p) =>
                        (!filters.search ||
                            p.project_title
                                .toLocaleLowerCase()
                                .includes(
                                    filters.search.toLocaleLowerCase(),
                                )) &&
                        (!filters.municipality ||
                            String(
                                projects.find((r) => r.id === p.id)?.lgu_id,
                            ) === String(filters.municipality)),
                )
                .sort((a, b) =>
                    filters.sort === 'oldest' ? a.id - b.id : b.id - a.id,
                ),
        [
            summaries,
            filters.search,
            filters.municipality,
            filters.sort,
            projects,
        ],
    );
    const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
    const pageNum = Math.min(currentPage, lastPage);
    const from = filtered.length ? (pageNum - 1) * perPage + 1 : null;
    const to = filtered.length
        ? Math.min(pageNum * perPage, filtered.length)
        : null;
    const pagination: Pagination = {
        data: filtered.slice((pageNum - 1) * perPage, pageNum * perPage),
        total: filtered.length,
        from,
        to,
        current_page: pageNum,
        last_page: lastPage,
        links: [],
    };
    const navigate = (url: string) =>
        router.visit(url, { preserveScroll: false });
    const cancel = () => navigate(HOME);
    const remove = (rows: ProjectSummary[]) => {
        if (!canManage || rows.length !== 1) {
            return;
        }

        const project = rows[0];

        if (
            !window.confirm(
                `Delete ${project.project_title}? Related records prevent deletion.`,
            )
        ) {
            return;
        }

        router.delete(`/dd-phase3/ops/projects/${project.id}`, {
            preserveScroll: true,
        });
    };
    const title = 'Maintenance Projects';

    if (view === 'create' && canWrite) {
        return (
            <>
                <Head title="Add Project" />
                <DdProjectEditor
                    key="new"
                    coverages={coverages}
                    onCancel={cancel}
                />
            </>
        );
    }

    if (view === 'edit' && selected && canWrite) {
        return (
            <>
                <Head title="Edit Project" />
                <DdProjectEditor
                    key={`edit-${selected.id}`}
                    project={selected}
                    coverages={coverages}
                    coverageLocked={
                        (countByProject.get(Number(selected.id)) ?? 0) > 0
                    }
                    onCancel={() =>
                        navigate(`${HOME}?view=show&project=${selected.id}`)
                    }
                />
            </>
        );
    }

    if (view === 'show' && selected) {
        const summary = summaries.find((p) => p.id === selected.id)!;
        const chosen = coverages.find(
            (c) => c.id === selected.road_coverage_id,
        );
        const maintenance = records.filter((r) => r.project_id === selected.id);

        return (
            <>
                <Head title={selected.project_title} />
                <ProjectWorkspace>
                    <button type="button" className="jr-back" onClick={cancel}>
                        <ArrowLeft className="size-4" /> Maintenance Projects
                    </button>
                    <div className="jr-page-head">
                        <div>
                            <h1>{selected.project_title}</h1>
                            <p>
                                Road maintenance project and quarterly
                                maintenance history
                            </p>
                        </div>
                        {canWrite && (
                            <Button
                                variant="outline"
                                type="button"
                                onClick={() =>
                                    navigate(
                                        `${HOME}?view=edit&project=${selected.id}`,
                                    )
                                }
                            >
                                <Pencil />
                                Edit Project
                            </Button>
                        )}
                    </div>
                    <section className="jr-detail-section">
                        <h2>Project Information</h2>
                        <div className="jr-detail-grid">
                            <div>
                                <dl className="jr-detail-fields">
                                    <div>
                                        <dt>Road Coverage</dt>
                                        <dd>
                                            {summary.road_name ?? 'Not mapped'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Municipality</dt>
                                        <dd>
                                            {summary.municipality ??
                                                'Not available'}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Description</dt>
                                        <dd>
                                            {selected.description ||
                                                'No description provided.'}
                                        </dd>
                                    </div>
                                </dl>
                            </div>
                            <div>
                                {chosen && (
                                    <RoadCoverageMap
                                        coverages={[chosen]}
                                        selectedId={chosen.id}
                                        onSelectCoverage={() => {}}
                                        selectionDisabled
                                    />
                                )}
                            </div>
                        </div>
                    </section>
                    <section className="jr-detail-section">
                        <h2>Maintenance History</h2>
                        <p>
                            {maintenance.length === 0
                                ? 'No maintenance records yet.'
                                : `${maintenance.length} quarterly maintenance record(s)`}
                        </p>
                        <div className="jr-history">
                            {maintenance.map((r) => (
                                <div className="jr-record-row" key={r.id}>
                                    <strong>
                                        {r.maintenance_year} · {r.quarter}
                                    </strong>
                                    <span>{r.status}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                </ProjectWorkspace>
            </>
        );
    }

    return (
        <>
            <Head title={title} />
            <DdProjectDirectory
                key={`${page.url}:${projects.length}`}
                projects={pagination}
                municipalities={lgus}
                filters={filters}
                integration={integration}
                canCreate={canWrite}
                canBulkDelete={false}
                onNavigate={navigate}
                onDelete={remove}
                onFilters={(next) => {
                    const params = new URLSearchParams();

                    if (next.search) {
                        params.set('search', next.search);
                    }

                    if (next.municipality) {
                        params.set('municipality', String(next.municipality));
                    }

                    params.set('sort', next.sort);
                    navigate(`${HOME}?${params.toString()}`);
                }}
            />
        </>
    );
}

function DdProjectEditor({
    project,
    coverages,
    coverageLocked = false,
    onCancel,
}: {
    project?: Project;
    coverages: CoverageChoice[];
    coverageLocked?: boolean;
    onCancel: () => void;
}) {
    const form = useForm<ProjectFormValues>({
        road_coverage_id: project ? String(project.road_coverage_id) : '',
        project_title: project?.project_title ?? '',
        description: project?.description ?? '',
    });
    // Own coverage stays selectable during an edit; all other assignments remain blocked.
    const choices = coverages.map((c) => ({
        ...c,
        assigned:
            project && c.id === Number(project.road_coverage_id)
                ? false
                : c.assigned,
    }));
    const onSave = () => {
        if (project) {
            form.put(`/dd-phase3/ops/projects/${project.id}`, {
                preserveScroll: true,
            });
        } else {
            form.post('/dd-phase3/ops/projects', { preserveScroll: true });
        }
    };

    return (
        <ProjectForm
            mode={project ? 'edit' : 'create'}
            coverageLocked={coverageLocked}
            coverages={choices}
            integration={integration}
            values={form.data}
            errors={form.errors}
            processing={form.processing}
            onChange={(next) => {
                form.clearErrors();
                form.setData(next);
            }}
            onSave={onSave}
            onCancel={onCancel}
        />
    );
}

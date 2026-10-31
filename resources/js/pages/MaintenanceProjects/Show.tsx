import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { MaintenanceHistory } from '@/components/maintenance-projects/maintenance-history';
import {
    ProjectDeletionDialog,
    useProjectDeletion,
} from '@/components/maintenance-projects/project-deletion';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { CoverageMapPreview } from '@/components/road-coverages/coverage-map-preview';
import { Button } from '@/components/ui/button';
import { editUrl } from '@/lib/form-navigation';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { ProjectSummary } from '@/types/maintenance-projects';
import type { MaintenanceRecordSummary } from '@/types/maintenance-records';
import '../../../css/maintenance-project-details.css';

const date = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Unavailable';

export default function Show({
    project,
    records,
    recordCreateUrl,
    expandedYear,
}: {
    project: ProjectSummary;
    records: MaintenanceRecordSummary[];
    recordCreateUrl?: string;
    expandedYear?: number;
}) {
    const deletion = useProjectDeletion();
    const page = usePage();
    const edit = () =>
        router.visit(
            editUrl(
                workspaceHref(`/maintenance-projects/${project.id}/edit`),
                page.url,
            ),
        );

    return (
        <div className="jr-project-details">
            <Head title={project.project_title} />
            <ProjectWorkspace>
                <Link
                    href={workspaceHref('/maintenance-projects')}
                    className="jr-back"
                >
                    <ArrowLeft className="size-4" /> Maintenance Projects
                </Link>
                <div className="jr-page-head jr-details-heading">
                    <div>
                        <h1>{project.project_title}</h1>
                        <p>
                            Road maintenance project and quarterly maintenance
                            history
                        </p>
                    </div>
                    <div className="jr-header-actions">
                        {project.can_edit && (
                            <Button variant="outline" onClick={edit}>
                                <Pencil /> Edit Project
                            </Button>
                        )}
                        {project.can_delete && (
                            <Button
                                className="jr-danger"
                                onClick={() => deletion.open([project])}
                            >
                                <Trash2 /> Delete Project
                            </Button>
                        )}
                    </div>
                </div>
                <section className="jr-detail-section">
                    <div className="jr-detail-grid">
                        <div className="jr-project-information">
                            <h2>Project Information</h2>
                            <dl className="jr-detail-fields">
                                <div>
                                    <dt>Road Coverage</dt>
                                    <dd>
                                        {project.road_name ??
                                            'Coverage not mapped'}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Municipality</dt>
                                    <dd>
                                        {project.municipality ??
                                            'Unavailable until coverage is mapped'}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Description</dt>
                                    <dd className="jr-muted whitespace-pre-wrap">
                                        {project.description ||
                                            'No description provided.'}
                                    </dd>
                                </div>
                            </dl>
                            <dl
                                className="jr-metadata"
                                aria-label="Project metadata"
                            >
                                <div>
                                    <dt>Created By</dt>
                                    <dd>
                                        {project.created_by ?? 'Unavailable'}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Created At</dt>
                                    <dd>{date(project.created_at)}</dd>
                                </div>
                                <div>
                                    <dt>Updated At</dt>
                                    <dd>{date(project.updated_at)}</dd>
                                </div>
                            </dl>
                        </div>
                        <div className="jr-project-map">
                            <h3>Road Coverage Map</h3>
                            <CoverageMapPreview
                                geojson={project.geojson ?? null}
                            />
                        </div>
                    </div>
                </section>
                <MaintenanceHistory
                    records={records}
                    recordCreateUrl={recordCreateUrl}
                    expandedYear={expandedYear}
                />
            </ProjectWorkspace>
            <ProjectDeletionDialog deletion={deletion} />
        </div>
    );
}

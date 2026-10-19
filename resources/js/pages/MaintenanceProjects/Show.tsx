import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ChevronRight,

    MoreHorizontal,
    Pencil,
    Plus,
} from 'lucide-react';
import {
    ProjectDeletionDialog,
    useProjectDeletion,
} from '@/components/maintenance-projects/project-deletion';
import {
    ProjectActions,
    ProjectWorkspace,
} from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import { RoadCoverageMap } from '@/components/maintenance-projects/road-coverage-map';
import type { CoverageChoice, ProjectSummary } from '@/types/maintenance-projects';

type RecordSummary = {
    id: number;
    year: number;
    quarter: string;
    status: string;
};
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
    coveragePreview = null,
    canCreateRecord = false,
}: {
    project: ProjectSummary;
    records: RecordSummary[];
    coveragePreview?: CoverageChoice | null;
    canCreateRecord?: boolean;
}) {
    const years = [...new Set(records.map((record) => record.year))].sort(
        (a, b) => b - a,
    );
    const deletion = useProjectDeletion();
    const edit = () => router.visit(`/maintenance-projects/${project.id}/edit`);

    return (
        <>
            <Head title={project.project_title} />
            <ProjectWorkspace>
                <Link href="/maintenance-projects" className="jr-back">
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
                    <div className="flex items-center gap-2">
                        {project.can_edit && (
                            <Button variant="outline" onClick={edit}>
                                <Pencil /> Edit Project
                            </Button>
                        )}
                        {(project.can_edit || project.can_delete) && (
                            <ProjectActions
                                project={project}
                                onEdit={edit}
                                onDelete={() => deletion.open([project])}
                            />
                        )}
                    </div>
                </div>
                <section className="jr-detail-section">
                    <h2>Project Information</h2>
                    <div className="jr-detail-grid">
                        <div>
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
                        <div className="min-w-0">
                            {coveragePreview ? (
                                <RoadCoverageMap
                                    coverages={[coveragePreview]}
                                    selectedId={coveragePreview.id}
                                    onSelectCoverage={() => undefined}
                                    selectionDisabled
                                />
                            ) : (
                                <div className="jr-map-placeholder jr-detail-map">
                                    <strong>No linked Road Coverage is available</strong>
                                    <span>There is no coverage location to display for this project.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
                <section className="jr-detail-section jr-history-section">
                    <div className="jr-section-title-row">
                        <div>
                            <h2>Maintenance History</h2>
                            <p>Records grouped by year and quarter</p>
                        </div>
                        {canCreateRecord && (
                            <Button className="jr-primary" type="button" onClick={() => router.visit(`/project-documents-preview?project=${project.id}`)}>
                                <Plus /> Add Record
                            </Button>
                        )}
                    </div>
                    {records.length === 0 ? (
                        <div className="jr-history-empty">
                            No maintenance records yet.
                        </div>
                    ) : (
                        <div className="jr-history">
                            {years.map((year) => (
                                <details key={year}>
                                    <summary>
                                        <span className="jr-year-title">
                                            <ChevronRight />
                                            <strong>{year}</strong>
                                        </span>
                                        <small>
                                            {
                                                records.filter(
                                                    (record) =>
                                                        record.year === year,
                                                ).length
                                            }{' '}
                                            records
                                        </small>
                                    </summary>
                                    <div className="jr-year-contents">
                                        {records
                                            .filter(
                                                (record) =>
                                                    record.year === year,
                                            )
                                            .map((record) => (
                                                <div
                                                    key={record.id}
                                                    className="jr-record-row"
                                                >
                                                    <span>
                                                        {record.quarter}
                                                    </span>
                                                    <span
                                                        className="jr-status"
                                                        data-status={
                                                            record.status
                                                        }
                                                    >
                                                        {record.status}
                                                    </span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        type="button"
                                                        className="jr-action-trigger ml-auto"
                                                        aria-label={`${record.quarter} ${year} record actions`}
                                                    >
                                                        <MoreHorizontal />
                                                    </Button>
                                                </div>
                                            ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                    )}
                </section>
            </ProjectWorkspace>
            <ProjectDeletionDialog deletion={deletion} />
        </>
    );
}

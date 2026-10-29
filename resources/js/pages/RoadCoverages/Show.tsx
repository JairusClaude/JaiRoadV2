import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Pencil } from 'lucide-react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { CoverageMapPreview } from '@/components/road-coverages/coverage-map-preview';
import { Button } from '@/components/ui/button';
import { editUrl } from '@/lib/form-navigation';
import type { RoadCoverageDetailsProps } from '@/types/road-coverages';
import '../../../css/road-coverage-directory.css';
import '../../../css/road-coverage-details.css';

const date = (value?: string | null) =>
    value && Number.isFinite(new Date(value).getTime())
        ? new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Unavailable';
const length = (value: string | number | null) =>
    value !== null && value !== '' && Number.isFinite(Number(value))
        ? `${new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} km`
        : 'Unavailable';

export default function Show({
    coverage,
    createdByName,
    associatedProject,
    canEdit,
    backUrl,
}: RoadCoverageDetailsProps) {
    const page = usePage();

    return (
        <div className="jr-road-coverage-details">
            <Head title={coverage.road_name} />
            <ProjectWorkspace>
                <Link href={backUrl} className="jr-back">
                    <ArrowLeft className="size-4" /> Road Coverages
                </Link>
                <div className="jr-page-head jr-details-heading">
                    <div>
                        <h1>{coverage.road_name}</h1>
                        <p>Road information and geographic coverage.</p>
                    </div>
                    <div className="jr-header-actions">
                        {canEdit && (
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.visit(
                                        editUrl(
                                            `/road-coverages/${coverage.id}/edit`,
                                            page.url,
                                        ),
                                    )
                                }
                            >
                                <Pencil /> Edit Road Coverage
                            </Button>
                        )}
                    </div>
                </div>
                <section className="jr-detail-section">
                    <div className="jr-detail-grid">
                        <div>
                            <h2>Road Coverage Information</h2>
                            <dl className="jr-detail-fields">
                                <div>
                                    <dt>Municipality</dt>
                                    <dd>
                                        {coverage.lgu?.municipality_name ??
                                            'Unavailable'}
                                    </dd>
                                </div>
                                <div>
                                    <dt>Pavement Type</dt>
                                    <dd>{coverage.pavement_type}</dd>
                                </div>
                                <div>
                                    <dt>Road Condition</dt>
                                    <dd>
                                        <span
                                            className="jr-coverage-condition"
                                            data-condition={
                                                coverage.state_category
                                            }
                                        >
                                            {coverage.state_category}
                                        </span>
                                    </dd>
                                </div>
                                <div>
                                    <dt>Road Length</dt>
                                    <dd>{length(coverage.kilometers)}</dd>
                                </div>
                            </dl>
                            <dl
                                className="jr-metadata"
                                aria-label="Road coverage metadata"
                            >
                                <div>
                                    <dt>Created By</dt>
                                    <dd>{createdByName ?? 'Unavailable'}</dd>
                                </div>
                                <div>
                                    <dt>Created At</dt>
                                    <dd>{date(coverage.created_at)}</dd>
                                </div>
                                <div>
                                    <dt>Updated At</dt>
                                    <dd>{date(coverage.updated_at)}</dd>
                                </div>
                            </dl>
                        </div>
                        <div className="jr-coverage-map-column">
                            <h3>Road Coverage Map</h3>
                            <CoverageMapPreview
                                key={coverage.id}
                                geojson={coverage.geojson}
                            />
                        </div>
                    </div>
                </section>
                <section
                    className="jr-detail-section jr-associated-project"
                    aria-labelledby="associated-project-heading"
                >
                    <div className="jr-section-title-row">
                        <h2 id="associated-project-heading">
                            Associated Maintenance Project
                        </h2>
                    </div>
                    {associatedProject ? (
                        <div className="jr-year-contents">
                            <div className="jr-record-row">
                                <Link
                                    className="jr-project-title"
                                    href={`/maintenance-projects/${associatedProject.id}`}
                                >
                                    {associatedProject.project_title}
                                </Link>
                                <Button variant="outline" asChild>
                                    <Link
                                        href={`/maintenance-projects/${associatedProject.id}`}
                                    >
                                        View Project
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="jr-history-empty">
                            No associated maintenance project.
                        </div>
                    )}
                </section>
            </ProjectWorkspace>
        </div>
    );
}

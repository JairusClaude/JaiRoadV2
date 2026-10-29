import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import {
    LguDeletionDialog,
    useLguDeletion,
} from '@/components/lgus/lgu-deletion';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import { editUrl } from '@/lib/form-navigation';
import { mayorName } from '@/lib/lgus';
import type { LguDetailProps } from '@/types/lgus';
import '../../../css/lgus.css';

export default function Show({
    lgu,
    roadCoverages,
    assignedEngineers,
    relationshipDataAvailable,
    directoryUrl,
    message,
    lguPermissions,
    lguReviewNotice,
}: LguDetailProps) {
    const page = usePage();
    const enabled = page.props.previewOnly === true;
    const deletion = useLguDeletion(
        [lgu],
        enabled && lguPermissions.can_delete,
    );

    return (
        <div className="jr-lgu-details">
            <Head title={`${lgu.municipality_name} · LGU Details`} />
            <ProjectWorkspace>
                <Link className="jr-back" href={directoryUrl}>
                    <ArrowLeft className="size-4" />
                    LGU Directory
                </Link>
                <div className="jr-page-head jr-details-heading">
                    <div>
                        <h1>{lgu.municipality_name}</h1>
                        <p>
                            Local government unit information and associated
                            records.
                        </p>
                    </div>
                    <div className="jr-lgu-detail-actions">
                        <div className="jr-header-actions">
                            <Button
                                variant="outline"
                                disabled={!enabled || !lguPermissions.can_edit}
                                onClick={() =>
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
                            </Button>
                            {enabled && lguPermissions.can_delete && (
                                <Button
                                    className="jr-danger"
                                    onClick={() => deletion.open(lgu)}
                                >
                                    <Trash2 />
                                    Delete LGU
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
                {lguReviewNotice && (
                    <p role="note" className="jr-field-hint mb-4">
                        {lguReviewNotice}
                    </p>
                )}
                {message && (
                    <p role="status" className="jr-field-hint mb-4">
                        {message}
                    </p>
                )}
                <section
                    className="jr-detail-section jr-lgu-detail-information"
                    aria-labelledby="lgu-information-title"
                >
                    <h2 id="lgu-information-title">LGU Information</h2>
                    <dl className="jr-detail-fields">
                        {[
                            ['Municipality Name', lgu.municipality_name],
                            ['Province', lgu.province],
                            ['Region', lgu.region],
                            ['Municipal Mayor', mayorName(lgu)],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <dt>{label}</dt>
                                <dd>{value}</dd>
                            </div>
                        ))}
                    </dl>
                </section>
                <div className="jr-lgu-related-columns jr-history">
                    <section aria-labelledby="lgu-coverages-title">
                        <div className="jr-section-title-row">
                            <div>
                                <h2 id="lgu-coverages-title">
                                    Associated Road Coverages
                                </h2>
                                <p>
                                    {roadCoverages.length}{' '}
                                    {roadCoverages.length === 1
                                        ? 'road coverage'
                                        : 'road coverages'}
                                </p>
                            </div>
                        </div>
                        {roadCoverages.length ? (
                            <ul
                                className="jr-year-contents"
                                aria-label="Associated road coverages"
                            >
                                {roadCoverages.map((coverage) => (
                                    <li
                                        className="jr-record-row jr-lgu-related-row"
                                        key={coverage.id}
                                        data-lgu-coverage-id={coverage.id}
                                    >
                                        <div>
                                            <strong>
                                                {coverage.road_name}
                                            </strong>
                                            <p className="jr-project-id">
                                                Length:{' '}
                                                {coverage.kilometers == null
                                                    ? 'Unavailable'
                                                    : `${coverage.kilometers} km`}{' '}
                                                · Pavement:{' '}
                                                {coverage.pavement_type ||
                                                    'Unavailable'}{' '}
                                                · Condition:{' '}
                                                {coverage.state_category ||
                                                    'Unavailable'}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="jr-related-empty">
                                <strong>
                                    No associated road coverages available.
                                </strong>
                                <p>
                                    {relationshipDataAvailable.roadCoverages
                                        ? 'Road coverages linked to this LGU will appear here.'
                                        : 'RoadCoverage-to-LGU relationship data is not available in this local preview yet.'}
                                </p>
                            </div>
                        )}
                    </section>
                    <section aria-labelledby="lgu-engineers-title">
                        <div className="jr-section-title-row">
                            <div>
                                <h2 id="lgu-engineers-title">
                                    Assigned Engineers
                                </h2>
                                <p>
                                    {assignedEngineers.length}{' '}
                                    {assignedEngineers.length === 1
                                        ? 'assignment'
                                        : 'assignments'}
                                </p>
                            </div>
                        </div>
                        {assignedEngineers.length ? (
                            <ul
                                className="jr-year-contents"
                                aria-label="Assigned engineers"
                            >
                                {assignedEngineers.map((assignment) => (
                                    <li
                                        className="jr-record-row jr-lgu-related-row"
                                        key={assignment.engineer_id}
                                        data-lgu-engineer-id={
                                            assignment.engineer_id
                                        }
                                    >
                                        <div>
                                            <strong>
                                                {assignment.full_name}
                                            </strong>
                                            <p className="jr-project-id">
                                                Rank:{' '}
                                                {assignment.rank ||
                                                    'Unavailable'}
                                            </p>
                                            <p className="jr-lgu-assignment-status">
                                                LGU assignment:{' '}
                                                {assignment.assignment_is_active ===
                                                true
                                                    ? 'Active'
                                                    : assignment.assignment_is_active ===
                                                        false
                                                      ? 'Inactive'
                                                      : 'Unavailable'}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="jr-related-empty">
                                <strong>
                                    No assigned engineers available.
                                </strong>
                                <p>
                                    {relationshipDataAvailable.engineerAssignments
                                        ? 'Engineers assigned to this LGU will appear here.'
                                        : 'EngineerLGU assignment data is not available in this local preview yet.'}
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </ProjectWorkspace>
            <LguDeletionDialog deletion={deletion} />
        </div>
    );
}

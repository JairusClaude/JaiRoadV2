import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import {
    RecordDeletionDialog,
    useRecordDeletion,
} from '@/components/maintenance-projects/record-deletion';
import { RecordRelatedLists } from '@/components/maintenance-projects/record-related-lists';
import type { RelatedMonthlyUpdate } from '@/components/maintenance-projects/record-related-lists';
import { Button } from '@/components/ui/button';
import { editUrl } from '@/lib/form-navigation';
import { engineerName, validRecordDate } from '@/lib/maintenance-records';
import { workspaceHref } from '@/lib/workspace-navigation';
import DdManagingEngineerReassignment from '@/pages/dd-phase3/DdManagingEngineerReassignment';
import type { DocumentSummary } from '@/types/maintenance-documents';
import type { ProjectSummary } from '@/types/maintenance-projects';
import type { MaintenanceRecordDetail } from '@/types/maintenance-records';

const date = (value?: string | null) =>
    value && validRecordDate(value)
        ? new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeZone: 'UTC',
          }).format(new Date(`${value}T00:00:00Z`))
        : 'Unavailable';
const timestamp = (value: string | null) =>
    value && Number.isFinite(Date.parse(value))
        ? new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeStyle: 'short',
          }).format(new Date(value))
        : 'Unavailable';

export default function ShowRecord({
    project,
    record,
    monthlyUpdateCreateUrl,
    documents = [],
    updates = [],
    canReassign = false,
    managerChoices = [],
}: {
    project: ProjectSummary;
    record: MaintenanceRecordDetail;
    monthlyUpdateCreateUrl?: string;
    documents?: DocumentSummary[];
    updates?: RelatedMonthlyUpdate[];
    canReassign?: boolean;
    managerChoices?: { id: number; first_name: string; last_name: string }[];
}) {
    const page = usePage();
    const deletion = useRecordDeletion();

    return (
        <>
            <Head
                title={`${record.quarter} ${record.year} · Maintenance Record`}
            />
            <ProjectWorkspace>
                <Link
                    href={workspaceHref(
                        `/maintenance-projects/${project.id}?record_year=${record.year}`,
                    )}
                    className="jr-back"
                >
                    <ArrowLeft className="size-4" /> Project Details
                </Link>
                <div className="jr-page-head jr-details-heading">
                    <div>
                        <h1>Maintenance Record Details</h1>
                        <p>
                            {record.quarter} {record.year} · Maintenance Record
                            ID: {record.id}
                        </p>
                    </div>
                    <div className="jr-header-actions">
                        <Button
                            variant="outline"
                            disabled={!record.edit_url}
                            onClick={() => {
                                if (record.edit_url) {
                                    router.visit(
                                        editUrl(record.edit_url, page.url),
                                    );
                                }
                            }}
                        >
                            <Pencil /> Edit Record
                        </Button>
                        <Button
                            className="jr-danger"
                            disabled={!record.delete_url}
                            onClick={() => deletion.open(record)}
                        >
                            <Trash2 /> Delete Record
                        </Button>
                    </div>
                </div>
                {canReassign && (
                    <DdManagingEngineerReassignment
                        record={{
                            id: record.id,
                            managing_engineer_id: record.engineers_id!,
                            maintenance_year: record.year,
                            quarter: record.quarter,
                        }}
                        managers={managerChoices}
                        submitUrl={`/dd-phase3/ui/maintenance-projects/${project.id}/records/${record.id}/reassignment`}
                    />
                )}
                <div className="jr-record-context">
                    <span className="jr-record-context-label">
                        Maintenance Project
                    </span>
                    <Link
                        href={workspaceHref(
                            `/maintenance-projects/${project.id}`,
                        )}
                        className="jr-related-title"
                    >
                        <strong>{project.project_title}</strong>
                    </Link>
                    <p className="jr-field-hint">
                        Project ID: {project.id} ·{' '}
                        {project.municipality ?? 'Municipality unavailable'}
                    </p>
                </div>
                <section className="jr-detail-section jr-record-information">
                    <h2>Record Information</h2>
                    <dl className="jr-detail-fields jr-record-detail-fields">
                        <div>
                            <dt>Maintenance Year</dt>
                            <dd>{record.year}</dd>
                        </div>
                        <div>
                            <dt>Quarter</dt>
                            <dd>{record.quarter}</dd>
                        </div>
                        <div>
                            <dt>Status</dt>
                            <dd>
                                <span
                                    className="jr-status"
                                    data-status={record.status}
                                >
                                    {record.status}
                                </span>
                            </dd>
                        </div>
                        <div>
                            <dt>Managing Engineer</dt>
                            <dd>
                                {record.managing_engineer
                                    ? engineerName(record.managing_engineer)
                                    : 'Unavailable'}
                            </dd>
                        </div>
                        <div>
                            <dt>Start Date</dt>
                            <dd>{date(record.start_date)}</dd>
                        </div>
                        <div>
                            <dt>Estimated Duration</dt>
                            <dd>
                                {record.estimated_duration_days}{' '}
                                {record.estimated_duration_days === 1
                                    ? 'day'
                                    : 'days'}
                            </dd>
                        </div>
                        {record.status === 'Completed' && (
                            <div>
                                <dt>Completion Date</dt>
                                <dd>{date(record.complete_date)}</dd>
                            </div>
                        )}
                    </dl>
                    <dl className="jr-detail-fields jr-record-detail-description">
                        <div>
                            <dt>Description</dt>
                            <dd className="jr-muted whitespace-pre-wrap">
                                {record.description ||
                                    'No description provided.'}
                            </dd>
                        </div>
                    </dl>
                    <dl className="jr-metadata" aria-label="Record metadata">
                        <div>
                            <dt>Created By</dt>
                            <dd>{record.created_by ?? 'Unavailable'}</dd>
                        </div>
                        <div>
                            <dt>Created At</dt>
                            <dd>{timestamp(record.created_at)}</dd>
                        </div>
                        <div>
                            <dt>Updated At</dt>
                            <dd>{timestamp(record.updated_at)}</dd>
                        </div>
                    </dl>
                </section>
                <RecordRelatedLists
                    recordId={record.id}
                    monthlyUpdateCreateUrl={monthlyUpdateCreateUrl}
                    updates={updates}
                    documents={documents}
                />
            </ProjectWorkspace>
            <RecordDeletionDialog deletion={deletion} />
        </>
    );
}

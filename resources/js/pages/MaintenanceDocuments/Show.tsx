import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    Download,
    Eye,
    Pencil,
    Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import {
    DocumentDeletionDialog,
    useDocumentDeletion,
} from '@/components/maintenance-documents/document-deletion';
import { DocumentIcon } from '@/components/maintenance-documents/document-file';
import { DocumentViewer } from '@/components/maintenance-documents/document-viewer';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import { editUrl } from '@/lib/form-navigation';
import { documentType } from '@/lib/maintenance-documents';
import { updateTimestamp } from '@/lib/monthly-updates';
import type { DocumentSummary } from '@/types/maintenance-documents';
export default function Show({ document: doc }: { document: DocumentSummary }) {
    const page = usePage();
    const enabled = page.props.previewOnly === true;
    const deletion = useDocumentDeletion();
    const [viewer, setViewer] = useState(false);
    const viewerFocus = useRef<HTMLElement | null>(null);
    const projectUrl = `/maintenance-projects/${doc.project.id}`;
    const recordUrl = `${projectUrl}/records/${doc.maintenance_id}`;

    return (
        <>
            <Head title={doc.document_title} />
            <ProjectWorkspace>
                <article className="jr-monthly-report">
                    <Link href="/maintenance-documents" className="jr-back">
                        <ArrowLeft className="size-4" />
                        Maintenance Documents
                    </Link>
                    <div className="jr-page-head jr-details-heading">
                        <div>
                            <h1>{doc.document_title}</h1>
                            <p>Document ID: {doc.id}</p>
                        </div>
                        <div className="jr-header-actions">
                            <Button
                                variant="outline"
                                disabled={!enabled}
                                onClick={() =>
                                    router.visit(
                                        editUrl(
                                            `/maintenance-documents/${doc.id}/edit`,
                                            page.url,
                                        ),
                                    )
                                }
                            >
                                <Pencil />
                                Edit Document
                            </Button>
                            <Button
                                className="jr-danger"
                                disabled={!enabled}
                                onClick={() => deletion.open([doc])}
                            >
                                <Trash2 />
                                Delete Document
                            </Button>
                        </div>
                    </div>
                    <section className="jr-report-context">
                        <h2>Maintenance Context</h2>
                        <div className="jr-report-context-columns">
                            <div>
                                <span className="jr-record-context-label">
                                    Maintenance Project
                                </span>
                                <Link
                                    href={projectUrl}
                                    className="jr-report-context-link"
                                >
                                    <strong>{doc.project.project_title}</strong>
                                    <span className="jr-field-hint">
                                        Project ID: {doc.project.id} ·{' '}
                                        {doc.project.municipality}
                                    </span>
                                    <span className="jr-report-context-action">
                                        View Project Details{' '}
                                        <ArrowRight className="size-3.5" />
                                    </span>
                                </Link>
                            </div>
                            <div>
                                <span className="jr-record-context-label">
                                    Maintenance Record
                                </span>
                                <Link
                                    href={recordUrl}
                                    className="jr-report-context-link"
                                >
                                    <strong>
                                        {doc.record.quarter} {doc.record.year}
                                    </strong>
                                    <span className="jr-field-hint">
                                        Maintenance Record ID:{' '}
                                        {doc.maintenance_id}
                                    </span>
                                    <span className="jr-report-context-action">
                                        View Record Details{' '}
                                        <ArrowRight className="size-3.5" />
                                    </span>
                                </Link>
                            </div>
                        </div>
                    </section>
                    <section className="jr-report-section">
                        <h2>Document Information</h2>
                        <p className="jr-report-summary">
                            {doc.description || 'No description provided.'}
                        </p>
                    </section>
                    <section className="jr-report-section">
                        <h2>Document Attachment</h2>
                        <div className="jr-document-file-row mt-3">
                            <DocumentIcon name={doc.file_name} />
                            <div className="min-w-0 flex-1">
                                <strong
                                    className="block truncate"
                                    title={doc.file_name}
                                >
                                    {doc.file_name}
                                </strong>
                                <p className="jr-field-hint">
                                    {documentType(doc.file_name)}
                                </p>
                            </div>
                            <div className="jr-document-file-actions">
                                <Button
                                    variant="outline"
                                    disabled={!doc.available}
                                    onClick={() => {
                                        viewerFocus.current = window.document
                                            .activeElement as HTMLElement;
                                        setViewer(true);
                                    }}
                                >
                                    <Eye />
                                    View
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={!doc.available}
                                    asChild
                                >
                                    <a
                                        href={
                                            doc.available
                                                ? `/preview-documents/${doc.id}?download`
                                                : undefined
                                        }
                                        download={doc.file_name}
                                        aria-disabled={!doc.available}
                                    >
                                        <Download />
                                        Download
                                    </a>
                                </Button>
                            </div>
                        </div>
                        {!doc.available && (
                            <p className="jr-field-error" role="status">
                                This file is unavailable in the current preview
                                session.
                            </p>
                        )}
                    </section>
                    <footer className="jr-report-footer">
                        <dl className="jr-metadata">
                            <div>
                                <dt>Uploaded By</dt>
                                <dd>{doc.uploaded_by}</dd>
                            </div>
                            <div>
                                <dt>Date Uploaded</dt>
                                <dd>{updateTimestamp(doc.uploaded_at)}</dd>
                            </div>
                            <div>
                                <dt>Last Updated</dt>
                                <dd>{updateTimestamp(doc.updated_at)}</dd>
                            </div>
                        </dl>
                    </footer>
                </article>
            </ProjectWorkspace>
            <DocumentViewer
                key={String(viewer)}
                document={doc}
                open={viewer}
                returnFocus={viewerFocus}
                onOpenChange={setViewer}
            />
            <DocumentDeletionDialog deletion={deletion} />
        </>
    );
}

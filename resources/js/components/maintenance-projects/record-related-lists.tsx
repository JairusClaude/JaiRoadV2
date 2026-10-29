import { Link, router, usePage } from '@inertiajs/react';
import {
    CalendarDays,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
    Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
    DocumentDeletionDialog,
    useDocumentDeletion,
} from '@/components/maintenance-documents/document-deletion';
import { DocumentIcon } from '@/components/maintenance-documents/document-file';
import { MonthlyProgress } from '@/components/monthly-updates/monthly-progress';
import {
    MonthlyDeletionDialog,
    useMonthlyDeletion,
} from '@/components/monthly-updates/monthly-update-deletion';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { editUrl } from '@/lib/form-navigation';
import { documentDate } from '@/lib/maintenance-documents';
import { updateMonth } from '@/lib/monthly-updates';
import type { DocumentSummary } from '@/types/maintenance-documents';
import type { MonthlyUpdateSummary } from '@/types/monthly-updates';
import '../../../css/maintenance-record-related.css';

export type RelatedMonthlyUpdate = MonthlyUpdateSummary & {
    photo_count: number;
    video_count: number;
    other_count: number;
};
function RelatedActions({
    label,
    enabled,
    onEdit,
    onDelete,
}: {
    label: string;
    enabled: boolean;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="jr-action-trigger"
                        aria-label={`${label} actions`}
                    >
                        <MoreHorizontal />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="jr-theme jr-menu" align="end">
                    <DropdownMenuItem disabled={!enabled} onSelect={onEdit}>
                        <Pencil />
                        Edit{' '}
                        {label.startsWith('Monthly')
                            ? 'Monthly Update'
                            : 'Maintenance Document'}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!enabled} onSelect={onDelete}>
                        <Trash2 />
                        Delete{' '}
                        {label.startsWith('Monthly')
                            ? 'Monthly Update'
                            : 'Maintenance Document'}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
function RelatedList({
    children,
    label,
}: {
    children: ReactNode;
    label: string;
}) {
    return (
        <ul className="jr-year-contents jr-related-list" aria-label={label}>
            {children}
        </ul>
    );
}
const mediaCount = (update: RelatedMonthlyUpdate) =>
    [
        `${update.photo_count} ${update.photo_count === 1 ? 'photo' : 'photos'}`,
        `${update.video_count} ${update.video_count === 1 ? 'video' : 'videos'}`,
        ...(update.other_count
            ? [
                  `${update.other_count} unclassified ${update.other_count === 1 ? 'file' : 'files'}`,
              ]
            : []),
    ].join(' · ');
export function RecordRelatedLists({
    recordId,
    monthlyUpdateCreateUrl,
    updates,
    documents,
}: {
    recordId: number;
    monthlyUpdateCreateUrl?: string;
    updates: RelatedMonthlyUpdate[];
    documents: DocumentSummary[];
}) {
    const page = usePage();
    const enabled = page.props.previewOnly === true;
    const monthlyDeletion = useMonthlyDeletion(`record=${recordId}`);
    const documentDeletion = useDocumentDeletion(recordId);
    const orderedUpdates = [...updates].sort(
        (a, b) => b.update_month.localeCompare(a.update_month) || b.id - a.id,
    );
    const orderedDocuments = [...documents].sort(
        (a, b) => b.uploaded_at.localeCompare(a.uploaded_at) || b.id - a.id,
    );

    return (
        <>
            <div className="jr-record-related-columns jr-history">
                <section aria-labelledby="monthly-updates-title">
                    <div className="jr-section-title-row">
                        <div>
                            <h2 id="monthly-updates-title">Monthly Updates</h2>
                            <p>
                                {updates.length}{' '}
                                {updates.length === 1 ? 'update' : 'updates'}{' '}
                                for this record
                            </p>
                        </div>
                        <Button
                            className="jr-primary"
                            disabled={!monthlyUpdateCreateUrl}
                            onClick={() =>
                                monthlyUpdateCreateUrl &&
                                router.visit(monthlyUpdateCreateUrl)
                            }
                        >
                            <Plus />
                            Add Monthly Update
                        </Button>
                    </div>
                    {updates.length ? (
                        <RelatedList label="Monthly updates for this record">
                            {orderedUpdates.map((update) => (
                                <li
                                    key={update.id}
                                    data-related-update-id={update.id}
                                    className="jr-record-row jr-related-row jr-related-monthly-row"
                                    data-clickable="true"
                                    onClick={() =>
                                        router.visit(
                                            `/monthly-updates/${update.id}?record=${recordId}`,
                                        )
                                    }
                                >
                                    <CalendarDays
                                        className="size-5 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <div className="jr-related-row-copy">
                                        <Link
                                            href={`/monthly-updates/${update.id}?record=${recordId}`}
                                            className="jr-related-row-title"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {updateMonth(update.update_month)}
                                        </Link>
                                        <span className="jr-project-id">
                                            {mediaCount(update)}
                                        </span>
                                    </div>
                                    <div className="jr-related-monthly-progress">
                                        <MonthlyProgress
                                            value={update.progress_percentage}
                                            label={`Progress for ${updateMonth(update.update_month)}`}
                                        />
                                    </div>
                                    <RelatedActions
                                        label={`Monthly Update ${update.id}`}
                                        enabled={enabled}
                                        onEdit={() =>
                                            router.visit(
                                                editUrl(
                                                    `/monthly-updates/${update.id}/edit`,
                                                    page.url,
                                                ),
                                            )
                                        }
                                        onDelete={() =>
                                            monthlyDeletion.open([update])
                                        }
                                    />
                                </li>
                            ))}
                        </RelatedList>
                    ) : (
                        <div className="jr-related-empty">
                            <strong>No monthly updates yet.</strong>
                            <p>
                                Updates and their media evidence will appear
                                here for this record.
                            </p>
                        </div>
                    )}
                </section>
                <section aria-labelledby="maintenance-documents-title">
                    <div className="jr-section-title-row">
                        <div>
                            <h2 id="maintenance-documents-title">
                                Maintenance Documents
                            </h2>
                            <p>
                                {documents.length}{' '}
                                {documents.length === 1
                                    ? 'document'
                                    : 'documents'}{' '}
                                for this record
                            </p>
                        </div>
                        <Button
                            className="jr-primary"
                            disabled={!enabled}
                            onClick={() =>
                                router.visit(
                                    `/maintenance-documents/create?record=${recordId}`,
                                )
                            }
                        >
                            <Upload />
                            Upload Document
                        </Button>
                    </div>
                    {documents.length ? (
                        <RelatedList label="Maintenance documents for this record">
                            {orderedDocuments.map((doc) => (
                                <li
                                    key={doc.id}
                                    data-related-document-id={doc.id}
                                    className="jr-record-row jr-related-row jr-related-document-row"
                                    data-clickable="true"
                                    onClick={() =>
                                        router.visit(
                                            `/maintenance-documents/${doc.id}`,
                                        )
                                    }
                                >
                                    <DocumentIcon name={doc.file_name} />
                                    <div className="jr-related-row-copy">
                                        <Link
                                            className="jr-related-row-title"
                                            href={`/maintenance-documents/${doc.id}`}
                                            title={doc.document_title}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {doc.document_title}
                                        </Link>
                                        <span
                                            className="jr-project-id"
                                            title={doc.file_name}
                                        >
                                            {doc.file_name}
                                        </span>
                                        <time
                                            className="jr-project-id"
                                            dateTime={doc.uploaded_at}
                                        >
                                            Uploaded{' '}
                                            {documentDate(doc.uploaded_at)}
                                        </time>
                                    </div>
                                    <RelatedActions
                                        label={`Maintenance Document ${doc.id}`}
                                        enabled={enabled}
                                        onEdit={() =>
                                            router.visit(
                                                editUrl(
                                                    `/maintenance-documents/${doc.id}/edit`,
                                                    page.url,
                                                ),
                                            )
                                        }
                                        onDelete={() =>
                                            documentDeletion.open([doc])
                                        }
                                    />
                                </li>
                            ))}
                        </RelatedList>
                    ) : (
                        <div className="jr-related-empty">
                            <strong>No maintenance documents yet.</strong>
                            <p>
                                Documents uploaded for this record will appear
                                here.
                            </p>
                        </div>
                    )}
                </section>
            </div>
            <MonthlyDeletionDialog deletion={monthlyDeletion} />
            <DocumentDeletionDialog deletion={documentDeletion} />
        </>
    );
}

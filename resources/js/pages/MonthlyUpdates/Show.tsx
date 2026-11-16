import '../../../css/maintenance-projects.css';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Pencil, Trash2, UploadCloud } from 'lucide-react';
import { useRef } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { MediaGallery } from '@/components/monthly-updates/media-gallery';
import { MonthlyProgress } from '@/components/monthly-updates/monthly-progress';
import {
    MonthlyDeletionDialog,
    useMonthlyDeletion,
} from '@/components/monthly-updates/monthly-update-deletion';
import { Button } from '@/components/ui/button';
import { editUrl } from '@/lib/form-navigation';
import { updateMonth, updateTimestamp } from '@/lib/monthly-updates';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { MonthlyDetailProps } from '@/types/monthly-updates';

export default function Show({
    update,
    media,
    backUrl,
    backLabel,
    directoryUrl,
    canUploadMedia = false,
}: MonthlyDetailProps) {
    const page = usePage();
    const preview =
        page.props.previewOnly === true ||
        (page.props.canonicalFrontend === true && page.props.canWrite === true);
    const canEdit = update.can_edit ?? preview;
    const deletion = useMonthlyDeletion(directoryUrl.split('?')[1] ?? '');
    const mediaInput = useRef<HTMLInputElement>(null);
    const mediaForm = useForm<{ monthly_update_id: number; file: File | null }>({
        monthly_update_id: update.id,
        file: null,
    });
    const photos = media.filter((file) =>
        file.mime_type?.startsWith('image/'),
    ).length;
    const videos = media.filter((file) =>
        file.mime_type?.startsWith('video/'),
    ).length;
    const unclassified = media.length - photos - videos;
    const mediaBreakdown = `${photos} ${photos === 1 ? 'photo' : 'photos'} · ${videos} ${videos === 1 ? 'video' : 'videos'}${unclassified ? ` · ${unclassified} unclassified` : ''}`;

    return (
        <>
            <Head
                title={`Monthly Update — ${updateMonth(update.update_month)}`}
            />
            <ProjectWorkspace>
                <article
                    className="jr-monthly-report"
                    aria-labelledby="monthly-report-title"
                >
                    <Link href={backUrl} className="jr-back">
                        <ArrowLeft className="size-4" /> {backLabel}
                    </Link>
                    <div className="jr-page-head jr-details-heading">
                        <div>
                            <h1 id="monthly-report-title">
                                Monthly Update —{' '}
                                {updateMonth(update.update_month)}
                            </h1>
                            <p>Update ID: {update.id}</p>
                        </div>
                        <div className="jr-header-actions">
                            <Button
                                variant="outline"
                                disabled={!canEdit}
                                onClick={() =>
                                    router.visit(
                                        editUrl(
                                            workspaceHref(
                                                `/monthly-updates/${update.id}/edit`,
                                            ),
                                            page.url,
                                        ),
                                    )
                                }
                            >
                                <Pencil /> Edit Update
                            </Button>
                            <Button
                                className="jr-danger"
                                disabled={!preview}
                                onClick={() => deletion.open([update])}
                            >
                                <Trash2 /> Delete Update
                            </Button>
                        </div>
                    </div>
                    <section
                        className="jr-report-context"
                        aria-labelledby="monthly-context-title"
                    >
                        <h2 id="monthly-context-title">Maintenance Context</h2>
                        <div className="jr-report-context-columns">
                            <div>
                                <span className="jr-record-context-label">
                                    Maintenance Project
                                </span>
                                <Link
                                    href={workspaceHref(
                                        `/maintenance-projects/${update.project.id}`,
                                    )}
                                    className="jr-report-context-link"
                                >
                                    <strong>
                                         {update.project.project_title}
                                    </strong>
                                    <span className="jr-field-hint">
                                        Project ID: {update.project.id}
                                    </span>
                                    <span className="jr-report-context-action">
                                        View Project Details{' '}
                                        <ArrowRight
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </span>
                                </Link>
                            </div>
                            <div>
                                <span className="jr-record-context-label">
                                    Maintenance Record
                                </span>
                                <Link
                                    href={workspaceHref(
                                        `/maintenance-projects/${update.project.id}/records/${update.maintenance_id}`,
                                    )}
                                    className="jr-report-context-link"
                                >
                                    <strong>
                                        {update.record.quarter}{' '}
                                        {update.record.year}
                                    </strong>
                                    <span className="jr-field-hint">
                                        Maintenance Record ID:{' '}
                                        {update.maintenance_id}
                                    </span>
                                    <span className="jr-report-context-action">
                                        View Record Details{' '}
                                        <ArrowRight
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </span>
                                </Link>
                            </div>
                        </div>
                    </section>
                    <dl
                        className="jr-report-overview"
                        aria-label="Report overview"
                    >
                        <div>
                            <dt>Reported Progress</dt>
                            <dd>
                                <MonthlyProgress
                                    value={update.progress_percentage}
                                />
                            </dd>
                        </div>
                        <div>
                            <dt>Attachments</dt>
                            <dd>
                                <strong className="jr-report-total">
                                    {media.length}{' '}
                                    {media.length === 1 ? 'file' : 'files'}
                                </strong>
                                <p className="jr-field-hint">
                                    {mediaBreakdown}
                                </p>
                            </dd>
                        </div>
                    </dl>
                    <section
                        className="jr-report-section"
                        aria-labelledby="monthly-summary-title"
                    >
                        <h2 id="monthly-summary-title">Progress Summary</h2>
                        <p className="jr-report-summary">
                            {update.summary_of_text_reports ||
                                'No progress summary provided.'}
                        </p>
                    </section>
                    <section
                        className="jr-report-section"
                        aria-labelledby="monthly-media-title"
                    >
                        <div className="jr-report-media-heading">
                            <h2 id="monthly-media-title">
                                Media Documentation
                            </h2>
                            <p className="jr-field-hint">{mediaBreakdown}</p>
                        </div>
                        {canUploadMedia && (
                            <form
                                className="jr-monthly-upload"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (!mediaForm.data.file || mediaForm.processing) return;
                                    mediaForm.clearErrors();
                                    mediaForm.post('/dd-phase3/ops/media', {
                                        forceFormData: true,
                                        preserveScroll: true,
                                        onSuccess: () => {
                                            mediaForm.reset('file');
                                            if (mediaInput.current) mediaInput.current.value = '';
                                        },
                                    });
                                }}
                            >
                                <label htmlFor="monthly-media-file">Add photos or videos</label>
                                <div className="jr-monthly-upload-controls">
                                    <input
                                        ref={mediaInput}
                                        id="monthly-media-file"
                                        name="file"
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                                        disabled={mediaForm.processing}
                                        onChange={(event) => mediaForm.setData('file', event.target.files?.[0] ?? null)}
                                    />
                                    <Button type="submit" disabled={!mediaForm.data.file || mediaForm.processing}>
                                        <UploadCloud className="size-4" />
                                        {mediaForm.processing ? 'Uploading…' : 'Upload media'}
                                    </Button>
                                </div>
                                <p className="jr-field-hint">JPEG, PNG, WebP, MP4, or WebM · Maximum 20 MB per file. Files are stored privately.</p>
                                {mediaForm.progress && (
                                    <p className="jr-field-hint" role="status">Uploading {mediaForm.progress.percentage}%</p>
                                )}
                                {mediaForm.errors.file && <p className="jr-field-error" role="alert">{mediaForm.errors.file}</p>}
                            </form>
                        )}
                        <MediaGallery key={update.id} media={media} />
                    </section>
                    <footer className="jr-report-footer">
                        <dl
                            className="jr-metadata"
                            aria-label="Update metadata"
                        >
                            <div>
                                <dt>Created By</dt>
                                <dd>{update.created_by || 'Unavailable'}</dd>
                            </div>
                            <div>
                                <dt>Created At</dt>
                                <dd>{updateTimestamp(update.created_at)}</dd>
                            </div>
                            <div>
                                <dt>Last Updated</dt>
                                <dd>{updateTimestamp(update.updated_at)}</dd>
                            </div>
                        </dl>
                    </footer>
                </article>
            </ProjectWorkspace>
            <MonthlyDeletionDialog deletion={deletion} />
        </>
    );
}

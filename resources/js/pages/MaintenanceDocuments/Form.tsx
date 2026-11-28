import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { DocumentAttachment } from '@/components/maintenance-documents/document-file';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { ProjectSelector } from '@/components/monthly-updates/project-selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { editUrl, formReturn } from '@/lib/form-navigation';
import { documentFileError } from '@/lib/maintenance-documents';
import { validRecordChoices } from '@/lib/project-choice-page';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { DocumentParents } from '@/types/maintenance-documents';
import type {
    MonthlyParentProject,
    MonthlyParentRecord,
} from '@/types/monthly-updates';

type RecordChoices = {
    project: MonthlyParentProject;
    records: MonthlyParentRecord[];
    recordPage: number;
    recordHasMore: boolean;
};

type Values = {
    project_id: string;
    maintenance_id: string;
    document_title: string;
    description: string;
    attachment: File | null;
    remove_attachment: boolean;
};
export default function Form(parents: DocumentParents) {
    const page = usePage();
    const enabled =
        page.props.previewOnly === true ||
        (page.props.canonicalFrontend === true && page.props.canWrite === true);
    const doc = parents.document;
    const [savedRemovalPending, setSavedRemovalPending] = useState(false);
    const [confirmRemoval, setConfirmRemoval] = useState(false);
    const fixed = parents.records.find((r) => r.id === parents.contextRecordId);
    const back = formReturn(page.url, parents.cancelUrl, [
        workspaceHref('/maintenance-documents'),
        ...(doc
            ? [
                  workspaceHref(
                      `/maintenance-projects/${doc.project.id}/records/${doc.maintenance_id}`,
                  ),
              ]
            : []),
    ]);
    const form = useForm<Values>({
        project_id: fixed ? String(fixed.project_id) : '',
        maintenance_id: fixed ? String(fixed.id) : '',
        document_title: doc?.document_title ?? '',
        description: doc?.description ?? '',
        attachment: null,
        remove_attachment: false,
    });
    const lock = useRef(false);
    const { formChoicesUrl } = parents;
    const projectId = form.data.project_id;
    const [recordPage, setRecordPage] = useState(1);
    const [attempt, retryChoices] = useState(0);
    const [choices, setChoices] = useState<{
        key: string;
        data?: RecordChoices;
    } | null>(null);
    const choiceKey = JSON.stringify([projectId, recordPage, attempt]);
    const current = choices?.key === choiceKey ? choices : null;
    const loading = Boolean(formChoicesUrl && projectId && !current);
    const currentPage = current?.data?.recordPage ?? 1;
    const hasMore = current?.data?.recordHasMore ?? false;
    const failed = Boolean(
        formChoicesUrl && projectId && current && !current.data,
    );

    useEffect(() => {
        if (!formChoicesUrl || !projectId) {
            return;
        }

        const controller = new AbortController();
        const params = new URLSearchParams({
            project: projectId,
            record_page: String(recordPage),
        });
        void fetch(`${formChoicesUrl}?${params}`, {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(12_000),
            ]),
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error('Record choices unavailable');
                }

                const data: RecordChoices = await response.json();

                if (!validRecordChoices(data, projectId)) {
                    throw new Error('Invalid record choices');
                }

                if (!controller.signal.aborted) {
                    setChoices({ key: choiceKey, data });
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setChoices({ key: choiceKey });
                }
            });

        return () => controller.abort();
    }, [choiceKey, formChoicesUrl, projectId, recordPage]);

    const project =
        current?.data?.project ??
        parents.projects.find((p) => String(p.id) === projectId);
    const records = formChoicesUrl
        ? (current?.data?.records ?? [])
        : parents.records;
    const record = records.find(
        (r) => String(r.id) === form.data.maintenance_id,
    );
    const options = records
        .filter((r) => r.project_id === project?.id)
        .sort((a, b) => b.year - a.year || b.quarter.localeCompare(a.quarter));
    const title = doc ? 'Edit Maintenance Document' : 'Upload Document';
    const disabled = !enabled || form.processing;
    const change = (
        key: 'document_title' | 'description' | 'maintenance_id',
        value: string,
    ) => {
        form.clearErrors(key);
        form.setData(key, value);
    };
    const error = (key: keyof Values) =>
        form.errors[key] && (
            <p id={`${key}-error`} className="jr-field-error" role="alert">
                {form.errors[key]}
            </p>
        );
    const attrs = (key: keyof Values) => ({
        id: key,
        'aria-invalid': !!form.errors[key],
        'aria-describedby': form.errors[key] ? `${key}-error` : undefined,
    });
    const cancel = () => router.visit(back);
    const save = (confirmed = false) => {
        if (disabled || lock.current || loading || failed) {
            return;
        }

        form.clearErrors();
        const errors: Partial<Record<keyof Values, string>> = {};

        if (!project) {
            errors.project_id = 'Select a Maintenance Project.';
        }

        if (!record || record.project_id !== project?.id) {
            errors.maintenance_id =
                'Select a Maintenance Record for this project.';
        }

        if (
            !form.data.document_title.trim() ||
            form.data.document_title.trim().length > 255
        ) {
            errors.document_title =
                'Enter a document title of 255 characters or fewer.';
        }

        if (!doc && !form.data.attachment) {
            errors.attachment = 'Select one document file.';
        }

        if (form.data.attachment) {
            const problem = documentFileError(form.data.attachment);

            if (problem) {
                errors.attachment = problem;
            }
        }

        if (Object.keys(errors).length) {
            form.setError(errors);
            document.getElementById(Object.keys(errors)[0])?.focus();

            return;
        }

        if (savedRemovalPending && !confirmed) {
            setConfirmRemoval(true);

            return;
        }

        form.transform((data) => ({
            ...data,
            remove_attachment: savedRemovalPending,
        }));
        lock.current = true;
        form.submit(
            doc ? 'put' : 'post',
            doc ? editUrl(parents.submitUrl, back) : parents.submitUrl,
            {
                forceFormData: !doc || page.props.canonicalFrontend !== true,
                preserveScroll: true,
                onSuccess: () => setConfirmRemoval(false),
                onFinish: () => {
                    lock.current = false;
                },
            },
        );
    };

    return (
        <>
            <Head title={title} />
            <ProjectWorkspace>
                <div className="jr-record-screen jr-document-form">
                    <button
                        className="jr-back"
                        type="button"
                        disabled={form.processing}
                        onClick={cancel}
                    >
                        <ArrowLeft className="size-4" />
                        {back.startsWith(
                            workspaceHref('/maintenance-documents/'),
                        )
                            ? 'Document Details'
                            : back.startsWith(
                                    workspaceHref('/maintenance-projects/'),
                                )
                              ? 'Record Details'
                              : 'Maintenance Documents'}
                    </button>
                    <div className="jr-page-head">
                        <div>
                            <h1>{title}</h1>
                            <p>
                                Attach supporting documents to a maintenance
                                record.
                            </p>
                        </div>
                    </div>
                    <form
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault();
                            save();
                        }}
                    >
                        <section>
                            <h2>Maintenance Information</h2>
                            <p className="jr-field-hint">
                                {fixed
                                    ? 'This document will be associated with the maintenance record below.'
                                    : 'Select the maintenance record for this document.'}
                            </p>
                            {fixed ? (
                                <div className="jr-record-fields jr-monthly-fixed">
                                    <div>
                                        <span className="jr-record-context-label">
                                            Maintenance Project
                                        </span>
                                        <strong>
                                            {project?.project_title}
                                        </strong>
                                        <p className="jr-field-hint">
                                            Project ID: {project?.id} ·{' '}
                                            {project?.municipality}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="jr-record-context-label">
                                            Maintenance Record
                                        </span>
                                        <strong>
                                            {fixed.quarter} {fixed.year}
                                        </strong>
                                        <p className="jr-field-hint">
                                            Maintenance Record ID: {fixed.id}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="jr-record-fields">
                                    <div className="jr-record-field">
                                        <Label htmlFor="project_id">
                                            Maintenance Project{' '}
                                            <span className="jr-required">
                                                *
                                            </span>
                                        </Label>
                                        <ProjectSelector
                                            projects={
                                                formChoicesUrl && project
                                                    ? [project]
                                                    : parents.projects
                                            }
                                            choicesUrl={formChoicesUrl}
                                            value={form.data.project_id}
                                            disabled={disabled}
                                            invalid={!!form.errors.project_id}
                                            onChange={(value) => {
                                                setRecordPage(1);
                                                retryChoices(
                                                    (previous) => previous + 1,
                                                );
                                                form.clearErrors(
                                                    'project_id',
                                                    'maintenance_id',
                                                );
                                                form.setData({
                                                    ...form.data,
                                                    project_id: value,
                                                    maintenance_id: '',
                                                });
                                            }}
                                        />
                                        {error('project_id')}
                                    </div>
                                    <div className="jr-record-field">
                                        <Label htmlFor="maintenance_id">
                                            Maintenance Record{' '}
                                            <span className="jr-required">
                                                *
                                            </span>
                                        </Label>
                                        <Select
                                            value={form.data.maintenance_id}
                                            disabled={
                                                disabled ||
                                                loading ||
                                                failed ||
                                                !project ||
                                                !options.length
                                            }
                                            onValueChange={(value) =>
                                                change('maintenance_id', value)
                                            }
                                        >
                                            <SelectTrigger
                                                {...attrs('maintenance_id')}
                                                className="jr-record-select"
                                                aria-required="true"
                                            >
                                                <SelectValue
                                                    placeholder={
                                                        loading
                                                            ? 'Loading records…'
                                                            : !project
                                                              ? 'Select a project first'
                                                              : options.length
                                                                ? 'Select record'
                                                                : 'No maintenance records'
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent
                                                className="jr-theme jr-menu"
                                                position="popper"
                                            >
                                                {options.map((r) => (
                                                    <SelectItem
                                                        key={r.id}
                                                        value={String(r.id)}
                                                    >
                                                        {r.quarter} {r.year}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {error('maintenance_id')}
                                        {loading && (
                                            <p
                                                role="status"
                                                className="jr-field-hint"
                                            >
                                                Loading eligible maintenance
                                                records…
                                            </p>
                                        )}
                                        {failed && (
                                            <p
                                                role="alert"
                                                className="jr-field-error"
                                            >
                                                Record choices unavailable.{' '}
                                                <button
                                                    type="button"
                                                    className="underline"
                                                    onClick={() =>
                                                        retryChoices(
                                                            (previous) =>
                                                                previous + 1,
                                                        )
                                                    }
                                                >
                                                    Retry
                                                </button>
                                            </p>
                                        )}
                                        {current?.data && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={
                                                        disabled ||
                                                        currentPage <= 1
                                                    }
                                                    onClick={() => {
                                                        change(
                                                            'maintenance_id',
                                                            '',
                                                        );
                                                        setRecordPage(
                                                            currentPage - 1,
                                                        );
                                                    }}
                                                >
                                                    Previous records
                                                </Button>
                                                <span className="text-sm">
                                                    Page {currentPage}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={
                                                        disabled || !hasMore
                                                    }
                                                    onClick={() => {
                                                        change(
                                                            'maintenance_id',
                                                            '',
                                                        );
                                                        setRecordPage(
                                                            currentPage + 1,
                                                        );
                                                    }}
                                                >
                                                    Next records
                                                </Button>
                                            </div>
                                        )}
                                        {project &&
                                            !loading &&
                                            !failed &&
                                            !options.length && (
                                                <p className="jr-field-hint">
                                                    Add a Maintenance Record
                                                    from Project Details first.
                                                </p>
                                            )}
                                    </div>
                                </div>
                            )}
                            {fixed && error('maintenance_id')}
                        </section>
                        <section className="jr-record-schedule">
                            <h2>Document Information</h2>
                            <div className="jr-record-field mt-4">
                                <Label htmlFor="document_title">
                                    Document Title{' '}
                                    <span className="jr-required">*</span>
                                </Label>
                                <Input
                                    {...attrs('document_title')}
                                    required
                                    maxLength={255}
                                    placeholder="Enter document title"
                                    value={form.data.document_title}
                                    disabled={disabled}
                                    onChange={(e) =>
                                        change('document_title', e.target.value)
                                    }
                                />
                                {error('document_title')}
                            </div>
                            <div className="jr-record-description">
                                <Label htmlFor="description">
                                    Description{' '}
                                    <span className="jr-muted">(optional)</span>
                                </Label>
                                <textarea
                                    id="description"
                                    className="jr-textarea"
                                    rows={3}
                                    placeholder="Enter a brief description of the document..."
                                    disabled={disabled}
                                    value={form.data.description}
                                    onChange={(e) =>
                                        change('description', e.target.value)
                                    }
                                />
                            </div>
                        </section>
                        <section className="jr-record-schedule">
                            <h2>Document Attachment</h2>
                            <p className="jr-field-hint mb-4">
                                {doc
                                    ? page.props.offlineSnapshot === true
                                        ? 'Edit document details offline. The existing private file is retained; removal requires an online session.'
                                        : 'Remove the attachment with X, then save. The document title and information remain; Cancel keeps the file.'
                                    : 'Upload one supporting document.'}
                            </p>
                            <DocumentAttachment
                                file={form.data.attachment}
                                savedName={doc?.file_name}
                                disabled={
                                    disabled ||
                                    (page.props.canonicalFrontend === true &&
                                        !!doc)
                                }
                                error={
                                    form.errors.attachment ||
                                    (form.errors as Record<string, string>).file
                                }
                                onChange={(file) => {
                                    form.clearErrors('attachment');
                                    form.setData('attachment', file);
                                }}
                                savedRemovalPending={savedRemovalPending}
                                onRemoveSaved={
                                    doc?.file_name && doc.delete_url
                                        ? () => setSavedRemovalPending(true)
                                        : undefined
                                }
                            />
                        </section>
                        <footer className="jr-form-footer">
                            <p>
                                {page.props.offlineSnapshot === true
                                    ? 'Changes are saved locally and synchronized when connected.'
                                    : page.props.canonicalFrontend === true
                                      ? 'Files remain private. X stages removal; Save Changes confirms permanent deletion. Cancel retains the file.'
                                      : 'Local preview only · files and changes reset on restart.'}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={form.processing}
                                    onClick={cancel}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    className="jr-primary"
                                    disabled={disabled || loading || failed}
                                >
                                    {form.processing
                                        ? 'Saving…'
                                        : doc
                                          ? 'Save Changes'
                                          : 'Upload Document'}
                                </Button>
                            </div>
                        </footer>
                    </form>
                </div>
                <DeletionDialog
                    open={confirmRemoval}
                    title="Remove attachment permanently?"
                    description="Save the changes and permanently remove the selected private Storage file. The document title and information will be retained."
                    selectionLabel="Selected attachment"
                    processing={form.processing}
                    error={Object.values(form.errors).join(' ')}
                    confirmLabel="Save and Remove"
                    busyLabel="Saving…"
                    onClose={() => {
                        if (!form.processing) {
                            setConfirmRemoval(false);
                        }
                    }}
                    onConfirm={() => save(true)}
                >
                    <p className="jr-delete-target-title">{doc?.file_name}</p>
                </DeletionDialog>
            </ProjectWorkspace>
        </>
    );
}

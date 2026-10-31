import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useRef } from 'react';
import { DocumentAttachment } from '@/components/maintenance-documents/document-file';
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
import { formReturn } from '@/lib/form-navigation';
import { documentFileError } from '@/lib/maintenance-documents';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { DocumentParents } from '@/types/maintenance-documents';

type Values = {
    project_id: string;
    maintenance_id: string;
    document_title: string;
    description: string;
    attachment: File | null;
};
export default function Form(parents: DocumentParents) {
    const page = usePage();
    const enabled =
        page.props.previewOnly === true ||
        (page.props.canonicalFrontend === true && page.props.canWrite === true);
    const doc = parents.document;
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
    });
    const lock = useRef(false);
    const project = parents.projects.find(
        (p) => String(p.id) === form.data.project_id,
    );
    const record = parents.records.find(
        (r) => String(r.id) === form.data.maintenance_id,
    );
    const options = parents.records
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

                            if (disabled || lock.current) {
                                return;
                            }

                            form.clearErrors();
                            const errors: Partial<
                                Record<keyof Values, string>
                            > = {};

                            if (!project) {
                                errors.project_id =
                                    'Select a Maintenance Project.';
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
                                const problem = documentFileError(
                                    form.data.attachment,
                                );

                                if (problem) {
                                    errors.attachment = problem;
                                }
                            }

                            if (Object.keys(errors).length) {
                                form.setError(errors);
                                document
                                    .getElementById(Object.keys(errors)[0])
                                    ?.focus();

                                return;
                            }

                            lock.current = true;
                            form.submit(
                                doc ? 'put' : 'post',
                                parents.submitUrl,
                                {
                                    forceFormData: true,
                                    preserveScroll: true,
                                    onFinish: () => {
                                        lock.current = false;
                                    },
                                },
                            );
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
                                            projects={parents.projects}
                                            value={form.data.project_id}
                                            disabled={disabled}
                                            invalid={!!form.errors.project_id}
                                            onChange={(value) => {
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
                                                        !project
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
                                        {project && !options.length && (
                                            <p className="jr-field-hint">
                                                Add a Maintenance Record from
                                                Project Details first.
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
                                    ? 'The existing private file is retained. Edit its metadata below.'
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
                                error={form.errors.attachment}
                                onChange={(file) => {
                                    form.clearErrors('attachment');
                                    form.setData('attachment', file);
                                }}
                            />
                        </section>
                        <footer className="jr-form-footer">
                            <p>
                                {page.props.canonicalFrontend === true
                                    ? 'Files remain private. File replacement and deletion are unavailable pending retention policy approval.'
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
                                    disabled={disabled}
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
            </ProjectWorkspace>
        </>
    );
}

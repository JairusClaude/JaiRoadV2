import { usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
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
import type {
    MonthlyMedia,
    MonthlyCreateProps,
    MonthlyUpdateErrors,
    MonthlyUpdateValues,
} from '@/types/monthly-updates';
import { MediaAttachments } from './media-attachments';
import { MonthYearPicker } from './month-year-picker';
import { ProjectSelector } from './project-selector';

export function MonthlyUpdateForm({
    parents,
    backLabel,
    savedMedia,
    onRemoveSaved,
    values,
    errors,
    processing,
    enabled,
    onChange,
    onFiles,
    onSave,
    onCancel,
}: {
    parents: MonthlyCreateProps;
    backLabel?: string;
    savedMedia?: MonthlyMedia[];
    onRemoveSaved?: (id: number) => void;
    values: MonthlyUpdateValues;
    errors: MonthlyUpdateErrors;
    processing: boolean;
    enabled: boolean;
    onChange: (
        key: Exclude<
            keyof MonthlyUpdateValues,
            'attachments' | 'removed_media_ids'
        >,
        value: string,
    ) => void;
    onFiles: (files: File[]) => void;
    onSave: () => void;
    onCancel: () => void;
}) {
    const canonical = usePage().props.canonicalFrontend === true;
    const disabled = !enabled || processing;
    const project = parents.projects.find(
        (item) => String(item.id) === values.project_id,
    );
    const record = parents.records.find(
        (item) => String(item.id) === values.maintenance_id,
    );
    const options = parents.records
        .filter((item) => item.project_id === project?.id)
        .sort((a, b) => b.year - a.year || b.quarter.localeCompare(a.quarter));
    const field = (
        name: Exclude<
            keyof MonthlyUpdateValues,
            'attachments' | 'removed_media_ids'
        >,
        label: string,
        control: ReactNode,
        hint?: string,
    ) => (
        <div className="jr-record-field">
            <Label htmlFor={name}>
                {label}{' '}
                <span className="jr-required" aria-hidden="true">
                    *
                </span>
            </Label>
            {control}
            {hint && (
                <p className="jr-field-hint" id={`${name}-hint`}>
                    {hint}
                </p>
            )}
            {errors[name] && (
                <p className="jr-field-error" id={`${name}-error`} role="alert">
                    {errors[name]}
                </p>
            )}
        </div>
    );
    const attrs = (name: keyof MonthlyUpdateValues) => ({
        id: name,
        'aria-invalid': Boolean(errors[name]),
        'aria-describedby':
            [
                name === 'update_month' ? 'update_month-hint' : '',
                errors[name] ? `${name}-error` : '',
            ]
                .filter(Boolean)
                .join(' ') || undefined,
    });

    return (
        <ProjectWorkspace>
            <div className="jr-record-screen jr-monthly-form">
                <button
                    type="button"
                    className="jr-back"
                    disabled={processing}
                    onClick={onCancel}
                >
                    <ArrowLeft className="size-4" />{' '}
                    {backLabel ??
                        (parents.contextRecordId
                            ? 'Record Details'
                            : 'Monthly Updates')}
                </button>
                <div className="jr-page-head">
                    <div>
                        <h1>
                            {parents.update
                                ? 'Edit Monthly Update'
                                : 'Add Monthly Update'}
                        </h1>
                        <p>
                            Report monthly maintenance progress and attach
                            supporting photos or videos.
                        </p>
                    </div>
                </div>
                {!enabled && (
                    <p className="jr-notice" role="status">
                        Your account cannot change this maintenance report.
                    </p>
                )}
                <form
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSave();
                    }}
                >
                    <section aria-labelledby="monthly-maintenance">
                        <h2 id="monthly-maintenance">
                            Maintenance Information
                        </h2>
                        <p className="jr-field-hint">
                            {parents.contextRecordId
                                ? 'This monthly update will be associated with the maintenance record below.'
                                : 'Select the maintenance record for this monthly report.'}
                        </p>
                        {parents.contextRecordId ? (
                            <div className="jr-record-fields jr-monthly-fixed">
                                <div>
                                    <span className="jr-record-context-label">
                                        Maintenance Project
                                    </span>
                                    <strong>{project?.project_title}</strong>
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
                                        {record?.quarter} {record?.year}
                                    </strong>
                                    <p className="jr-field-hint">
                                        Maintenance Record ID: {record?.id}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="jr-record-fields">
                                {field(
                                    'project_id',
                                    'Maintenance Project',
                                    <ProjectSelector
                                        projects={parents.projects}
                                        value={values.project_id}
                                        disabled={disabled}
                                        invalid={Boolean(errors.project_id)}
                                        onChange={(value) =>
                                            onChange('project_id', value)
                                        }
                                    />,
                                )}
                                {field(
                                    'maintenance_id',
                                    'Maintenance Record',
                                    <Select
                                        value={values.maintenance_id}
                                        disabled={
                                            disabled ||
                                            !project ||
                                            !options.length
                                        }
                                        onValueChange={(value) =>
                                            onChange('maintenance_id', value)
                                        }
                                    >
                                        <SelectTrigger
                                            {...attrs('maintenance_id')}
                                            className="jr-record-select"
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
                                            align="start"
                                            position="popper"
                                            sideOffset={4}
                                        >
                                            {options.map((item) => (
                                                <SelectItem
                                                    key={item.id}
                                                    value={String(item.id)}
                                                >
                                                    {item.quarter} {item.year}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>,
                                    project && !options.length
                                        ? 'This project has no Maintenance Records. Add a record from Project Details first.'
                                        : undefined,
                                )}
                            </div>
                        )}
                        {parents.contextRecordId &&
                            (errors.project_id || errors.maintenance_id) && (
                                <p className="jr-field-error" role="alert">
                                    {errors.project_id ?? errors.maintenance_id}
                                </p>
                            )}
                    </section>
                    <section
                        className="jr-record-schedule"
                        aria-labelledby="monthly-progress"
                    >
                        <h2 id="monthly-progress">Progress Information</h2>
                        <p className="jr-field-hint">
                            Enter progress for the reporting month.
                        </p>
                        <div className="jr-record-fields jr-monthly-progress-fields">
                            {field(
                                'update_month',
                                'Reporting Month',
                                <MonthYearPicker
                                    {...attrs('update_month')}
                                    disabled={disabled}
                                    value={values.update_month}
                                    onChange={(value) =>
                                        onChange('update_month', value)
                                    }
                                />,
                                'Reporting month is independent of the record’s year and quarter.',
                            )}
                            {field(
                                'progress_percentage',
                                'Progress Percentage',
                                <div className="jr-monthly-percent">
                                    <Input
                                        {...attrs('progress_percentage')}
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="e.g. 45.5"
                                        required
                                        disabled={disabled}
                                        value={values.progress_percentage}
                                        onChange={(event) =>
                                            onChange(
                                                'progress_percentage',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <span aria-hidden="true">%</span>
                                </div>,
                            )}
                        </div>
                        <div className="jr-record-description">
                            <Label htmlFor="summary_of_text_reports">
                                Progress Summary{' '}
                                <span className="jr-muted">(optional)</span>
                            </Label>
                            <textarea
                                id="summary_of_text_reports"
                                className="jr-textarea"
                                rows={3}
                                placeholder="Describe work completed, progress, and observations..."
                                disabled={disabled}
                                value={values.summary_of_text_reports}
                                onChange={(event) =>
                                    onChange(
                                        'summary_of_text_reports',
                                        event.target.value,
                                    )
                                }
                            />
                        </div>
                    </section>
                    <section
                        className="jr-record-schedule"
                        aria-labelledby="monthly-media"
                    >
                        <h2 id="monthly-media">Media Attachments</h2>
                        <p className="jr-field-hint mb-4">
                            Add supporting evidence for this monthly update.
                        </p>
                        {canonical ? (
                            <p className="jr-field-hint">
                                Save this report first. Add Media from its
                                Details page using the private upload workflow;
                                existing files are retained.
                            </p>
                        ) : (
                            <MediaAttachments
                                files={values.attachments}
                                existing={savedMedia}
                                onRemoveExisting={onRemoveSaved}
                                disabled={disabled}
                                error={errors.attachments}
                                onChange={onFiles}
                            />
                        )}
                    </section>
                    <footer className="jr-form-footer">
                        <p>
                            {canonical
                                ? 'Saving persists this MonthlyUpdate to the database. File removal remains unavailable pending retention policy approval.'
                                : 'Sample data only · changes reset when the preview server restarts.'}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={processing}
                                onClick={onCancel}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="jr-primary"
                                disabled={disabled}
                            >
                                {processing
                                    ? 'Saving…'
                                    : parents.update
                                      ? 'Save Changes'
                                      : 'Save Update'}
                            </Button>
                        </div>
                    </footer>
                </form>
            </div>
        </ProjectWorkspace>
    );
}

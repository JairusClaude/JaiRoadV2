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
import {
    engineerName,
    validateMaintenanceYear,
} from '@/lib/maintenance-records';
import type { ProjectSummary } from '@/types/maintenance-projects';
import type {
    EngineerOption,
    MaintenanceRecordValues,
    RecordErrors,
} from '@/types/maintenance-records';

export function MaintenanceRecordForm({
    mode = 'create',
    originalEngineerId,
    project,
    projectSelector,
    backLabel,
    engineers,
    values,
    errors,
    processing,
    enabled,
    preview,
    onChange,
    onYearError,
    onSave,
    onCancel,
}: {
    mode?: 'create' | 'edit';
    originalEngineerId?: number;
    project?: ProjectSummary;
    projectSelector?: ReactNode;
    backLabel?: string;
    engineers: EngineerOption[];
    values: MaintenanceRecordValues;
    errors: RecordErrors;
    processing: boolean;
    enabled: boolean;
    preview: boolean;
    onChange: (field: keyof MaintenanceRecordValues, value: string) => void;
    onYearError: (message?: string) => void;
    onSave: () => void;
    onCancel: () => void;
}) {
    const required = (
        <span className="jr-required" aria-hidden="true">
            *
        </span>
    );
    const field = (
        name: keyof MaintenanceRecordValues,
        label: string,
        control: ReactNode,
        hint?: string,
    ) => (
        <div className="jr-record-field">
            <Label htmlFor={name}>
                {label}{' '}
                {name !== 'complete_date' || values.status === 'Completed'
                    ? required
                    : null}
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
    const accessibility = (
        name: keyof MaintenanceRecordValues,
        hint = false,
    ) => ({
        id: name,
        'aria-invalid': Boolean(errors[name]),
        'aria-describedby':
            [hint ? `${name}-hint` : '', errors[name] ? `${name}-error` : '']
                .filter(Boolean)
                .join(' ') || undefined,
    });
    const select = (
        name: keyof MaintenanceRecordValues,
        placeholder: string,
        options: { value: string; label: string }[],
        hint = false,
    ) => (
        <Select
            value={values[name]}
            onValueChange={(value) => onChange(name, value)}
            disabled={
                !enabled ||
                processing ||
                (mode === 'edit' &&
                    ['engineers_id', 'maintenance_year', 'quarter'].includes(
                        name,
                    ))
            }
            required
        >
            <SelectTrigger
                {...accessibility(name, hint)}
                className="jr-record-select"
            >
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent
                className="jr-theme jr-menu"
                align="start"
                position="popper"
                sideOffset={4}
            >
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
    const input = (
        name: keyof MaintenanceRecordValues,
        type: string,
        placeholder?: string,
    ) => (
        <Input
            {...accessibility(name)}
            name={name}
            type={type}
            value={values[name]}
            placeholder={placeholder}
            inputMode={type === 'text' ? 'numeric' : undefined}
            min={
                type === 'number'
                    ? 1
                    : type === 'date'
                      ? '0001-01-01'
                      : undefined
            }
            max={type === 'date' ? '9999-12-31' : undefined}
            step={type === 'number' ? 1 : undefined}
            maxLength={name === 'maintenance_year' ? 4 : undefined}
            pattern={name === 'maintenance_year' ? '[0-9]{4}' : undefined}
            onBlur={
                name === 'maintenance_year'
                    ? () =>
                          onYearError(
                              validateMaintenanceYear(values.maintenance_year),
                          )
                    : undefined
            }
            onPaste={
                name === 'maintenance_year'
                    ? (event) => {
                          const control = event.currentTarget;
                          const pasted = event.clipboardData.getData('text');
                          const next =
                              control.value.slice(
                                  0,
                                  control.selectionStart ??
                                      control.value.length,
                              ) +
                              pasted +
                              control.value.slice(
                                  control.selectionEnd ?? control.value.length,
                              );

                          // Reject the entire invalid paste visibly; do not strip symbols
                          // or truncate it into a different reporting year.
                          if (!/^\d{0,4}$/.test(next)) {
                              event.preventDefault();
                              onYearError(
                                  'Enter a four-digit year using digits only.',
                              );
                          }
                      }
                    : undefined
            }
            onChange={(event) => {
                const next = event.target.value;

                if (name === 'maintenance_year' && !/^\d{0,4}$/.test(next)) {
                    onYearError('Enter a four-digit year using digits only.');

                    return;
                }

                onChange(name, next);
            }}
            required
            disabled={!enabled || processing}
        />
    );

    return (
        <ProjectWorkspace>
            <div className="jr-record-screen">
                <button type="button" className="jr-back" onClick={onCancel}>
                    <ArrowLeft className="size-4" />{' '}
                    {backLabel ??
                        (mode === 'edit'
                            ? 'Record Details'
                            : 'Project Details')}
                </button>
                <div className="jr-page-head">
                    <div>
                        <h1>
                            {mode === 'edit'
                                ? 'Edit Maintenance Record'
                                : 'Add Maintenance Record'}
                        </h1>
                        <p>
                            {mode === 'edit'
                                ? 'Update this maintenance record and its managing engineer.'
                                : 'Record a maintenance occurrence for this project.'}
                        </p>
                    </div>
                </div>
                <div className="jr-record-context">
                    {projectSelector ?? (
                        <>
                            <span className="jr-record-context-label">
                                Maintenance Project
                            </span>
                            <strong>{project?.project_title}</strong>
                            <p className="jr-field-hint">
                                Project ID: {project?.id} ·{' '}
                                {project?.municipality ??
                                    'Municipality unavailable'}
                            </p>
                        </>
                    )}
                </div>
                {!enabled && (
                    <p className="jr-notice" role="status">
                        Record creation is pending Laravel integration. Saving
                        is unavailable.
                    </p>
                )}
                <form
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();
                        onSave();
                    }}
                >
                    <section aria-labelledby="record-information">
                        <h2 id="record-information">Record Information</h2>
                        <p className="jr-field-hint">
                            Select the year, quarter, and engineer responsible
                            for this maintenance.
                        </p>
                        <div className="jr-record-fields jr-record-information-fields">
                            {field(
                                'maintenance_year',
                                'Maintenance Year',
                                input('maintenance_year', 'text', 'e.g. 2026'),
                                'Enter a four-digit year.',
                            )}
                            {field(
                                'quarter',
                                'Quarter',
                                select(
                                    'quarter',
                                    'Select quarter',
                                    ['Q1', 'Q2', 'Q3', 'Q4'].map((value) => ({
                                        value,
                                        label: value,
                                    })),
                                ),
                            )}
                            {field(
                                'engineers_id',
                                'Managing Engineer',
                                select(
                                    'engineers_id',
                                    'Select engineer',
                                    engineers.map((engineer) => ({
                                        value: String(engineer.id),
                                        label: engineerName(engineer),
                                    })),
                                    preview || mode === 'create',
                                ),
                                preview
                                    ? mode === 'edit' &&
                                      originalEngineerId &&
                                      values.engineers_id !==
                                          String(originalEngineerId)
                                        ? 'The Managing Engineer assignment will change when you save this record.'
                                        : 'Representative sample Engineers.'
                                    : undefined,
                            )}
                            {field(
                                'status',
                                'Status',
                                select(
                                    'status',
                                    'Select status',
                                    ['Ongoing', 'Completed'].map((value) => ({
                                        value,
                                        label: value,
                                    })),
                                ),
                            )}
                        </div>
                    </section>
                    <section
                        className="jr-record-schedule"
                        aria-labelledby="record-dates"
                    >
                        <h2 id="record-dates">Dates &amp; Duration</h2>
                        <p className="jr-field-hint">
                            Enter the actual dates independently of the selected
                            year and quarter.
                        </p>
                        <div className="jr-record-fields jr-record-schedule-fields">
                            {field(
                                'start_date',
                                'Start Date',
                                input('start_date', 'date'),
                            )}
                            {field(
                                'estimated_duration_days',
                                'Estimated Duration (Days)',
                                input(
                                    'estimated_duration_days',
                                    'number',
                                    'e.g. 30',
                                ),
                                'Enter the estimated number of days.',
                            )}
                            {field(
                                'complete_date',
                                'Completion Date',
                                <Input
                                    {...accessibility('complete_date', true)}
                                    name="complete_date"
                                    type="date"
                                    value={values.complete_date}
                                    min={values.start_date || '0001-01-01'}
                                    max="9999-12-31"
                                    disabled={
                                        !enabled ||
                                        processing ||
                                        values.status === 'Ongoing'
                                    }
                                    required={values.status === 'Completed'}
                                    onChange={(event) =>
                                        onChange(
                                            'complete_date',
                                            event.target.value,
                                        )
                                    }
                                />,
                                values.status === 'Completed'
                                    ? 'Required when the maintenance record is Completed.'
                                    : 'Not used while Ongoing; no completion date is submitted.',
                            )}
                        </div>
                    </section>
                    <div className="jr-record-description">
                        <Label htmlFor="description">
                            Description{' '}
                            <span className="jr-muted">(optional)</span>
                        </Label>
                        <textarea
                            id="description"
                            name="description"
                            className="jr-textarea"
                            rows={3}
                            placeholder="Describe this maintenance occurrence..."
                            value={values.description}
                            disabled={!enabled || processing}
                            onChange={(event) =>
                                onChange('description', event.target.value)
                            }
                            aria-invalid={Boolean(errors.description)}
                            aria-describedby={
                                errors.description
                                    ? 'description-error'
                                    : undefined
                            }
                        />
                        {errors.description && (
                            <p
                                id="description-error"
                                className="jr-field-error"
                                role="alert"
                            >
                                {errors.description}
                            </p>
                        )}
                    </div>
                    <footer className="jr-form-footer">
                        <p>
                            {preview
                                ? 'Sample data only · restarting the preview resets maintenance records.'
                                : 'Saved to the canonical MaintenanceRecord; assignment changes use the separate reassignment action.'}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onCancel}
                                disabled={processing}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="jr-primary"
                                disabled={!enabled || processing}
                            >
                                {processing
                                    ? 'Saving…'
                                    : mode === 'edit'
                                      ? 'Save Changes'
                                      : 'Save Record'}
                            </Button>
                        </div>
                    </footer>
                </form>
            </div>
        </ProjectWorkspace>
    );
}

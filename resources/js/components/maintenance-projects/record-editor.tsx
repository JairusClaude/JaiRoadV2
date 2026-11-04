import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { DuplicatePeriodWarning } from '@/components/maintenance-projects/duplicate-period-warning';
import { MaintenanceRecordForm } from '@/components/maintenance-projects/maintenance-record-form';
import { ProjectSelector } from '@/components/monthly-updates/project-selector';
import { Label } from '@/components/ui/label';
import { formReturn, returnLabel, editUrl } from '@/lib/form-navigation';
import { recordPayload, validateRecord } from '@/lib/maintenance-records';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { ProjectChoice } from '@/types/maintenance-projects';
import type {
    DuplicatePeriod,
    EngineerOption,
    MaintenanceRecordDetail,
    MaintenancePeriodChoice,
    MaintenanceRecordValues,
} from '@/types/maintenance-records';

export function RecordEditor({
    project,
    engineers,
    records,
    submitUrl,
    record,
    cancelUrl,
    projects = [],
    managerChoicesByProject,
}: {
    managerChoicesByProject?: Record<string, EngineerOption[]>;
    project?: ProjectChoice;
    projects?: ProjectChoice[];
    engineers: EngineerOption[];
    records: MaintenancePeriodChoice[];
    submitUrl?: string;
    record?: MaintenanceRecordDetail;
    cancelUrl?: string;
}) {
    const page = usePage();
    const preview = page.props.previewOnly === true;
    const serverConflict = (page.props.duplicatePeriod ??
        null) as DuplicatePeriod | null;
    const [localConflict, setLocalConflict] = useState<DuplicatePeriod | null>(
        null,
    );
    const [dismissedConflict, setDismissedConflict] =
        useState<DuplicatePeriod | null>(null);
    const conflict =
        localConflict ??
        (serverConflict !== dismissedConflict ? serverConflict : null);
    const closeConflict = () => {
        setLocalConflict(null);
        setDismissedConflict(serverConflict);
    };
    const [projectId, setProjectId] = useState('');
    const [projectError, setProjectError] = useState('');
    const selectedProject =
        project ?? projects.find((item) => String(item.id) === projectId);
    const fallback =
        record?.details_url ??
        (project
            ? workspaceHref(`/maintenance-projects/${project.id}`)
            : workspaceHref('/maintenance-records'));
    const cancel = formReturn(page.url, cancelUrl ?? fallback, [
        workspaceHref('/maintenance-records'),
        ...(project
            ? [workspaceHref(`/maintenance-projects/${project.id}`)]
            : []),
    ]);
    const submitting = useRef(false);
    const enabled =
        (preview ||
            (page.props.canonicalFrontend === true &&
                page.props.canWrite === true)) &&
        Boolean(submitUrl || projects.length);
    const form = useForm<MaintenanceRecordValues>({
        maintenance_year: record ? String(record.year).padStart(4, '0') : '',
        quarter: record?.quarter ?? '',
        engineers_id: record?.engineers_id ? String(record.engineers_id) : '',
        status: record?.status ?? 'Ongoing',
        start_date: record?.start_date ?? '',
        estimated_duration_days: record
            ? String(record.estimated_duration_days)
            : '',
        complete_date:
            record?.status === 'Completed' ? (record.complete_date ?? '') : '',
        description: record?.description ?? '',
    });
    const eligibleEngineers = selectedProject
        ? (managerChoicesByProject?.[String(selectedProject.id)] ?? engineers)
        : engineers;
    const projectRecords = records.filter(
        (item) =>
            !('project_id' in item) || item.project_id === selectedProject?.id,
    );
    const unavailableQuarters = record
        ? []
        : projectRecords
              .filter(
                  (item) => item.year === Number(form.data.maintenance_year),
              )
              .map((item) => item.quarter);
    const save = () => {
        if (!enabled || submitting.current || form.processing) {
            return;
        }

        form.clearErrors();

        if (!selectedProject) {
            setProjectError('Select an existing Maintenance Project.');
            document.getElementById('project_id')?.focus();

            return;
        }

        const occupied =
            !record &&
            projectRecords.find(
                (item) =>
                    item.year === Number(form.data.maintenance_year) &&
                    item.quarter === form.data.quarter,
            );

        if (occupied) {
            setLocalConflict({
                project_id: selectedProject.id,
                project_title: selectedProject.project_title,
                maintenance_year: occupied.year,
                quarter: occupied.quarter,
                details_url: occupied.details_url,
            });
            form.setError(
                'quarter',
                'This maintenance period is already occupied. Choose another quarter or year.',
            );

            return;
        }

        const errors = validateRecord(
            form.data,
            projectRecords,
            eligibleEngineers,
            record?.id,
        );

        if (record?.engineers_id === null && form.data.engineers_id === '') {
            delete errors.engineers_id; // Existing NULL may be preserved, never introduced by this form.
        }

        if (Object.keys(errors).length) {
            form.setError(errors);
            document.getElementById(Object.keys(errors)[0])?.focus();

            return;
        }

        form.transform((values) =>
            recordPayload(
                values,
                selectedProject.id,
                page.props.canonicalFrontend === true
                    ? 'canonical'
                    : preview
                      ? 'preview'
                      : 'legacy',
            ),
        );
        submitting.current = true;
        const url =
            submitUrl ??
            workspaceHref(
                `/maintenance-projects/${selectedProject.id}/records?from=records`,
            );
        form.submit(record ? 'put' : 'post', editUrl(url, cancel), {
            preserveScroll: true,
            onFinish: () => {
                submitting.current = false;
            },
        });
    };

    return (
        <>
            <Head
                title={
                    record
                        ? 'Edit Maintenance Record'
                        : 'Add Maintenance Record'
                }
            />
            <MaintenanceRecordForm
                mode={record ? 'edit' : 'create'}
                originalEngineerId={record?.engineers_id}
                unavailableQuarters={unavailableQuarters}
                project={selectedProject}
                backLabel={returnLabel(
                    cancel,
                    record ? 'Record Details' : 'Project Details',
                )}
                projectSelector={
                    !project ? (
                        <div className="jr-record-field">
                            <Label htmlFor="project_id">
                                Maintenance Project{' '}
                                <span
                                    className="jr-required"
                                    aria-hidden="true"
                                >
                                    *
                                </span>
                            </Label>
                            <ProjectSelector
                                projects={projects}
                                value={projectId}
                                disabled={!enabled || form.processing}
                                invalid={Boolean(projectError)}
                                onChange={(value) => {
                                    setProjectId(value);
                                    setProjectError('');
                                    form.clearErrors('quarter');
                                }}
                            />
                            {selectedProject && (
                                <p className="jr-field-hint">
                                    Project ID: {selectedProject.id} ·{' '}
                                    {selectedProject.municipality}
                                </p>
                            )}
                            {projectError && (
                                <p
                                    id="project_id-error"
                                    className="jr-field-error"
                                    role="alert"
                                >
                                    {projectError}
                                </p>
                            )}
                        </div>
                    ) : undefined
                }
                engineers={eligibleEngineers}
                values={form.data}
                errors={form.errors}
                processing={form.processing}
                enabled={enabled}
                preview={preview}
                onChange={(field, value) => {
                    form.clearErrors(field);

                    if (field === 'maintenance_year') {
                        form.clearErrors('quarter');
                    }

                    if (field === 'start_date') {
                        form.clearErrors('complete_date');
                    }

                    if (field === 'status') {
                        form.clearErrors('complete_date');
                        form.setData({
                            ...form.data,
                            status: value,
                            complete_date:
                                value === 'Ongoing'
                                    ? ''
                                    : form.data.complete_date,
                        });
                    } else {
                        form.setData(field, value);
                    }
                }}
                onYearError={(message) => {
                    if (message) {
                        form.setError('maintenance_year', message);
                    } else {
                        form.clearErrors('maintenance_year');
                    }
                }}
                onSave={save}
                onCancel={() => router.visit(cancel)}
            />
            <DuplicatePeriodWarning
                conflict={record ? null : conflict}
                onClose={closeConflict}
                onChooseQuarter={() => {
                    closeConflict();
                    form.setData('quarter', '');
                    form.clearErrors('quarter');
                }}
            />
        </>
    );
}

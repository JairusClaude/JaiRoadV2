import '../../../css/maintenance-projects.css';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import { FieldReportDraft } from '@/components/monthly-updates/field-report-draft';
import { MonthlyUpdateForm } from '@/components/monthly-updates/monthly-update-form';
import { ReconnectSubmission } from '@/components/monthly-updates/reconnect-submission';
import { editUrl, formReturn, returnLabel } from '@/lib/form-navigation';
import { validateMonthlyUpdate } from '@/lib/monthly-updates';
import { workspaceHref } from '@/lib/workspace-navigation';
import type {
    MonthlyCreateProps,
    MonthlyUpdateValues,
} from '@/types/monthly-updates';

export default function Create(parents: MonthlyCreateProps) {
    const page = usePage();
    const preview =
        page.props.previewOnly === true ||
        (page.props.canonicalFrontend === true && page.props.canWrite === true);
    const update = parents.update;
    const canUseDrafts =
        !update && page.props.canonicalFrontend === true && preview;
    const cancel = update
        ? formReturn(page.url, workspaceHref(`/monthly-updates/${update.id}`), [
              workspaceHref('/monthly-updates'),
              workspaceHref(
                  `/maintenance-projects/${update.project.id}/records/${update.maintenance_id}`,
              ),
          ])
        : parents.cancelUrl;
    const fixed = parents.records.find(
        (item) => item.id === parents.contextRecordId,
    );
    const form = useForm<MonthlyUpdateValues>({
        project_id: fixed ? String(fixed.project_id) : '',
        maintenance_id: fixed ? String(fixed.id) : '',
        update_month: update?.update_month ?? '',
        progress_percentage: update ? String(update.progress_percentage) : '',
        summary_of_text_reports: update?.summary_of_text_reports ?? '',
        attachments: [],
        removed_media_ids: [],
    });
    const submitting = useRef(false);
    const [confirmRemoval, setConfirmRemoval] = useState(false);
    const save = (confirmed = false, reconnect = false) => {
        if (
            !preview ||
            !parents.submitUrl ||
            submitting.current ||
            form.processing
        ) {
            return;
        }

        if (!navigator.onLine) {
            toast.error('No connection. Save a draft or use reconnect submission.');

            return;
        }

        if (
            reconnect &&
            (!canUseDrafts ||
                !parents.reconnectAccountId ||
                form.data.attachments.length ||
                form.data.removed_media_ids.length)
        ) {
            return;
        }

        form.clearErrors();
        const errors = validateMonthlyUpdate(form.data, parents);

        if (Object.keys(errors).length) {
            form.setError(errors);
            document.getElementById(Object.keys(errors)[0])?.focus();

            return;
        }

        if (
            page.props.canonicalFrontend === true &&
            form.data.removed_media_ids.length &&
            !confirmed
        ) {
            setConfirmRemoval(true);

            return;
        }

        submitting.current = true;

        const selectedAttachments = [...form.data.attachments];

        if (page.props.canonicalFrontend === true) {
            form.transform((data) => ({
                ...data,
                attachments: undefined,
                ...(reconnect
                    ? { reconnect_account_id: parents.reconnectAccountId }
                    : {}),
            }));
        }

        form.submit(
            update ? 'put' : 'post',
            update ? editUrl(parents.submitUrl, cancel) : parents.submitUrl,
            {
                forceFormData: page.props.canonicalFrontend !== true,
                preserveScroll: true,
                onSuccess: (responsePage) => {
                    setConfirmRemoval(false);

                    if (page.props.canonicalFrontend !== true) {
                        return;
                    }

                    const match = responsePage.url.match(
                        new RegExp('/monthly-updates/([0-9]+)(?:[/?#]|$)'),
                    );
                    const savedId = update?.id ?? Number(match?.[1] ?? 0);

                    if (
                        selectedAttachments.length &&
                        (!Number.isSafeInteger(savedId) || savedId < 1)
                    ) {
                        form.setError(
                            'attachments',
                            'The update was saved, but its media changes could not be completed. Open the saved update and retry.',
                        );

                        return;
                    }

                    const uploadNext = (index: number) => {
                        if (index >= selectedAttachments.length) {
                            return;
                        }

                        const mediaUrl = workspaceHref(
                            `/monthly-updates/${savedId}/media`,
                        );
                        router.post(
                            update ? editUrl(mediaUrl, cancel) : mediaUrl,
                            {
                                file: selectedAttachments[index],
                            },
                            {
                                forceFormData: true,
                                preserveScroll: true,
                                onSuccess: () => uploadNext(index + 1),
                                onError: (errors) => {
                                    const message =
                                        errors.file ??
                                        'The update was saved, but a media file could not be uploaded. Open the saved update and retry.';
                                    form.setError('attachments', message);
                                    toast.error(message);
                                },
                            },
                        );
                    };
                    uploadNext(0);
                },
                onFinish: () => {
                    submitting.current = false;
                },
            },
        );
    };

    return (
        <>
            <Head
                title={update ? 'Edit Monthly Update' : 'Add Monthly Update'}
            />
            <MonthlyUpdateForm
                parents={parents}
                draftTools={
                    canUseDrafts && (
                        <>
                            <FieldReportDraft
                                parents={parents}
                                values={form.data}
                                disabled={form.processing}
                                onImport={(values) => {
                                    form.clearErrors();
                                    form.setData({
                                        ...values,
                                        attachments: [],
                                        removed_media_ids: [],
                                    });
                                }}
                            />
                            {parents.reconnectAccountId && (
                                <ReconnectSubmission
                                    parents={parents}
                                    values={form.data}
                                    disabled={form.processing}
                                    onSubmit={() => save(false, true)}
                                />
                            )}
                        </>
                    )
                }
                backLabel={
                    update
                        ? returnLabel(
                              cancel,
                              cancel.startsWith(
                                  workspaceHref('/maintenance-projects/'),
                              )
                                  ? 'Record Details'
                                  : 'Monthly Update Details',
                          )
                        : undefined
                }
                savedMedia={(parents.media ?? []).filter(
                    (file) => !form.data.removed_media_ids.includes(file.id),
                )}
                onRemoveSaved={(id) => {
                    form.clearErrors('attachments');
                    form.setData('removed_media_ids', [
                        ...form.data.removed_media_ids,
                        id,
                    ]);
                }}
                values={form.data}
                errors={form.errors}
                enabled={preview && Boolean(parents.submitUrl)}
                processing={form.processing}
                onChange={(key, value) => {
                    form.clearErrors(key);

                    if (key === 'project_id') {
                        form.clearErrors('maintenance_id', 'update_month');
                        form.setData({
                            ...form.data,
                            project_id: value,
                            maintenance_id: '',
                        });
                    } else {
                        if (key === 'maintenance_id') {
                            form.clearErrors('update_month');
                        }

                        form.setData(key, value);
                    }
                }}
                onFiles={(files) => {
                    form.clearErrors('attachments');
                    form.setData('attachments', files);
                }}
                onCancel={() => router.visit(cancel)}
                onSave={() => save()}
            />
            <DeletionDialog
                open={confirmRemoval}
                title="Remove selected media permanently?"
                description="Save the changes and permanently remove the selected private media files. The monthly update and its information will be retained."
                selectionLabel={`${form.data.removed_media_ids.length} selected media files`}
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
                <ul className="jr-delete-list">
                    {(parents.media ?? [])
                        .filter((file) =>
                            form.data.removed_media_ids.includes(file.id),
                        )
                        .map((file) => (
                            <li key={file.id}>
                                <strong>{file.file_name}</strong>
                            </li>
                        ))}
                </ul>
            </DeletionDialog>
        </>
    );
}

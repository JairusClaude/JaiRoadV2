import '../../../css/maintenance-projects.css';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import { DurableReportQueue } from '@/components/monthly-updates/durable-report-queue';
import { FieldReportDraft } from '@/components/monthly-updates/field-report-draft';
import { MonthlyUpdateForm } from '@/components/monthly-updates/monthly-update-form';
import { ReconnectSubmission } from '@/components/monthly-updates/reconnect-submission';
import { editUrl, formReturn, returnLabel } from '@/lib/form-navigation';
import { validateMonthlyUpdate } from '@/lib/monthly-updates';
import { validRecordChoices } from '@/lib/project-choice-page';
import { workspaceHref } from '@/lib/workspace-navigation';
import type {
    MonthlyCreateProps,
    MonthlyParentProject,
    MonthlyUpdateValues,
} from '@/types/monthly-updates';

type ProjectChoices = Pick<
    MonthlyCreateProps,
    'records' | 'existingUpdates' | 'occupiedMonths'
> & {
    project: MonthlyParentProject;
    recordPage: number;
    recordHasMore: boolean;
    selectedRecordId: number | null;
};

async function loadProjectChoices(
    url: string,
    id: string,
    signal: AbortSignal,
    recordPage = 1,
    recordId = '',
): Promise<ProjectChoices> {
    const query = new URLSearchParams({
        project: id,
        record_page: String(recordPage),
    });

    if (recordId) {
        query.set('record', recordId);
    }

    const response = await fetch(`${url}?${query}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
    });

    if (!response.ok) {
        throw new Error('Could not verify the maintenance project.');
    }

    const result = await response.json();

    if (!validRecordChoices(result, id, recordId)) {
        throw new Error('Invalid maintenance record choices.');
    }

    return result;
}

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
    const { formChoicesUrl } = parents;
    const { project_id: projectId, maintenance_id: recordId } = form.data;
    const [recordPage, setRecordPage] = useState(1);
    const [projectChoices, setProjectChoices] = useState<ProjectChoices | null>(
        null,
    );
    const [choiceAttempt, retryChoices] = useState(0);
    const [choiceFailure, setChoiceFailure] = useState<string | null>(null);
    const selectedChoices =
        String(projectChoices?.project.id) === projectId
            ? projectChoices
            : null;
    const choiceKey = [projectId, recordPage, recordId].join(':');
    const choicesCurrent =
        selectedChoices?.recordPage === recordPage &&
        String(selectedChoices.selectedRecordId ?? '') === recordId;
    const choicesPending = Boolean(
        formChoicesUrl && projectId && !choicesCurrent,
    );
    const choicesLoading = choicesPending && choiceFailure !== choiceKey;
    const formParents = selectedChoices
        ? {
              ...parents,
              ...selectedChoices,
              projects: [selectedChoices.project],
          }
        : parents;

    useEffect(() => {
        if (!formChoicesUrl || !projectId || choicesCurrent) {
            return;
        }

        const controller = new AbortController();
        const signal = AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(12_000),
        ]);
        void loadProjectChoices(
            formChoicesUrl,
            projectId,
            signal,
            recordPage,
            recordId,
        )
            .then((choices) => {
                if (!controller.signal.aborted) {
                    setProjectChoices(choices);
                    setRecordPage(choices.recordPage);
                    setChoiceFailure(null);
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setChoiceFailure(choiceKey);
                }
            });

        return () => controller.abort();
    }, [
        choiceAttempt,
        choiceKey,
        choicesCurrent,
        formChoicesUrl,
        projectId,
        recordId,
        recordPage,
    ]);

    const submitting = useRef(false);
    const importing = useRef(false);
    const [importBusy, setImportBusy] = useState(false);
    const [confirmRemoval, setConfirmRemoval] = useState(false);
    const [saveError, setSaveError] = useState('');
    const save = (confirmed = false, reconnect = false) => {
        if (
            !preview ||
            !parents.submitUrl ||
            submitting.current ||
            importing.current ||
            form.processing ||
            choicesPending
        ) {
            return;
        }

        if (!navigator.onLine) {
            setSaveError(
                'Offline. Save a draft or queue reconnect submission.',
            );

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

        setSaveError('');
        form.clearErrors();
        const errors = validateMonthlyUpdate(form.data, formParents);

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
                parents={formParents}
                recordChoicesLoading={choicesLoading}
                recordPageControls={
                    formChoicesUrl && selectedChoices
                        ? {
                              page: selectedChoices.recordPage,
                              hasMore: selectedChoices.recordHasMore,
                              onPage: setRecordPage,
                          }
                        : undefined
                }
                recordChoicesPending={choicesPending}
                retryRecordChoices={
                    choiceFailure === choiceKey && choicesPending
                        ? () => {
                              setChoiceFailure(null);
                              retryChoices((attempt) => attempt + 1);
                          }
                        : undefined
                }
                draftTools={
                    canUseDrafts && (
                        <>
                            <FieldReportDraft
                                values={form.data}
                                disabled={form.processing || importBusy}
                                onImportBusy={(busy) => {
                                    importing.current = busy;
                                    setImportBusy(busy);
                                }}
                                onImport={async (values, signal) => {
                                    const remote = formChoicesUrl
                                        ? await loadProjectChoices(
                                              formChoicesUrl,
                                              values.project_id,
                                              AbortSignal.any([
                                                  signal,
                                                  AbortSignal.timeout(12_000),
                                              ]),
                                              1,
                                              values.maintenance_id,
                                          )
                                        : null;
                                    signal.throwIfAborted();
                                    const choices = remote ?? formParents;
                                    const record = choices.records.find(
                                        (item) =>
                                            String(item.id) ===
                                                values.maintenance_id &&
                                            String(item.project_id) ===
                                                values.project_id,
                                    );

                                    if (
                                        !record ||
                                        (parents.contextRecordId &&
                                            record.id !==
                                                parents.contextRecordId)
                                    ) {
                                        throw new Error(
                                            'This draft does not match a currently available maintenance record.',
                                        );
                                    }

                                    if (remote) {
                                        setProjectChoices(remote);
                                        setRecordPage(remote.recordPage);
                                        setChoiceFailure(null);
                                    }

                                    form.clearErrors();
                                    form.setData({
                                        ...values,
                                        attachments: [],
                                        removed_media_ids: [],
                                    });
                                }}
                            />
                            {parents.durableReceiptsAvailable &&
                                parents.reconnectAccountId && (
                                    <DurableReportQueue
                                        key={parents.reconnectAccountId}
                                        accountId={parents.reconnectAccountId}
                                        contextRecordId={
                                            parents.contextRecordId
                                        }
                                        values={form.data}
                                        valid={
                                            Object.keys(
                                                validateMonthlyUpdate(
                                                    form.data,
                                                    formParents,
                                                ),
                                            ).length === 0
                                        }
                                        disabled={
                                            form.processing ||
                                            importBusy ||
                                            choicesPending
                                        }
                                        onBusy={(busy) => {
                                            importing.current = busy;
                                            setImportBusy(busy);
                                        }}
                                    />
                                )}
                            {parents.reconnectAccountId &&
                                !parents.durableReceiptsAvailable && (
                                    <ReconnectSubmission
                                        parents={formParents}
                                        values={form.data}
                                        disabled={
                                            form.processing ||
                                            importBusy ||
                                            choicesPending
                                        }
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
                processing={form.processing || importBusy}
                onChange={(key, value) => {
                    if (importing.current) {
                        return;
                    }

                    form.clearErrors(key);

                    if (key === 'project_id') {
                        setChoiceFailure(null);
                        setRecordPage(1);
                        setProjectChoices(null);
                        form.clearErrors('maintenance_id', 'update_month');
                        form.setData({
                            ...form.data,
                            project_id: value,
                            maintenance_id: '',
                        });
                    } else {
                        if (key === 'maintenance_id') {
                            setChoiceFailure(null);
                            form.clearErrors('update_month');
                        }

                        form.setData(key, value);
                    }
                }}
                onFiles={(files) => {
                    if (importing.current) {
                        return;
                    }

                    form.clearErrors('attachments');
                    form.setData('attachments', files);
                }}
                onCancel={() => router.visit(cancel)}
                saveError={saveError}
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

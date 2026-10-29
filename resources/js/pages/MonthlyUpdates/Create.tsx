import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useRef } from 'react';
import { MonthlyUpdateForm } from '@/components/monthly-updates/monthly-update-form';
import { formReturn, returnLabel } from '@/lib/form-navigation';
import { validateMonthlyUpdate } from '@/lib/monthly-updates';
import type {
    MonthlyCreateProps,
    MonthlyUpdateValues,
} from '@/types/monthly-updates';

export default function Create(parents: MonthlyCreateProps) {
    const page = usePage();
    const preview = page.props.previewOnly === true;
    const update = parents.update;
    const cancel = update
        ? formReturn(page.url, `/monthly-updates/${update.id}`, [
              '/monthly-updates',
              `/maintenance-projects/${update.project.id}/records/${update.maintenance_id}`,
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

    return (
        <>
            <Head
                title={update ? 'Edit Monthly Update' : 'Add Monthly Update'}
            />
            <MonthlyUpdateForm
                parents={parents}
                backLabel={
                    update
                        ? returnLabel(
                              cancel,
                              cancel.startsWith('/maintenance-projects/')
                                  ? 'Record Details'
                                  : 'Monthly Update Details',
                          )
                        : undefined
                }
                savedMedia={(parents.media ?? []).filter(
                    (file) => !form.data.removed_media_ids.includes(file.id),
                )}
                onRemoveSaved={(id) =>
                    form.setData('removed_media_ids', [
                        ...form.data.removed_media_ids,
                        id,
                    ])
                }
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
                onSave={() => {
                    if (
                        !preview ||
                        !parents.submitUrl ||
                        submitting.current ||
                        form.processing
                    ) {
                        return;
                    }

                    form.clearErrors();
                    const errors = validateMonthlyUpdate(form.data, parents);

                    if (Object.keys(errors).length) {
                        form.setError(errors);
                        document
                            .getElementById(Object.keys(errors)[0])
                            ?.focus();

                        return;
                    }

                    submitting.current = true;
                    form.submit(update ? 'put' : 'post', parents.submitUrl, {
                        forceFormData: true,
                        preserveScroll: true,
                        onFinish: () => {
                            submitting.current = false;
                        },
                    });
                }}
            />
        </>
    );
}

import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import { useRef } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { editUrl, formReturn } from '@/lib/form-navigation';
import { lguFields, validateLgu } from '@/lib/lgus';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { Lgu, LguPermissions, LguValues } from '@/types/lgus';

export function LguForm({ lgu }: { lgu?: Lgu }) {
    const page = usePage();
    const canonical = page.props.canonicalFrontend === true;
    const directory = workspaceHref('/lgus');
    const detail = lgu ? workspaceHref(`/lgus/${lgu.id}`) : directory;
    const back = formReturn(page.url, lgu ? detail : directory, [directory, detail]);
    const fixedLocation = canonical && !lgu;
    const form = useForm<LguValues>(
        Object.fromEntries(
            lguFields.map(({ key }) => [key, lgu?.[key] ?? (fixedLocation && key === 'province' ? 'Davao De Oro' : fixedLocation && key === 'region' ? 'XI' : '')]),
        ) as LguValues,
    );
    const saving = useRef(false);
    const permissions = page.props.lguPermissions as LguPermissions | undefined;
    const enabled =
        page.props.previewOnly === true
            ? permissions?.can_edit === true
            : (permissions?.can_edit ?? page.props.canEdit ?? true);
    const title = lgu ? 'Edit LGU' : 'Add LGU';
    const cancel = () => router.visit(workspaceHref(back));

    return (
        <>
            <Head title={title} />
            <ProjectWorkspace>
                <div className="jr-record-screen">
                    <button
                        className="jr-back"
                        type="button"
                        disabled={form.processing}
                        onClick={cancel}
                    >
                        <ArrowLeft className="size-4" />
                        {back.split('?')[0] === directory ? 'LGU' : 'LGU Details'}
                    </button>
                    <div className="jr-page-head">
                        <div>
                            <h1>{title}</h1>
                            <p>
                                {lgu
                                    ? 'Update the municipality and municipal mayor information.'
                                    : 'Register a local government unit and its municipal mayor.'}
                            </p>
                        </div>
                    </div>
                    <form
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault();

                            if (!enabled || saving.current || form.processing) {
                                return;
                            }

                            form.clearErrors();
                            const errors = validateLgu(form.data);

                            if (Object.keys(errors).length) {
                                form.setError(errors);
                                document
                                    .getElementById(Object.keys(errors)[0])
                                    ?.focus();

                                return;
                            }

                            saving.current = true;
                            form.submit(
                                lgu ? 'put' : 'post',
                                workspaceHref(
                                    lgu
                                        ? editUrl(`/lgus/${lgu.id}`, back)
                                        : '/lgus',
                                ),
                                {
                                    preserveScroll: true,
                                    onFinish: () => {
                                        saving.current = false;
                                    },
                                },
                            );
                        }}
                    >
                        {[
                            {
                                heading: 'LGU Information',
                                fields: lguFields.slice(0, 3),
                            },
                            {
                                heading: 'Municipal Mayor',
                                fields: lguFields.slice(3),
                            },
                        ].map((section, index) => (
                            <section
                                key={section.heading}
                                className={
                                    index ? 'jr-record-schedule' : undefined
                                }
                            >
                                <h2>{section.heading}</h2>
                                <div className="jr-record-fields">
                                    {section.fields.map((field) => (
                                        <div
                                            className="jr-record-field"
                                            key={field.key}
                                        >
                                            <Label htmlFor={field.key}>
                                                {field.label}
                                                {field.required ? (
                                                    <span className="jr-required">
                                                        {' '}
                                                        *
                                                    </span>
                                                ) : (
                                                    <span className="jr-muted">
                                                        {' '}
                                                        (optional)
                                                    </span>
                                                )}
                                            </Label>
                                            <Input
                                                id={field.key}
                                                name={field.key}
                                                required={field.required}
                                                maxLength={255}
                                                value={form.data[field.key]}
                                                readOnly={fixedLocation && (field.key === 'province' || field.key === 'region')}
                                                className={fixedLocation && (field.key === 'province' || field.key === 'region') ? '!bg-slate-100 !text-slate-600 dark:!bg-slate-800 dark:!text-slate-300 cursor-not-allowed' : undefined}
                                                disabled={
                                                    !enabled || form.processing
                                                }
                                                aria-invalid={
                                                    !!form.errors[field.key]
                                                }
                                                aria-describedby={
                                                    form.errors[field.key]
                                                        ? `${field.key}-error`
                                                        : undefined
                                                }
                                                onChange={(e) => {
                                                    if (fixedLocation && (field.key === 'province' || field.key === 'region')) return;
                                                    form.clearErrors(field.key);
                                                    form.setData(
                                                        field.key,
                                                        e.target.value,
                                                    );
                                                }}
                                            />
                                            {form.errors[field.key] && (
                                                <p
                                                    className="jr-field-error"
                                                    id={`${field.key}-error`}
                                                    role="alert"
                                                >
                                                    {form.errors[field.key]}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                        <footer className="jr-form-footer">
                            <p>{canonical ? 'Saved to the LGU directory.' : 'Local preview · changes reset on restart.'}</p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    type="button"
                                    disabled={form.processing}
                                    onClick={cancel}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="jr-primary"
                                    type="submit"
                                    disabled={!enabled || form.processing}
                                >
                                    {form.processing
                                        ? 'Saving…'
                                        : lgu
                                          ? 'Save Changes'
                                          : 'Save LGU'}
                                </Button>
                            </div>
                        </footer>
                    </form>
                </div>
            </ProjectWorkspace>
        </>
    );
}

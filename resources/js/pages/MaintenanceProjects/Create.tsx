import { Head, router, useForm } from '@inertiajs/react';
import { useRef } from 'react';
import { ProjectForm } from '@/components/maintenance-projects/project-form';
import { workspaceHref } from '@/lib/workspace-navigation';
import type {
    CoverageChoice,
    IntegrationStatus,
    ProjectFormValues,
} from '@/types/maintenance-projects';

export default function Create({
    coverages,
    integration,
}: {
    coverages: CoverageChoice[];
    integration: IntegrationStatus;
}) {
    const saving = useRef(false);
    const form = useForm<ProjectFormValues>({
        road_coverage_id: '',
        project_title: '',
        description: '',
    });

    return (
        <>
            <Head title="Add Project" />
            <ProjectForm
                coverages={coverages}
                integration={integration}
                values={form.data}
                errors={form.errors}
                processing={form.processing}
                onChange={(values) => {
                    for (const field of [
                        'road_coverage_id',
                        'project_title',
                        'description',
                    ] as const) {
                        if (values[field] !== form.data[field]) {
                            form.clearErrors(field);
                        }
                    }

                    form.setData(values);
                }}
                onSave={() => {
                    if (saving.current || form.processing) {
                        return;
                    }

                    saving.current = true;
                    form.post(workspaceHref('/maintenance-projects'), {
                        preserveScroll: true,
                        onFinish: () => {
                            saving.current = false;
                        },
                    });
                }}
                onCancel={() =>
                    router.visit(workspaceHref('/maintenance-projects'))
                }
            />
        </>
    );
}

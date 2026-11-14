import { Head, router, useForm, usePage } from '@inertiajs/react';
import { ProjectForm } from '@/components/maintenance-projects/project-form';
import { formReturn, returnLabel, editUrl } from '@/lib/form-navigation';
import { workspaceHref } from '@/lib/workspace-navigation';
import type {
    CoverageChoice,
    IntegrationStatus,
    ProjectFormValues,
    ProjectSummary,
} from '@/types/maintenance-projects';

export default function Edit({
    project,
    coverages,
    integration,
}: {
    project: ProjectSummary;
    coverages: CoverageChoice[];
    integration: IntegrationStatus;
}) {
    const page = usePage();
    const cancel = formReturn(
        page.url,
        workspaceHref(`/maintenance-projects/${project.id}`),
        [workspaceHref('/maintenance-projects')],
    );
    const form = useForm<ProjectFormValues>({
        road_coverage_id: String(project.road_coverage_id ?? ''),
        project_title: project.project_title,
        description: project.description ?? '',
    });

    return (
        <>
            <Head title="Edit Project" />
            <ProjectForm
                mode="edit"
                backLabel={returnLabel(cancel, 'Project Details')}
                coverageLocked={project.maintenance_records_count > 0}
                coverages={coverages}
                integration={integration}
                values={form.data}
                errors={form.errors}
                processing={form.processing}
                onChange={(values) => {
                    form.clearErrors();
                    form.setData(values);
                }}
                onSave={() =>
                    form.put(
                        editUrl(
                            workspaceHref(
                                `/maintenance-projects/${project.id}`,
                            ),
                            cancel,
                        ),
                        {
                            preserveScroll: true,
                        },
                    )
                }
                onCancel={() => router.visit(cancel)}
            />
        </>
    );
}

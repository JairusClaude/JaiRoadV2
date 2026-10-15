import { Head, router, useForm } from '@inertiajs/react';
import { ProjectForm } from '@/components/maintenance-projects/project-form';
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
                    form.put(`/maintenance-projects/${project.id}`, {
                        preserveScroll: true,
                    })
                }
                onCancel={() =>
                    router.visit(`/maintenance-projects/${project.id}`)
                }
            />
        </>
    );
}

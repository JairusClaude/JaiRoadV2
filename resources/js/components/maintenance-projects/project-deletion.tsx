import { router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    DeletionCounts,
    DeletionDialog,
} from '@/components/maintenance-projects/deletion-dialog';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { ProjectSummary } from '@/types/maintenance-projects';

export function useProjectDeletion(onDeleted?: () => void) {
    const preview = usePage().props.previewOnly === true;
    const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
    const [bulk, setBulk] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const close = () => {
        if (!processing) {
            setProjects(null);
        }
    };
    const open = (selected: ProjectSummary[], multiple = false) => {
        setError('');
        setBulk(multiple);
        setProjects(selected);
    };
    const confirm = () => {
        if (!projects?.length || processing) {
            return;
        }

        setProcessing(true);
        setError('');
        router.delete(
            bulk
                ? workspaceHref('/maintenance-projects/bulk')
                : workspaceHref(`/maintenance-projects/${projects[0].id}`),
            {
                data: bulk
                    ? { project_ids: projects.map((project) => project.id) }
                    : {},
                preserveScroll: true,
                onError: (errors) =>
                    setError(
                        errors.project_ids ?? Object.values(errors).join(' '),
                    ),
                onSuccess: () => {
                    setProjects(null);
                    onDeleted?.();
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    return { projects, preview, processing, error, open, close, confirm };
}
export function ProjectDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof useProjectDeletion>;
}) {
    const { projects, preview, processing, error, close, confirm } = deletion;
    const count = projects?.length ?? 0;

    return (
        <DeletionDialog
            open={projects !== null}
            title={
                count === 1 ? 'Delete project?' : `Delete ${count} projects?`
            }
            description={
                preview
                    ? `You selected ${count} ${count === 1 ? 'project' : 'projects'}. Its maintenance records, monthly updates, media and maintenance documents will also be deleted. This cannot be undone within the preview. RoadCoverage, LGUs, Engineers and UserAccounts are preserved.`
                    : 'Delete the selected projects? Dependent maintenance data handling is subject to backend validation. This action cannot be undone.'
            }
            processing={processing}
            error={error}
            onClose={close}
            onConfirm={confirm}
            confirmLabel={
                count === 1 ? 'Delete Project' : 'Delete Selected Projects'
            }
        >
            <ul className="jr-delete-list">
                {(projects ?? []).map((project) => (
                    <li key={project.id}>
                        <strong>
                            #{project.id} · {project.project_title}
                        </strong>
                        <DeletionCounts counts={project.deletion_counts} />
                    </li>
                ))}
            </ul>
        </DeletionDialog>
    );
}

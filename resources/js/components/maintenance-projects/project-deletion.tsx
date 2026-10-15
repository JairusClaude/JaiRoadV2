import { router } from '@inertiajs/react';
import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ProjectSummary } from '@/types/maintenance-projects';

export function useProjectDeletion(onDeleted?: () => void) {
    const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
    const [bulk, setBulk] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const blocked =
        projects?.filter((project) => project.maintenance_records_count > 0) ??
        [];
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
        if (!projects?.length || blocked.length || processing) {
            return;
        }

        setProcessing(true);
        setError('');
        router.delete(
            bulk
                ? '/maintenance-projects/bulk'
                : `/maintenance-projects/${projects[0].id}`,
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

    return { projects, blocked, processing, error, open, close, confirm };
}

export function ProjectDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof useProjectDeletion>;
}) {
    const { projects, blocked, processing, error, close, confirm } = deletion;
    const count = projects?.length ?? 0;

    return (
        <Dialog.Root
            open={projects !== null}
            onOpenChange={(open) => {
                if (!open) {
                    close();
                }
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="jr-delete-overlay" />
                <Dialog.Content
                    className="jr-app jr-theme jr-delete-dialog"
                    onEscapeKeyDown={(event) => {
                        if (processing) {
                            event.preventDefault();
                        }
                    }}
                    onPointerDownOutside={(event) => {
                        if (processing) {
                            event.preventDefault();
                        }
                    }}
                >
                    <Dialog.Title>
                        {blocked.length
                            ? 'Projects cannot be deleted'
                            : count === 1
                              ? 'Delete project?'
                              : `Delete ${count} projects?`}
                    </Dialog.Title>
                    <Dialog.Description>
                        {blocked.length
                            ? 'Nothing will be deleted. Remove the projects with maintenance history from your selection and try again.'
                            : `You selected ${count} ${count === 1 ? 'project' : 'projects'}. Deletion cannot be undone. RoadCoverage records will be preserved and become available again.`}
                    </Dialog.Description>
                    <ul className="jr-delete-list">
                        {(blocked.length ? blocked : (projects ?? [])).map(
                            (project) => (
                                <li key={project.id}>
                                    <strong>
                                        #{project.id} · {project.project_title}
                                    </strong>
                                    {project.maintenance_records_count > 0 && (
                                        <span>
                                            {project.maintenance_records_count}{' '}
                                            MaintenanceRecords · maintenance
                                            history must be preserved
                                        </span>
                                    )}
                                </li>
                            ),
                        )}
                    </ul>
                    {error && (
                        <p className="jr-field-error" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="jr-dialog-actions">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={processing}
                            onClick={close}
                        >
                            {blocked.length ? 'Adjust selection' : 'Cancel'}
                        </Button>
                        {blocked.length === 0 && (
                            <Button
                                type="button"
                                className="jr-danger"
                                disabled={processing}
                                onClick={confirm}
                            >
                                {processing
                                    ? 'Deleting…'
                                    : count === 1
                                      ? 'Delete Project'
                                      : 'Delete Selected Projects'}
                            </Button>
                        )}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

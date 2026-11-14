import { router, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
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
    const [impact, setImpact] = useState<{
        project: { id: number; project_title: string };
        road: { id: number; road_name: string };
        counts: {
            maintenance_records: number;
            monthly_updates: number;
            maintenance_documents: number;
            media: number;
        };
        confirmation_token: string;
    } | null>(null);
    const pending = useRef(false);
    const generation = useRef(0);
    const close = () => {
        if (!processing) {
            generation.current++;
            setProjects(null);
        }
    };
    const open = async (selected: ProjectSummary[], multiple = false) => {
        if (pending.current) {
            return;
        }

        const request = ++generation.current;
        setImpact(null);
        setError('');
        setBulk(multiple);
        setProjects(selected);

        if (!preview) {
            if (selected.length > 1 || multiple) {
                const blocked = selected.filter(
                    (p) => (p.maintenance_records_count ?? 0) > 0,
                );
                if (blocked.length > 0) {
                    setError(
                        `Some selected projects have maintenance records and cannot be deleted (${blocked.map((p) => p.project_title).join(', ')}). Only empty projects may be deleted.`,
                    );
                }

                return;
            }

            try {
                const response = await fetch(
                    `/dd-phase3/ui/maintenance-projects/${selected[0].id}/deletion-preview`,
                    {
                        headers: { Accept: 'application/json' },
                        cache: 'no-store',
                    },
                );

                if (!response.ok) {
                    const payload = await response.json().catch(() => null);

                    throw new Error(
                        response.status === 409 &&
                            typeof payload?.message === 'string'
                            ? payload.message
                            : 'Deletion preview is unavailable. Refresh and try again.',
                    );
                }

                const data = await response.json();

                if (request === generation.current) {
                    setImpact(data);
                }
            } catch (reason) {
                if (request === generation.current) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : 'Deletion preview is unavailable. Refresh and try again.',
                    );
                }
            }
        }
    };
    const confirm = async () => {
        if (!projects?.length || processing) {
            return;
        }

        if (!preview) {
            if (pending.current) {
                return;
            }

            pending.current = true;
            setProcessing(true);
            setError('');

            const cookie = document.cookie
                .split('; ')
                .find((v) => v.startsWith('XSRF-TOKEN='));
            const xsrf = cookie ? decodeURIComponent(cookie.slice(11)) : '';

            try {
                if (projects.length === 1 && impact) {
                    const response = await fetch(
                        `/dd-phase3/ui/maintenance-projects/${impact.project.id}`,
                        {
                            method: 'DELETE',
                            headers: {
                                Accept: 'application/json',
                                'Content-Type': 'application/json',
                                'X-XSRF-TOKEN': xsrf,
                            },
                            body: JSON.stringify({
                                confirmation_token: impact.confirmation_token,
                            }),
                        },
                    );
                    const data = await response.json();

                    if (!response.ok || data.state !== 'completed') {
                        setError(
                            data.errors?.confirmation_token?.[0] ??
                                (response.status === 409 &&
                                typeof data.message === 'string'
                                    ? data.message
                                    : 'Project deletion was not confirmed. Refresh the preview and try again.'),
                        );

                        return;
                    }

                    setProjects(null);
                    toast.success(data.message);
                    onDeleted?.();
                    router.visit(workspaceHref('/maintenance-projects'));
                } else {
                    const failed: string[] = [];

                    for (const p of projects) {
                        try {
                            const prevRes = await fetch(
                                `/dd-phase3/ui/maintenance-projects/${p.id}/deletion-preview`,
                                {
                                    headers: { Accept: 'application/json' },
                                    cache: 'no-store',
                                },
                            );
                            if (!prevRes.ok) {
                                const errData = await prevRes
                                    .json()
                                    .catch(() => null);
                                failed.push(
                                    `${p.project_title}: ${errData?.message || 'Deletion preview unavailable'}`,
                                );
                                continue;
                            }
                            const prevData = await prevRes.json();
                            const delRes = await fetch(
                                `/dd-phase3/ui/maintenance-projects/${p.id}`,
                                {
                                    method: 'DELETE',
                                    headers: {
                                        Accept: 'application/json',
                                        'Content-Type': 'application/json',
                                        'X-XSRF-TOKEN': xsrf,
                                    },
                                    body: JSON.stringify({
                                        confirmation_token:
                                            prevData.confirmation_token,
                                    }),
                                },
                            );
                            const delData = await delRes.json();
                            if (!delRes.ok || delData.state !== 'completed') {
                                failed.push(
                                    `${p.project_title}: ${delData.message || 'Deletion failed'}`,
                                );
                            }
                        } catch (err) {
                            failed.push(
                                `${p.project_title}: ${err instanceof Error ? err.message : 'Deletion failed'}`,
                            );
                        }
                    }

                    if (failed.length > 0) {
                        setError(failed.join('; '));
                        return;
                    }

                    setProjects(null);
                    toast.success(
                        `Successfully deleted ${projects.length} projects.`,
                    );
                    onDeleted?.();
                    router.visit(workspaceHref('/maintenance-projects'));
                }
            } catch {
                setError(
                    'Project deletion was not confirmed. Refresh the directory before trying again.',
                );
            } finally {
                pending.current = false;
                setProcessing(false);
            }

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

    return {
        projects,
        preview,
        processing,
        error,
        impact,
        open,
        close,
        confirm,
    };
}
export function ProjectDeletionDialog({
    deletion,
}: {
    deletion: ReturnType<typeof useProjectDeletion>;
}) {
    const { projects, preview, processing, error, impact, close, confirm } =
        deletion;
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
                    : count === 1
                      ? 'Permanently delete this empty project? Projects with MaintenanceRecords cannot be deleted. The road and existing audit history remain. This action cannot be undone.'
                      : `Permanently delete these ${count} empty projects? Projects with MaintenanceRecords cannot be deleted. This action cannot be undone.`
            }
            confirmDisabled={
                (!preview && projects?.length === 1 && !impact) ||
                (!preview &&
                    projects !== null &&
                    projects.some(
                        (p) => (p.maintenance_records_count ?? 0) > 0,
                    ))
            }
            processing={processing}
            error={error}
            onClose={close}
            onConfirm={confirm}
            confirmLabel={
                count === 1 ? 'Delete Project' : `Delete ${count} Projects`
            }
        >
            {!preview && impact && (
                <section aria-label="Project deletion impact">
                    <p>
                        Selected project: #{impact.project.id} ·{' '}
                        {impact.project.project_title}
                    </p>
                    <p>
                        RoadCoverage: #{impact.road.id} ·{' '}
                        {impact.road.road_name} (preserved)
                    </p>
                    <DeletionCounts counts={impact.counts} />
                    <p>
                        No MaintenanceRecords will be detached or deleted.
                        Existing audit history is retained.
                    </p>
                </section>
            )}
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

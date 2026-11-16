import { router, usePage } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { DeletionCounts, DeletionDialog } from '@/components/maintenance-projects/deletion-dialog';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { DependentCounts, ProjectSummary } from '@/types/maintenance-projects';

type Impact = {
    project: { id: number; project_title: string };
    road: { id: number; road_name: string };
    counts: DependentCounts;
    confirmation_token: string;
    can_delete: boolean;
};

export function useProjectDeletion(onDeleted?: () => void) {
    const preview = usePage().props.previewOnly === true;
    const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
    const [bulk, setBulk] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [impacts, setImpacts] = useState<Impact[]>([]);
    const [reviewing, setReviewing] = useState(false);
    const pending = useRef(false);
    const generation = useRef(0);
    const close = () => {
        if (!pending.current) {
            generation.current++;
            setProjects(null);
        }
    };
    const open = async (selected: ProjectSummary[], multiple = false) => {
        if (pending.current || selected.length === 0) return;
        const request = ++generation.current;
        setImpacts([]);
        setError('');
        setBulk(multiple);
        setProjects(selected);
        if (preview) return;
        setReviewing(true);
        try {
            const reviewed = await Promise.all(selected.map(async (project) => {
                const response = await fetch(`/dd-phase3/ui/maintenance-projects/${project.id}/deletion-preview`, {
                    headers: { Accept: 'application/json' }, cache: 'no-store',
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Deletion preview unavailable.');
                return data as Impact;
            }));
            if (request !== generation.current) return;
            setImpacts(reviewed);
            if (reviewed.some((item) => !item.can_delete)) {
                setError('Private file deletion is temporarily unavailable. No deletion has started.');
            }
        } catch (reason) {
            if (request === generation.current) setError(reason instanceof Error ? reason.message : 'Deletion preview unavailable.');
        } finally {
            if (request === generation.current) setReviewing(false);
        }
    };
    const confirm = async () => {
        if (!projects?.length || pending.current || reviewing ||
            (!preview && (impacts.length !== projects.length || impacts.some((item) => !item.can_delete)))) return;
        pending.current = true;
        setProcessing(true);
        setError('');
        if (preview) {
            router.delete(bulk ? workspaceHref('/maintenance-projects/bulk') : workspaceHref(`/maintenance-projects/${projects[0].id}`), {
                data: bulk ? { project_ids: projects.map((p) => p.id) } : {},
                onError: (errors) => setError(Object.values(errors).join(' ')),
                onSuccess: () => { setProjects(null); onDeleted?.(); },
                onFinish: () => { pending.current = false; setProcessing(false); },
            });
            return;
        }
        const cookie = document.cookie.split('; ').find((value) => value.startsWith('XSRF-TOKEN='));
        const xsrf = cookie ? decodeURIComponent(cookie.slice(11)) : '';
        const completed: number[] = [];
        try {
            for (const impact of impacts) {
                try {
                    const response = await fetch(`/dd-phase3/ui/maintenance-projects/${impact.project.id}`, {
                        method: 'DELETE',
                        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
                        body: JSON.stringify({ confirmation_token: impact.confirmation_token, confirmation: 'YES' }),
                    });
                    const data = await response.json();
                    if (!response.ok || data.state !== 'completed') {
                        throw new Error(data.errors?.confirmation_token?.[0] ?? data.errors?.file?.[0] ?? data.message ?? 'Deletion not confirmed.');
                    }
                    completed.push(impact.project.id);
                } catch (reason) {
                    setError(`${completed.length} project(s) deleted. ${impact.project.project_title}: ${reason instanceof Error ? reason.message : 'Deletion not confirmed.'} Close and refresh the page to review remaining data.`);
                    setImpacts([]);
                    return;
                }
            }
            setProjects(null);
            toast.success(`Successfully deleted ${completed.length} project(s).`);
            onDeleted?.();
            router.visit(workspaceHref('/maintenance-projects'));
        } finally {
            pending.current = false;
            setProcessing(false);
        }
    };
    return { projects, preview, processing, reviewing, error, impacts, open, close, confirm };
}

export function ProjectDeletionDialog({ deletion }: { deletion: ReturnType<typeof useProjectDeletion> }) {
    const { projects, preview, processing, reviewing, error, impacts, close, confirm } = deletion;
    const count = projects?.length ?? 0;
    return (
        <DeletionDialog
            requireYes
            open={projects !== null}
            title={count === 1 ? 'Delete project?' : `Delete ${count} projects?`}
            description="Permanently delete the selected projects, their maintenance records, monthly updates, documents and private media. This cannot be undone. Road coverages, LGUs, engineers, user accounts and audit history remain."
            confirmDisabled={!preview && (reviewing || impacts.length !== count || impacts.some((item) => !item.can_delete))}
            processing={processing}
            error={error}
            onClose={close}
            onConfirm={confirm}
            confirmLabel={count === 1 ? 'Delete Project' : `Delete ${count} Projects`}
        >
            {reviewing && <p role="status">Reviewing affected records and files…</p>}
            <ul className="jr-delete-list">
                {(projects ?? []).map((project) => {
                    const impact = impacts.find((item) => item.project.id === project.id);
                    return (
                        <li key={project.id}>
                            <strong>#{project.id} · {project.project_title}</strong>
                            {impact && <p>RoadCoverage: #{impact.road.id} · {impact.road.road_name} (preserved)</p>}
                            <DeletionCounts counts={impact?.counts ?? (preview ? project.deletion_counts : undefined)} />
                        </li>
                    );
                })}
            </ul>
        </DeletionDialog>
    );
}

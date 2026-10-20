import { Head, router, usePage } from '@inertiajs/react';
import {
    ProjectDeletionDialog,
    useProjectDeletion,
} from '@/components/maintenance-projects/project-deletion';
import { ProjectDirectory } from '@/components/maintenance-projects/project-directory';
import type { DirectoryProps } from '@/components/maintenance-projects/project-directory';
import ViewerProjectDirectory from '@/components/maintenance-projects/viewer-project-directory';

export default function Index(
    props: Omit<DirectoryProps, 'onFilters' | 'onNavigate' | 'onDelete'>,
) {
    const deletion = useProjectDeletion();
    const { jairoadsIdentity } = usePage<{
        jairoadsIdentity?: { role?: string } | null;
    }>().props;
    const viewer = jairoadsIdentity?.role === 'viewer';

    return (
        <>
            <Head title="Maintenance Projects" />
            {viewer ? (
                <ViewerProjectDirectory {...props} />
            ) : (
                <ProjectDirectory
                    {...props}
                    key={`${props.projects.current_page}:${JSON.stringify(props.filters)}:${props.projects.data.map((project) => project.id).join(',')}`}
                    onDelete={deletion.open}
                    onFilters={(filters) =>
                        router.get('/maintenance-projects', filters, {
                            preserveState: false,
                            preserveScroll: true,
                            replace: true,
                        })
                    }
                    onNavigate={(url) => router.visit(url)}
                />
            )}
            {!viewer && <ProjectDeletionDialog deletion={deletion} />}
        </>
    );
}

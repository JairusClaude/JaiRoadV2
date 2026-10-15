import { Head, router } from '@inertiajs/react';
import {
    ProjectDeletionDialog,
    useProjectDeletion,
} from '@/components/maintenance-projects/project-deletion';
import { ProjectDirectory } from '@/components/maintenance-projects/project-directory';
import type { DirectoryProps } from '@/components/maintenance-projects/project-directory';

export default function Index(
    props: Omit<DirectoryProps, 'onFilters' | 'onNavigate' | 'onDelete'>,
) {
    const deletion = useProjectDeletion();

    return (
        <>
            <Head title="Maintenance Projects" />
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
            <ProjectDeletionDialog deletion={deletion} />
        </>
    );
}

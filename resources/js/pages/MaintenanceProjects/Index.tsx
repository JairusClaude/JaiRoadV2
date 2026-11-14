import { Head, router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import {
    ProjectDeletionDialog,
    useProjectDeletion,
} from '@/components/maintenance-projects/project-deletion';
import { ProjectDirectory } from '@/components/maintenance-projects/project-directory';
import type { DirectoryProps } from '@/components/maintenance-projects/project-directory';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { ProjectFilters } from '@/types/maintenance-projects';

export default function Index(
    props: Omit<
        DirectoryProps,
        'onFilters' | 'onNavigate' | 'onDelete' | 'onSearch'
    >,
) {
    const deletion = useProjectDeletion();
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const request = useRef<{ cancel: () => void } | null>(null);
    const cancel = () => {
        clearTimeout(timer.current);
        request.current?.cancel();
    };
    useEffect(
        () => () => {
            clearTimeout(timer.current);
            request.current?.cancel();
        },
        [],
    );
    const filter = (filters: ProjectFilters) => {
        cancel();
        router.get(
            workspaceHref('/maintenance-projects'),
            { ...filters, page: 1 },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onCancelToken: (token) => {
                    request.current = token;
                },
            },
        );
    };

    return (
        <div className="jr-directory-exploration">
            <Head title="Maintenance Projects" />
            <ProjectDirectory
                {...props}
                onDelete={deletion.open}
                onFilters={filter}
                onSearch={(search) => {
                    cancel();
                    timer.current = setTimeout(
                        () => filter({ ...props.filters, search }),
                        250,
                    );
                }}
                onNavigate={(url) => {
                    cancel();
                    router.visit(url);
                }}
            />
            <ProjectDeletionDialog deletion={deletion} />
        </div>
    );
}

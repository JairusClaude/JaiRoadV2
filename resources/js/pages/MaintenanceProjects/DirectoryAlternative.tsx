import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import {
    alternativeDirectoryFor,
    alternativeDirectoryUrl,
} from '@/components/maintenance-projects/alternative-navigation';
import {
    ProjectDeletionDialog,
    useProjectDeletion,
} from '@/components/maintenance-projects/project-deletion';
import { ProjectDirectory } from '@/components/maintenance-projects/project-directory';
import type { DirectoryProps } from '@/components/maintenance-projects/project-directory';
import type { ProjectFilters } from '@/types/maintenance-projects';
import '../../../css/maintenance-projects-exploration.css';

import '../../../css/maintenance-projects-espresso-sidebar.css';

// An isolated visual alternative. The approved directory supplies all table,
// selection, permission, and action behavior without a second implementation.
export default function DirectoryAlternative(
    props: Omit<
        DirectoryProps,
        'onFilters' | 'onNavigate' | 'onDelete' | 'onSearch'
    >,
) {
    const espresso = usePage().props.sidebarTheme === 'espresso';
    const directoryUrl = alternativeDirectoryFor(
        espresso ? 'espresso' : undefined,
    );
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
            directoryUrl,
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
        <div
            className={
                espresso
                    ? 'jr-directory-exploration jr-espresso-exploration'
                    : 'jr-directory-exploration'
            }
        >
            <Head title="Maintenance Projects · Design exploration" />
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
                    // Pagination stays in the alternative; Add, Details and
                    // Edit continue using their existing approved pages.
                    router.visit(
                        url.replace(
                            /^\/maintenance-projects(?=\?|$)/,
                            directoryUrl,
                        ),
                    );
                }}
            />
            <p className="jr-exploration-version">
                <span>
                    {espresso
                        ? 'Espresso sidebar exploration'
                        : 'Alternative design preview'}
                </span>
                {espresso && (
                    <Link href={alternativeDirectoryUrl}>
                        Return to preserved light alternative
                    </Link>
                )}
                <Link href="/maintenance-projects">
                    View original directory
                </Link>
            </p>
            <ProjectDeletionDialog deletion={deletion} />
        </div>
    );
}

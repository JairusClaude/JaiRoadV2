// The original Maintenance Projects form/directory styles were formerly imported by
// MaintenanceProjectLayout. The shared role layout no longer imports them.
// Load them with the project content so the original two-column selector/map and
// form grid are restored without replacing the Admin/Engineer/Viewer shell.
import '../../../css/maintenance-projects.css';
import '../../../css/jairoads-settings-theme.css';
import '../../../css/jairoads-module-content.css';
import { usePage } from '@inertiajs/react';
import { AlertCircle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type {
    IntegrationStatus,
    ProjectSummary,
} from '@/types/maintenance-projects';

export function ProjectWorkspace({
    children,
    className = '',
}: {
    children: ReactNode;
    className?: string;
}) {
    const canonical = usePage().props.canonicalFrontend === true;

    if (canonical) {
        return <div className={`jr-workspace ${className}`}>{children}</div>;
    }

    return (
        // The original styles are scoped beneath .jr-app and .jr-theme.
        // Apply that context to content ONLY; do not nest another sidebar.
        <section
            className={`jr-app jr-theme jr-module-content w-full min-w-0 ${className}`}
            style={{ display: 'block', minHeight: 0 }}
        >
            <div className="jr-workspace w-full min-w-0">{children}</div>
        </section>
    );
}

export function IntegrationNotice({
    integration,
}: {
    integration: IntegrationStatus;
}) {
    if (integration.ready) {
        return null;
    }

    return (
        <div className="jr-notice" role="status">
            <AlertCircle className="size-4 shrink-0" />
            <p>{integration.message}</p>
        </div>
    );
}

export function ProjectActions({
    project,
    onEdit,
    onDelete,
}: {
    project: ProjectSummary;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="jr-action-trigger"
                    aria-label={`Actions for ${project.project_title}`}
                    onClick={(event) => event.stopPropagation()}
                >
                    <MoreHorizontal className="size-[18px]" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="jr-theme jr-menu"
                align="end"
                onClick={(event) => event.stopPropagation()}
            >
                <DropdownMenuItem
                    disabled={!project.can_edit}
                    onSelect={onEdit}
                >
                    <Pencil /> Edit Project
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={!project.can_delete}
                    onSelect={onDelete}
                >
                    <Trash2 /> Delete Project
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

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

export function ProjectWorkspace({ children }: { children: ReactNode }) {
    return <div className="jr-workspace">{children}</div>;
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

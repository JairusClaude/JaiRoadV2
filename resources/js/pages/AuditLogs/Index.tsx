import { Head, router } from '@inertiajs/react';
import {
    Activity,
    Calendar,
    Eye,
    FileText,
    History,
    Search,
    Shield,
    User,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    DirectoryFilter,
    DirectoryPagination,
} from '@/components/directory-controls';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { workspaceHref } from '@/lib/workspace-navigation';
import '../../../css/maintenance-documents.css';
import '../../../css/maintenance-projects-exploration.css';

export type AuditEvent = {
    id: number;
    actor_identifier: string;
    action: string;
    entity_type: string;
    entity_id: number | null;
    description: string;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    recipient_user_id?: number | null;
    notification_message?: string | null;
    created_at: string;
};

export type AuditLogsProps = {
    events: {
        data: AuditEvent[];
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
        total: number;
    };
    filters: {
        search: string;
        action: string;
        sort: string;
    };
};

const ACTION_OPTIONS = [
    { value: 'all', label: 'All Actions' },
    { value: 'CREATE', label: 'Create' },
    { value: 'UPDATE', label: 'Update' },
    { value: 'DELETE', label: 'Delete' },
    { value: 'LOGIN', label: 'Login' },
    { value: 'UPLOAD', label: 'Upload' },
];

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
];

function actionVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    switch (action.toUpperCase()) {
        case 'CREATE':
        case 'UPLOAD':
            return 'default';
        case 'DELETE':
            return 'destructive';
        case 'UPDATE':
            return 'secondary';
        default:
            return 'outline';
    }
}

function formatDate(iso: string): string {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return new Intl.DateTimeFormat('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(d);
    } catch {
        return iso;
    }
}

export default function Index({ events, filters }: AuditLogsProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        setSearch(filters.search || '');
    }, [filters.search]);

    const navigate = (nextFilters: Partial<typeof filters>, page = 1) => {
        clearTimeout(timer.current);
        router.get(
            workspaceHref('/audit-logs'),
            {
                ...filters,
                ...nextFilters,
                page,
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            },
        );
    };

    const handleSearchChange = (value: string) => {
        setSearch(value);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            navigate({ search: value }, 1);
        }, 300);
    };

    return (
        <div className="jr-module-content">
            <Head title="Audit Log" />
            <ProjectWorkspace>
                <div className="jr-page-head">
                    <div>
                        <h1>Audit Log</h1>
                        <p>
                            Review permanent system audit history, authentication events, and operational activity trails.
                        </p>
                    </div>
                </div>

                <div className="jr-directory-controls">
                    <div className="jr-search">
                        <Search className="size-[18px]" />
                        <Input
                            type="search"
                            placeholder="Search description, actor, or entity..."
                            aria-label="Search audit log"
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                        />
                    </div>
                    <div className="jr-filters">
                        <DirectoryFilter
                            label="Filter by action"
                            value={filters.action || 'all'}
                            options={ACTION_OPTIONS}
                            onChange={(val) => navigate({ action: val }, 1)}
                            className="w-[150px]"
                        />
                        <DirectoryFilter
                            label="Sort audit log"
                            value={filters.sort || 'newest'}
                            options={SORT_OPTIONS}
                            onChange={(val) => navigate({ sort: val }, 1)}
                            className="w-[140px]"
                        />
                    </div>
                </div>

                <section
                    className="jr-documents-panel mt-4"
                    aria-label="Audit log records"
                >
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-[#e6e9ef] text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    <th className="px-4 py-3">Event ID</th>
                                    <th className="px-4 py-3">Timestamp</th>
                                    <th className="px-4 py-3">Action</th>
                                    <th className="px-4 py-3">Entity</th>
                                    <th className="px-4 py-3">Actor</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#f1f3f7]">
                                {events.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-12 text-center text-slate-500"
                                        >
                                            <History className="mx-auto mb-2 size-8 text-slate-400" />
                                            <p className="font-medium text-slate-700">
                                                No audit log entries found
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {search || filters.action !== 'all'
                                                    ? 'Try clearing your search or filters to see more results.'
                                                    : 'Audit records will appear here as users perform actions in the system.'}
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    events.data.map((event) => (
                                        <tr
                                            key={event.id}
                                            className="hover:bg-slate-50/80 transition-colors"
                                        >
                                            <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-600">
                                                #{event.id}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                                                {formatDate(event.created_at)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <Badge
                                                    variant={actionVariant(event.action)}
                                                    className="text-[11px] font-semibold"
                                                >
                                                    {event.action}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-slate-700">
                                                {event.entity_type}
                                                {event.entity_id !== null && (
                                                    <span className="text-slate-400 ml-1">
                                                        #{event.entity_id}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-700">
                                                <span className="inline-flex items-center gap-1.5 font-medium">
                                                    <User className="size-3.5 text-slate-400" />
                                                    {event.actor_identifier || 'System'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={event.description}>
                                                {event.description}
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 px-2.5 text-xs text-[#843b12] hover:bg-[#843b12]/10 hover:text-[#843b12]"
                                                    onClick={() => setSelectedEvent(event)}
                                                >
                                                    <Eye className="size-3.5 mr-1" />
                                                    View
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <DirectoryPagination
                        total={events.total}
                        from={events.from}
                        to={events.to}
                        currentPage={events.current_page}
                        lastPage={events.last_page}
                        plural="audit events"
                        label="Audit log pagination"
                        onPage={(p) => navigate({}, p)}
                    />
                </section>
            </ProjectWorkspace>

            {/* Event Detail Modal */}
            <Dialog
                open={selectedEvent !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedEvent(null);
                }}
            >
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Shield className="size-5 text-[#843b12]" />
                            Audit Event #{selectedEvent?.id}
                        </DialogTitle>
                        <DialogDescription>
                            Full event payload and historical state change.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEvent && (
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200">
                                <div>
                                    <span className="text-xs text-slate-500 block">Action</span>
                                    <Badge variant={actionVariant(selectedEvent.action)}>
                                        {selectedEvent.action}
                                    </Badge>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 block">Timestamp</span>
                                    <span className="font-medium">{formatDate(selectedEvent.created_at)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 block">Entity</span>
                                    <span className="font-medium">
                                        {selectedEvent.entity_type} {selectedEvent.entity_id ? `#${selectedEvent.entity_id}` : ''}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 block">Actor</span>
                                    <span className="font-medium">{selectedEvent.actor_identifier}</span>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-slate-700 uppercase mb-1">Description</h4>
                                <p className="text-slate-700 bg-slate-50 rounded p-2.5 border border-slate-200 text-xs">
                                    {selectedEvent.description}
                                </p>
                            </div>

                            {(selectedEvent.old_value || selectedEvent.new_value) && (
                                <div className="grid md:grid-cols-2 gap-3">
                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-600 mb-1">Previous State (Before)</h4>
                                        <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-48 font-mono">
                                            {selectedEvent.old_value
                                                ? JSON.stringify(selectedEvent.old_value, null, 2)
                                                : 'null (None / Created)'}
                                        </pre>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-semibold text-slate-600 mb-1">New State (After)</h4>
                                        <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-48 font-mono">
                                            {selectedEvent.new_value
                                                ? JSON.stringify(selectedEvent.new_value, null, 2)
                                                : 'null (Deleted)'}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

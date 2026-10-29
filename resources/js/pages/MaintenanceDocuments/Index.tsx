import { Head, Link, router, usePage } from '@inertiajs/react';
import { MoreHorizontal, Pencil, Search, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    DirectoryFilter,
    DirectoryPagination,
    DirectorySelectionToolbar,
} from '@/components/directory-controls';
import {
    DocumentDeletionDialog,
    useDocumentDeletion,
} from '@/components/maintenance-documents/document-deletion';
import { DocumentIcon } from '@/components/maintenance-documents/document-file';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { MonthlyProjectFilter } from '@/components/monthly-updates/project-filter';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { editUrl } from '@/lib/form-navigation';
import { documentDate } from '@/lib/maintenance-documents';
import type {
    DocumentDirectoryProps,
    DocumentFilters,
} from '@/types/maintenance-documents';
export default function Index({
    documents,
    projects,
    filters,
}: DocumentDirectoryProps) {
    const page = usePage();
    const enabled = page.props.previewOnly === true;
    const deletion = useDocumentDeletion();
    const [search, setSearch] = useState(filters.search);
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const request = useRef<{ cancel: () => void } | null>(null);
    useEffect(
        () => () => {
            clearTimeout(timer.current);
            request.current?.cancel();
        },
        [],
    );
    const scope = JSON.stringify([
        documents.current_page,
        documents.data.map((d) => d.id),
        filters,
    ]);
    const [previousScope, setPreviousScope] = useState(scope);

    if (scope !== previousScope) {
        setPreviousScope(scope);
        setSelected(new Set());
        setSelecting(false);
    }

    const visit = (next: DocumentFilters, current = 1) => {
        clearTimeout(timer.current);
        request.current?.cancel();
        router.get(
            '/maintenance-documents',
            { ...next, page: current },
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
    const toggle = (id: number) =>
        setSelected((old) => {
            const next = new Set(old);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });

    return (
        <div className="jr-directory-exploration">
            <Head title="Maintenance Documents" />
            <ProjectWorkspace>
                <div className="jr-page-head">
                    <div>
                        <h1>Maintenance Documents</h1>
                        <p>
                            Browse and manage documents associated with
                            maintenance records.
                        </p>
                    </div>
                    <Button
                        className="jr-primary"
                        disabled={!enabled}
                        onClick={() =>
                            router.visit(
                                editUrl(
                                    '/maintenance-documents/create',
                                    page.url,
                                ),
                            )
                        }
                    >
                        <Upload />
                        Upload Document
                    </Button>
                </div>
                <form
                    className="jr-filters"
                    onSubmit={(e) => {
                        e.preventDefault();
                        visit({ ...filters, search });
                    }}
                >
                    <div className="jr-search">
                        <Search className="size-[18px]" />
                        <Input
                            type="search"
                            aria-label="Search documents"
                            placeholder="Search document titles or filenames..."
                            value={search}
                            onChange={(e) => {
                                const value = e.target.value;
                                setSearch(value);
                                clearTimeout(timer.current);
                                request.current?.cancel();
                                timer.current = setTimeout(
                                    () => visit({ ...filters, search: value }),
                                    250,
                                );
                            }}
                        />
                    </div>
                    <div className="jr-filter-row">
                        <MonthlyProjectFilter
                            projects={projects}
                            value={filters.project}
                            onChange={(project) =>
                                visit({ ...filters, search, project })
                            }
                        />
                        <DirectoryFilter
                            label="Sort documents"
                            value={filters.sort}
                            options={[
                                { value: 'newest', label: 'Newest First' },
                                { value: 'oldest', label: 'Oldest First' },
                            ]}
                            onChange={(sort) =>
                                visit({
                                    ...filters,
                                    search,
                                    sort: sort as DocumentFilters['sort'],
                                })
                            }
                        />
                    </div>
                </form>
                <DirectorySelectionToolbar
                    selecting={selecting}
                    selectedCount={selected.size}
                    total={documents.total}
                    singular="document"
                    plural="documents"
                    canDelete={enabled}
                    disabled={deletion.processing || !enabled}
                    onSelect={() => setSelecting(true)}
                    onCancel={() => {
                        setSelecting(false);
                        setSelected(new Set());
                    }}
                    onDelete={() =>
                        deletion.open(
                            documents.data.filter((d) => selected.has(d.id)),
                        )
                    }
                />
                <div
                    className="jr-table-wrap"
                    role="region"
                    aria-label="Maintenance documents table"
                    tabIndex={0}
                >
                    <table className="jr-table jr-document-table">
                        <colgroup>
                            {[27, 24, 16, 12, 14, 7].map((width, i) => (
                                <col key={i} style={{ width: `${width}%` }} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr>
                                <th>
                                    <div className="jr-project-line">
                                        {selecting && (
                                            <Checkbox
                                                aria-label="Select all documents on this page"
                                                checked={
                                                    documents.data.length > 0 &&
                                                    documents.data.every((d) =>
                                                        selected.has(d.id),
                                                    )
                                                        ? true
                                                        : selected.size
                                                          ? 'indeterminate'
                                                          : false
                                                }
                                                onCheckedChange={(checked) =>
                                                    setSelected(
                                                        checked
                                                            ? new Set(
                                                                  documents.data.map(
                                                                      (d) =>
                                                                          d.id,
                                                                  ),
                                                              )
                                                            : new Set(),
                                                    )
                                                }
                                            />
                                        )}
                                        Document
                                    </div>
                                </th>
                                <th>Maintenance Project</th>
                                <th>Maintenance Record</th>
                                <th>Uploaded By</th>
                                <th>Date Uploaded</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.data.map((doc) => (
                                <tr
                                    key={doc.id}
                                    data-document-id={doc.id}
                                    data-selected={selected.has(doc.id)}
                                    onClick={() =>
                                        selecting
                                            ? toggle(doc.id)
                                            : router.visit(
                                                  `/maintenance-documents/${doc.id}`,
                                              )
                                    }
                                >
                                    <td>
                                        <div className="jr-project-line">
                                            {selecting && (
                                                <Checkbox
                                                    aria-label={`Select document ${doc.id}`}
                                                    checked={selected.has(
                                                        doc.id,
                                                    )}
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                    onCheckedChange={() =>
                                                        toggle(doc.id)
                                                    }
                                                />
                                            )}
                                            <DocumentIcon
                                                name={doc.file_name}
                                            />
                                            <div className="min-w-0">
                                                <Link
                                                    className="jr-project-title jr-document-title"
                                                    href={`/maintenance-documents/${doc.id}`}
                                                    title={doc.document_title}
                                                    onClick={(e) => {
                                                        e.stopPropagation();

                                                        if (selecting) {
                                                            e.preventDefault();
                                                            toggle(doc.id);
                                                        }
                                                    }}
                                                >
                                                    {doc.document_title}
                                                </Link>
                                                <div
                                                    className="jr-project-id truncate"
                                                    title={doc.file_name}
                                                >
                                                    {doc.file_name}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>{doc.project.project_title}</td>
                                    <td>
                                        {doc.record.quarter} {doc.record.year}
                                    </td>
                                    <td>{doc.uploaded_by}</td>
                                    <td>{documentDate(doc.uploaded_at)}</td>
                                    <td
                                        className="text-right"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {!selecting && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="jr-action-trigger"
                                                        aria-label={`Actions for document ${doc.id}`}
                                                    >
                                                        <MoreHorizontal />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="jr-theme jr-menu"
                                                >
                                                    <DropdownMenuItem
                                                        disabled={!enabled}
                                                        onSelect={() =>
                                                            router.visit(
                                                                editUrl(
                                                                    `/maintenance-documents/${doc.id}/edit`,
                                                                    page.url,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        <Pencil />
                                                        Edit Maintenance
                                                        Document
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={!enabled}
                                                        onSelect={() =>
                                                            deletion.open([doc])
                                                        }
                                                    >
                                                        <Trash2 />
                                                        Delete Maintenance
                                                        Document
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!documents.data.length && (
                        <div className="jr-empty">
                            <strong>
                                {filters.search || filters.project
                                    ? 'No matching documents.'
                                    : 'No maintenance documents yet.'}
                            </strong>
                            <p>
                                {filters.search || filters.project
                                    ? 'Try another search or project.'
                                    : 'Upload a document associated with a Maintenance Record.'}
                            </p>
                            {(filters.search || filters.project) && (
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSearch('');
                                        visit({
                                            search: '',
                                            project: '',
                                            sort: 'newest',
                                        });
                                    }}
                                >
                                    Clear filters
                                </Button>
                            )}
                        </div>
                    )}
                </div>
                <DirectoryPagination
                    total={documents.total}
                    from={documents.from}
                    to={documents.to}
                    currentPage={documents.current_page}
                    lastPage={documents.last_page}
                    plural="documents"
                    label="Document pagination"
                    onPage={(current) => visit({ ...filters, search }, current)}
                />
            </ProjectWorkspace>
            <DocumentDeletionDialog deletion={deletion} />
        </div>
    );
}

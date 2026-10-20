import {
    Check,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileArchive,
    FileCheck2,
    FilePlus2,
    FileSpreadsheet,
    FileText,
    FileType2,
    FolderOpen,
    HardHat,
    Info,
    MoreHorizontal,
    Plus,
    Search,
    ShieldAlert,
    SlidersHorizontal,
    UploadCloud,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

/**
 * UI label: Project Documents. Data-dictionary entity: MaintenanceDocument.
 * Its parent is ALWAYS MaintenanceRecord, not MaintenanceProject.
 * This screen is a read-only backend preview with optional in-memory drafts.
 */
export type MaintenanceDocumentSummary = {
    id: number;
    maintenanceRecordId: number;
    title: string;
    description: string | null;
    fileName: string;
    uploadedBy: string;
    uploadedAt: string | null;
    localDraft?: boolean;
};
export type MaintenanceRecordOption = {
    id: number;
    projectTitle: string;
    year: number | null;
    quarter: string | null;
    status: string;
};
export type ProjectDocumentsPageProps = {
    initialDocuments?: MaintenanceDocumentSummary[];
    maintenanceRecords?: MaintenanceRecordOption[];
    schemaNotice?: string | null;
    canDraft?: boolean;
};

type Tab = 'documents' | 'guidelines';
const primary =
    'jr-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50';
const neutral =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm font-medium text-[#405572] transition hover:bg-[#F8FAFD] disabled:cursor-not-allowed disabled:opacity-50';
const input =
    'w-full rounded-xl border border-[#DEE5EF] bg-white px-3.5 py-2.5 text-sm text-[#20324A] outline-none placeholder:text-[#99A7BA] focus:border-[#A95F37] focus:ring-2 focus:ring-[#F6E6DA]';
const allowedExtensions = ['pdf', 'docx', 'xlsx', 'pptx'];
const rowsPerPage = 8;

function fileExtension(name: string) {
    return name.includes('.')
        ? (name.split('.').pop() || '').toLowerCase()
        : '';
}
function prettyDate(value: string | null) {
    if (!value) {
        return 'Not recorded';
    }

    const date = new Date(value.replace(' ', 'T'));

    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          }).format(date);
}
function FileIcon({ name }: { name: string }) {
    const extension = fileExtension(name);

    if (extension === 'xlsx' || extension === 'xls') {
        return <FileSpreadsheet className="size-5 text-[#26936A]" />;
    }

    if (extension === 'pptx' || extension === 'ppt') {
        return <FileArchive className="size-5 text-[#CA7B34]" />;
    }

    if (extension === 'docx' || extension === 'doc') {
        return <FileType2 className="size-5 text-[#4974B0]" />;
    }

    return <FileText className="size-5 text-[#A25331]" />;
}
function Notice({
    children,
    warning = false,
}: {
    children: ReactNode;
    warning?: boolean;
}) {
    return (
        <div
            role="status"
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-6 ${warning ? 'border-[#F1D9C9] bg-[#FFF9F5] text-[#985330]' : 'border-[#DEE7F1] bg-[#F7FAFD] text-[#506885]'}`}
        >
            {warning ? (
                <ShieldAlert className="mt-1 size-4 shrink-0" />
            ) : (
                <Info className="mt-1 size-4 shrink-0" />
            )}
            <div>{children}</div>
        </div>
    );
}
function Stat({
    label,
    value,
    icon: Icon,
    accent,
}: {
    label: string;
    value: number;
    icon: typeof FileText;
    accent: string;
}) {
    return (
        <div className="flex min-w-0 items-center justify-between rounded-2xl border border-[#E4EAF2] bg-[#FCFDFE] px-4 py-4">
            <div>
                <p className="text-xs font-medium text-[#8294AE]">{label}</p>
                <strong className="mt-1 block text-2xl font-semibold text-[#192A41]">
                    {value}
                </strong>
            </div>
            <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${accent}`}
            >
                <Icon className="size-5" />
            </span>
        </div>
    );
}
function Modal({
    titleId,
    onClose,
    children,
}: {
    titleId: string;
    onClose: () => void;
    children: ReactNode;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#162438]/55 px-4 py-6"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            >
                {children}
            </section>
        </div>
    );
}

export default function ProjectDocumentsPage({
    initialDocuments = [],
    maintenanceRecords = [],
    schemaNotice = null,
    canDraft = false,
}: ProjectDocumentsPageProps) {
    const [drafts, setDrafts] = useState<MaintenanceDocumentSummary[]>([]);
    const [tab, setTab] = useState<Tab>('documents');
    const [search, setSearch] = useState('');
    const [recordFilter, setRecordFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [addOpen, setAddOpen] = useState(false);
    const [details, setDetails] = useState<MaintenanceDocumentSummary | null>(
        null,
    );
    const [recordId, setRecordId] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const recordsById = useMemo(
        () => new Map(maintenanceRecords.map((record) => [record.id, record])),
        [maintenanceRecords],
    );
    const docs = useMemo(
        () =>
            [...drafts, ...initialDocuments].sort(
                (a, b) =>
                    Number(Boolean(b.localDraft)) -
                        Number(Boolean(a.localDraft)) || b.id - a.id,
            ),
        [drafts, initialDocuments],
    );
    const recordLabel = (id: number) => {
        const record = recordsById.get(id);

        return record
            ? `${record.projectTitle} · ${record.year ?? 'Year TBD'} ${record.quarter || ''}`.trim()
            : `Maintenance Record #${id}`;
    };
    const filtered = docs.filter((document) => {
        const query = search.trim().toLowerCase();

        return (
            (!query ||
                `${document.title} ${document.fileName} ${document.description ?? ''} ${document.uploadedBy} ${document.maintenanceRecordId} ${recordLabel(document.maintenanceRecordId)}`
                    .toLowerCase()
                    .includes(query)) &&
            (recordFilter === 'all' ||
                String(document.maintenanceRecordId) === recordFilter) &&
            (typeFilter === 'all' ||
                fileExtension(document.fileName) === typeFilter)
        );
    });
    const lastPage = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    const activePage = Math.min(page, lastPage);
    const visible = filtered.slice(
        (activePage - 1) * rowsPerPage,
        activePage * rowsPerPage,
    );
    const resetPage = () => setPage(1);
    const recordCount = new Set(
        docs.map((document) => document.maintenanceRecordId),
    ).size;
    const allFiles = new Set(
        docs.map((document) => fileExtension(document.fileName)),
    ).size;

    function openDraft() {
        setRecordId(
            maintenanceRecords.length ? String(maintenanceRecords[0].id) : '',
        );
        setTitle('');
        setDescription('');
        setFileName('');
        setError('');
        setAddOpen(true);
    }
    function submitDraft(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const id = Number(recordId);

        if (!maintenanceRecords.some((record) => record.id === id)) {
            setError('Select an existing Maintenance Record.');

            return;
        }

        if (!title.trim()) {
            setError('Enter a document title.');

            return;
        }

        if (title.trim().length > 255) {
            setError('Document titles cannot exceed 255 characters.');

            return;
        }

        if (!fileName) {
            setError('Choose a document file.');

            return;
        }

        if (!allowedExtensions.includes(fileExtension(fileName))) {
            setError(
                'For this prototype, use a PDF, DOCX, XLSX, or PPTX file.',
            );

            return;
        }

        setDrafts((previous) => [
            {
                id: -Date.now(),
                maintenanceRecordId: id,
                title: title.trim(),
                description: description.trim() || null,
                fileName,
                uploadedBy: 'Local preview',
                uploadedAt: new Date().toISOString(),
                localDraft: true,
            },
            ...previous,
        ]);
        setAddOpen(false);
        setSearch('');
        setRecordFilter('all');
        setTypeFilter('all');
        resetPage();
        setTab('documents');
        setMessage(
            'Local document draft added. The file was NOT uploaded and Supabase was NOT changed.',
        );
    }

    return (
        <ProjectWorkspace>
            <div className="jr-page-head">
                <div>
                    <h1>Project Documents</h1>
                    <p>
                        Manage formal documents associated with maintenance
                        records.
                    </p>
                </div>
                {canDraft && (
                    <button
                        type="button"
                        className={primary}
                        disabled={!maintenanceRecords.length}
                        onClick={openDraft}
                        title={
                            !maintenanceRecords.length
                                ? 'Create a Maintenance Record before adding documents'
                                : 'Add a local draft document'
                        }
                    >
                        <Plus className="size-4" /> Add Document
                    </button>
                )}
            </div>

            <div className="mt-5 space-y-2.5">
                <Notice>
                    <strong>Frontend prototype.</strong> Documents are tied to
                    Maintenance Records. New document entries are saved{' '}
                    <strong>only in this browser session</strong>; selected
                    files are <strong>not uploaded</strong> to Supabase Storage.
                </Notice>
                {schemaNotice && (
                    <Notice warning>
                        <strong>Schema review needed:</strong> {schemaNotice}
                    </Notice>
                )}
                {!maintenanceRecords.length && (
                    <Notice warning>
                        No Maintenance Records are available yet. An existing
                        Maintenance Record is required before a document can be
                        attached.
                    </Notice>
                )}
                {message && (
                    <div
                        role="status"
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#CDE8D7] bg-[#EFF9F3] px-4 py-3 text-sm text-[#24754A]"
                    >
                        <span className="flex items-center gap-2">
                            <Check className="size-4" />
                            {message}
                        </span>
                        <button
                            type="button"
                            aria-label="Dismiss message"
                            onClick={() => setMessage('')}
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                    label="Total Documents"
                    value={docs.length}
                    icon={FileText}
                    accent="bg-[#F6E9E0] text-[#98532C]"
                />
                <Stat
                    label="Records With Documents"
                    value={recordCount}
                    icon={HardHat}
                    accent="bg-[#E9F1FC] text-[#4E79B7]"
                />
                <Stat
                    label="Available Records"
                    value={maintenanceRecords.length}
                    icon={ClipboardList}
                    accent="bg-[#EAF6EF] text-[#269465]"
                />
                <Stat
                    label="Document Formats"
                    value={allFiles}
                    icon={FileCheck2}
                    accent="bg-[#F0EBFB] text-[#8065B4]"
                />
            </div>

            <div className="mt-7 flex flex-wrap gap-2 border-b border-[#E4EAF2]">
                <button
                    type="button"
                    onClick={() => setTab('documents')}
                    aria-current={tab === 'documents' ? 'page' : undefined}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === 'documents' ? 'border-[#995025] text-[#995025]' : 'border-transparent text-[#8395AE] hover:text-[#374E6F]'}`}
                >
                    <FolderOpen className="size-4" /> Documents
                </button>
                <button
                    type="button"
                    onClick={() => setTab('guidelines')}
                    aria-current={tab === 'guidelines' ? 'page' : undefined}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${tab === 'guidelines' ? 'border-[#995025] text-[#995025]' : 'border-transparent text-[#8395AE] hover:text-[#374E6F]'}`}
                >
                    <FileCheck2 className="size-4" /> Upload Guidelines
                </button>
            </div>

            {tab === 'documents' ? (
                <>
                    <div className="mt-5 flex flex-wrap gap-3">
                        <label className="relative min-w-[210px] flex-[1_1_400px]">
                            <Search className="pointer-events-none absolute top-3.5 left-3.5 size-[18px] text-[#8A9CB4]" />
                            <span className="sr-only">Search documents</span>
                            <input
                                type="search"
                                className={`${input} pl-11`}
                                value={search}
                                maxLength={255}
                                placeholder="Search document titles, files, or maintenance records..."
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    resetPage();
                                }}
                            />
                        </label>
                        <label className="relative min-w-[170px] flex-[0_1_250px]">
                            <span className="sr-only">
                                Filter maintenance records
                            </span>
                            <select
                                className={input}
                                value={recordFilter}
                                onChange={(event) => {
                                    setRecordFilter(event.target.value);
                                    resetPage();
                                }}
                            >
                                <option value="all">
                                    All Maintenance Records
                                </option>
                                {maintenanceRecords.map((record) => (
                                    <option value={record.id} key={record.id}>
                                        #{record.id} · {record.projectTitle}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="relative min-w-[135px] flex-[0_1_160px]">
                            <span className="sr-only">Filter file formats</span>
                            <select
                                className={input}
                                value={typeFilter}
                                onChange={(event) => {
                                    setTypeFilter(event.target.value);
                                    resetPage();
                                }}
                            >
                                <option value="all">All Formats</option>
                                <option value="pdf">PDF</option>
                                <option value="docx">DOCX</option>
                                <option value="xlsx">XLSX</option>
                                <option value="pptx">PPTX</option>
                            </select>
                        </label>
                    </div>
                    <div className="mt-6 mb-4 flex items-center justify-between gap-3 text-sm text-[#607694]">
                        <span>
                            {filtered.length}{' '}
                            {filtered.length === 1 ? 'document' : 'documents'}{' '}
                            found
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs">
                            <SlidersHorizontal className="size-3.5" /> Newest
                            first
                        </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-[#E5EBF3]">
                        <table className="w-full min-w-[750px] border-collapse text-left text-sm">
                            <thead className="bg-[#F2F4F8] text-[11px] tracking-wider text-[#68809F] uppercase">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">
                                        Document
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        Maintenance Record
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        Uploaded By
                                    </th>
                                    <th className="px-4 py-3 font-semibold">
                                        Uploaded
                                    </th>
                                    <th className="px-4 py-3 text-right font-semibold">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EEF1F6]">
                                {visible.map((document) => (
                                    <tr
                                        key={`${document.localDraft ? 'draft' : 'db'}-${document.id}`}
                                        className="hover:bg-[#FAFBFD]"
                                    >
                                        <td className="px-4 py-4">
                                            <div className="flex min-w-0 items-center gap-3">
                                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F8F2EE]">
                                                    <FileIcon
                                                        name={document.fileName}
                                                    />
                                                </span>
                                                <div className="min-w-0">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setDetails(document)
                                                        }
                                                        className="max-w-[320px] truncate text-left font-semibold text-[#1F2D43] hover:text-[#974D28] hover:underline"
                                                    >
                                                        {document.title}
                                                    </button>
                                                    <p className="max-w-[300px] truncate text-xs text-[#899AB0]">
                                                        {document.fileName}{' '}
                                                        {document.localDraft
                                                            ? '· Local draft'
                                                            : `· Document #${document.id}`}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="max-w-[225px] truncate font-medium text-[#405471]">
                                                {recordLabel(
                                                    document.maintenanceRecordId,
                                                )}
                                            </div>
                                            <span className="text-xs text-[#8B9CB2]">
                                                Maintenance ID:{' '}
                                                {document.maintenanceRecordId}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-[#617693]">
                                            {document.uploadedBy}
                                        </td>
                                        <td className="px-4 py-4 text-[#617693]">
                                            {prettyDate(document.uploadedAt)}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button
                                                type="button"
                                                aria-label={`View details for ${document.title}`}
                                                className={neutral}
                                                onClick={() =>
                                                    setDetails(document)
                                                }
                                            >
                                                <MoreHorizontal className="size-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {!visible.length && (
                            <div className="flex flex-col items-center px-6 py-12 text-center">
                                <span className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-[#F9EEE6] text-[#96512B]">
                                    <FolderOpen className="size-7" />
                                </span>
                                <strong className="text-[#1A2940]">
                                    {docs.length
                                        ? 'No matching documents.'
                                        : 'No maintenance documents yet.'}
                                </strong>
                                <p className="mt-2 max-w-lg text-sm leading-6 text-[#7C8EA6]">
                                    {docs.length
                                        ? 'Try another search or filter.'
                                        : 'Formal project documents will appear here once they are attached to a Maintenance Record and the data model is approved.'}
                                </p>
                                {docs.length > 0 && (
                                    <button
                                        type="button"
                                        className={`${neutral} mt-4`}
                                        onClick={() => {
                                            setSearch('');
                                            setRecordFilter('all');
                                            setTypeFilter('all');
                                            resetPage();
                                        }}
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[#7A8DA8]">
                        <span>
                            {filtered.length
                                ? `Showing ${(activePage - 1) * rowsPerPage + 1}–${Math.min(activePage * rowsPerPage, filtered.length)} of ${filtered.length}`
                                : '0 documents'}
                            {drafts.length
                                ? ' · Local drafts are not saved'
                                : ''}
                        </span>
                        <nav
                            aria-label="Document pagination"
                            className="flex items-center gap-1"
                        >
                            <button
                                type="button"
                                className={neutral}
                                aria-label="Previous page"
                                disabled={activePage === 1}
                                onClick={() => setPage(activePage - 1)}
                            >
                                <ChevronLeft className="size-4" />
                            </button>
                            <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[#F1D2BA] bg-[#FFF3EA] font-semibold text-[#94512D]">
                                {activePage}
                            </span>
                            <button
                                type="button"
                                className={neutral}
                                aria-label="Next page"
                                disabled={activePage >= lastPage}
                                onClick={() => setPage(activePage + 1)}
                            >
                                <ChevronRight className="size-4" />
                            </button>
                        </nav>
                    </footer>
                </>
            ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <section className="rounded-2xl border border-[#E3EAF2] bg-[#FCFDFE] p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <FileCheck2 className="size-5 text-[#98512B]" />
                            <h2 className="font-semibold text-[#1F3048]">
                                Formal document requirements
                            </h2>
                        </div>
                        <ul className="space-y-3 text-sm leading-6 text-[#60758F]">
                            <li>
                                <strong>Maintenance Record:</strong> Every
                                document belongs to exactly one Maintenance
                                Record, not directly to a project.
                            </li>
                            <li>
                                <strong>Formats under review:</strong> PDF,
                                DOCX, XLSX and PPTX are the working examples.
                                Final file types and size limits need client
                                approval.
                            </li>
                            <li>
                                <strong>Storage:</strong> Files belong in
                                Supabase Storage; the database keeps metadata
                                and a private file path/reference.
                            </li>
                            <li>
                                <strong>Attribution:</strong> UploadedBy refers
                                to a retained UserAccount, even if that account
                                is later deactivated.
                            </li>
                        </ul>
                    </section>
                    <section className="rounded-2xl border border-[#E3EAF2] bg-[#FCFDFE] p-5">
                        <div className="mb-4 flex items-center gap-2">
                            <ShieldAlert className="size-5 text-[#98512B]" />
                            <h2 className="font-semibold text-[#1F3048]">
                                Permissions & retention
                            </h2>
                        </div>
                        <ul className="space-y-3 text-sm leading-6 text-[#60758F]">
                            <li>
                                <strong>Viewing:</strong> All roles can access
                                according to their authorized scope;
                                record-level rules still need implementation.
                            </li>
                            <li>
                                <strong>Engineer create/update:</strong>{' '}
                                Requires an active EngineerLGU assignment and
                                the Engineer to be the parent record's
                                ManagingEngineer.
                            </li>
                            <li>
                                <strong>Admin overrides:</strong>{' '}
                                Admin/SuperAdmin can override edit restrictions;
                                only these roles may delete.
                            </li>
                            <li>
                                <strong>Delete behavior:</strong> Storage-object
                                retention after deletion is still undecided;
                                deleting is disabled in this preview.
                            </li>
                        </ul>
                    </section>
                </div>
            )}

            {addOpen && (
                <Modal
                    titleId="document-add-title"
                    onClose={() => setAddOpen(false)}
                >
                    <div className="flex items-start justify-between gap-3 border-b border-[#E7ECF3] p-6">
                        <div>
                            <h2
                                id="document-add-title"
                                className="text-xl font-bold text-[#1B2C44]"
                            >
                                Add Project Document
                            </h2>
                            <p className="mt-1 text-sm text-[#7A8BA4]">
                                Create a local preview only. No file will be
                                uploaded.
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setAddOpen(false)}
                        >
                            <X className="size-5 text-[#71839C]" />
                        </button>
                    </div>
                    <form className="space-y-4 p-6" onSubmit={submitDraft}>
                        <label className="block text-sm font-semibold text-[#314763]">
                            Maintenance Record{' '}
                            <span className="text-[#A04733]">*</span>
                            <select
                                className={`${input} mt-1.5`}
                                value={recordId}
                                required
                                onChange={(event) =>
                                    setRecordId(event.target.value)
                                }
                            >
                                <option value="">Select a record</option>
                                {maintenanceRecords.map((record) => (
                                    <option key={record.id} value={record.id}>
                                        #{record.id} · {record.projectTitle} ·{' '}
                                        {record.year} {record.quarter}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block text-sm font-semibold text-[#314763]">
                            Document Title{' '}
                            <span className="text-[#A04733]">*</span>
                            <input
                                className={`${input} mt-1.5`}
                                value={title}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                maxLength={255}
                                required
                                placeholder="e.g. Quarterly Inspection Report"
                            />
                        </label>
                        <label className="block text-sm font-semibold text-[#314763]">
                            Description{' '}
                            <span className="font-normal text-[#8B9CB0]">
                                (optional)
                            </span>
                            <textarea
                                className={`${input} mt-1.5 min-h-24`}
                                rows={3}
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                                placeholder="Describe the document..."
                            />
                        </label>
                        <label className="block text-sm font-semibold text-[#314763]">
                            Select File{' '}
                            <span className="text-[#A04733]">*</span>
                            <span className="mt-1.5 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-[#D1DCE9] bg-[#FAFCFE] px-5 py-5 text-center">
                                <UploadCloud className="size-6 text-[#A15B37]" />
                                <span className="text-xs text-[#68809B]">
                                    PDF, DOCX, XLSX or PPTX · file name only in
                                    this preview
                                </span>
                                <input
                                    className="max-w-full text-xs text-[#7186A0] file:mr-2 file:rounded-lg file:border-0 file:bg-[#F3E5D9] file:px-3 file:py-1.5 file:text-[#98522D]"
                                    type="file"
                                    accept=".pdf,.docx,.xlsx,.pptx"
                                    required
                                    onChange={(event) => {
                                        setFileName(
                                            event.target.files?.[0]?.name || '',
                                        );
                                        setError('');
                                    }}
                                />
                            </span>
                        </label>
                        {fileName && (
                            <div className="rounded-lg bg-[#F6F9FC] px-3 py-2 text-xs text-[#5A7390]">
                                Selected: {fileName}. The actual file will not
                                leave your device.
                            </div>
                        )}
                        {error && (
                            <p className="text-sm text-[#B14434]" role="alert">
                                {error}
                            </p>
                        )}
                        <div className="flex justify-end gap-2 border-t border-[#E7ECF3] pt-4">
                            <button
                                type="button"
                                className={neutral}
                                onClick={() => setAddOpen(false)}
                            >
                                Cancel
                            </button>
                            <button type="submit" className={primary}>
                                <FilePlus2 className="size-4" /> Add Local Draft
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {details && (
                <Modal
                    titleId="document-details-title"
                    onClose={() => setDetails(null)}
                >
                    <div className="flex items-start justify-between gap-3 border-b border-[#E7ECF3] p-6">
                        <div>
                            <h2
                                id="document-details-title"
                                className="text-xl font-bold text-[#1B2C44]"
                            >
                                Document Details
                            </h2>
                            <p className="mt-1 text-sm text-[#7D8EA5]">
                                {details.localDraft
                                    ? 'Local draft only'
                                    : `Document #${details.id}`}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={() => setDetails(null)}
                        >
                            <X className="size-5 text-[#71839C]" />
                        </button>
                    </div>
                    <div className="space-y-5 p-6 text-sm text-[#516782]">
                        <div className="flex items-center gap-3">
                            <span className="rounded-xl bg-[#F8F1EC] p-3">
                                <FileIcon name={details.fileName} />
                            </span>
                            <div>
                                <h3 className="font-semibold text-[#1E2D45]">
                                    {details.title}
                                </h3>
                                <p>{details.fileName}</p>
                            </div>
                        </div>
                        <div>
                            <strong className="text-xs tracking-wide text-[#8B9BB1] uppercase">
                                Maintenance Record
                            </strong>
                            <p className="mt-1">
                                #{details.maintenanceRecordId} ·{' '}
                                {recordLabel(details.maintenanceRecordId)}
                            </p>
                        </div>
                        <div>
                            <strong className="text-xs tracking-wide text-[#8B9BB1] uppercase">
                                Description
                            </strong>
                            <p className="mt-1 whitespace-pre-wrap">
                                {details.description ||
                                    'No description provided.'}
                            </p>
                        </div>
                        <div>
                            <strong className="text-xs tracking-wide text-[#8B9BB1] uppercase">
                                Uploaded by
                            </strong>
                            <p className="mt-1">{details.uploadedBy}</p>
                        </div>
                        <div>
                            <strong className="text-xs tracking-wide text-[#8B9BB1] uppercase">
                                Date
                            </strong>
                            <p className="mt-1">
                                {prettyDate(details.uploadedAt)}
                            </p>
                        </div>
                        <Notice>
                            File downloads are not available in this preview.
                            Secure Supabase Storage access must be implemented
                            by the backend.
                        </Notice>
                        {details.localDraft && (
                            <button
                                className="rounded-xl border border-[#E9CDCB] px-4 py-2.5 font-medium text-[#A4463F] hover:bg-[#FFF7F7]"
                                type="button"
                                onClick={() => {
                                    setDrafts((previous) =>
                                        previous.filter(
                                            (item) => item.id !== details.id,
                                        ),
                                    );
                                    setDetails(null);
                                    setMessage(
                                        'Local draft discarded. No Supabase data was changed.',
                                    );
                                }}
                            >
                                Discard local draft
                            </button>
                        )}
                    </div>
                </Modal>
            )}
        </ProjectWorkspace>
    );
}

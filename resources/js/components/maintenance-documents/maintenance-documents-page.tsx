import { router } from '@inertiajs/react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
    CheckCircle2, ChevronLeft, ChevronRight, Download, FilePlus2, FileText,
    FolderOpen, HardHat, Info, Plus, Search, ShieldAlert, UploadCloud, X,
} from 'lucide-react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

type DocumentRow = {
    id: number;
    maintenanceRecordId: number;
    title: string;
    description: string | null;
    fileName: string;
    uploadedBy: string;
    uploadedAt: string | null;
};
type MaintenanceRecord = {
    id: number;
    projectTitle: string;
    year: number | null;
    quarter: string | null;
    status: string;
};
type Project = { id: number; title: string };
type Engineer = { id: number; name: string };
type Props = {
    initialDocuments?: DocumentRow[];
    maintenanceRecords?: MaintenanceRecord[];
    maintenanceProjects?: Project[];
    initialProjectId?: number | null;
    engineers?: Engineer[];
    schemaNotice?: string | null;
    canUpload?: boolean;
    canCreateRecord?: boolean;
    storageConfigured?: boolean;
};
const primary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#935026] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#7E411D] disabled:cursor-not-allowed disabled:opacity-50';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#DBE4EE] bg-white px-3.5 py-2.5 text-sm font-medium text-[#36516F] hover:bg-[#F6F9FC] disabled:cursor-not-allowed disabled:opacity-50';
const field = 'mt-1.5 w-full rounded-xl border border-[#DAE3EF] bg-white px-3.5 py-2.5 text-sm text-[#21364E] outline-none focus:border-[#A65A32] focus:ring-2 focus:ring-[#F5E5D8]';
const label = 'block text-sm font-semibold text-[#314763]';

function Notice({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
    return <div role="status" className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-6 ${warning ? 'border-[#EECDB8] bg-[#FFF8F3] text-[#94502C]' : 'border-[#DCE6F0] bg-[#F7FAFD] text-[#4F6989]'}`}>
        {warning ? <ShieldAlert className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}<span>{children}</span>
    </div>;
}
function Dialog({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14253B]/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
        <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[#E5EBF3] px-6 py-4"><h2 className="text-xl font-semibold text-[#1C2D45]">{title}</h2><button type="button" aria-label="Close" className={secondary} onClick={close}><X className="size-4" /></button></header>
            {children}
        </section>
    </div>;
}
function dateText(value: string | null) {
    if (!value) return '—';
    const date = new Date(value.replace(' ', 'T'));
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export default function MaintenanceDocumentsPage({
    initialDocuments = [], maintenanceRecords = [], maintenanceProjects = [], initialProjectId = null, engineers = [],
    schemaNotice = null, canUpload = false, canCreateRecord = false, storageConfigured = false,
}: Props) {
    const [search, setSearch] = useState('');
    const [recordFilter, setRecordFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [recordOpen, setRecordOpen] = useState(canCreateRecord && initialProjectId !== null && maintenanceProjects.some(project => project.id === initialProjectId));
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [maintenanceId, setMaintenanceId] = useState(String(maintenanceRecords[0]?.id ?? ''));
    const [documentTitle, setDocumentTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);

    const [projectId, setProjectId] = useState(String(initialProjectId !== null && maintenanceProjects.some(project => project.id === initialProjectId) ? initialProjectId : (maintenanceProjects[0]?.id ?? '')));
    const [engineerId, setEngineerId] = useState(String(engineers[0]?.id ?? ''));
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const [quarter, setQuarter] = useState('Q1');
    const [startDate, setStartDate] = useState('');
    const [duration, setDuration] = useState('30');
    const [status, setStatus] = useState('Ongoing');
    const [completeDate, setCompleteDate] = useState('');
    const [recordDescription, setRecordDescription] = useState('');

    const map = useMemo(() => new Map(maintenanceRecords.map(record => [record.id, record])), [maintenanceRecords]);
    const filtered = useMemo(() => initialDocuments.filter(item => {
        const record = map.get(item.maintenanceRecordId);
        const haystack = `${item.title} ${item.fileName} ${item.uploadedBy} ${record?.projectTitle ?? ''}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase()) && (recordFilter === 'all' || String(item.maintenanceRecordId) === recordFilter);
    }), [initialDocuments, map, search, recordFilter]);
    const pages = Math.max(1, Math.ceil(filtered.length / 8));
    const currentPage = Math.min(page, pages);
    const shown = filtered.slice((currentPage - 1) * 8, currentPage * 8);
    const recordLabel = (id: number) => {
        const record = map.get(id);
        return record ? `${record.projectTitle} · ${record.year ?? ''} ${record.quarter ?? ''}` : `Maintenance Record #${id}`;
    };
    const uploadsReady = canUpload && storageConfigured && !schemaNotice;

    function submitUpload(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!file) { setError('Select a file.'); return; }
        if (!['pdf', 'docx', 'xlsx', 'pptx'].includes(file.name.split('.').pop()?.toLowerCase() ?? '')) { setError('Only PDF, DOCX, XLSX and PPTX are accepted.'); return; }
        if (file.size > 10 * 1024 * 1024) { setError('Files may not exceed 10 MB.'); return; }
        setError('');
        router.post('/project-documents-preview/upload', {
            maintenance_id: Number(maintenanceId), document_title: documentTitle, description, file,
        }, {
            forceFormData: true, preserveScroll: true,
            onStart: () => setPending(true),
            onFinish: () => setPending(false),
            onError: errors => setError(Object.values(errors)[0] || 'The upload could not be completed.'),
            onSuccess: () => { setUploadOpen(false); setDocumentTitle(''); setDescription(''); setFile(null); setSuccess('Document uploaded and saved to Supabase.'); },
        });
    }
    function submitRecord(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        router.post('/project-documents-preview/maintenance-records', {
            maintenance_projects_id: Number(projectId), engineers_id: Number(engineerId),
            maintenance_year: Number(year), quarter, start_date: startDate,
            estimated_duration_days: Number(duration), status,
            complete_date: status === 'Completed' ? completeDate : null,
            description: recordDescription,
        }, {
            preserveScroll: true,
            onStart: () => setPending(true),
            onFinish: () => setPending(false),
            onError: errors => setError(Object.values(errors)[0] || 'The maintenance record could not be created.'),
            onSuccess: () => { setRecordOpen(false); setSuccess('Maintenance Record created. You can now upload a document.'); },
        });
    }

    return <ProjectWorkspace>
        <div className="jr-page-head">
            <div><h1>Project Documents</h1><p>Formal files associated with recorded road maintenance activities.</p></div>
            <div className="flex flex-wrap gap-2">
                {canCreateRecord && <button type="button" className={secondary} onClick={() => { setError(''); setRecordOpen(true); }}><HardHat className="size-4" /> Add Maintenance Record</button>}
                {canUpload && <button type="button" className={primary} disabled={!uploadsReady || maintenanceRecords.length === 0} onClick={() => { setMaintenanceId(String(maintenanceRecords[0]?.id ?? '')); setError(''); setUploadOpen(true); }}><Plus className="size-4" /> Add Document</button>}
            </div>
        </div>
        <div className="mt-5 space-y-2.5">
            {schemaNotice && <Notice warning>{schemaNotice}</Notice>}
            {!storageConfigured && <Notice warning>Private Supabase Storage is not configured on the Laravel server. Set up the private bucket and backend credentials before uploading.</Notice>}
            {maintenanceRecords.length === 0 && <Notice warning>There are no Maintenance Records yet. Create a real maintenance occurrence under a project before attaching documents.</Notice>}
            <Notice>Documents are tied to Maintenance Records and stored in a private Supabase Storage bucket. Files are downloaded only through authorized Laravel endpoints. Deletes remain disabled pending the file-retention decision.</Notice>
            {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-[#CEE7D7] bg-[#F0F9F3] px-4 py-3 text-sm text-[#27764E]"><CheckCircle2 className="size-4" />{success}</div>}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
                ['Total Documents', initialDocuments.length],
                ['Records With Documents', new Set(initialDocuments.map(doc => doc.maintenanceRecordId)).size],
                ['Available Maintenance Records', maintenanceRecords.length],
            ].map(([name, count]) => <div key={name} className="rounded-xl border border-[#E1E8F1] bg-[#FCFDFE] p-4"><p className="text-xs font-medium text-[#8292AA]">{name}</p><p className="mt-2 text-2xl font-semibold text-[#1A2D46]">{count}</p></div>)}
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#96A8BE]" /><input type="search" aria-label="Search documents" className={`${field} !mt-0 pl-10`} placeholder="Search documents or filenames..." value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
            <select aria-label="Filter by Maintenance Record" className={`${field} !mt-0 max-w-xs`} value={recordFilter} onChange={event => { setRecordFilter(event.target.value); setPage(1); }}>
                <option value="all">All Maintenance Records</option>
                {maintenanceRecords.map(record => <option key={record.id} value={record.id}>#{record.id} · {record.projectTitle}</option>)}
            </select>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-[#E7ECF3]">
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead className="bg-[#F1F4F8] text-xs uppercase tracking-wide text-[#627994]"><tr><th className="px-4 py-3">Document</th><th className="px-4 py-3">Maintenance Record</th><th className="px-4 py-3">Uploaded By</th><th className="px-4 py-3">Uploaded</th><th className="px-4 py-3">File</th></tr></thead>
                <tbody className="divide-y divide-[#ECF0F5]">
                    {shown.map(doc => <tr key={doc.id} className="text-[#405572]"><td className="px-4 py-4"><span className="flex items-center gap-2 font-semibold text-[#263951]"><FileText className="size-4 text-[#A55F38]" />{doc.title}</span><span className="block pl-6 text-xs text-[#8194AD]">{doc.fileName}</span></td><td className="px-4 py-4">{recordLabel(doc.maintenanceRecordId)}</td><td className="px-4 py-4">{doc.uploadedBy}</td><td className="px-4 py-4">{dateText(doc.uploadedAt)}</td><td className="px-4 py-4"><a className={secondary} href={`/project-documents-preview/files/${doc.id}/download`}><Download className="size-4" /> Download</a></td></tr>)}
                </tbody>
            </table></div>
            {shown.length === 0 && <div className="flex flex-col items-center gap-2 px-5 py-12 text-center"><FolderOpen className="size-8 text-[#A9B7C7]" /><strong className="text-[#233950]">{initialDocuments.length ? 'No matching documents' : 'No Maintenance Documents yet'}</strong><p className="max-w-md text-sm text-[#7B90AA]">{initialDocuments.length ? 'Try changing the filters.' : 'Create a Maintenance Record and upload a formal document to get started.'}</p></div>}
        </div>
        <footer className="mt-4 flex items-center justify-between text-sm text-[#7F91A8]"><span>{filtered.length} documents found</span><div className="flex items-center gap-2"><button type="button" className={secondary} disabled={currentPage === 1} aria-label="Previous" onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" /></button><span>{currentPage} / {pages}</span><button type="button" className={secondary} disabled={currentPage === pages} aria-label="Next" onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" /></button></div></footer>

        {uploadOpen && <Dialog title="Add Maintenance Document" close={() => { if (!pending) setUploadOpen(false); }}><form className="space-y-4 p-6" onSubmit={submitUpload}>
            <label className={label}>Maintenance Record <select className={field} value={maintenanceId} onChange={event => setMaintenanceId(event.target.value)} required>{maintenanceRecords.map(record => <option key={record.id} value={record.id}>#{record.id} · {record.projectTitle} · {record.year} {record.quarter}</option>)}</select></label>
            <label className={label}>Document Title <input className={field} required maxLength={255} value={documentTitle} onChange={event => setDocumentTitle(event.target.value)} placeholder="e.g. Quarterly Inspection Report" /></label>
            <label className={label}>Description (optional) <textarea className={`${field} min-h-20`} maxLength={5000} value={description} onChange={event => setDescription(event.target.value)} /></label>
            <label className={label}><span className="flex items-center gap-2"><UploadCloud className="size-4" /> Choose file · maximum 10 MB</span><input className={`${field} file:mr-3 file:rounded-md file:border-0 file:bg-[#F9E9DC] file:px-3 file:py-1`} type="file" accept=".pdf,.docx,.xlsx,.pptx" required onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-[#E5EBF3] pt-4"><button type="button" disabled={pending} className={secondary} onClick={() => setUploadOpen(false)}>Cancel</button><button type="submit" className={primary} disabled={pending || !file}><FilePlus2 className="size-4" />{pending ? 'Uploading...' : 'Upload document'}</button></div>
        </form></Dialog>}

        {recordOpen && <Dialog title="Create Maintenance Record" close={() => { if (!pending) setRecordOpen(false); }}><form className="space-y-4 p-6" onSubmit={submitRecord}>
            <Notice>Maintenance Records represent quarterly maintenance occurrences under an existing project. This action saves a real record and a CREATE audit entry.</Notice>
            <label className={label}>Maintenance Project <select className={field} required value={projectId} onChange={event => setProjectId(event.target.value)}>{maintenanceProjects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
            <label className={label}>Managing Engineer <select className={field} required value={engineerId} onChange={event => setEngineerId(event.target.value)}>{engineers.map(engineer => <option key={engineer.id} value={engineer.id}>{engineer.name}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Maintenance Year <input className={field} type="number" required min={2000} max={2100} value={year} onChange={event => setYear(event.target.value)} /></label><label className={label}>Quarter <select className={field} value={quarter} onChange={event => setQuarter(event.target.value)}>{['Q1','Q2','Q3','Q4'].map(q => <option key={q}>{q}</option>)}</select></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Start Date <input className={field} required type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label className={label}>Estimated Duration (days) <input className={field} required min={1} max={3650} type="number" value={duration} onChange={event => setDuration(event.target.value)} /></label></div>
            <div className="grid gap-3 sm:grid-cols-2"><label className={label}>Status <select className={field} value={status} onChange={event => setStatus(event.target.value)}><option value="Ongoing">Ongoing</option><option value="Completed">Completed</option></select></label>{status === 'Completed' && <label className={label}>Completion Date <input className={field} required type="date" min={startDate} value={completeDate} onChange={event => setCompleteDate(event.target.value)} /></label>}</div>
            <label className={label}>Description (optional) <textarea className={`${field} min-h-20`} value={recordDescription} onChange={event => setRecordDescription(event.target.value)} /></label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-[#E5EBF3] pt-4"><button type="button" className={secondary} disabled={pending} onClick={() => setRecordOpen(false)}>Cancel</button><button type="submit" className={primary} disabled={pending || !projectId || !engineerId}>{pending ? 'Saving...' : 'Create Maintenance Record'}</button></div>
        </form></Dialog>}
    </ProjectWorkspace>;
}

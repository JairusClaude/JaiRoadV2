import {
    Building2, ChevronLeft, ChevronRight, FilePenLine,
    Info, MoreHorizontal, Plus, Search, ShieldCheck,
    Trash2, X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

/** UI label: LGU; data entity: LGU master data. */
export type LguRecord = {
    id: number;
    municipalityName: string;
    province: string | null;
    region: string | null;
    mayorFirstName: string | null;
    mayorMiddleName: string | null;
    mayorLastName: string | null;
    roadCoverageCount: number | null;
    activeAssignmentCount: number | null;
    localDraft?: boolean;
    localEdited?: boolean;
};
export type LguDirectoryProps = {
    initialLgus?: LguRecord[];
    schemaNotice?: string | null;
    canPreviewDraft?: boolean;
    availableFields?: {
        municipality?: boolean;
        province?: boolean;
        region?: boolean;
        mayorFirst?: boolean;
        mayorMiddle?: boolean;
        mayorLast?: boolean;
        roadLinks?: boolean;
        engineerAssignments?: boolean;
    };
};
type LguForm = {
    municipalityName: string;
    province: string;
    region: string;
    mayorFirstName: string;
    mayorMiddleName: string;
    mayorLastName: string;
};
type Editor = { kind: 'add' } | { kind: 'edit'; id: number } | null;

const emptyForm: LguForm = {
    municipalityName: '', province: '', region: '',
    mayorFirstName: '', mayorMiddleName: '', mayorLastName: '',
};
const control = 'min-h-10 w-full rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm text-[#20324A] outline-none placeholder:text-[#91A2BA] focus:border-[#98512D] focus:ring-2 focus:ring-[#F6E6DA]';
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm font-medium text-[#405572] transition hover:bg-[#F8FAFD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#994C29] disabled:cursor-not-allowed disabled:opacity-50';
const pageSize = 8;

function present(value: string | null | undefined, supported = true): ReactNode {
    return value?.trim() ? value : <span className="text-[#95A4B7]">{supported ? 'Not recorded' : 'Not in current schema'}</span>;
}
function mayorName(item: LguRecord): string {
    return [item.mayorFirstName, item.mayorMiddleName, item.mayorLastName].filter(Boolean).join(' ').trim();
}
function toForm(item: LguRecord): LguForm {
    return {
        municipalityName: item.municipalityName,
        province: item.province ?? '', region: item.region ?? '',
        mayorFirstName: item.mayorFirstName ?? '',
        mayorMiddleName: item.mayorMiddleName ?? '',
        mayorLastName: item.mayorLastName ?? '',
    };
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#15253B]/55 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
            <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-[650px] overflow-y-auto rounded-2xl border border-[#DDE5F0] bg-white shadow-2xl">
                {children}
            </section>
        </div>
    );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
    return <div><p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#8A9BB1]">{label}</p><div className="text-sm font-medium text-[#263A52]">{children}</div></div>;
}

export default function LguDirectory({ initialLgus = [], availableFields = {}, schemaNotice = null, canPreviewDraft = false }: LguDirectoryProps) {
    const [drafts, setDrafts] = useState<LguRecord[]>([]);
    const [overrides, setOverrides] = useState<Record<number, LguRecord>>({});
    const [query, setQuery] = useState('');
    const [provinceFilter, setProvinceFilter] = useState('all');
    const [sort, setSort] = useState<'name' | 'newest' | 'oldest'>('name');
    const [page, setPage] = useState(1);
    const [detailsId, setDetailsId] = useState<number | null>(null);
    const [editor, setEditor] = useState<Editor>(null);
    const [form, setForm] = useState<LguForm>(emptyForm);
    const [formError, setFormError] = useState('');
    const [nextDraftId, setNextDraftId] = useState(-1);

    const items = useMemo(() => [
        ...initialLgus.map(item => overrides[item.id] ?? item), ...drafts,
    ], [initialLgus, overrides, drafts]);
    const provinces = useMemo(() => Array.from(new Set(items.map(item => item.province?.trim()).filter((value): value is string => Boolean(value)))).sort(), [items]);
    const filtered = useMemo(() => {
        const normalized = query.toLocaleLowerCase().trim();
        const result = items.filter(item => {
            const searchText = [item.municipalityName, item.province, item.region, mayorName(item), String(item.id)].join(' ').toLocaleLowerCase();
            return (!normalized || searchText.includes(normalized)) && (provinceFilter === 'all' || item.province === provinceFilter);
        });
        return result.sort((a, b) => {
            if (sort === 'newest') return b.id - a.id;
            if (sort === 'oldest') return a.id - b.id;
            return a.municipalityName.localeCompare(b.municipalityName) || a.id - b.id;
        });
    }, [items, query, provinceFilter, sort]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const details = detailsId === null ? null : items.find(item => item.id === detailsId) ?? null;
    const editorIsDraft = editor?.kind === 'edit' && editor.id < 0;
    const coveragesLinked = items.reduce((sum, item) => sum + (item.roadCoverageCount ?? 0), 0);
    const fieldsMissing = ['province', 'region', 'mayorFirst', 'mayorMiddle', 'mayorLast'].filter(key => !availableFields[key as keyof typeof availableFields]);

    const resetFilters = () => { setQuery(''); setProvinceFilter('all'); setSort('name'); setPage(1); };
    const openAdd = () => { if (!canPreviewDraft) return; setForm({ ...emptyForm }); setFormError(''); setEditor({ kind: 'add' }); };
    const openEdit = (item: LguRecord) => { if (!canPreviewDraft) return; setForm(toForm(item)); setFormError(''); setEditor({ kind: 'edit', id: item.id }); setDetailsId(null); };
    const closeEditor = () => { setEditor(null); setFormError(''); };
    const setValue = (key: keyof LguForm, value: string) => setForm(prev => ({ ...prev, [key]: value }));

    const savePreview = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canPreviewDraft) { setFormError('LGU modifications are unavailable in read-only mode.'); return; }
        const normalized: LguForm = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as LguForm;
        if (!normalized.municipalityName || !normalized.province || !normalized.region || !normalized.mayorFirstName || !normalized.mayorLastName) {
            setFormError('Municipality, province, region, and the mayor’s first and last names are required for new LGU records.');
            return;
        }
        if (editor?.kind === 'add') {
            const created: LguRecord = {
                id: nextDraftId,
                municipalityName: normalized.municipalityName,
                province: normalized.province, region: normalized.region,
                mayorFirstName: normalized.mayorFirstName,
                mayorMiddleName: normalized.mayorMiddleName || null,
                mayorLastName: normalized.mayorLastName,
                roadCoverageCount: 0, activeAssignmentCount: null, localDraft: true,
            };
            setNextDraftId(current => current - 1);
            setDrafts(previous => [created, ...previous]);
        } else if (editor?.kind === 'edit') {
            const old = items.find(item => item.id === editor.id);
            if (!old) return;
            const updated: LguRecord = {
                ...old, ...normalized, mayorMiddleName: normalized.mayorMiddleName || null,
                localEdited: !old.localDraft,
            };
            if (old.localDraft) setDrafts(previous => previous.map(item => item.id === old.id ? updated : item));
            else setOverrides(previous => ({ ...previous, [old.id]: updated }));
        }
        setPage(1);
        closeEditor();
    };
    const removeDraft = (id: number) => { if (!canPreviewDraft) return; setDrafts(previous => previous.filter(item => item.id !== id)); setDetailsId(null); };

    return (
        <ProjectWorkspace>
            <div className="jr-page-head">
                <div><h1>LGU</h1><p>{canPreviewDraft ? 'Browse and manage municipality reference information.' : 'Browse municipality reference information (read-only).'}</p></div>
                {canPreviewDraft && <button type="button" className="jr-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" onClick={openAdd}>
                    <Plus className="size-[17px]" /> Add LGU
                </button>}
            </div>

            <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#F3DFC9] bg-[#FFFAF5] px-4 py-3 text-sm leading-relaxed text-[#975124]" role="status">
                <Info className="mt-0.5 size-4 shrink-0" />
                <div>{canPreviewDraft ? <><strong>Frontend prototype.</strong> Existing LGUs are read from Supabase. Add and Edit only change this browser view; nothing is saved to the shared database. Deleting saved LGUs is disabled.</> : <><strong>Read-only LGU directory.</strong> You may view saved municipalities and their road coverage links regardless of active EngineerLGU assignments. Only Admin/SuperAdmin may modify LGU master data through separately authorized server-side workflows; this directory provides no database-writing actions.</>}</div>
            </div>
            {schemaNotice && <div className="mb-5 rounded-xl border border-[#E5D8C8] bg-[#FFF7ED] px-4 py-3 text-sm text-[#85532D]" role="status">{schemaNotice}</div>}
            {fieldsMissing.length > 0 && <div className="mb-5 flex items-start gap-2 rounded-xl border border-[#DFE7F1] bg-[#F6F9FD] px-4 py-3 text-sm text-[#58718C]" role="note"><Info className="mt-0.5 size-4 shrink-0" /><span>Your connected LGU table may not yet contain all Data Dictionary fields (province, region or mayor name). Missing fields are shown as unavailable, not invented. Preview drafts do not change the schema.</span></div>}

            <section aria-label="LGU overview" className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E2E8F1] bg-gradient-to-br from-[#FFFAF4] to-white p-5 shadow-sm"><div className="flex items-center justify-between text-[#A1582C]"><span className="text-xs font-semibold uppercase tracking-wider">Municipalities</span><Building2 className="size-5" /></div><p className="mt-3 text-3xl font-bold text-[#1D324B]">{initialLgus.length}</p><p className="mt-1 text-xs text-[#8294AA]">Saved LGU records</p></div>
                <div className="rounded-2xl border border-[#E2E8F1] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-[#7389A3]">Road coverages</p><p className="mt-3 text-3xl font-bold text-[#1D324B]">{availableFields.roadLinks ? coveragesLinked : '—'}</p><p className="mt-1 text-xs text-[#8294AA]">Linked to municipalities</p></div>
                <div className="rounded-2xl border border-[#E2E8F1] bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-[#7389A3]">Engineer assignments</p><p className="mt-3 text-3xl font-bold text-[#1D324B]">{availableFields.engineerAssignments ? initialLgus.reduce((sum, lgu) => sum + (lgu.activeAssignmentCount ?? 0), 0) : '—'}</p><p className="mt-1 text-xs text-[#8294AA]">Active EngineerLGU links</p></div>
            </section>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-b border-[#E6ECF3] pb-4"><div><h2 className="text-lg font-bold text-[#1C2F47]">Municipality directory</h2><p className="text-xs text-[#8193A9]">Explore existing LGUs and open a municipality for details.</p></div><span className="rounded-full bg-[#F5F0EA] px-3 py-1.5 text-xs font-medium text-[#8B4A24]">{filtered.length} results</span></div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-[#E5EAF2] bg-[#F9FAFC] p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="jr-search relative">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-[#8BA0B7]" />
                    <input aria-label="Search municipalities" className={`${control} pl-10`} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search municipality, province, region or mayor..." />
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <label className="sr-only" htmlFor="lgu-province-filter">Filter by province</label>
                    <select id="lgu-province-filter" className={`${control} w-auto min-w-48`} value={provinceFilter} onChange={event => { setProvinceFilter(event.target.value); setPage(1); }}>
                        <option value="all">All Provinces</option>
                        {provinces.map(province => <option key={province} value={province}>{province}</option>)}
                    </select>
                    <label className="sr-only" htmlFor="lgu-sort">Sort LGUs</label>
                    <select id="lgu-sort" className={`${control} w-auto min-w-40`} value={sort} onChange={event => { setSort(event.target.value as typeof sort); setPage(1); }}>
                        <option value="name">Municipality A–Z</option><option value="newest">Newest ID first</option><option value="oldest">Oldest ID first</option>
                    </select>
                </div>
            </div>

            <div className="jr-table-toolbar mt-6"><span role="status">{filtered.length} {filtered.length === 1 ? 'LGU' : 'LGUs'} found</span><span className="text-xs text-[#8092A7]">Select a municipality to view its details</span></div>
            <div className="jr-table-wrap overflow-x-auto">
                <table className="jr-table min-w-[820px]">
                    <thead><tr><th>Municipality</th><th>Province</th><th>Region</th><th>Road Coverages</th><th>Engineer Assignments</th><th className="text-right">Actions</th></tr></thead>
                    <tbody>
                        {visible.map(item => <tr key={item.id}>
                            <td><button type="button" className="text-left" onClick={() => setDetailsId(item.id)}><strong className="jr-project-title block">{item.municipalityName}</strong><span className="jr-project-id">{item.localDraft ? 'Browser-only draft' : `LGU ID: ${item.id}`}{item.localEdited ? ' · Locally edited' : ''}</span></button></td>
                            <td>{present(item.province, availableFields.province || item.localDraft || item.localEdited)}</td>
                            <td>{present(item.region, availableFields.region || item.localDraft || item.localEdited)}</td>
                            <td>{item.localDraft ? '0' : item.roadCoverageCount === null ? <span className="text-[#95A4B7]">Unavailable</span> : <span className="font-medium text-[#39516E]">{item.roadCoverageCount}</span>}</td>
                            <td>{item.activeAssignmentCount === null ? <span className="text-[#95A4B7]">Not connected</span> : item.activeAssignmentCount}</td>
                            <td className="text-right"><button type="button" className={`${secondary} px-2.5`} onClick={() => setDetailsId(item.id)} aria-label={`View ${item.municipalityName} details`}><MoreHorizontal className="size-4" /></button></td>
                        </tr>)}
                    </tbody>
                </table>
                {visible.length === 0 && <div className="jr-empty"><strong>{items.length ? 'No matching LGUs.' : 'No LGUs available.'}</strong><p>{items.length ? 'Try another search or province filter.' : 'LGU records from your connected database will appear here.'}</p>{items.length > 0 && <button type="button" className={secondary} onClick={resetFilters}>Clear filters</button>}</div>}
            </div>
            <footer className="jr-table-footer">
                <span>{filtered.length ? `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length} LGUs` : '0 LGUs'}{drafts.length ? ` · ${drafts.length} browser draft${drafts.length === 1 ? '' : 's'}` : ''}</span>
                <nav aria-label="LGU pagination" className="flex gap-1">
                    <button type="button" className={`${secondary} px-2.5`} disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></button>
                    <span className="flex min-w-9 items-center justify-center rounded-lg bg-[#FFF0E2] text-sm font-medium text-[#97502A]">{safePage}</span>
                    <button type="button" className={`${secondary} px-2.5`} disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} aria-label="Next page"><ChevronRight className="size-4" /></button>
                </nav>
            </footer>

            {details && <Modal title={`LGU details: ${details.municipalityName}`} onClose={() => setDetailsId(null)}>
                <div className="flex items-start justify-between border-b border-[#E4EAF2] px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#93502B]">{details.localDraft ? 'Local preview draft' : `LGU #${details.id}`}</p><h2 className="mt-1 text-xl font-semibold text-[#20324A]">{details.municipalityName}</h2><p className="mt-1 text-sm text-[#8092AA]">Municipality master information</p></div><button type="button" className={secondary} onClick={() => setDetailsId(null)} aria-label="Close details"><X className="size-4" /></button></div>
                <div className="space-y-5 px-6 py-5">
                    <div className="grid gap-4 sm:grid-cols-2"><Field label="Province">{present(details.province, availableFields.province || details.localDraft || details.localEdited)}</Field><Field label="Region">{present(details.region, availableFields.region || details.localDraft || details.localEdited)}</Field></div>
                    <div className="rounded-xl border border-[#E4EAF2] bg-[#FAFBFD] p-4"><p className="mb-3 text-sm font-semibold text-[#20334B]">Mayor Information</p><div className="grid gap-4 sm:grid-cols-3"><Field label="First name">{present(details.mayorFirstName, availableFields.mayorFirst || details.localDraft || details.localEdited)}</Field><Field label="Middle name">{present(details.mayorMiddleName, availableFields.mayorMiddle || details.localDraft || details.localEdited)}</Field><Field label="Last name">{present(details.mayorLastName, availableFields.mayorLast || details.localDraft || details.localEdited)}</Field></div></div>
                    <div className="grid gap-4 rounded-xl border border-[#E4EAF2] p-4 sm:grid-cols-2"><Field label="Linked Road Coverages">{details.roadCoverageCount ?? 'Not connected'}</Field><Field label="Active EngineerLGU Assignments">{details.activeAssignmentCount ?? 'Not connected'}</Field></div>
                    <div className="rounded-xl bg-[#F6F8FC] p-4 text-xs leading-relaxed text-[#647D96]"><ShieldCheck className="mb-2 size-4 text-[#92552F]" /><p>LGU references are retained while Road Coverages or EngineerLGU assignments depend on them. The production Delete action must check dependencies and respect database foreign-key restrictions.</p></div>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-t border-[#E4EAF2] px-6 py-4">
                    {canPreviewDraft && details.localDraft ? <button type="button" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#B44C49] hover:bg-[#FFF0F0]" onClick={() => removeDraft(details.id)}><Trash2 className="size-4" /> Remove draft</button> : <span className="text-xs text-[#8899AD]">{canPreviewDraft ? 'Saved LGUs cannot be deleted in preview' : 'LGU master data is read-only'}</span>}
                    <div className="flex gap-2">{canPreviewDraft && <button type="button" className={secondary} onClick={() => openEdit(details)}><FilePenLine className="size-4" /> Edit preview</button>}<button type="button" className={secondary} onClick={() => setDetailsId(null)}>Close</button></div>
                </div>
            </Modal>}

            {canPreviewDraft && editor && <Modal title={editor.kind === 'add' ? 'Add LGU preview' : 'Edit LGU preview'} onClose={closeEditor}>
                <form onSubmit={savePreview}>
                    <div className="flex items-start justify-between border-b border-[#E4EAF2] px-6 py-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#93502B]">Browser-only prototype</p><h2 className="mt-1 text-xl font-semibold text-[#20324A]">{editor.kind === 'add' ? 'Add LGU' : 'Edit LGU'}</h2><p className="mt-1 text-sm text-[#8295AB]">Preview changes locally; nothing is saved to Supabase.</p></div><button type="button" className={secondary} onClick={closeEditor} aria-label="Close form"><X className="size-4" /></button></div>
                    <div className="space-y-4 px-6 py-5">
                        <div><label htmlFor="lgu-municipality" className="mb-1.5 block text-sm font-medium text-[#263B53]">Municipality Name *</label><input id="lgu-municipality" className={control} maxLength={100} required value={form.municipalityName} onChange={event => setValue('municipalityName', event.target.value)} placeholder="Enter municipality name" /></div>
                        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="lgu-province" className="mb-1.5 block text-sm font-medium text-[#263B53]">Province *</label><input id="lgu-province" className={control} maxLength={100} required value={form.province} onChange={event => setValue('province', event.target.value)} placeholder="Enter province" /></div><div><label htmlFor="lgu-region" className="mb-1.5 block text-sm font-medium text-[#263B53]">Region *</label><input id="lgu-region" className={control} maxLength={100} required value={form.region} onChange={event => setValue('region', event.target.value)} placeholder="Enter region" /></div></div>
                        <div className="rounded-xl border border-[#E6ECF3] p-4"><p className="mb-3 text-sm font-semibold text-[#20334B]">Mayor Information</p><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="lgu-mayor-first" className="mb-1.5 block text-sm font-medium text-[#263B53]">First Name *</label><input id="lgu-mayor-first" className={control} maxLength={100} required value={form.mayorFirstName} onChange={event => setValue('mayorFirstName', event.target.value)} /></div><div><label htmlFor="lgu-mayor-middle" className="mb-1.5 block text-sm font-medium text-[#263B53]">Middle Name <span className="font-normal text-[#8092AA]">(optional)</span></label><input id="lgu-mayor-middle" className={control} maxLength={100} value={form.mayorMiddleName} onChange={event => setValue('mayorMiddleName', event.target.value)} /></div><div className="sm:col-span-2"><label htmlFor="lgu-mayor-last" className="mb-1.5 block text-sm font-medium text-[#263B53]">Last Name *</label><input id="lgu-mayor-last" className={control} maxLength={100} required value={form.mayorLastName} onChange={event => setValue('mayorLastName', event.target.value)} /></div></div></div>
                        {formError && <p role="alert" className="rounded-lg bg-[#FFF0F0] px-3 py-2 text-sm text-[#AD4948]">{formError}</p>}
                        {editorIsDraft && <p className="text-xs text-[#8394A8]">Editing an unsaved LGU draft.</p>}
                    </div>
                    <div className="flex justify-end gap-2 border-t border-[#E4EAF2] px-6 py-4"><button type="button" className={secondary} onClick={closeEditor}>Cancel</button><button type="submit" className="jr-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"><Plus className="size-4" /> Save Preview</button></div>
                </form>
            </Modal>}
        </ProjectWorkspace>
    );
}

import { router } from '@inertiajs/react';
import {
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileImage,
    Film,
    FilePlus2,
    HardHat,
    Images,
    Info,
    ListFilter,
    Plus,
    Search,
    ShieldAlert,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';

type MediaItem = {
    name: string;
    kind: 'Photo' | 'Video';
    bytes: number;
    file: File;
};
export type MonthlyUpdate = {
    id: number;
    maintenanceRecordId: number;
    month: string; // strictly YYYY-MM
    summary: string;
    progressPercentage?: number | null;
    author: string;
    createdAt: string | null;
    mediaCount: number;
    localDraft?: boolean;
    localMedia?: MediaItem[];
    mediaFiles?: { id: number; name: string }[];
};
export type MaintenanceRecordOption = {
    id: number;
    projectId: number;
    projectTitle: string;
    year: number | null;
    quarter: string | null;
    status: string;
};
export type MonthlyUpdatesPageProps = {
    initialUpdates?: MonthlyUpdate[];
    maintenanceRecords?: MaintenanceRecordOption[];
    schemaNotice?: string | null;
    mediaNotice?: string | null;
    canDraft?: boolean;
    canWrite?: boolean;
};

type Tab = 'reports' | 'media';
const field =
    'w-full rounded-xl border border-[#DEE5EF] bg-white px-3.5 py-2.5 text-sm text-[#20324A] outline-none placeholder:text-[#9AA8BE] focus:border-[#AA6845] focus:ring-2 focus:ring-[#F7E8DE]';
const neutral =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm font-medium text-[#3F536F] transition hover:bg-[#F7F9FC] disabled:cursor-not-allowed disabled:opacity-50';
const primary =
    'jr-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50';
const todayMonth = () => new Date().toISOString().slice(0, 7);
const niceMonth = (value: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
        return value || 'Unknown month';
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${value}-01T12:00:00Z`));
};
const isValidMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

function Stat({
    icon: Icon,
    label,
    value,
    accent,
}: {
    icon: typeof CalendarDays;
    label: string;
    value: number;
    accent: string;
}) {
    return (
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-[#E4EAF2] bg-[#FCFDFE] px-4 py-4">
            <div className="min-w-0">
                <div className="text-xs font-medium text-[#8195B0]">
                    {label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-[#17263D]">
                    {value}
                </div>
            </div>
            <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${accent}`}
            >
                <Icon className="size-5" />
            </span>
        </div>
    );
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
            className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-6 ${warning ? 'border-[#F5D9C9] bg-[#FFF8F2] text-[#914B29]' : 'border-[#E0E8F2] bg-[#F8FAFD] text-[#536B89]'}`}
        >
            {warning ? (
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            ) : (
                <Info className="mt-0.5 size-4 shrink-0" />
            )}
            <div>{children}</div>
        </div>
    );
}
function Empty({ title, description }: { title: string; description: string }) {
    return (
        <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#F8EBE2] text-[#9A532F]">
                <ClipboardList className="size-6" />
            </span>
            <strong className="text-[#1A2940]">{title}</strong>
            <p className="mt-1 max-w-md text-sm leading-6 text-[#7A8CA6]">
                {description}
            </p>
        </div>
    );
}
const pageSize = 8;

export default function MonthlyUpdatesPage({
    initialUpdates = [],
    maintenanceRecords = [],
    schemaNotice = null,
    mediaNotice = null,
    canDraft = false,
    canWrite = false,
}: MonthlyUpdatesPageProps) {
    const [drafts, setDrafts] = useState<MonthlyUpdate[]>([]);
    const [tab, setTab] = useState<Tab>('reports');
    const [search, setSearch] = useState('');
    const [monthFilter, setMonthFilter] = useState('all');
    const [recordFilter, setRecordFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [dialog, setDialog] = useState(false);
    const [recordId, setRecordId] = useState('');
    const [month, setMonth] = useState(todayMonth());
    const [summary, setSummary] = useState('');
    const [progress, setProgress] = useState('0');
    const [saving, setSaving] = useState(false);
    const [files, setFiles] = useState<MediaItem[]>([]);
    const [formError, setFormError] = useState('');
    const [selectedUpdate, setSelectedUpdate] = useState<MonthlyUpdate | null>(
        null,
    );
    const [toast, setToast] = useState('');

    const allUpdates = useMemo(
        () =>
            [...drafts, ...initialUpdates].sort(
                (a, b) => b.month.localeCompare(a.month) || b.id - a.id,
            ),
        [drafts, initialUpdates],
    );
    const recordsById = useMemo(
        () => new Map(maintenanceRecords.map((r) => [r.id, r])),
        [maintenanceRecords],
    );
    const recordName = (id: number) => {
        const record = recordsById.get(id);

        return record ? record.projectTitle : `Maintenance record #${id}`;
    };
    const months = useMemo(
        () =>
            [...new Set(allUpdates.map((u) => u.month).filter(isValidMonth))]
                .sort()
                .reverse(),
        [allUpdates],
    );
    const filtered = useMemo(
        () =>
            allUpdates.filter((u) => {
                const query = search.trim().toLowerCase();

                return (
                    (!query ||
                        `${u.summary} ${u.author} ${u.month} ${recordName(u.maintenanceRecordId)} ${u.maintenanceRecordId}`
                            .toLowerCase()
                            .includes(query)) &&
                    (monthFilter === 'all' || u.month === monthFilter) &&
                    (recordFilter === 'all' ||
                        String(u.maintenanceRecordId) === recordFilter)
                );
            }),
        [allUpdates, search, monthFilter, recordFilter, maintenanceRecords],
    );
    const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, maxPage);
    const visible = filtered.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
    );
    const totalMedia = allUpdates.reduce(
        (total, update) => total + update.mediaCount,
        0,
    );
    const reportsThisMonth = allUpdates.filter(
        (u) => u.month === todayMonth(),
    ).length;
    const setFilter = (callback: () => void) => {
        callback();
        setPage(1);
    };

    function openDraft() {
        setRecordId(
            maintenanceRecords[0] ? String(maintenanceRecords[0].id) : '',
        );
        setMonth(todayMonth());
        setSummary('');
        setProgress('0');
        setFiles([]);
        setFormError('');
        setDialog(true);
    }
    function addLocalDraft(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const id = Number(recordId);

        if (!maintenanceRecords.some((r) => r.id === id)) {
            setFormError('Select a valid maintenance record.');

            return;
        }

        if (!isValidMonth(month)) {
            setFormError('Choose a month in YYYY-MM format.');

            return;
        }

        if (!summary.trim()) {
            setFormError('Enter a progress summary.');

            return;
        }

        if (
            allUpdates.some(
                (u) => u.maintenanceRecordId === id && u.month === month,
            )
        ) {
            setFormError(
                'An update for this maintenance record and month already exists. Only one update is allowed per month.',
            );

            return;
        }

        const draft: MonthlyUpdate = {
            id: -Date.now(),
            maintenanceRecordId: id,
            month,
            summary: summary.trim(),
            author: 'Local preview',
            createdAt: new Date().toISOString(),
            mediaCount: files.length,
            progressPercentage: null,
            localDraft: true,
            localMedia: files,
        };
        setDrafts((previous) => [draft, ...previous]);
        setDialog(false);
        setFilter(() => {
            setMonthFilter('all');
            setRecordFilter('all');
            setSearch('');
        });
        setTab('reports');
        setToast(
            'Draft added to this browser session only. Nothing was saved to Supabase.',
        );
    }
    function saveMonthlyUpdate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError('');

        if (!canWrite) {
            setFormError('Saving is not currently enabled.');

            return;
        }

        const id = Number(recordId);

        if (
            !maintenanceRecords.some((r) => r.id === id) ||
            !isValidMonth(month)
        ) {
            setFormError(
                'Choose an eligible maintenance record and a valid YYYY-MM month.',
            );

            return;
        }

        const percentage = Number(progress);

        if (
            !Number.isFinite(percentage) ||
            percentage < 0 ||
            percentage > 100 ||
            !/^\d{1,3}(\.\d{1,2})?$/.test(progress)
        ) {
            setFormError(
                'Progress must be between 0 and 100, with up to 2 decimals.',
            );

            return;
        }

        const payload = new FormData();
        payload.append('maintenance_id', recordId);
        payload.append('update_month', month);
        payload.append('progress_percentage', progress);
        payload.append('summary_of_text_reports', summary.trim());

        for (const item of files) {
            payload.append('files[]', item.file);
        }

        setSaving(true);
        router.post('/monthly-updates-preview/save', payload, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setDialog(false);
                setFiles([]);
                setPage(1);
                setToast('Monthly update saved to Supabase.');
            },
            onError: (errors) =>
                setFormError(
                    Object.values(errors).join(' ') ||
                        'Please review your report.',
                ),
            onFinish: () => setSaving(false),
        });
    }
    function pickFiles(selected: FileList | null) {
        if (!selected) {
            return;
        }

        const entries = Array.from(selected)
            .filter(
                (f) =>
                    f.type.startsWith('image/') || f.type.startsWith('video/'),
            )
            .map((f) => ({
                name: f.name,
                kind: (f.type.startsWith('video/')
                    ? 'Video'
                    : 'Photo') as MediaItem['kind'],
                bytes: f.size,
                file: f,
            }));
        setFiles((previous) => [...previous, ...entries]);
    }

    return (
        <ProjectWorkspace>
            <div className="jr-page-head">
                <div>
                    <h1>Monthly Updates</h1>
                    <p>
                        Track monthly maintenance progress and photo or video
                        evidence.
                    </p>
                </div>
                {(canWrite || canDraft) && (
                    <button
                        className={primary}
                        type="button"
                        onClick={openDraft}
                    >
                        <Plus className="size-4" /> Add Update
                    </button>
                )}
            </div>

            <div className="mt-5 space-y-2.5">
                {!canWrite && (
                    <Notice>
                        <strong>Read-only Supabase integration.</strong> Real
                        saving is disabled until the record-linked schema,
                        private storage and authorization are approved. Drafts
                        in this view are local previews only.
                    </Notice>
                )}
                {schemaNotice && (
                    <Notice warning>
                        <strong>Schema review needed:</strong> {schemaNotice}
                    </Notice>
                )}
                {mediaNotice && (
                    <Notice warning>
                        <strong>Media integration:</strong> {mediaNotice}
                    </Notice>
                )}
                {toast && (
                    <div
                        className="flex items-center justify-between gap-3 rounded-xl bg-[#EAF7EF] px-4 py-3 text-sm text-[#267A4A]"
                        role="status"
                    >
                        <span className="flex items-center gap-2">
                            <CheckCircle2 className="size-4" />
                            {toast}
                        </span>
                        <button
                            aria-label="Dismiss notification"
                            type="button"
                            onClick={() => setToast('')}
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat
                    label="Monthly Reports"
                    value={allUpdates.length}
                    icon={ClipboardList}
                    accent="bg-[#F7E9DF] text-[#9B522B]"
                />
                <Stat
                    label="Records Covered"
                    value={
                        new Set(allUpdates.map((u) => u.maintenanceRecordId))
                            .size
                    }
                    icon={HardHat}
                    accent="bg-[#EDF1FB] text-[#4C75B2]"
                />
                <Stat
                    label="Reports This Month"
                    value={reportsThisMonth}
                    icon={CalendarDays}
                    accent="bg-[#E9F6EF] text-[#299362]"
                />
                <Stat
                    label="Media Items"
                    value={totalMedia}
                    icon={Images}
                    accent="bg-[#F1EAFA] text-[#8862B0]"
                />
            </div>

            <div
                className="mt-7 flex flex-wrap gap-6 border-b border-[#E5EAF1]"
                role="tablist"
                aria-label="Monthly Updates views"
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'reports'}
                    onClick={() => setTab('reports')}
                    className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${tab === 'reports' ? 'border-[#91471F] text-[#91471F]' : 'border-transparent text-[#8293AD]'}`}
                >
                    <ClipboardList className="size-4" />
                    Monthly Reports
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'media'}
                    onClick={() => setTab('media')}
                    className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${tab === 'media' ? 'border-[#91471F] text-[#91471F]' : 'border-transparent text-[#8293AD]'}`}
                >
                    <Images className="size-4" />
                    Media Evidence
                </button>
            </div>

            {tab === 'reports' ? (
                <>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                        <label className="relative min-w-[230px] flex-1">
                            <span className="sr-only">
                                Search monthly reports
                            </span>
                            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#91A3BA]" />
                            <input
                                type="search"
                                value={search}
                                onChange={(e) =>
                                    setFilter(() => setSearch(e.target.value))
                                }
                                placeholder="Search reports or maintenance projects..."
                                className={`${field} pl-10`}
                            />
                        </label>
                        <label>
                            <span className="sr-only">Filter by month</span>
                            <select
                                className={`${field} min-w-[155px]`}
                                value={monthFilter}
                                onChange={(e) =>
                                    setFilter(() =>
                                        setMonthFilter(e.target.value),
                                    )
                                }
                            >
                                <option value="all">All Months</option>
                                {months.map((m) => (
                                    <option value={m} key={m}>
                                        {niceMonth(m)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            <span className="sr-only">
                                Filter by maintenance record
                            </span>
                            <select
                                className={`${field} max-w-[280px] min-w-[185px]`}
                                value={recordFilter}
                                onChange={(e) =>
                                    setFilter(() =>
                                        setRecordFilter(e.target.value),
                                    )
                                }
                            >
                                <option value="all">
                                    All Maintenance Records
                                </option>
                                {maintenanceRecords.map((r) => (
                                    <option value={r.id} key={r.id}>
                                        #{r.id} · {r.projectTitle}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="mt-5 flex items-center gap-2 text-sm text-[#637997]">
                        <ListFilter className="size-4" />
                        {filtered.length}{' '}
                        {filtered.length === 1 ? 'report' : 'reports'} found
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-xl border border-[#E6EBF2]">
                        <table className="w-full min-w-[830px] border-collapse text-left text-sm">
                            <thead>
                                <tr className="bg-[#F1F3F7] text-xs font-semibold tracking-[.045em] text-[#6981A0] uppercase">
                                    <th className="px-4 py-3">
                                        Maintenance Project / Record
                                    </th>
                                    <th className="px-4 py-3">
                                        Reporting Month
                                    </th>
                                    <th className="px-4 py-3">Progress</th>
                                    <th className="px-4 py-3">Summary</th>
                                    <th className="px-4 py-3">Media</th>
                                    <th className="px-4 py-3 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((u) => (
                                    <tr
                                        key={`${u.localDraft ? 'draft' : 'db'}-${u.id}`}
                                        className="border-t border-[#E9EDF4] text-[#465A76]"
                                    >
                                        <td className="px-4 py-4">
                                            <div className="font-semibold text-[#17283E]">
                                                {recordName(
                                                    u.maintenanceRecordId,
                                                )}
                                            </div>
                                            <div className="mt-1 text-xs text-[#8A9BB4]">
                                                Maintenance Record ID:{' '}
                                                {u.maintenanceRecordId}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="font-medium text-[#33465F]">
                                                {niceMonth(u.month)}
                                            </span>
                                            {u.localDraft && (
                                                <div className="mt-1">
                                                    <span className="rounded-full bg-[#FFF0E2] px-2 py-0.5 text-xs font-medium text-[#965020]">
                                                        Local draft
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            {u.progressPercentage == null
                                                ? '—'
                                                : `${u.progressPercentage}%`}
                                        </td>
                                        <td className="max-w-[300px] px-4 py-4">
                                            <p className="line-clamp-2">
                                                {u.summary ||
                                                    'No summary supplied'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Images className="size-4 text-[#8194B0]" />
                                                {u.mediaCount}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedUpdate(u)
                                                }
                                                className={neutral}
                                            >
                                                View details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filtered.length === 0 && (
                            <Empty
                                title={
                                    allUpdates.length === 0
                                        ? 'No monthly updates yet'
                                        : 'No matching updates'
                                }
                                description={
                                    schemaNotice
                                        ? 'The current monthly_updates schema needs review before reports can be loaded according to the data dictionary.'
                                        : 'Monthly updates belong to a maintenance record. Once records and reports exist, they will appear here.'
                                }
                            />
                        )}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-4 text-sm text-[#7B8EA8]">
                        <span>
                            {filtered.length
                                ? `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} reports`
                                : '0 reports'}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                aria-label="Previous page"
                                className={neutral}
                                disabled={currentPage === 1}
                                onClick={() =>
                                    setPage((p) => Math.max(1, p - 1))
                                }
                            >
                                <ChevronLeft className="size-4" />
                            </button>
                            <span className="rounded-lg bg-[#FAEBDF] px-3 py-2 font-semibold text-[#91502D]">
                                {currentPage}
                            </span>
                            <button
                                aria-label="Next page"
                                className={neutral}
                                disabled={currentPage === maxPage}
                                onClick={() =>
                                    setPage((p) => Math.min(maxPage, p + 1))
                                }
                            >
                                <ChevronRight className="size-4" />
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="mt-5 space-y-3">
                    <Notice>
                        Media belongs to a Monthly Update, not a Maintenance
                        Project.{' '}
                        {canWrite
                            ? 'Saved files are private and downloaded through authorized Laravel routes.'
                            : 'Files selected for local drafts are not uploaded.'}
                    </Notice>
                    {allUpdates
                        .filter((u) => u.mediaCount > 0)
                        .map((u) => (
                            <div
                                key={u.id}
                                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E3E9F2] px-5 py-4"
                            >
                                <div>
                                    <strong className="text-[#1D3048]">
                                        {recordName(u.maintenanceRecordId)}
                                    </strong>
                                    <p className="mt-1 text-sm text-[#8293AC]">
                                        {niceMonth(u.month)} ·{' '}
                                        {u.localDraft
                                            ? 'Local draft'
                                            : `Update #${u.id}`}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className={neutral}
                                    onClick={() => setSelectedUpdate(u)}
                                >
                                    <Images className="size-4" />
                                    {u.mediaCount}{' '}
                                    {u.mediaCount === 1 ? 'file' : 'files'}
                                </button>
                            </div>
                        ))}
                    {allUpdates.every((u) => u.mediaCount === 0) && (
                        <div className="rounded-xl border border-[#E3E9F2]">
                            <Empty
                                title="No media evidence yet"
                                description="Photo and video evidence attached to monthly updates will be summarized here once the media relationship is connected."
                            />
                        </div>
                    )}
                </div>
            )}

            {dialog && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-[#17263B]/50 p-4"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            setDialog(false);
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="monthly-form-title"
                        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="flex items-start justify-between border-b border-[#E7ECF3] px-6 py-5">
                            <div>
                                <h2
                                    id="monthly-form-title"
                                    className="text-xl font-bold text-[#19283C]"
                                >
                                    Add Monthly Update
                                </h2>
                                <p className="mt-1 text-sm text-[#7F91A8]">
                                    {canWrite
                                        ? 'Saved to Supabase with private evidence files.'
                                        : 'Local preview only — this will not write to Supabase.'}
                                </p>
                            </div>
                            <button
                                aria-label="Close form"
                                className="rounded-lg p-1.5 text-[#6B819D] hover:bg-[#F1F3F7]"
                                onClick={() => setDialog(false)}
                            >
                                <X className="size-5" />
                            </button>
                        </div>
                        <form
                            onSubmit={
                                canWrite ? saveMonthlyUpdate : addLocalDraft
                            }
                            className="space-y-4 p-6"
                        >
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold text-[#394F6B]">
                                    Maintenance Record{' '}
                                    <span className="text-[#B84A2C]">*</span>
                                </span>
                                <select
                                    required
                                    value={recordId}
                                    onChange={(e) =>
                                        setRecordId(e.target.value)
                                    }
                                    className={field}
                                >
                                    <option value="">
                                        Select a maintenance record
                                    </option>
                                    {maintenanceRecords.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            #{r.id} · {r.projectTitle}
                                            {r.year ? ` · ${r.year}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {maintenanceRecords.length === 0 && (
                                <Notice warning>
                                    No maintenance records exist yet. Create an
                                    eligible Maintenance Record before recording
                                    its monthly progress.
                                </Notice>
                            )}
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold text-[#394F6B]">
                                    Update Month{' '}
                                    <span className="text-[#B84A2C]">*</span>
                                </span>
                                <input
                                    type="month"
                                    value={month}
                                    required
                                    onChange={(e) => setMonth(e.target.value)}
                                    className={field}
                                />
                                <span className="mt-1 block text-xs text-[#8B9BB0]">
                                    Stored conceptually as YYYY-MM; one update
                                    per maintenance record per month.
                                </span>
                            </label>
                            {canWrite && (
                                <label className="block">
                                    <span className="mb-1.5 block text-sm font-semibold text-[#394F6B]">
                                        Progress Percentage *
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        required
                                        value={progress}
                                        onChange={(e) =>
                                            setProgress(e.target.value)
                                        }
                                        className={field}
                                    />
                                </label>
                            )}
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold text-[#394F6B]">
                                    Progress Summary{' '}
                                    {canWrite ? '(optional)' : '*'}
                                </span>
                                <textarea
                                    rows={4}
                                    value={summary}
                                    maxLength={5000}
                                    onChange={(e) => setSummary(e.target.value)}
                                    placeholder="Describe progress, completed work, delays, and next steps..."
                                    className={field}
                                    required={!canWrite}
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold text-[#394F6B]">
                                    Photo / Video Evidence{' '}
                                    {canWrite
                                        ? '(private storage)'
                                        : '(preview)'}
                                </span>
                            </label>
                            <input
                                aria-label="Select photo or video evidence"
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                                onChange={(e) => pickFiles(e.target.files)}
                                className={`${field} file:mr-3 file:rounded-lg file:border-0 file:bg-[#F7E9DE] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[#914A21]`}
                            />
                            {files.length > 0 && (
                                <div className="space-y-1 rounded-xl bg-[#F7F9FC] p-3">
                                    {files.map((f, i) => (
                                        <div
                                            key={`${f.name}-${i}`}
                                            className="flex items-center justify-between gap-2 text-xs text-[#5E708C]"
                                        >
                                            <span className="flex items-center gap-2 truncate">
                                                {f.kind === 'Photo' ? (
                                                    <FileImage className="size-4" />
                                                ) : (
                                                    <Film className="size-4" />
                                                )}
                                                {f.name}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label={`Remove ${f.name}`}
                                                onClick={() =>
                                                    setFiles((previous) =>
                                                        previous.filter(
                                                            (_, ix) => ix !== i,
                                                        ),
                                                    )
                                                }
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {formError && (
                                <p
                                    role="alert"
                                    className="rounded-xl bg-[#FFF2EB] px-3 py-2 text-sm text-[#A04B29]"
                                >
                                    {formError}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDialog(false)}
                                    className={neutral}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        !maintenanceRecords.length || saving
                                    }
                                    className={primary}
                                >
                                    <FilePlus2 className="size-4" />
                                    {saving
                                        ? 'Saving...'
                                        : canWrite
                                          ? 'Save Monthly Update'
                                          : 'Save Local Draft'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}

            {selectedUpdate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-[#17263B]/50 p-4"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            setSelectedUpdate(null);
                        }
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="monthly-detail-title"
                        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="flex justify-between gap-3 border-b border-[#E7ECF3] p-6">
                            <div>
                                <h2
                                    id="monthly-detail-title"
                                    className="text-xl font-bold text-[#19283C]"
                                >
                                    Monthly Update Details
                                </h2>
                                <p className="mt-1 text-sm text-[#7C8EA8]">
                                    {niceMonth(selectedUpdate.month)} ·
                                    Maintenance record #
                                    {selectedUpdate.maintenanceRecordId}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close details"
                                onClick={() => setSelectedUpdate(null)}
                            >
                                <X className="size-5 text-[#7487A0]" />
                            </button>
                        </div>
                        <div className="space-y-5 p-6 text-sm">
                            <div>
                                <div className="text-xs font-semibold tracking-wide text-[#7A8EAA] uppercase">
                                    Maintenance Project
                                </div>
                                <div className="mt-1 font-semibold text-[#1D2E47]">
                                    {recordName(
                                        selectedUpdate.maintenanceRecordId,
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold tracking-wide text-[#7A8EAA] uppercase">
                                    Report Summary
                                </div>
                                <p className="mt-1 leading-6 whitespace-pre-wrap text-[#405674]">
                                    {selectedUpdate.summary ||
                                        'No summary supplied'}
                                </p>
                            </div>
                            <div>
                                <div className="text-xs font-semibold tracking-wide text-[#7A8EAA] uppercase">
                                    Created By
                                </div>
                                <p className="mt-1 text-[#405674]">
                                    {selectedUpdate.author}
                                </p>
                            </div>
                            <div>
                                <div className="text-xs font-semibold tracking-wide text-[#7A8EAA] uppercase">
                                    Media Evidence ({selectedUpdate.mediaCount})
                                </div>
                                {selectedUpdate.localMedia?.length ? (
                                    <div className="mt-2 space-y-2">
                                        {selectedUpdate.localMedia.map(
                                            (f, i) => (
                                                <div
                                                    className="flex items-center gap-2 rounded-lg bg-[#F7F9FC] p-2.5 text-[#526780]"
                                                    key={i}
                                                >
                                                    {f.kind === 'Photo' ? (
                                                        <FileImage className="size-4" />
                                                    ) : (
                                                        <Film className="size-4" />
                                                    )}
                                                    {f.name}
                                                </div>
                                            ),
                                        )}
                                    </div>
                                ) : (
                                    <p className="mt-1 text-[#8295AC]">
                                        {selectedUpdate.mediaCount
                                            ? `${selectedUpdate.mediaCount} associated file(s).`
                                            : 'No files attached.'}
                                    </p>
                                )}
                            </div>
                            {selectedUpdate.mediaFiles?.length ? (
                                <div className="mt-3 space-y-2">
                                    {selectedUpdate.mediaFiles.map((f) => (
                                        <a
                                            key={f.id}
                                            className="block rounded-xl border border-[#E7ECF3] px-3 py-2 text-[#934B23] hover:bg-[#FFF8F2]"
                                            href={`/monthly-updates-preview/media/${f.id}/download`}
                                        >
                                            {f.name} · Download
                                        </a>
                                    ))}
                                </div>
                            ) : null}
                            {selectedUpdate.localDraft && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDrafts((current) =>
                                            current.filter(
                                                (d) =>
                                                    d.id !== selectedUpdate.id,
                                            ),
                                        );
                                        setSelectedUpdate(null);
                                        setToast(
                                            'Local draft discarded. Supabase data was not changed.',
                                        );
                                    }}
                                    className="rounded-xl border border-[#E6D8D8] px-4 py-2.5 font-medium text-[#A44740] hover:bg-[#FFF6F5]"
                                >
                                    Discard local draft
                                </button>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </ProjectWorkspace>
    );
}

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
import { useCallback, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { requestOperation } from '@/pages/dd-phase3/requests';
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
    mediaFiles?: {
        id: number;
        name: string;
    }[];
};
export type MaintenanceRecordOption = {
    id: number;
    projectId: number;
    projectTitle: string;
    year: number | null;
    quarter: string | null;
    status: string;
};
export type DdMonthlyUpdatesProps = {
    initialUpdates?: MonthlyUpdate[];
    maintenanceRecords?: MaintenanceRecordOption[];
    schemaNotice?: string | null;
    mediaNotice?: string | null;
    canWrite?: boolean;
    canManage: boolean;
    writableRecordIds: number[];
    mediaReady: boolean;
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
export default function DdMonthlyUpdates({
    initialUpdates = [],
    maintenanceRecords = [],
    schemaNotice = null,
    mediaNotice = null,
    canWrite = false,
    canManage,
    writableRecordIds,
    mediaReady,
}: DdMonthlyUpdatesProps) {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const eligibleRecords = maintenanceRecords.filter((r) =>
        writableRecordIds.includes(r.id),
    );
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
    const [formError, setFormError] = useState('');
    const [selectedUpdate, setSelectedUpdate] = useState<MonthlyUpdate | null>(
        null,
    );
    const [toast, setToast] = useState('');
    const allUpdates = useMemo(
        () =>
            [...initialUpdates].sort(
                (a, b) => b.month.localeCompare(a.month) || b.id - a.id,
            ),
        [initialUpdates],
    );
    const recordsById = useMemo(
        () => new Map(maintenanceRecords.map((r) => [r.id, r])),
        [maintenanceRecords],
    );
    const recordName = useCallback(
        (id: number) => {
            const record = recordsById.get(id);

            return record ? record.projectTitle : `Maintenance record #${id}`;
        },
        [recordsById],
    );
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
        [allUpdates, search, monthFilter, recordFilter, recordName],
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
        setEditingId(null);
        setRecordId(eligibleRecords[0] ? String(eligibleRecords[0].id) : '');
        setMonth(todayMonth());
        setSummary('');
        setProgress('0');
        setFormError('');
        setDialog(true);
    }
    async function saveMonthlyUpdate(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError('');

        if (!canWrite || saving) {
            return;
        }

        if (
            !eligibleRecords.some((r) => r.id === Number(recordId)) ||
            !isValidMonth(month)
        ) {
            setFormError(
                'Choose an eligible maintenance record and reporting month.',
            );

            return;
        }

        const percentage = Number(progress);

        if (
            !Number.isFinite(percentage) ||
            percentage < 0 ||
            percentage > 100
        ) {
            setFormError('Progress must be between 0 and 100.');

            return;
        }

        if (
            initialUpdates.some(
                (u) =>
                    u.id !== editingId &&
                    u.maintenanceRecordId === Number(recordId) &&
                    u.month === month,
            )
        ) {
            setFormError(
                'An update already exists for this maintenance record and month.',
            );

            return;
        }

        setSaving(true);

        try {
            await requestOperation(
                `/dd-phase3/ops/updates${editingId === null ? '' : `/${editingId}`}`,
                {
                    maintenance_id: recordId,
                    update_month: month,
                    progress_percentage: progress,
                    summary_of_text_reports: summary.trim(),
                },
                editingId === null ? 'post' : 'put',
            );
            setDialog(false);
            setPage(1);
            setToast(
                'Monthly update saved. Open its details to attach photos or videos.',
            );
        } catch (failure) {
            setFormError(
                failure instanceof Error
                    ? failure.message
                    : 'Unable to save monthly update.',
            );
        } finally {
            setSaving(false);
        }
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
                {canWrite && eligibleRecords.length > 0 && (
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
                                        key={`${'db'}-${u.id}`}
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
                                            {false}
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
                                                onClick={() => {
                                                    setAttachment(null);
                                                    setUploadError('');
                                                    setSelectedUpdate(u);
                                                }}
                                                className={neutral}
                                            >
                                                View details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {visible.length === 0 && (
                                    <tr className="jr-dd-empty-row">
                                        <td colSpan={6}>
                                            <div
                                                className="jr-dd-empty-content"
                                                role="status"
                                            >
                                                <span
                                                    className="jr-dd-empty-icon"
                                                    aria-hidden="true"
                                                >
                                                    <ClipboardList className="h-6 w-6" />
                                                </span>
                                                <strong>
                                                    {allUpdates.length
                                                        ? 'No matching updates'
                                                        : 'No monthly updates yet'}
                                                </strong>
                                                <p>
                                                    {allUpdates.length
                                                        ? 'Try changing the month or maintenance filters.'
                                                        : 'Monthly reports are attached to Maintenance Records.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
                        Open a monthly update to view its photos and videos.
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
                                        {`Update #${u.id}`}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className={neutral}
                                    onClick={() => {
                                        setAttachment(null);
                                        setUploadError('');
                                        setSelectedUpdate(u);
                                    }}
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
                                description="Photos and videos attached to monthly updates will appear here."
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
                                    {editingId === null
                                        ? 'Add Monthly Update'
                                        : 'Edit Monthly Update'}
                                </h2>
                                <p className="mt-1 text-sm text-[#7F91A8]">
                                    Record progress for the selected maintenance
                                    activity.
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
                            onSubmit={saveMonthlyUpdate}
                            className="space-y-4 p-6"
                        >
                            <label className="block">
                                <span className="mb-1.5 block text-sm font-semibold text-[#394F6B]">
                                    Maintenance Record{' '}
                                    <span className="text-[#B84A2C]">*</span>
                                </span>
                                <select
                                    disabled={editingId !== null}
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
                                    {eligibleRecords.map((r) => (
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
                                    Submit one report per maintenance record
                                    each month.
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
                            <p className="text-xs text-[#7F91A8]">
                                Save this report, then open its details to
                                attach photos or videos.
                            </p>
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
                                    {saving ? 'Saving…' : 'Save Monthly Update'}
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
                                            href={`/dd-phase3/files/media/${f.id}`}
                                        >
                                            {f.name} · Download
                                        </a>
                                    ))}
                                </div>
                            ) : null}
                            {writableRecordIds.includes(
                                selectedUpdate.maintenanceRecordId,
                            ) && (
                                <div className="space-y-4 border-t border-[#E7ECF3] pt-4">
                                    <button
                                        type="button"
                                        className={neutral}
                                        onClick={() => {
                                            setEditingId(selectedUpdate.id);
                                            setRecordId(
                                                String(
                                                    selectedUpdate.maintenanceRecordId,
                                                ),
                                            );
                                            setMonth(selectedUpdate.month);
                                            setSummary(selectedUpdate.summary);
                                            setProgress(
                                                String(
                                                    selectedUpdate.progressPercentage ??
                                                        0,
                                                ),
                                            );
                                            setFormError('');
                                            setSelectedUpdate(null);
                                            setDialog(true);
                                        }}
                                    >
                                        Edit update
                                    </button>
                                    <form
                                        className="space-y-3"
                                        onSubmit={async (e) => {
                                            e.preventDefault();

                                            if (
                                                !attachment ||
                                                uploading ||
                                                !mediaReady
                                            ) {
                                                return;
                                            }

                                            setUploading(true);
                                            setUploadError('');

                                            try {
                                                await requestOperation(
                                                    '/dd-phase3/ops/media',
                                                    {
                                                        monthly_update_id:
                                                            String(
                                                                selectedUpdate.id,
                                                            ),
                                                        file: attachment,
                                                    },
                                                    'post',
                                                    true,
                                                );
                                                setAttachment(null);
                                                setSelectedUpdate(null);
                                                setToast('Evidence uploaded.');
                                            } catch (failure) {
                                                setUploadError(
                                                    failure instanceof Error
                                                        ? failure.message
                                                        : 'Unable to upload evidence.',
                                                );
                                            } finally {
                                                setUploading(false);
                                            }
                                        }}
                                    >
                                        <label className="block text-sm font-semibold">
                                            Attach photo or video
                                            <input
                                                type="file"
                                                required
                                                disabled={
                                                    !mediaReady || uploading
                                                }
                                                className={`${field} mt-2`}
                                                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                                                onChange={(e) => {
                                                    setAttachment(
                                                        e.target.files?.[0] ??
                                                            null,
                                                    );
                                                    setUploadError('');
                                                }}
                                            />
                                        </label>
                                        <p className="text-xs text-[#7F91A8]">
                                            JPG, PNG, WEBP, MP4 or WEBM · up to
                                            20 MB per file.
                                        </p>
                                        {!mediaReady && (
                                            <Notice warning>
                                                Evidence uploads are temporarily
                                                unavailable. Contact your
                                                administrator.
                                            </Notice>
                                        )}
                                        {uploadError && (
                                            <p
                                                role="alert"
                                                className="text-red-700"
                                            >
                                                {uploadError}
                                            </p>
                                        )}
                                        <button
                                            type="submit"
                                            disabled={
                                                !mediaReady ||
                                                !attachment ||
                                                uploading
                                            }
                                            className={primary}
                                        >
                                            {uploading
                                                ? 'Uploading…'
                                                : 'Upload evidence'}
                                        </button>
                                    </form>
                                </div>
                            )}
                            {canManage && (
                                <button
                                    type="button"
                                    className={`${neutral} text-red-700`}
                                    onClick={async () => {
                                        if (
                                            !window.confirm(
                                                'Delete this monthly update? Attached files will prevent deletion.',
                                            )
                                        ) {
                                            return;
                                        }

                                        try {
                                            await requestOperation(
                                                `/dd-phase3/ops/updates/${selectedUpdate.id}`,
                                                {},
                                                'delete',
                                            );
                                            setSelectedUpdate(null);
                                            setToast('Monthly update deleted.');
                                        } catch (failure) {
                                            setUploadError(
                                                failure instanceof Error
                                                    ? failure.message
                                                    : 'Unable to delete update.',
                                            );
                                        }
                                    }}
                                >
                                    Delete update
                                </button>
                            )}
                            {uploadError &&
                                !writableRecordIds.includes(
                                    selectedUpdate.maintenanceRecordId,
                                ) && (
                                    <p role="alert" className="text-red-700">
                                        {uploadError}
                                    </p>
                                )}
                        </div>
                    </section>
                </div>
            )}
        </ProjectWorkspace>
    );
}

import {
    Building2,
    ChevronLeft,
    ChevronRight,
    FilePenLine,
    Info,
    MoreHorizontal,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { requestOperation } from '@/pages/dd-phase3/requests';
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
export type DdLguDirectoryProps = {
    initialLgus?: LguRecord[];
    schemaNotice?: string | null;
    canCreate?: boolean;
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
type Editor =
    | {
          kind: 'add';
      }
    | {
          kind: 'edit';
          id: number;
      }
    | null;
const emptyForm: LguForm = {
    municipalityName: '',
    province: '',
    region: '',
    mayorFirstName: '',
    mayorMiddleName: '',
    mayorLastName: '',
};
const control =
    'min-h-10 w-full rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm text-[#20324A] outline-none placeholder:text-[#91A2BA] focus:border-[#98512D] focus:ring-2 focus:ring-[#F6E6DA]';
const secondary =
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#DFE6F0] bg-white px-3.5 py-2.5 text-sm font-medium text-[#405572] transition hover:bg-[#F8FAFD] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#994C29] disabled:cursor-not-allowed disabled:opacity-50';
const pageSize = 8;
function present(
    value: string | null | undefined,
    supported = true,
): ReactNode {
    return value?.trim() ? (
        value
    ) : (
        <span className="text-[#95A4B7]">
            {supported ? 'Not recorded' : 'Not in current schema'}
        </span>
    );
}
function mayorName(item: LguRecord): string {
    return [item.mayorFirstName, item.mayorMiddleName, item.mayorLastName]
        .filter(Boolean)
        .join(' ')
        .trim();
}
function toForm(item: LguRecord): LguForm {
    return {
        municipalityName: item.municipalityName,
        province: item.province ?? '',
        region: item.region ?? '',
        mayorFirstName: item.mayorFirstName ?? '',
        mayorMiddleName: item.mayorMiddleName ?? '',
        mayorLastName: item.mayorLastName ?? '',
    };
}
function Modal({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    useEffect(() => {
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', closeOnEscape);

        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#15253B]/55 p-3 sm:p-6"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="max-h-[90vh] w-full max-w-[650px] overflow-y-auto rounded-2xl border border-[#DDE5F0] bg-white shadow-2xl"
            >
                {children}
            </section>
        </div>
    );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-[#8A9BB1] uppercase">
                {label}
            </p>
            <div className="text-sm font-medium text-[#263A52]">{children}</div>
        </div>
    );
}
export default function DdLguDirectory({
    initialLgus = [],
    availableFields = {},
    schemaNotice = null,
    canCreate = false,
}: DdLguDirectoryProps) {
    const [saving, setSaving] = useState(false);
    const [query, setQuery] = useState('');
    const [provinceFilter, setProvinceFilter] = useState('all');
    const [sort, setSort] = useState<'name' | 'newest' | 'oldest'>('name');
    const [page, setPage] = useState(1);
    const [detailsId, setDetailsId] = useState<number | null>(null);
    const [editor, setEditor] = useState<Editor>(null);
    const [form, setForm] = useState<LguForm>(emptyForm);
    const [formError, setFormError] = useState('');
    const items = initialLgus;
    const provinces = useMemo(
        () =>
            Array.from(
                new Set(
                    items
                        .map((item) => item.province?.trim())
                        .filter((value): value is string => Boolean(value)),
                ),
            ).sort(),
        [items],
    );
    const filtered = useMemo(() => {
        const normalized = query.toLocaleLowerCase().trim();
        const result = items.filter((item) => {
            const searchText = [
                item.municipalityName,
                item.province,
                item.region,
                mayorName(item),
                String(item.id),
            ]
                .join(' ')
                .toLocaleLowerCase();

            return (
                (!normalized || searchText.includes(normalized)) &&
                (provinceFilter === 'all' || item.province === provinceFilter)
            );
        });

        return result.sort((a, b) => {
            if (sort === 'newest') {
                return b.id - a.id;
            }

            if (sort === 'oldest') {
                return a.id - b.id;
            }

            return (
                a.municipalityName.localeCompare(b.municipalityName) ||
                a.id - b.id
            );
        });
    }, [items, query, provinceFilter, sort]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, pageCount);
    const visible = filtered.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize,
    );
    const details =
        detailsId === null
            ? null
            : (items.find((item) => item.id === detailsId) ?? null);
    const [detailsError, setDetailsError] = useState('');
    const coveragesLinked = items.reduce(
        (sum, item) => sum + (item.roadCoverageCount ?? 0),
        0,
    );
    const fieldsMissing = [
        'province',
        'region',
        'mayorFirst',
        'mayorMiddle',
        'mayorLast',
    ].filter((key) => !availableFields[key as keyof typeof availableFields]);
    const openAdd = () => {
        if (!canCreate) {
            return;
        }

        setForm({ ...emptyForm });
        setFormError('');
        setEditor({ kind: 'add' });
    };
    const openEdit = (item: LguRecord) => {
        if (!canCreate) {
            return;
        }

        setForm(toForm(item));
        setFormError('');
        setEditor({ kind: 'edit', id: item.id });
        setDetailsId(null);
    };
    const closeEditor = () => {
        setEditor(null);
        setFormError('');
    };
    const setValue = (key: keyof LguForm, value: string) =>
        setForm((prev) => ({ ...prev, [key]: value }));
    const savePreview = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!canCreate) {
            setFormError(
                'LGU modifications are unavailable in read-only mode.',
            );

            return;
        }

        const normalized: LguForm = Object.fromEntries(
            Object.entries(form).map(([key, value]) => [key, value.trim()]),
        ) as LguForm;

        if (
            !normalized.municipalityName ||
            !normalized.province ||
            !normalized.region ||
            !normalized.mayorFirstName ||
            !normalized.mayorLastName
        ) {
            setFormError(
                'Municipality, province, region, and the mayor’s first and last names are required for new LGU records.',
            );

            return;
        }

        if (saving || editor === null) {
            return;
        }

        setSaving(true);

        try {
            await requestOperation(
                editor.kind === 'add'
                    ? '/dd-phase3/lgus'
                    : `/dd-phase3/lgus/${editor.id}`,
                {
                    municipality_name: normalized.municipalityName,
                    province: normalized.province,
                    region: normalized.region,
                    mayor_first_name: normalized.mayorFirstName,
                    mayor_middle_name: normalized.mayorMiddleName,
                    mayor_last_name: normalized.mayorLastName,
                },
                editor.kind === 'add' ? 'post' : 'put',
            );
            setPage(1);
            closeEditor();
        } catch (failure) {
            setFormError(
                failure instanceof Error
                    ? failure.message
                    : 'Unable to save municipality.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <ProjectWorkspace>
            <div className="jr-page-head">
                <div>
                    <h1>LGU</h1>
                    <p>
                        {canCreate
                            ? 'Browse and manage municipality reference information.'
                            : 'Browse municipality reference information (read-only).'}
                    </p>
                </div>
                {canCreate && (
                    <button
                        type="button"
                        className="jr-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                        onClick={openAdd}
                    >
                        <Plus className="size-[17px]" /> Add LGU
                    </button>
                )}
            </div>

            {schemaNotice && (
                <div
                    className="mb-5 rounded-xl border border-[#E5D8C8] bg-[#FFF7ED] px-4 py-3 text-sm text-[#85532D]"
                    role="status"
                >
                    {schemaNotice}
                </div>
            )}
            {fieldsMissing.length > 0 && (
                <div
                    className="mb-5 flex items-start gap-2 rounded-xl border border-[#DFE7F1] bg-[#F6F9FD] px-4 py-3 text-sm text-[#58718C]"
                    role="note"
                >
                    <Info className="mt-0.5 size-4 shrink-0" />
                    <span>
                        Some municipality details are unavailable. Contact your
                        administrator if information needs updating.
                    </span>
                </div>
            )}

            <section
                aria-label="LGU overview"
                className="grid gap-3 sm:grid-cols-3"
            >
                <div className="rounded-2xl border border-[#E2E8F1] bg-gradient-to-br from-[#FFFAF4] to-white p-5 shadow-sm">
                    <div className="flex items-center justify-between text-[#A1582C]">
                        <span className="text-xs font-semibold tracking-wider uppercase">
                            Municipalities
                        </span>
                        <Building2 className="size-5" />
                    </div>
                    <p className="mt-3 text-3xl font-bold text-[#1D324B]">
                        {initialLgus.length}
                    </p>
                    <p className="mt-1 text-xs text-[#8294AA]">
                        Saved LGU records
                    </p>
                </div>
                <div className="rounded-2xl border border-[#E2E8F1] bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold tracking-wider text-[#7389A3] uppercase">
                        Road coverages
                    </p>
                    <p className="mt-3 text-3xl font-bold text-[#1D324B]">
                        {availableFields.roadLinks ? coveragesLinked : '—'}
                    </p>
                    <p className="mt-1 text-xs text-[#8294AA]">
                        Linked to municipalities
                    </p>
                </div>
                <div className="rounded-2xl border border-[#E2E8F1] bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold tracking-wider text-[#7389A3] uppercase">
                        Engineer assignments
                    </p>
                    <p className="mt-3 text-3xl font-bold text-[#1D324B]">
                        {availableFields.engineerAssignments
                            ? initialLgus.reduce(
                                  (sum, lgu) =>
                                      sum + (lgu.activeAssignmentCount ?? 0),
                                  0,
                              )
                            : '—'}
                    </p>
                    <p className="mt-1 text-xs text-[#8294AA]">
                        Active engineer assignments
                    </p>
                </div>
            </section>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-b border-[#E6ECF3] pb-4">
                <div>
                    <h2 className="text-lg font-bold text-[#1C2F47]">
                        Municipality directory
                    </h2>
                    <p className="text-xs text-[#8193A9]">
                        Explore existing LGUs and open a municipality for
                        details.
                    </p>
                </div>
                <span className="rounded-full bg-[#F5F0EA] px-3 py-1.5 text-xs font-medium text-[#8B4A24]">
                    {filtered.length} results
                </span>
            </div>

            <div className="mt-5 grid gap-3 rounded-2xl border border-[#E5EAF2] bg-[#F9FAFC] p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="jr-search relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-[#8BA0B7]" />
                    <input
                        aria-label="Search municipalities"
                        className={`${control} pl-10`}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Search municipality, province, region or mayor..."
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <label className="sr-only" htmlFor="lgu-province-filter">
                        Filter by province
                    </label>
                    <select
                        id="lgu-province-filter"
                        className={`${control} w-auto min-w-48`}
                        value={provinceFilter}
                        onChange={(event) => {
                            setProvinceFilter(event.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="all">All Provinces</option>
                        {provinces.map((province) => (
                            <option key={province} value={province}>
                                {province}
                            </option>
                        ))}
                    </select>
                    <label className="sr-only" htmlFor="lgu-sort">
                        Sort LGUs
                    </label>
                    <select
                        id="lgu-sort"
                        className={`${control} w-auto min-w-40`}
                        value={sort}
                        onChange={(event) => {
                            setSort(event.target.value as typeof sort);
                            setPage(1);
                        }}
                    >
                        <option value="name">Municipality A–Z</option>
                        <option value="newest">Newest ID first</option>
                        <option value="oldest">Oldest ID first</option>
                    </select>
                </div>
            </div>

            <div className="jr-table-toolbar mt-6">
                <span role="status">
                    {filtered.length} {filtered.length === 1 ? 'LGU' : 'LGUs'}{' '}
                    found
                </span>
                <span className="text-xs text-[#8092A7]">
                    Select a municipality to view its details
                </span>
            </div>
            <div className="jr-table-wrap overflow-x-auto">
                <table className="jr-table min-w-[820px]">
                    <thead>
                        <tr>
                            <th>Municipality</th>
                            <th>Province</th>
                            <th>Region</th>
                            <th>Road Coverages</th>
                            <th>Engineer Assignments</th>
                            <th className="text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    <button
                                        type="button"
                                        className="text-left"
                                        onClick={() => setDetailsId(item.id)}
                                    >
                                        <strong className="jr-project-title block">
                                            {item.municipalityName}
                                        </strong>
                                        <span className="jr-project-id">
                                            {`LGU ID: ${item.id}`}
                                            {''}
                                        </span>
                                    </button>
                                </td>
                                <td>
                                    {present(
                                        item.province,
                                        availableFields.province ||
                                            false ||
                                            false,
                                    )}
                                </td>
                                <td>
                                    {present(
                                        item.region,
                                        availableFields.region ||
                                            false ||
                                            false,
                                    )}
                                </td>
                                <td>
                                    {item.roadCoverageCount === null ? (
                                        <span className="text-[#95A4B7]">
                                            Unavailable
                                        </span>
                                    ) : (
                                        <span className="font-medium text-[#39516E]">
                                            {item.roadCoverageCount}
                                        </span>
                                    )}
                                </td>
                                <td>
                                    {item.activeAssignmentCount === null ? (
                                        <span className="text-[#95A4B7]">
                                            Not available
                                        </span>
                                    ) : (
                                        item.activeAssignmentCount
                                    )}
                                </td>
                                <td className="text-right">
                                    <button
                                        type="button"
                                        className={`${secondary} px-2.5`}
                                        onClick={() => setDetailsId(item.id)}
                                        aria-label={`View ${item.municipalityName} details`}
                                    >
                                        <MoreHorizontal className="size-4" />
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
                                            <Building2 className="h-6 w-6" />
                                        </span>
                                        <strong>
                                            {items.length
                                                ? 'No matching LGUs'
                                                : 'No LGUs available yet'}
                                        </strong>
                                        <p>
                                            {items.length
                                                ? 'Try another search or province.'
                                                : 'Add an LGU to begin recording municipality information.'}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <footer className="jr-table-footer">
                <span>
                    {filtered.length
                        ? `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length} LGUs`
                        : '0 LGUs'}
                </span>
                <nav aria-label="LGU pagination" className="flex gap-1">
                    <button
                        type="button"
                        className={`${secondary} px-2.5`}
                        disabled={safePage <= 1}
                        onClick={() => setPage(safePage - 1)}
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <span className="flex min-w-9 items-center justify-center rounded-lg bg-[#FFF0E2] text-sm font-medium text-[#97502A]">
                        {safePage}
                    </span>
                    <button
                        type="button"
                        className={`${secondary} px-2.5`}
                        disabled={safePage >= pageCount}
                        onClick={() => setPage(safePage + 1)}
                        aria-label="Next page"
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </nav>
            </footer>

            {details && (
                <Modal
                    title={`LGU details: ${details.municipalityName}`}
                    onClose={() => setDetailsId(null)}
                >
                    <div className="flex items-start justify-between border-b border-[#E4EAF2] px-6 py-5">
                        <div>
                            <p className="text-xs font-semibold tracking-wide text-[#93502B] uppercase">
                                {`LGU #${details.id}`}
                            </p>
                            <h2 className="mt-1 text-xl font-semibold text-[#20324A]">
                                {details.municipalityName}
                            </h2>
                            <p className="mt-1 text-sm text-[#8092AA]">
                                Municipality master information
                            </p>
                        </div>
                        <button
                            type="button"
                            className={secondary}
                            onClick={() => setDetailsId(null)}
                            aria-label="Close details"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                    <div className="space-y-5 px-6 py-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Province">
                                {present(
                                    details.province,
                                    availableFields.province || false || false,
                                )}
                            </Field>
                            <Field label="Region">
                                {present(
                                    details.region,
                                    availableFields.region || false || false,
                                )}
                            </Field>
                        </div>
                        <div className="rounded-xl border border-[#E4EAF2] bg-[#FAFBFD] p-4">
                            <p className="mb-3 text-sm font-semibold text-[#20334B]">
                                Mayor Information
                            </p>
                            <div className="grid gap-4 sm:grid-cols-3">
                                <Field label="First name">
                                    {present(
                                        details.mayorFirstName,
                                        availableFields.mayorFirst ||
                                            false ||
                                            false,
                                    )}
                                </Field>
                                <Field label="Middle name">
                                    {present(
                                        details.mayorMiddleName,
                                        availableFields.mayorMiddle ||
                                            false ||
                                            false,
                                    )}
                                </Field>
                                <Field label="Last name">
                                    {present(
                                        details.mayorLastName,
                                        availableFields.mayorLast ||
                                            false ||
                                            false,
                                    )}
                                </Field>
                            </div>
                        </div>
                        <div className="grid gap-4 rounded-xl border border-[#E4EAF2] p-4 sm:grid-cols-2">
                            <Field label="Linked Road Coverages">
                                {details.roadCoverageCount ?? 'Not available'}
                            </Field>
                            <Field label="Active engineer assignments">
                                {details.activeAssignmentCount ??
                                    'Not available'}
                            </Field>
                        </div>
                        <div className="rounded-xl bg-[#F6F8FC] p-4 text-xs leading-relaxed text-[#647D96]">
                            <ShieldCheck className="mb-2 size-4 text-[#92552F]" />
                            <p>
                                Municipality information is shared across road
                                coverages and engineer assignments.
                            </p>
                        </div>
                    </div>
                    {detailsError && (
                        <p
                            role="alert"
                            className="mx-6 mb-3 rounded-lg bg-[#FFF0F0] px-3 py-2 text-sm text-[#AD4948]"
                        >
                            {detailsError}
                        </p>
                    )}
                    <div className="flex flex-wrap justify-between gap-2 border-t border-[#E4EAF2] px-6 py-4">
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className={secondary}
                                onClick={() => {
                                    setDetailsId(null);
                                    setDetailsError('');
                                }}
                            >
                                Close
                            </button>
                        </div>
                        {canCreate && (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className={secondary}
                                    onClick={() => {
                                        setDetailsError('');
                                        openEdit(details);
                                    }}
                                >
                                    <FilePenLine className="size-4" /> Edit LGU
                                </button>
                                <button
                                    type="button"
                                    disabled={saving}
                                    className={`${secondary} text-red-700`}
                                    onClick={async () => {
                                        if (
                                            !window.confirm(
                                                `Delete ${details.municipalityName}? Linked road coverages or engineer assignments will block deletion.`,
                                            )
                                        ) {
                                            return;
                                        }

                                        setSaving(true);
                                        setDetailsError('');

                                        try {
                                            await requestOperation(
                                                `/dd-phase3/lgus/${details.id}`,
                                                {},
                                                'delete',
                                            );
                                            setDetailsId(null);
                                        } catch (failure) {
                                            setDetailsError(
                                                failure instanceof Error
                                                    ? failure.message
                                                    : 'Unable to delete the LGU.',
                                            );
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                >
                                    <Trash2 className="size-4" /> Delete LGU
                                </button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {canCreate && editor && (
                <Modal
                    title={editor.kind === 'add' ? 'Add LGU' : 'Edit LGU'}
                    onClose={closeEditor}
                >
                    <form onSubmit={savePreview}>
                        <div className="flex items-start justify-between border-b border-[#E4EAF2] px-6 py-5">
                            <div>
                                <p className="text-xs font-semibold tracking-wide text-[#93502B] uppercase">
                                    Municipality details
                                </p>
                                <h2 className="mt-1 text-xl font-semibold text-[#20324A]">
                                    {editor.kind === 'add'
                                        ? 'Add LGU'
                                        : 'Edit LGU'}
                                </h2>
                                <p className="mt-1 text-sm text-[#8295AB]">
                                    Enter the municipality and mayor
                                    information.
                                </p>
                            </div>
                            <button
                                type="button"
                                className={secondary}
                                onClick={closeEditor}
                                aria-label="Close form"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        <div className="space-y-4 px-6 py-5">
                            <div>
                                <label
                                    htmlFor="lgu-municipality"
                                    className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                >
                                    Municipality Name *
                                </label>
                                <input
                                    id="lgu-municipality"
                                    className={control}
                                    maxLength={100}
                                    required
                                    value={form.municipalityName}
                                    onChange={(event) =>
                                        setValue(
                                            'municipalityName',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Enter municipality name"
                                />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="lgu-province"
                                        className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                    >
                                        Province *
                                    </label>
                                    <input
                                        id="lgu-province"
                                        className={control}
                                        maxLength={100}
                                        required
                                        value={form.province}
                                        onChange={(event) =>
                                            setValue(
                                                'province',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Enter province"
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="lgu-region"
                                        className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                    >
                                        Region *
                                    </label>
                                    <input
                                        id="lgu-region"
                                        className={control}
                                        maxLength={100}
                                        required
                                        value={form.region}
                                        onChange={(event) =>
                                            setValue(
                                                'region',
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Enter region"
                                    />
                                </div>
                            </div>
                            <div className="rounded-xl border border-[#E6ECF3] p-4">
                                <p className="mb-3 text-sm font-semibold text-[#20334B]">
                                    Mayor Information
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label
                                            htmlFor="lgu-mayor-first"
                                            className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                        >
                                            First Name *
                                        </label>
                                        <input
                                            id="lgu-mayor-first"
                                            className={control}
                                            maxLength={100}
                                            required
                                            value={form.mayorFirstName}
                                            onChange={(event) =>
                                                setValue(
                                                    'mayorFirstName',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="lgu-mayor-middle"
                                            className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                        >
                                            Middle Name{' '}
                                            <span className="font-normal text-[#8092AA]">
                                                (optional)
                                            </span>
                                        </label>
                                        <input
                                            id="lgu-mayor-middle"
                                            className={control}
                                            maxLength={100}
                                            value={form.mayorMiddleName}
                                            onChange={(event) =>
                                                setValue(
                                                    'mayorMiddleName',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label
                                            htmlFor="lgu-mayor-last"
                                            className="mb-1.5 block text-sm font-medium text-[#263B53]"
                                        >
                                            Last Name *
                                        </label>
                                        <input
                                            id="lgu-mayor-last"
                                            className={control}
                                            maxLength={100}
                                            required
                                            value={form.mayorLastName}
                                            onChange={(event) =>
                                                setValue(
                                                    'mayorLastName',
                                                    event.target.value,
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                            {formError && (
                                <p
                                    role="alert"
                                    className="rounded-lg bg-[#FFF0F0] px-3 py-2 text-sm text-[#AD4948]"
                                >
                                    {formError}
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 border-t border-[#E4EAF2] px-6 py-4">
                            <button
                                type="button"
                                className={secondary}
                                onClick={closeEditor}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="jr-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                            >
                                <Plus className="size-4" />{' '}
                                {saving
                                    ? 'Saving…'
                                    : editor.kind === 'add'
                                      ? 'Create LGU'
                                      : 'Save LGU'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </ProjectWorkspace>
    );
}

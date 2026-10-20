import { router } from '@inertiajs/react';
import {
    Check,
    Filter,
    HardHat,
    Link2,
    Plus,
    Search,
    UserRoundCheck,
    Users,
    X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { Button } from '@/components/ui/button';
import {
    EngineerDialog,
    AssignmentDialog,
    AssignmentStatusDialog,
} from '@/components/user-management/engineer-administration';

type Role = 'viewer' | 'user' | 'admin' | 'engineer' | 'superadmin';
export type Account = {
    id: number;
    username: string;
    accountType: Role;
    is_active: boolean;
    engineers_id: number | null;
    created_by?: number | null;
};
export type Engineer = {
    id: number;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    email: string;
    contact_no?: string;
    position: string;
    rank?: string;
    lgus_id: number;
    engineer_status: 'Active' | 'Retired';
};
export type Lgu = { id: number; municipality_name: string };
export type EngineerLgu = {
    id: string;
    engineers_id: number;
    lgus_id: number;
    is_active: boolean;
};

type Tab = 'accounts' | 'engineers' | 'assignments';
type CreateRole = 'viewer' | 'engineer' | 'admin';
type AccountForm = {
    username: string;
    email: string;
    name: string;
    accountType: CreateRole;
    engineers_id: string;
    password: string;
    password_confirmation: string;
};

export interface UserManagementPageProps {
    initialAccounts?: Account[];
    initialEngineers?: Engineer[];
    initialLgus?: Lgu[];
    initialAssignments?: EngineerLgu[];
    assignmentsAvailable?: boolean;
    canManage?: boolean;
    creatableRoles?: CreateRole[];
    engineerRoleReady?: boolean;
    flashStatus?: string | null;
}

const initialForm = (): AccountForm => ({
    username: '',
    email: '',
    name: '',
    accountType: 'viewer',
    engineers_id: '',
    password: '',
    password_confirmation: '',
});
const field =
    'w-full rounded-xl border border-[#DFE6EF] bg-white px-3 py-2.5 text-sm text-[#18263A] outline-none transition placeholder:text-[#95A4BE] focus:border-[#B56C3B] focus:ring-2 focus:ring-[#F4E5D7]';
const ghost =
    'inline-flex items-center justify-center gap-2 rounded-xl border border-[#DFE6EF] bg-white px-3.5 py-2.5 text-sm font-medium text-[#435773] shadow-sm transition hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-45';
const primary =
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#90451F] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_3px_9px_rgba(100,46,20,.16)] transition hover:bg-[#793713] disabled:cursor-not-allowed disabled:opacity-45';

function Status({ active }: { active: boolean }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-[#E9F7EE] text-[#238554]' : 'bg-[#F1F2F5] text-[#79869A]'}`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#35A66B]' : 'bg-[#9AA5B5]'}`}
            />
            {active ? 'Active' : 'Inactive'}
        </span>
    );
}
function RoleBadge({ role }: { role: Role }) {
    return (
        <span className="rounded-full bg-[#FFF0E2] px-2.5 py-1 text-xs font-semibold text-[#995321]">
            {role === 'superadmin'
                ? 'SuperAdmin'
                : role.charAt(0).toUpperCase() + role.slice(1)}
        </span>
    );
}
function FieldError({ text }: { text?: string }) {
    return text ? (
        <div role="alert" className="mt-1 text-xs text-red-700">
            {text}
        </div>
    ) : null;
}

/**
 * Create-only production workflow: all writes go through authorized Laravel.
 * Account status/role edits remain restricted; Engineer/LGU writes use new authorized endpoints.
 */
export default function UserManagementPage({
    initialAccounts = [],
    initialEngineers = [],
    initialLgus = [],
    initialAssignments = [],
    assignmentsAvailable = false,
    canManage = false,
    creatableRoles = [],
    engineerRoleReady = false,
    flashStatus = null,
}: UserManagementPageProps) {
    // Inertia props are already the current server state. Keeping local copies
    // of them creates redundant effects and can show stale account records.
    const accounts = initialAccounts;
    const engineers = initialEngineers;
    const assignments = initialAssignments;
    const [tab, setTab] = useState<Tab>('accounts');
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [creating, setCreating] = useState(false);
    const [engineerEditor, setEngineerEditor] = useState<
        Engineer | 'new' | null
    >(null);
    const [assignmentEditor, setAssignmentEditor] = useState(false);
    const [assignmentChanging, setAssignmentChanging] =
        useState<EngineerLgu | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState<AccountForm>(initialForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [notice, setNotice] = useState<string | null>(null);
    const [dismissedFlash, setDismissedFlash] = useState<string | null>(null);
    // Display fresh Inertia flash props directly; no effect is needed to sync them.
    const visibleNotice =
        notice ?? (flashStatus !== dismissedFlash ? flashStatus : null);

    const engineerById = useMemo(
        () => new Map(engineers.map((engineer) => [engineer.id, engineer])),
        [engineers],
    );
    const lguById = useMemo(
        () => new Map(initialLgus.map((lgu) => [lgu.id, lgu])),
        [initialLgus],
    );
    const accountByEngineerId = useMemo(
        () =>
            new Map(
                accounts
                    .filter((account) => account.engineers_id !== null)
                    .map((account) => [account.engineers_id, account]),
            ),
        [accounts],
    );

    const engineerName = useCallback(
        (id: number | null) => {
            if (id === null) {
                return 'Not assigned';
            }

            const engineer = engineerById.get(id);

            return engineer
                ? `${engineer.first_name} ${engineer.last_name}`
                : `Engineer #${id}`;
        },
        [engineerById],
    );

    const lguName = (id: number) =>
        lguById.get(id)?.municipality_name ?? `LGU #${id}`;
    const filteredAccounts = useMemo(() => {
        const query = search.toLowerCase();

        return accounts.filter(
            (account) =>
                (account.username.toLowerCase().includes(query) ||
                    String(account.id).includes(search) ||
                    engineerName(account.engineers_id)
                        .toLowerCase()
                        .includes(query)) &&
                (roleFilter === 'all' || account.accountType === roleFilter) &&
                (statusFilter === 'all' ||
                    (account.is_active ? 'active' : 'inactive') ===
                        statusFilter),
        );
    }, [accounts, search, roleFilter, statusFilter, engineerName]);
    const filteredEngineers = engineers.filter((e) =>
        `${e.first_name} ${e.middle_name ?? ''} ${e.last_name} ${e.email} ${e.engineer_status} ${lguName(e.lgus_id)}`
            .toLowerCase()
            .includes(search.toLowerCase()),
    );
    const filteredAssignments = assignments.filter((a) =>
        `${engineerName(a.engineers_id)} ${lguName(a.lgus_id)}`
            .toLowerCase()
            .includes(search.toLowerCase()),
    );
    const active = accounts.filter((a) => a.is_active).length;
    const activeAssignments = assignments.filter(
        (assignment) => assignment.is_active,
    ).length;

    function closeCreateDialog() {
        if (submitting) {
            return;
        }

        setCreating(false);
        setForm(initialForm());
        setErrors({});
    }

    function submitAccount(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (submitting || !creatableRoles.includes(form.accountType)) {
            return;
        }

        setSubmitting(true);
        setErrors({});
        // Laravel verifies the role, authorization, uniqueness, engineer link,
        // password strength and audit insert; no browser-side storage is used.
        router.post(
            '/user-management/accounts',
            {
                ...form,
                engineers_id:
                    (form.accountType === 'admin' ||
                        form.accountType === 'engineer') &&
                    form.engineers_id
                        ? Number(form.engineers_id)
                        : null,
                name: form.accountType === 'viewer' ? form.name : null,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCreating(false);
                    setForm(initialForm());
                    setErrors({});
                    setNotice(
                        'Account creation request succeeded. Confirm the saved row after refresh.',
                    );
                },
                onError: (validation) => {
                    setErrors(validation);
                },
                onFinish: () => {
                    setSubmitting(false);
                },
            },
        );
    }

    return (
        <ProjectWorkspace>
            <div className="jr-page-head">
                <div>
                    <h1>User Management</h1>
                    <p>
                        Manage system accounts, Engineer information, and LGU
                        assignments.
                    </p>
                </div>
                {canManage &&
                    creatableRoles.length > 0 &&
                    tab === 'accounts' && (
                        <Button
                            type="button"
                            className="jr-primary"
                            onClick={() => {
                                setForm(initialForm());
                                setErrors({});
                                setCreating(true);
                            }}
                        >
                            <Plus size={17} /> Add Account
                        </Button>
                    )}
                {canManage && tab === 'engineers' && (
                    <Button
                        type="button"
                        className="jr-primary"
                        onClick={() => setEngineerEditor('new')}
                    >
                        <Plus size={17} /> Add Engineer
                    </Button>
                )}
                {canManage && assignmentsAvailable && tab === 'assignments' && (
                    <Button
                        type="button"
                        className="jr-primary"
                        onClick={() => setAssignmentEditor(true)}
                    >
                        <Plus size={17} /> Assign LGU
                    </Button>
                )}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    {
                        title: 'Total Accounts',
                        value: accounts.length,
                        icon: Users,
                    },
                    {
                        title: 'Active Accounts',
                        value: active,
                        icon: UserRoundCheck,
                    },
                    {
                        title: 'Engineers',
                        value: engineers.length,
                        icon: HardHat,
                    },
                    {
                        title: 'Active LGU Assignments',
                        value: assignmentsAvailable ? activeAssignments : '—',
                        icon: Link2,
                    },
                ].map((item) => (
                    <div
                        key={item.title}
                        className="flex items-center justify-between rounded-2xl border border-[#E8EDF4] bg-[#FDFEFF] px-4 py-4"
                    >
                        <div>
                            <div className="text-xs font-medium text-[#8190A6]">
                                {item.title}
                            </div>
                            <div className="mt-1 text-2xl font-bold text-[#16253A]">
                                {item.value}
                            </div>
                        </div>
                        <item.icon size={21} className="text-[#A2572A]" />
                    </div>
                ))}
            </div>
            <div className="mt-7 flex flex-wrap gap-2 border-b border-[#E8EDF4]">
                {(
                    [
                        ['accounts', 'User Accounts', Users],
                        ['engineers', 'Engineers', HardHat],
                        ['assignments', 'LGU Assignments', Link2],
                    ] as const
                ).map(([key, label, Icon]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => {
                            setTab(key);
                            setSearch('');
                        }}
                        className={`inline-flex items-center gap-2 border-b-[3px] px-4 py-3 text-sm font-semibold ${tab === key ? 'border-[#985023] text-[#995024]' : 'border-transparent text-[#8593A8] hover:text-[#3C526E]'}`}
                    >
                        <Icon size={16} />
                        {label}
                    </button>
                ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
                <div className="relative min-w-[230px] flex-1">
                    <Search
                        className="absolute top-1/2 left-3.5 -translate-y-1/2 text-[#9AACBF]"
                        size={18}
                    />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={`${field} pl-10`}
                        placeholder="Search existing records..."
                    />
                </div>
                {tab === 'accounts' && (
                    <>
                        <div className="relative">
                            <Filter
                                size={15}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#91A2B9]"
                            />
                            <select
                                aria-label="Filter role"
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className={`${field} min-w-[155px] pl-9`}
                            >
                                <option value="all">All Roles</option>
                                <option value="admin">Admin</option>
                                <option value="engineer">Engineer</option>
                                <option value="superadmin">SuperAdmin</option>
                                <option value="user">User (legacy)</option>
                                <option value="viewer">Viewer</option>
                            </select>
                        </div>
                        <select
                            aria-label="Filter status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className={`${field} min-w-[152px]`}
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </>
                )}
            </div>
            {visibleNotice && (
                <div
                    role="status"
                    className="mt-4 flex items-start justify-between rounded-xl border border-[#DDE9F5] bg-[#F5FAFF] p-3 text-sm text-[#4B698B]"
                >
                    <span className="flex items-start gap-2">
                        <Check size={16} className="shrink-0" />
                        {visibleNotice}
                    </span>
                    <button
                        aria-label="Dismiss notice"
                        type="button"
                        onClick={() => {
                            setNotice(null);
                            setDismissedFlash(flashStatus);
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}
            <div className="mt-5 overflow-x-auto rounded-xl border border-[#ECF0F5]">
                {tab === 'accounts' && (
                    <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                        <thead className="bg-[#F3F5F8] text-[11px] tracking-wide text-[#607998] uppercase">
                            <tr>
                                <th className="px-5 py-3.5">Account</th>
                                <th className="px-4 py-3.5">Role</th>
                                <th className="px-4 py-3.5">Linked Engineer</th>
                                <th className="px-4 py-3.5">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAccounts.map((a) => (
                                <tr
                                    key={a.id}
                                    className="border-t border-[#ECF0F5] hover:bg-[#FBFCFE]"
                                >
                                    <td className="px-5 py-4">
                                        <strong>{a.username}</strong>
                                        <div className="mt-0.5 text-xs text-[#93A0B4]">
                                            Account ID: {a.id}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <RoleBadge role={a.accountType} />
                                    </td>
                                    <td className="px-4 py-4 text-[#667A96]">
                                        {engineerName(a.engineers_id)}
                                    </td>
                                    <td className="px-4 py-4">
                                        <Status active={a.is_active} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {tab === 'engineers' && (
                    <table className="w-full min-w-[620px] text-left text-sm">
                        <thead className="bg-[#F3F5F8] text-xs text-[#607998] uppercase">
                            <tr>
                                <th className="px-5 py-3">Engineer</th>
                                <th className="px-4 py-3">Position / Rank</th>
                                <th className="px-4 py-3">LGU</th>
                                <th className="px-4 py-3">Account</th>
                                <th className="px-4 py-3">Engineer Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEngineers.map((e) => (
                                <tr
                                    key={e.id}
                                    className="border-t border-[#ECF0F5]"
                                >
                                    <td className="px-5 py-4">
                                        {e.first_name} {e.last_name}
                                    </td>
                                    <td className="px-4 py-4">
                                        {e.position || e.rank || '—'}
                                    </td>
                                    <td className="px-4 py-4">
                                        {lguName(e.lgus_id)}
                                    </td>
                                    <td className="px-4 py-4">
                                        {accountByEngineerId.get(e.id)
                                            ?.username ?? 'No account'}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span
                                            className={
                                                e.engineer_status === 'Active'
                                                    ? 'font-semibold text-emerald-700'
                                                    : 'font-semibold text-slate-500'
                                            }
                                        >
                                            {e.engineer_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        {canManage && (
                                            <button
                                                type="button"
                                                className={ghost}
                                                onClick={() =>
                                                    setEngineerEditor(e)
                                                }
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {tab === 'assignments' &&
                    (!assignmentsAvailable ? (
                        <div
                            role="status"
                            className="p-6 text-sm text-[#687C95]"
                        >
                            The EngineerLGU table could not be found. Assignment
                            management remains unavailable; verify the existing
                            database connection before making changes.
                        </div>
                    ) : (
                        <div>
                            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8EDF4] bg-[#FAFBFD] px-5 py-4">
                                <div>
                                    <p className="text-sm font-semibold text-[#253A54]">
                                        Engineer–LGU assignments
                                    </p>
                                    <p className="mt-1 text-xs text-[#7689A2]">
                                        {activeAssignments} active of{' '}
                                        {assignments.length} assignment
                                        {assignments.length === 1 ? '' : 's'} ·
                                        Existing database records
                                    </p>
                                </div>
                                <span className="rounded-full bg-[#F0F3F8] px-3 py-1.5 text-xs font-medium text-[#59708C]">
                                    Admin controls · changes audited
                                </span>
                            </div>
                            {filteredAssignments.length ? (
                                <table className="w-full min-w-[580px] text-left text-sm">
                                    <thead className="bg-[#F3F5F8] text-xs text-[#607998] uppercase">
                                        <tr>
                                            <th className="px-5 py-3">
                                                Engineer
                                            </th>
                                            <th className="px-4 py-3">
                                                Municipality (LGU)
                                            </th>
                                            <th className="px-4 py-3">
                                                Assignment
                                            </th>
                                            <th className="px-4 py-3">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAssignments.map(
                                            (assignment) => (
                                                <tr
                                                    key={assignment.id}
                                                    className="border-t border-[#ECF0F5]"
                                                >
                                                    <td className="px-5 py-4">
                                                        <span className="font-semibold text-[#263A52]">
                                                            {engineerName(
                                                                assignment.engineers_id,
                                                            )}
                                                        </span>
                                                        <p className="text-xs text-[#91A0B4]">
                                                            Engineer #
                                                            {
                                                                assignment.engineers_id
                                                            }
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {lguName(
                                                            assignment.lgus_id,
                                                        )}{' '}
                                                        <span className="text-xs text-[#91A0B4]">
                                                            · LGU #
                                                            {assignment.lgus_id}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <Status
                                                            active={
                                                                assignment.is_active
                                                            }
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {canManage && (
                                                            <button
                                                                type="button"
                                                                className={
                                                                    ghost
                                                                }
                                                                onClick={() =>
                                                                    setAssignmentChanging(
                                                                        assignment,
                                                                    )
                                                                }
                                                            >
                                                                {assignment.is_active
                                                                    ? 'Deactivate'
                                                                    : 'Activate'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-7 text-center text-sm text-[#687C95]">
                                    {assignments.length
                                        ? 'No assignments match your search.'
                                        : 'No EngineerLGU assignments have been recorded.'}
                                </div>
                            )}
                        </div>
                    ))}
                {tab === 'accounts' && filteredAccounts.length === 0 && (
                    <div className="p-8 text-center text-sm text-[#687C95]">
                        No matching accounts.
                    </div>
                )}
                {tab === 'engineers' && filteredEngineers.length === 0 && (
                    <div className="p-8 text-center text-sm text-[#687C95]">
                        No matching Engineers.
                    </div>
                )}
            </div>
            <p className="mt-4 text-xs text-[#8495AC]">
                Showing{' '}
                {tab === 'accounts'
                    ? filteredAccounts.length
                    : tab === 'engineers'
                      ? filteredEngineers.length
                      : filteredAssignments.length}{' '}
                of{' '}
                {tab === 'accounts'
                    ? accounts.length
                    : tab === 'engineers'
                      ? engineers.length
                      : assignments.length}{' '}
                entries
            </p>

            {engineerEditor !== null && (
                <EngineerDialog
                    key={engineerEditor === 'new' ? 'new' : engineerEditor.id}
                    engineer={engineerEditor === 'new' ? null : engineerEditor}
                    lgus={initialLgus}
                    onClose={() => setEngineerEditor(null)}
                />
            )}
            {assignmentEditor && (
                <AssignmentDialog
                    engineers={engineers.filter(
                        (e) => e.engineer_status === 'Active',
                    )}
                    lgus={initialLgus}
                    onClose={() => setAssignmentEditor(false)}
                />
            )}
            {assignmentChanging && (
                <AssignmentStatusDialog
                    assignment={assignmentChanging}
                    engineerName={engineerName(assignmentChanging.engineers_id)}
                    lguName={lguName(assignmentChanging.lgus_id)}
                    engineerIsActive={
                        engineerById.get(assignmentChanging.engineers_id)
                            ?.engineer_status === 'Active'
                    }
                    onClose={() => setAssignmentChanging(null)}
                />
            )}

            {creating && (
                <div
                    role="presentation"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-[#18283F]/45 p-4"
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Add User Account"
                        className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-white shadow-2xl"
                    >
                        <div className="flex items-center justify-between border-b border-[#E8EDF4] px-6 py-5">
                            <div>
                                <h2 className="text-xl font-bold text-[#16253A]">
                                    Add User Account
                                </h2>
                                <p className="mt-1 text-sm text-[#7A8CA4]">
                                    Create an actual JaiROADS account and
                                    Laravel login.
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                disabled={submitting}
                                onClick={closeCreateDialog}
                            >
                                <X size={19} />
                            </button>
                        </div>
                        <form
                            onSubmit={submitAccount}
                            className="space-y-4 px-6 py-5"
                        >
                            <div>
                                <label
                                    htmlFor="new-account-username"
                                    className="mb-1 block text-sm font-semibold"
                                >
                                    Username *
                                </label>
                                <input
                                    id="new-account-username"
                                    autoComplete="off"
                                    required
                                    minLength={3}
                                    maxLength={100}
                                    value={form.username}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            username: e.target.value,
                                        }))
                                    }
                                    className={field}
                                />
                                <FieldError text={errors.username} />
                            </div>
                            <div>
                                <label
                                    htmlFor="new-account-email"
                                    className="mb-1 block text-sm font-semibold"
                                >
                                    Login email *
                                </label>
                                <input
                                    id="new-account-email"
                                    type="email"
                                    autoComplete="off"
                                    required
                                    value={form.email}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            email: e.target.value,
                                        }))
                                    }
                                    className={field}
                                />
                                <FieldError text={errors.email} />
                            </div>
                            <div>
                                <label
                                    htmlFor="new-account-role"
                                    className="mb-1 block text-sm font-semibold"
                                >
                                    Role *
                                </label>
                                <select
                                    id="new-account-role"
                                    className={field}
                                    value={form.accountType}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            accountType: e.target
                                                .value as CreateRole,
                                            engineers_id: '',
                                        }))
                                    }
                                >
                                    {creatableRoles.includes('viewer') && (
                                        <option value="viewer">
                                            Viewer — read only
                                        </option>
                                    )}
                                    {creatableRoles.includes('engineer') && (
                                        <option value="engineer">
                                            Engineer — requires an unlinked
                                            Engineer
                                        </option>
                                    )}
                                    {creatableRoles.includes('admin') && (
                                        <option value="admin">
                                            Admin — SuperAdmin approval and
                                            Engineer required
                                        </option>
                                    )}
                                </select>
                                <FieldError text={errors.accountType} />
                            </div>
                            {!engineerRoleReady && (
                                <p className="text-xs text-[#94501C]">
                                    Engineer account creation is disabled until
                                    the shared database role constraint is
                                    approved.
                                </p>
                            )}
                            {form.accountType === 'viewer' ? (
                                <div>
                                    <label
                                        htmlFor="new-account-name"
                                        className="mb-1 block text-sm font-semibold"
                                    >
                                        Full name *
                                    </label>
                                    <input
                                        id="new-account-name"
                                        className={field}
                                        required
                                        maxLength={255}
                                        value={form.name}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                name: e.target.value,
                                            }))
                                        }
                                    />
                                    <FieldError text={errors.name} />
                                </div>
                            ) : (
                                <div>
                                    <label
                                        htmlFor="new-account-engineer"
                                        className="mb-1 block text-sm font-semibold"
                                    >
                                        Linked Engineer *
                                    </label>
                                    <select
                                        id="new-account-engineer"
                                        className={field}
                                        required
                                        value={form.engineers_id}
                                        onChange={(e) =>
                                            setForm((f) => ({
                                                ...f,
                                                engineers_id: e.target.value,
                                            }))
                                        }
                                    >
                                        <option value="">
                                            Select an Engineer
                                        </option>
                                        {engineers
                                            .filter(
                                                (e) =>
                                                    e.engineer_status ===
                                                        'Active' &&
                                                    !accountByEngineerId.has(
                                                        e.id,
                                                    ),
                                            )
                                            .map((e) => (
                                                <option key={e.id} value={e.id}>
                                                    {e.first_name} {e.last_name}{' '}
                                                    (#{e.id})
                                                </option>
                                            ))}
                                    </select>
                                    <FieldError text={errors.engineers_id} />
                                </div>
                            )}
                            <div>
                                <label
                                    htmlFor="new-account-password"
                                    className="mb-1 block text-sm font-semibold"
                                >
                                    Temporary password *
                                </label>
                                <input
                                    id="new-account-password"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={12}
                                    required
                                    className={field}
                                    value={form.password}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            password: e.target.value,
                                        }))
                                    }
                                />
                                <FieldError text={errors.password} />
                            </div>
                            <div>
                                <label
                                    htmlFor="new-account-confirm"
                                    className="mb-1 block text-sm font-semibold"
                                >
                                    Confirm temporary password *
                                </label>
                                <input
                                    id="new-account-confirm"
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={12}
                                    required
                                    className={field}
                                    value={form.password_confirmation}
                                    onChange={(e) =>
                                        setForm((f) => ({
                                            ...f,
                                            password_confirmation:
                                                e.target.value,
                                        }))
                                    }
                                />
                                <FieldError
                                    text={errors.password_confirmation}
                                />
                            </div>
                            <p className="rounded-xl bg-[#F6F8FB] p-3 text-xs leading-5 text-[#74849B]">
                                Use a unique 12+ character password with
                                upper/lowercase letters, digits and symbols.
                                Share it securely, never in screenshots. No
                                verification email or password invitation is
                                sent by this form. Deliver the temporary
                                password securely and follow your team's
                                verification/reset process.
                            </p>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    disabled={submitting}
                                    className={ghost}
                                    onClick={closeCreateDialog}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={primary}
                                >
                                    {submitting
                                        ? 'Creating...'
                                        : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </ProjectWorkspace>
    );
}

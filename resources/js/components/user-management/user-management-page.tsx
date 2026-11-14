import { router } from '@inertiajs/react';
import {
    Check,
    HardHat,
    Link2,
    Plus,
    Search,
    Users,
    X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { DirectoryFilter } from '@/components/directory-controls';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { MetricCard } from '@/components/metric-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    EngineerDialog,
    AssignmentDialog,
    AssignmentStatusDialog,
} from '@/components/user-management/engineer-administration';
import '../../../css/maintenance-projects-exploration.css';

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
        <span className="inline-flex rounded-full bg-[#FFF0E2] px-2.5 py-1 text-xs font-semibold text-[#995321]">
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

    const filteredEngineers = useMemo(() => {
        const query = search.toLowerCase();

        return engineers.filter((e) =>
            `${e.first_name} ${e.middle_name ?? ''} ${e.last_name} ${e.email} ${e.engineer_status} ${lguName(e.lgus_id)}`
                .toLowerCase()
                .includes(query),
        );
    }, [engineers, search, lguById]);

    const filteredAssignments = useMemo(() => {
        const query = search.toLowerCase();

        return assignments.filter((a) =>
            `${engineerName(a.engineers_id)} ${lguName(a.lgus_id)}`
                .toLowerCase()
                .includes(query),
        );
    }, [assignments, search, engineerName, lguById]);

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
        <div className="jr-directory-exploration">
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
                                <Plus size={16} /> Add Account
                            </Button>
                        )}
                    {canManage && tab === 'engineers' && (
                        <Button
                            type="button"
                            className="jr-primary"
                            onClick={() => setEngineerEditor('new')}
                        >
                            <Plus size={16} /> Add Engineer
                        </Button>
                    )}
                    {canManage && assignmentsAvailable && tab === 'assignments' && (
                        <Button
                            type="button"
                            className="jr-primary"
                            onClick={() => setAssignmentEditor(true)}
                        >
                            <Plus size={16} /> Assign LGU
                        </Button>
                    )}
                </div>

                <main className="relative -mt-3.5 -mx-7 rounded-t-[20px] bg-white px-7 pt-7 pb-10 shadow-sm min-w-0">
                    <section
                        aria-label="User management statistics"
                        className="jr-metrics-grid mb-6 grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4"
                    >
                        <MetricCard
                            title="Total Accounts"
                            value={accounts.length}
                            subtitle="Registered system accounts"
                            highlight={true}
                        />
                        <MetricCard
                            title="Active Accounts"
                            value={active}
                            subtitle="Active account logins"
                        />
                        <MetricCard
                            title="Engineers"
                            value={engineers.length}
                            subtitle="Registered field engineers"
                        />
                        <MetricCard
                            title="Active LGU Assignments"
                            value={assignmentsAvailable ? activeAssignments : '—'}
                            subtitle="Active engineer assignments"
                        />
                    </section>

                    <div className="mb-6 flex flex-wrap gap-2 border-b border-[#E2E8F0]">
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
                                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                                    tab === key
                                        ? 'border-[#90451f] text-[#90451f]'
                                        : 'border-transparent text-[#64748B] hover:border-[#CBD5E1] hover:text-[#1E293B]'
                                }`}
                            >
                                <Icon size={16} />
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="mb-6 flex flex-wrap items-center gap-3">
                        <div className="jr-search">
                            <Search className="size-[18px]" />
                            <Input
                                type="search"
                                maxLength={255}
                                aria-label="Search records"
                                placeholder={
                                    tab === 'accounts'
                                        ? 'Search accounts or linked engineers...'
                                        : tab === 'engineers'
                                          ? 'Search engineers by name, email, or LGU...'
                                          : 'Search assignments by engineer or LGU...'
                                }
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        {tab === 'accounts' && (
                            <div className="jr-filter-row flex flex-wrap items-center gap-2.5">
                                <DirectoryFilter
                                    label="Filter role"
                                    value={roleFilter}
                                    onChange={setRoleFilter}
                                    options={[
                                        { value: 'all', label: 'All Roles' },
                                        { value: 'admin', label: 'Admin' },
                                        { value: 'engineer', label: 'Engineer' },
                                        { value: 'superadmin', label: 'SuperAdmin' },
                                        { value: 'user', label: 'User (legacy)' },
                                        { value: 'viewer', label: 'Viewer' },
                                    ]}
                                />
                                <DirectoryFilter
                                    label="Filter status"
                                    value={statusFilter}
                                    onChange={setStatusFilter}
                                    options={[
                                        { value: 'all', label: 'All Statuses' },
                                        { value: 'active', label: 'Active' },
                                        { value: 'inactive', label: 'Inactive' },
                                    ]}
                                />
                            </div>
                        )}
                    </div>

                    {visibleNotice && (
                        <div
                            role="status"
                            className="mb-5 flex items-start justify-between rounded-xl border border-[#DDE9F5] bg-[#F5FAFF] p-3 text-sm text-[#4B698B]"
                        >
                            <span className="flex items-start gap-2">
                                <Check size={16} className="mt-0.5 shrink-0 text-[#238554]" />
                                {visibleNotice}
                            </span>
                            <button
                                aria-label="Dismiss notice"
                                type="button"
                                className="text-[#64748B] hover:text-[#1E293B]"
                                onClick={() => {
                                    setNotice(null);
                                    setDismissedFlash(flashStatus);
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {tab === 'accounts' && (
                        <div
                            className="jr-table-wrap"
                            role="region"
                            aria-label="User Accounts table"
                            tabIndex={0}
                        >
                            <table className="jr-table">
                                <colgroup>
                                    <col style={{ width: '30%' }} />
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '32%' }} />
                                    <col style={{ width: '18%' }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>ACCOUNT</th>
                                        <th>ROLE</th>
                                        <th>LINKED ENGINEER</th>
                                        <th>STATUS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAccounts.length > 0 ? (
                                        filteredAccounts.map((a) => (
                                            <tr key={a.id}>
                                                <td>
                                                    <span className="font-semibold text-[#1E293B]">
                                                        {a.username}
                                                    </span>
                                                    <div className="text-xs text-[#64748B]">
                                                        Account ID: {a.id}
                                                    </div>
                                                </td>
                                                <td>
                                                    <RoleBadge role={a.accountType} />
                                                </td>
                                                <td className="text-[#334155]">
                                                    {engineerName(a.engineers_id)}
                                                </td>
                                                <td>
                                                    <Status active={a.is_active} />
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-sm text-[#64748B]">
                                                No matching accounts found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'engineers' && (
                        <div
                            className="jr-table-wrap"
                            role="region"
                            aria-label="Engineers table"
                            tabIndex={0}
                        >
                            <table className="jr-table">
                                <colgroup>
                                    <col style={{ width: '26%' }} />
                                    <col style={{ width: '20%' }} />
                                    <col style={{ width: '18%' }} />
                                    <col style={{ width: '16%' }} />
                                    <col style={{ width: '12%' }} />
                                    <col style={{ width: '8%' }} />
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th>ENGINEER</th>
                                        <th>POSITION / RANK</th>
                                        <th>MUNICIPALITY (LGU)</th>
                                        <th>ACCOUNT</th>
                                        <th>ENGINEER STATUS</th>
                                        <th>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEngineers.length > 0 ? (
                                        filteredEngineers.map((e) => (
                                            <tr key={e.id}>
                                                <td>
                                                    <span className="font-semibold text-[#1E293B]">
                                                        {e.first_name} {e.middle_name ? `${e.middle_name} ` : ''}{e.last_name}
                                                    </span>
                                                    <div className="text-xs text-[#64748B]">{e.email}</div>
                                                </td>
                                                <td className="text-[#334155]">
                                                    {e.position || e.rank || '—'}
                                                </td>
                                                <td className="text-[#334155]">
                                                    {lguName(e.lgus_id)}
                                                </td>
                                                <td className="text-[#334155]">
                                                    {accountByEngineerId.get(e.id)?.username ?? (
                                                        <span className="text-[#94A3B8]">No account</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                            e.engineer_status === 'Active'
                                                                ? 'bg-[#E9F7EE] text-[#238554]'
                                                                : 'bg-[#F1F2F5] text-[#79869A]'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`h-1.5 w-1.5 rounded-full ${
                                                                e.engineer_status === 'Active'
                                                                    ? 'bg-[#35A66B]'
                                                                    : 'bg-[#9AA5B5]'
                                                            }`}
                                                        />
                                                        {e.engineer_status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {canManage && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 rounded-lg border-[#E2E8F0] px-3 text-xs font-medium text-[#334155] hover:bg-[#F8FAFC]"
                                                            onClick={() => setEngineerEditor(e)}
                                                        >
                                                            Edit
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-sm text-[#64748B]">
                                                No matching engineers found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {tab === 'assignments' && (
                        !assignmentsAvailable ? (
                            <div
                                role="status"
                                className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-sm text-[#64748B]"
                            >
                                The EngineerLGU table could not be found. Assignment management remains unavailable;
                                verify the existing database connection before making changes.
                            </div>
                        ) : (
                            <div>
                                <div className="mb-3 flex flex-wrap items-start justify-between gap-3 px-1">
                                    <div>
                                        <p className="text-sm font-semibold text-[#1E293B]">
                                            Engineer–LGU assignments
                                        </p>
                                        <p className="mt-0.5 text-xs text-[#64748B]">
                                            {activeAssignments} active of {assignments.length} assignment
                                            {assignments.length === 1 ? '' : 's'} · Existing database records
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-[#F1F5F9] px-3 py-1 text-xs font-medium text-[#475569]">
                                        Admin controls · changes audited
                                    </span>
                                </div>
                                <div
                                    className="jr-table-wrap"
                                    role="region"
                                    aria-label="Engineer LGU Assignments table"
                                    tabIndex={0}
                                >
                                    <table className="jr-table">
                                        <colgroup>
                                            <col style={{ width: '38%' }} />
                                            <col style={{ width: '32%' }} />
                                            <col style={{ width: '18%' }} />
                                            <col style={{ width: '12%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr>
                                                <th>ENGINEER</th>
                                                <th>MUNICIPALITY (LGU)</th>
                                                <th>ASSIGNMENT</th>
                                                <th>ACTION</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAssignments.length > 0 ? (
                                                filteredAssignments.map((assignment) => (
                                                    <tr key={assignment.id}>
                                                        <td>
                                                            <span className="font-semibold text-[#1E293B]">
                                                                {engineerName(assignment.engineers_id)}
                                                            </span>
                                                            <div className="text-xs text-[#64748B]">
                                                                Engineer #{assignment.engineers_id}
                                                            </div>
                                                        </td>
                                                        <td className="text-[#334155]">
                                                            {lguName(assignment.lgus_id)}{' '}
                                                            <span className="text-xs text-[#64748B]">
                                                                · LGU #{assignment.lgus_id}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <Status active={assignment.is_active} />
                                                        </td>
                                                        <td>
                                                            {canManage && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="h-8 rounded-lg border-[#E2E8F0] px-3 text-xs font-medium text-[#334155] hover:bg-[#F8FAFC]"
                                                                    onClick={() => setAssignmentChanging(assignment)}
                                                                >
                                                                    {assignment.is_active ? 'Deactivate' : 'Activate'}
                                                                </Button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} className="py-8 text-center text-sm text-[#64748B]">
                                                        {assignments.length
                                                            ? 'No assignments match your search.'
                                                            : 'No EngineerLGU assignments have been recorded.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    )}

                    <div className="mt-4 flex items-center justify-between text-xs text-[#64748B]">
                        <p>
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
                    </div>
                </main>

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
        </div>
    );
}

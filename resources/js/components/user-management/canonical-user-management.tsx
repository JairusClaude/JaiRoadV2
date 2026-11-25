import { router } from '@inertiajs/react';
import * as Dialog from '@radix-ui/react-dialog';
import {
    CheckCircle2,
    HardHat,
    Plus,
    Search,
    ShieldCheck,
    UserRound,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { DirectoryFilter, DirectoryPagination } from '@/components/directory-controls';
import AccountTypeBadge from '@/components/user-management/account-type-badge';
import DdAccountLifecycle from '@/pages/dd-phase3/DdAccountLifecycle';
import DdEngineerLifecycle from '@/pages/dd-phase3/DdEngineerLifecycle';
import '../../../css/canonical-user-management.css';

type Role = 'SuperAdmin' | 'Admin' | 'Engineer' | 'Viewer';
type Account = {
    id: number;
    username: string;
    email: string;
    account_type: Role;
    engineer_id: number | null;
    is_active: boolean;
};
type Engineer = {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    rank: string;
    engineer_status: string;
    contact_no: string | null;
};
type EligibleEngineer = Pick<
    Engineer,
    'id' | 'first_name' | 'last_name' | 'rank' | 'engineer_status'
>;
type Modal =
    | { kind: 'add-account' | 'add-engineer' }
    | { kind: 'account' | 'engineer'; id: number };
type DirectoryPaging = {
    tab: 'accounts' | 'engineers';
    search: string;
    role: string;
    state: string;
    page: number;
    pages: number;
    total: number;
    accountTotal: number;
    activeAccounts: number;
    engineerTotal: number;
    activeEngineers: number;
};
type Props = {
    accounts: Account[];
    engineers: Engineer[];
    directory?: DirectoryPaging | null;
    initialEngineerId?: number | null;
    eligibleEngineers: EligibleEngineer[];
    eligibleEngineerTotal: number;
    actorId: number;
    canCreateRoles: Role[];
    accountTotal: number | null;
    status: string | null;
};
const roles: Role[] = ['SuperAdmin', 'Admin', 'Engineer', 'Viewer'];
const nameOf = (e: Engineer | EligibleEngineer) =>
    [e.first_name, 'middle_name' in e ? e.middle_name : '', e.last_name]
        .filter(Boolean)
        .join(' ');
const pageSize = 15;

function Status({ active, label }: { active: boolean; label?: string }) {
    return (
        <span className={active ? 'um-status um-status-active' : 'um-status'}>
            <i />
            {label ?? (active ? 'Active' : 'Inactive')}
        </span>
    );
}
function Field({
    label,
    value,
    onChange,
    error,
    type = 'text',
    optional = false,
    help,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string;
    type?: string;
    optional?: boolean;
    help?: string;
}) {
    const [visible, setVisible] = useState(false);

    return (
        <label className="um-field">
            {label}
            {optional ? (
                <span className="um-optional"> (optional)</span>
            ) : (
                <span className="um-required" aria-hidden="true">
                    {' '}
                    *
                </span>
            )}
            <div
                className={
                    type === 'password' ? 'um-password-field' : undefined
                }
            >
                <input
                    aria-label={label}
                    className="um-input"
                    type={type === 'password' && visible ? 'text' : type}
                    value={value}
                    required={!optional}
                    aria-invalid={!!error}
                    autoComplete={type === 'password' ? 'new-password' : 'off'}
                    onChange={(e) => onChange(e.target.value)}
                />
                {type === 'password' && (
                    <button
                        type="button"
                        className="um-password-toggle"
                        aria-label={
                            (visible ? 'Hide ' : 'Show ') + label.toLowerCase()
                        }
                        aria-pressed={visible}
                        onClick={() => setVisible((v) => !v)}
                    >
                        {visible ? 'Hide' : 'Show'}
                    </button>
                )}
            </div>
            {help && <small>{help}</small>}
            {error && (
                <small role="alert" className="um-required">
                    {error}
                </small>
            )}
        </label>
    );
}
function CreateForm({
    kind,
    eligible,
    eligibleTotal,
    roles: allowed,
    onClose,
    onBusy,
    onProfileOnly,
}: {
    kind: 'add-account' | 'add-engineer';
    eligible: EligibleEngineer[];
    eligibleTotal: number;
    roles: Role[];
    onClose: () => void;
    onBusy: (busy: boolean) => void;
    onProfileOnly: () => void;
}) {
    const isAccount = kind === 'add-account';
    const [profileMode, setProfileMode] = useState<'new' | 'existing'>(
        eligibleTotal > 0 ? 'existing' : 'new',
    );
    const [account, setAccount] = useState({
        username: '',
        email: '',
        name: '',
        account_type: allowed[0] ?? 'Viewer',
        engineer_id: '',
        password: '',
        password_confirmation: '',
    });
    const [engineer, setEngineer] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        contact_no: '',
        rank: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [eligibleSearch, setEligibleSearch] = useState('');
    const [lookup, setLookup] = useState<{
        query: string;
        engineers: EligibleEngineer[];
        total: number;
        error: string;
    }>({ query: '', engineers: [], total: 0, error: '' });
    const [chosenEngineer, setChosenEngineer] =
        useState<EligibleEngineer | null>(null);
    const searchTerm = Array.from(eligibleSearch.trim()).slice(0, 100).join('');
    useEffect(() => {
        if (!isAccount || profileMode !== 'existing' || searchTerm === '') {
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => {
            void fetch(
                `/dd-phase3/eligible-engineers?search=${encodeURIComponent(searchTerm)}`,
                {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: controller.signal,
                },
            )
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(
                            'Eligible Engineer search is unavailable.',
                        );
                    }

                    return (await response.json()) as {
                        engineers: EligibleEngineer[];
                        total: number;
                    };
                })
                .then((result) => {
                    if (!controller.signal.aborted) {
                        setLookup({
                            query: searchTerm,
                            engineers: result.engineers,
                            total: result.total,
                            error: '',
                        });
                    }
                })
                .catch(() => {
                    if (!controller.signal.aborted) {
                        setLookup({
                            query: searchTerm,
                            engineers: [],
                            total: 0,
                            error: 'Search unavailable. Please try again.',
                        });
                    }
                });
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [isAccount, profileMode, searchTerm]);
    const searchResolved = searchTerm === lookup.query;
    const visibleEligible =
        searchTerm === '' ? eligible : searchResolved ? lookup.engineers : [];
    // A chosen profile must stay selectable even when the search is changed.
    const eligibleChoices =
        chosenEngineer &&
        !visibleEligible.some((e) => e.id === chosenEngineer.id)
            ? [chosenEngineer, ...visibleEligible]
            : visibleEligible;
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (
            busy ||
            (isAccount &&
                (!allowed.includes(account.account_type) ||
                    (profileMode === 'existing' &&
                        (!chosenEngineer || String(chosenEngineer.id) !== account.engineer_id))))
        ) {
            return;
        }

        if (isAccount && account.password !== account.password_confirmation) {
            setErrors({ password_confirmation: 'Passwords do not match.' });

            return;
        }

        setBusy(true);
        onBusy(true);
        setErrors({});
        router.post(
            isAccount ? '/dd-phase3/accounts' : '/dd-phase3/engineers',
            isAccount
                ? profileMode === 'new'
                    ? { ...account, engineer_id: null, profile: engineer }
                    : account
                : engineer,
            {
                preserveScroll: true,
                onError: setErrors,
                onSuccess: onClose,
                onFinish: () => {
                    setBusy(false);
                    onBusy(false);
                },
            },
        );
    }
    const af = (
        key: keyof typeof account,
        label: string,
        type = 'text',
        help?: string,
    ) => (
        <Field
            key={key}
            label={label}
            type={type}
            value={account[key]}
            onChange={(v) => setAccount((old) => ({ ...old, [key]: v }))}
            error={errors[key]}
            help={help}
        />
    );
    const ef = (
        key: keyof typeof engineer,
        label: string,
        optional = false,
    ) => (
        <Field
            key={key}
            label={label}
            value={engineer[key]}
            onChange={(v) => setEngineer((old) => ({ ...old, [key]: v }))}
            error={errors[`profile.${key}`] ?? errors[key]}
            optional={optional}
        />
    );

    return (
        <form onSubmit={submit} className="um-form">
            {isAccount ? (
                <>
                    <div className="um-form-note">
                        Create a new profile and account together, or link an active, unused Engineer profile. All account types retain the profile requirement; linking a profile does not grant Engineer permissions.
                    </div>
                    <div className="um-form-grid">
                        {af(
                            'username',
                            'Username',
                            'text',
                            'Letters, numbers, underscore, dot and hyphen.',
                        )}
                        {af('email', 'Email', 'email')}
                        {af('name', 'Display name')}
                        <label className="um-field">
                            Account Type <span className="um-required">*</span>
                            <select
                                aria-label="Account Type"
                                className="um-input"
                                required
                                value={account.account_type}
                                onChange={(e) =>
                                    setAccount((old) => ({
                                        ...old,
                                        account_type: e.target.value as Role,
                                    }))
                                }
                            >
                                {allowed.map((role) => (
                                    <option key={role}>{role}</option>
                                ))}
                            </select>
                            {errors.account_type && (
                                <small role="alert" className="um-required">
                                    {errors.account_type}
                                </small>
                            )}
                        </label>
                        <fieldset className="um-span min-w-0 space-y-3">
                            <legend className="mb-2 text-sm font-semibold">Engineer profile</legend>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className={profileMode === 'new' ? 'um-primary' : 'um-secondary'} aria-pressed={profileMode === 'new'} disabled={busy} onClick={() => setProfileMode('new')}>
                                    Create new profile
                                </button>
                                <button type="button" className={profileMode === 'existing' ? 'um-primary' : 'um-secondary'} aria-pressed={profileMode === 'existing'} disabled={busy} onClick={() => setProfileMode('existing')}>
                                    Link existing profile
                                </button>
                            </div>
                            {profileMode === 'new' ? (
                                <div className="um-form-grid">
                                    {ef('first_name', 'First name')}
                                    {ef('middle_name', 'Middle name', true)}
                                    {ef('last_name', 'Last name')}
                                    {ef('contact_no', 'Contact number')}
                                    {ef('rank', 'Rank')}
                                </div>
                            ) : (
                                <div className="space-y-3">
                        <label className="um-field um-span">
                            Search eligible Engineers
                            <input
                                aria-label="Search eligible Engineers"
                                className="um-input"
                                type="search"
                                maxLength={100}
                                placeholder="Find by name, rank or profile ID"
                                value={eligibleSearch}
                                onChange={(e) =>
                                    setEligibleSearch(e.target.value)
                                }
                            />
                        </label>
                        <label className="um-field um-span">
                            Linked Engineer{' '}
                            <span className="um-required">*</span>
                            <select
                                aria-label="Linked Engineer"
                                className="um-input"
                                required
                                value={account.engineer_id}
                                onChange={(e) => {
                                    const engineer = eligibleChoices.find(
                                        (item) =>
                                            String(item.id) === e.target.value,
                                    );
                                    setChosenEngineer(engineer ?? null);
                                    setAccount((old) => ({
                                        ...old,
                                        engineer_id: e.target.value,
                                    }));
                                }}
                            >
                                <option value="">
                                    Select an active Engineer
                                </option>
                                {eligibleChoices.map((e) => (
                                    <option key={e.id} value={e.id}>
                                        {e.first_name} {e.last_name} · {e.rank}
                                    </option>
                                ))}
                            </select>
                            <small role="status">
                                {searchTerm === ''
                                    ? `Showing ${eligible.length} of ${eligibleTotal} available profile(s). Search to find more.`
                                    : !searchResolved
                                      ? 'Searching eligible profiles…'
                                      : lookup.error ||
                                        `Showing ${visibleEligible.length} of ${lookup.total} matching profile(s).`}
                                {eligibleTotal === 0 &&
                                    searchTerm === '' &&
                                    ' Choose Create new profile to continue.'}
                            </small>
                            {errors.engineer_id && (
                                <small role="alert" className="um-required">
                                    {errors.engineer_id}
                                </small>
                            )}
                        </label>
                                </div>
                            )}
                        </fieldset>
                        {af(
                            'password',
                            'Password',
                            'password',
                            'At least 12 characters with upper/lowercase, numbers and symbols.',
                        )}
                        {af(
                            'password_confirmation',
                            'Confirm password',
                            'password',
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div className="um-form-grid">
                        {ef('first_name', 'First name')}
                        {ef('middle_name', 'Middle name', true)}
                        {ef('last_name', 'Last name')}
                        {ef('contact_no', 'Contact number')}
                        {ef('rank', 'Rank')}
                    </div>
                    <div className="um-form-note">
                        New Engineer profiles start Active. Create a linked
                        account separately if the Engineer needs system access.
                        No LGU assignment is required.
                    </div>
                </>
            )}
            {isAccount && (
                <button type="button" className="um-secondary self-start" disabled={busy} onClick={onProfileOnly}>
                    Register an Engineer profile without an account
                </button>
            )}
            {Object.keys(errors).length > 0 && (
                <div role="alert" className="um-error">
                    {Object.values(errors).join(' ')}
                </div>
            )}
            <footer className="um-dialog-actions">
                <button
                    type="button"
                    className="um-secondary"
                    disabled={busy}
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="um-primary"
                    disabled={
                        busy ||
                        (isAccount && (!allowed.length || (profileMode === 'existing' && !chosenEngineer)))
                    }
                >
                    {busy
                        ? 'Saving…'
                        : isAccount
                          ? 'Create account'
                          : 'Create engineer'}
                </button>
            </footer>
        </form>
    );
}

export default function CanonicalUserManagement({
    accounts,
    engineers,
    initialEngineerId,
    directory,
    eligibleEngineers,
    eligibleEngineerTotal,
    actorId,
    canCreateRoles,
    accountTotal,
    status,
}: Props) {
    const [tab, setTab] = useState<'accounts' | 'engineers'>(
        directory?.tab ?? (initialEngineerId ? 'engineers' : 'accounts'),
    );
    const [search, setSearch] = useState(directory?.search ?? '');
    const normalizedSearch = Array.from(search.trim()).slice(0, 150).join('');
    const [role, setRole] = useState(directory?.role ?? 'all');
    const [state, setState] = useState(directory?.state ?? 'all');
    const [page, setPage] = useState(1);
    const [modal, setModal] = useState<Modal | null>(() =>
        initialEngineerId && engineers.some((e) => e.id === initialEngineerId)
            ? { kind: 'engineer', id: initialEngineerId }
            : null,
    );
    const [busy, setBusy] = useState(false);
    const [dismissed, setDismissed] = useState<string | null>(null);
    // Keep the existing filter controls while searching the full authorized
    // directory on the server. Only the visible page is sent to the browser.
    useEffect(() => {
        if (
            !directory ||
            (directory.tab === tab &&
                directory.search === normalizedSearch &&
                directory.role === role &&
                directory.state === state)
        ) {
            return;
        }

        const timer = setTimeout(() => {
            router.get(
                '/dd-phase3/users',
                {
                    directory_tab: tab,
                    directory_search: normalizedSearch,
                    directory_role: role,
                    directory_state: state,
                    directory_page: 1,
                },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 250);

        return () => clearTimeout(timer);
    }, [directory, tab, normalizedSearch, role, state]);
    const activeAccounts =
        directory?.activeAccounts ?? accounts.filter((a) => a.is_active).length;
    const activeEngineers =
        directory?.activeEngineers ??
        engineers.filter((e) => e.engineer_status === 'Active').length;
    const byEngineer = new Map(engineers.map((e) => [e.id, e]));
    const linkedAccounts = new Map(
        accounts
            .filter((a) => a.engineer_id !== null)
            .map((a) => [a.engineer_id, a]),
    );
    const q = directory ? '' : search.trim().toLowerCase();
    const appliedRole = directory ? 'all' : role;
    const appliedState = directory ? 'all' : state;
    const filteredAccounts = accounts.filter((a) => {
        const e =
            a.engineer_id === null ? undefined : byEngineer.get(a.engineer_id);

        return (
            [a.username, a.email, a.id, a.account_type, e ? nameOf(e) : '']
                .join(' ')
                .toLowerCase()
                .includes(q) &&
            (appliedRole === 'all' || a.account_type === appliedRole) &&
            (appliedState === 'all' ||
                (appliedState === 'active') === a.is_active)
        );
    });
    const filteredEngineers = engineers.filter(
        (e) =>
            [
                nameOf(e),
                e.rank,
                e.contact_no,
                e.id,
                linkedAccounts.get(e.id)?.username,
            ]
                .join(' ')
                .toLowerCase()
                .includes(q) &&
            (appliedState === 'all' ||
                (appliedState === 'active') ===
                    (e.engineer_status === 'Active')),
    );
    const count =
        directory?.total ??
        (tab === 'accounts'
            ? filteredAccounts.length
            : filteredEngineers.length);
    const last = directory?.pages ?? Math.max(1, Math.ceil(count / pageSize));
    const current = directory?.page ?? Math.min(page, last);
    const start = (current - 1) * pageSize;
    const sliceStart = directory ? 0 : start;
    const sliceEnd = directory ? pageSize : start + pageSize;
    function visitPage(next: number) {
        if (!directory) {
            setPage(next);

            return;
        }

        router.get(
            '/dd-phase3/users',
            {
                directory_tab: tab,
                directory_search: normalizedSearch,
                directory_role: role,
                directory_state: state,
                directory_page: next,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }
    function switchTab(next: typeof tab, nextRole: string = 'all') {
        setTab(next);
        setSearch('');
        setRole(nextRole);
        setState('all');
        setPage(1);
    }
    function clear() {
        setSearch('');
        setState('all');
        setPage(1);
    }
    function open(value: Modal) {
        setDismissed(status);
        setModal(value);
    }
    const modalTitle =
        modal?.kind === 'add-account'
            ? 'Add Account'
            : modal?.kind === 'add-engineer'
              ? 'Add Engineer'
              : modal?.kind === 'account'
                ? 'Manage Account'
                : 'Manage Engineer';
    const stats = [
        {
            label: 'Total accounts',
            value: accountTotal ?? accounts.length,
            detail: 'Registered system accounts',
            Icon: Users,
        },
        {
            label: 'Active accounts',
            value: activeAccounts,
            detail: 'Enabled for sign-in',
            Icon: ShieldCheck,
        },
        {
            label: 'Engineer profiles',
            value: directory?.engineerTotal ?? engineers.length,
            detail: activeEngineers + ' active in directory',
            Icon: HardHat,
        },
        {
            label: 'Available profiles',
            value: eligibleEngineerTotal,
            detail: 'Ready to link to an account',
            Icon: UserRound,
        },
    ];

    return (
        <div className="um-workspace">
            <section
                className="um-metrics"
                aria-label="User management statistics"
            >
                {stats.map(({ label, value, detail, Icon }) => (
                    <div key={label} className="um-metric">
                        <div className="um-metric-top">
                            <span>{label}</span>
                            <span className="um-stat-icon">
                                <Icon size={19} />
                            </span>
                        </div>
                        <strong>{value}</strong>
                        <small>{detail}</small>
                    </div>
                ))}
            </section>
            {status && status !== dismissed && (
                <div role="status" className="um-notice">
                    <CheckCircle2 size={18} />
                    <span>{status}</span>
                    <button
                        type="button"
                        aria-label="Dismiss notice"
                        onClick={() => setDismissed(status)}
                    >
                        <X size={17} />
                    </button>
                </div>
            )}
            <section className="um-directory">
                <div className="um-directory-head">
                    <div>
                        <h2>People directory</h2>
                        <p>
                            Manage access and professional profiles in one
                            place.
                        </p>
                    </div>
                    <div className="um-header-actions">
                        <button
                            type="button"
                            className="um-primary"
                            disabled={!canCreateRoles.length}
                            onClick={() => open({ kind: 'add-account' })}
                        >
                            <Plus size={16} /> Add Account
                        </button>
                    </div>
                </div>
                <nav className="um-tabs" aria-label="Directory views">
                    <button
                        type="button"
                        aria-pressed={tab === 'accounts' && role === 'all'}
                        onClick={() => switchTab('accounts')}
                    >
                        <Users size={17} /> User Accounts{' '}
                        <span>
                            {directory?.accountTotal ?? accounts.length}
                        </span>
                    </button>
                    {roles.map((accountRole) => (
                        <button
                            key={accountRole}
                            type="button"
                            aria-pressed={tab === 'accounts' && role === accountRole}
                            onClick={() => switchTab('accounts', accountRole)}
                        >
                            {accountRole === 'Engineer' ? 'Engineer Accounts' : `${accountRole}s`}
                        </button>
                    ))}
                    <button
                        type="button"
                        aria-pressed={tab === 'engineers'}
                        onClick={() => switchTab('engineers')}
                    >
                        <HardHat size={17} /> Engineer Profiles{' '}
                        <span>
                            {directory?.engineerTotal ?? engineers.length}
                        </span>
                    </button>
                </nav>
                <div className="um-toolbar">
                    <label className="um-search">
                        <Search size={18} />
                        <input
                            aria-label={
                                tab === 'accounts'
                                    ? 'Search accounts'
                                    : 'Search engineers'
                            }
                            placeholder={
                                tab === 'accounts'
                                    ? 'Search username, email or Engineer…'
                                    : 'Search Engineer name, rank or contact…'
                            }
                            value={search}
                            maxLength={150}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                    </label>
                    <DirectoryFilter
                        label="Filter status"
                        className="um-filter"
                        value={state}
                        onChange={(value) => {
                            setState(value);
                            setPage(1);
                        }}
                        options={[
                            { value: 'all', label: 'All Statuses' },
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: tab === 'accounts' ? 'Inactive' : 'Retired' },
                        ]}
                    />
                    {(search || state !== 'all') && (
                        <button
                            className="um-secondary"
                            type="button"
                            onClick={clear}
                        >
                            Clear filters
                        </button>
                    )}
                </div>
                <div
                    className="um-table-scroll"
                    role="region"
                    aria-label={
                        tab === 'accounts'
                            ? 'User Accounts table'
                            : 'Engineers table'
                    }
                    tabIndex={0}
                >
                    {tab === 'accounts' ? (
                        <table className="um-table">
                            <thead>
                                <tr>
                                    <th>Account</th>
                                    <th>Account Type</th>
                                    <th>Linked Engineer</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAccounts
                                    .slice(sliceStart, sliceEnd)
                                    .map((a) => {
                                        const e =
                                            a.engineer_id === null
                                                ? undefined
                                                : byEngineer.get(a.engineer_id);

                                        return (
                                            <tr
                                                key={a.id}
                                                data-account-id={a.id}
                                            >
                                                <td>
                                                    <div className="um-person">
                                                        <span className="um-avatar">
                                                            {a.username
                                                                .slice(0, 2)
                                                                .toUpperCase()}
                                                        </span>
                                                        <div>
                                                            <strong>
                                                                {a.username}
                                                                {a.id ===
                                                                    actorId && (
                                                                    <span className="um-you">
                                                                        {' '}
                                                                        You
                                                                    </span>
                                                                )}
                                                            </strong>
                                                            <small>
                                                                {a.email}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <AccountTypeBadge
                                                        role={a.account_type}
                                                    />
                                                </td>
                                                <td>
                                                    {e ? (
                                                        <>
                                                            <strong>
                                                                {nameOf(e)}
                                                            </strong>
                                                            <small>
                                                                {e.rank}
                                                            </small>
                                                        </>
                                                    ) : a.engineer_id ? (
                                                        'Engineer #' +
                                                        a.engineer_id
                                                    ) : (
                                                        <span className="um-muted">
                                                            Not linked
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <Status
                                                        active={a.is_active}
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        className="um-secondary um-row-action"
                                                        type="button"
                                                        aria-label={
                                                            'Manage account ' +
                                                            a.username
                                                        }
                                                        onClick={() =>
                                                            open({
                                                                kind: 'account',
                                                                id: a.id,
                                                            })
                                                        }
                                                    >
                                                        Manage
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    ) : (
                        <table className="um-table">
                            <thead>
                                <tr>
                                    <th>Engineer</th>
                                    <th>Rank</th>
                                    <th>Linked Account</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEngineers
                                    .slice(sliceStart, sliceEnd)
                                    .map((e) => {
                                        const account = linkedAccounts.get(
                                            e.id,
                                        );

                                        return (
                                            <tr
                                                key={e.id}
                                                data-engineer-id={e.id}
                                            >
                                                <td>
                                                    <div className="um-person">
                                                        <span className="um-avatar">
                                                            {(
                                                                e.first_name.slice(
                                                                    0,
                                                                    1,
                                                                ) +
                                                                e.last_name.slice(
                                                                    0,
                                                                    1,
                                                                )
                                                            ).toUpperCase()}
                                                        </span>
                                                        <div>
                                                            <strong>
                                                                {nameOf(e)}
                                                            </strong>
                                                            <small>
                                                                {e.contact_no ||
                                                                    'No contact number'}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{e.rank}</td>
                                                <td>
                                                    {account ? (
                                                        <>
                                                            <strong>
                                                                {
                                                                    account.username
                                                                }
                                                            </strong>
                                                            <div className="mt-1">
                                                                <AccountTypeBadge
                                                                    role={
                                                                        account.account_type
                                                                    }
                                                                />
                                                            </div>
                                                        </>
                                                    ) : e.engineer_status ===
                                                      'Active' ? (
                                                        <span className="um-muted">
                                                            Available to link
                                                        </span>
                                                    ) : (
                                                        <span className="um-muted">
                                                            Not available to
                                                            link
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <Status
                                                        active={
                                                            e.engineer_status ===
                                                            'Active'
                                                        }
                                                        label={
                                                            e.engineer_status
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        className="um-secondary um-row-action"
                                                        type="button"
                                                        aria-label={
                                                            'Manage engineer ' +
                                                            nameOf(e)
                                                        }
                                                        onClick={() =>
                                                            open({
                                                                kind: 'engineer',
                                                                id: e.id,
                                                            })
                                                        }
                                                    >
                                                        Manage
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    )}
                    {count === 0 && (
                        <div className="um-empty">
                            <Search size={25} />
                            <strong>
                                No{' '}
                                {tab === 'accounts' ? 'accounts' : 'engineers'}{' '}
                                found
                            </strong>
                            <p>Try changing your search or filters.</p>
                            <button
                                type="button"
                                className="um-secondary"
                                onClick={clear}
                            >
                                Clear filters
                            </button>
                        </div>
                    )}
                </div>
                <div className="um-footer">
                    <DirectoryPagination
                        total={count}
                        from={count ? start + 1 : 0}
                        to={Math.min(start + pageSize, count)}
                        currentPage={current}
                        lastPage={last}
                        plural={tab === 'accounts' ? 'accounts' : 'engineers'}
                        label="User management pagination"
                        onPage={visitPage}
                    />
                </div>
            </section>
            <aside className="um-policy">
                <ShieldCheck size={20} />
                <div>
                    <strong>Access & record protection</strong>
                    <p>
                        Account Type controls permissions. Deactivation and
                        retirement preserve maintenance history. Engineer
                        profiles are not restricted by LGU.
                    </p>
                </div>
            </aside>
            <Dialog.Root
                open={modal !== null}
                onOpenChange={(value) => {
                    if (!value && !busy) {
                        setModal(null);
                    }
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="um-overlay" />
                    <Dialog.Content
                        className="um-dialog"
                        onEscapeKeyDown={(e) => {
                            if (busy) {
                                e.preventDefault();
                            }
                        }}
                        onPointerDownOutside={(e) => {
                            if (busy) {
                                e.preventDefault();
                            }
                        }}
                    >
                        <div className="um-dialog-head">
                            <div>
                                <Dialog.Title>{modalTitle}</Dialog.Title>
                                <Dialog.Description>
                                    {modal?.kind === 'add-account'
                                        ? 'Set up a person profile, sign-in details and account access.'
                                        : modal?.kind === 'add-engineer'
                                          ? 'Register a professional Engineer profile.'
                                          : 'Review details and make authorized changes.'}
                                </Dialog.Description>
                            </div>
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    aria-label="Close dialog"
                                    disabled={busy}
                                >
                                    <X size={20} />
                                </button>
                            </Dialog.Close>
                        </div>
                        <div className="um-dialog-body">
                            {modal?.kind === 'add-account' ||
                            modal?.kind === 'add-engineer' ? (
                                <CreateForm
                                    key={modal.kind}
                                    kind={modal.kind}
                                    eligible={eligibleEngineers}
                                    eligibleTotal={eligibleEngineerTotal}
                                    roles={canCreateRoles}
                                    onClose={() => {
                                        setModal(null);
                                        setBusy(false);
                                        setDismissed(null);
                                        setTab(
                                            modal.kind === 'add-account'
                                                ? 'accounts'
                                                : 'engineers',
                                        );
                                        setRole('all');
                                        clear();
                                    }}
                                    onBusy={setBusy}
                                    onProfileOnly={() => open({ kind: 'add-engineer' })}
                                />
                            ) : modal?.kind === 'account' ? (
                                <DdAccountLifecycle
                                    key={modal.id}
                                    accounts={accounts}
                                    actorId={actorId}
                                    initialAccountId={modal.id}
                                    onBusy={setBusy}
                                />
                            ) : modal?.kind === 'engineer' ? (
                                <DdEngineerLifecycle
                                    key={modal.id}
                                    engineers={engineers}
                                    initialEngineerId={modal.id}
                                    onBusy={setBusy}
                                />
                            ) : null}
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
}

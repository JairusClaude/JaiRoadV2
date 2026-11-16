import * as Dialog from '@radix-ui/react-dialog';
import { router } from '@inertiajs/react';
import { CheckCircle2, ChevronLeft, ChevronRight, HardHat, Plus, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import DdAccountLifecycle from '@/pages/dd-phase3/DdAccountLifecycle';
import DdEngineerLifecycle from '@/pages/dd-phase3/DdEngineerLifecycle';
import '../../../css/canonical-user-management.css';

type Role = 'SuperAdmin' | 'Admin' | 'Engineer' | 'Viewer';
type Account = { id: number; username: string; email: string; account_type: Role; engineer_id: number | null; is_active: boolean };
type Engineer = { id: number; first_name: string; middle_name: string | null; last_name: string; rank: string; engineer_status: string; contact_no: string | null };
type EligibleEngineer = Pick<Engineer, 'id' | 'first_name' | 'last_name' | 'rank' | 'engineer_status'>;
type Modal = { kind: 'add-account' | 'add-engineer' } | { kind: 'account' | 'engineer'; id: number };
type Props = {
    accounts: Account[];
    engineers: Engineer[];
    eligibleEngineers: EligibleEngineer[];
    actorId: number;
    canCreateRoles: Role[];
    accountTotal: number | null;
    status: string | null;
};
const roles: Role[] = ['SuperAdmin', 'Admin', 'Engineer', 'Viewer'];
const nameOf = (e: Engineer | EligibleEngineer) => [e.first_name, 'middle_name' in e ? e.middle_name : '', e.last_name].filter(Boolean).join(' ');
const pageSize = 15;

function Status({ active, label }: { active: boolean; label?: string }) {
    return <span className={active ? 'um-status um-status-active' : 'um-status'}><i />{label ?? (active ? 'Active' : 'Inactive')}</span>;
}
function Field({ label, value, onChange, error, type = 'text', optional = false, help }: {
    label: string; value: string; onChange: (value: string) => void; error?: string; type?: string; optional?: boolean; help?: string;
}) {
    return <label className="um-field">{label}{optional ? <span className="um-optional"> (optional)</span> : <span className="um-required" aria-hidden="true"> *</span>}
        <input aria-label={label} className="um-input" type={type} value={value} required={!optional} aria-invalid={!!error} autoComplete={type === 'password' ? 'new-password' : 'off'} onChange={(e) => onChange(e.target.value)} />
        {help && <small>{help}</small>}
        {error && <small role="alert" className="um-required">{error}</small>}
    </label>;
}
function CreateForm({ kind, eligible, roles: allowed, onClose, onBusy }: {
    kind: 'add-account' | 'add-engineer'; eligible: EligibleEngineer[]; roles: Role[]; onClose: () => void; onBusy: (busy: boolean) => void;
}) {
    const isAccount = kind === 'add-account';
    const [account, setAccount] = useState({ username: '', email: '', name: '', account_type: allowed[0] ?? 'Viewer', engineer_id: '', password: '', password_confirmation: '' });
    const [engineer, setEngineer] = useState({ first_name: '', middle_name: '', last_name: '', contact_no: '', rank: '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || (isAccount && (!allowed.includes(account.account_type) || !eligible.some(e => String(e.id) === account.engineer_id)))) return;
        setBusy(true);
        onBusy(true);
        setErrors({});
        router.post(isAccount ? '/dd-phase3/accounts' : '/dd-phase3/engineers', isAccount ? account : engineer, {
            preserveScroll: true,
            onError: setErrors,
            onSuccess: onClose,
            onFinish: () => { setBusy(false); onBusy(false); },
        });
    }
    const af = (key: keyof typeof account, label: string, type = 'text', help?: string) => <Field key={key} label={label} type={type} value={account[key]} onChange={v => setAccount(old => ({ ...old, [key]: v }))} error={errors[key]} help={help}/>;
    const ef = (key: keyof typeof engineer, label: string, optional = false) => <Field key={key} label={label} value={engineer[key]} onChange={v => setEngineer(old => ({ ...old, [key]: v }))} error={errors[key]} optional={optional}/>;
    return <form onSubmit={submit} className="um-form">
        {isAccount ? <>
            <div className="um-form-note">New accounts require an active, unused Engineer profile. Linking a profile does not change Account Type or its permissions.</div>
            <div className="um-form-grid">
                {af('username', 'Username', 'text', 'Letters, numbers, underscore, dot and hyphen.')}
                {af('email', 'Email', 'email')}
                {af('name', 'Display name')}
                <label className="um-field">Account Type <span className="um-required">*</span>
                    <select aria-label="Account Type" className="um-input" required value={account.account_type} onChange={e => setAccount(old => ({ ...old, account_type: e.target.value as Role }))}>
                        {allowed.map(role => <option key={role}>{role}</option>)}
                    </select>
                    {errors.account_type && <small role="alert" className="um-required">{errors.account_type}</small>}
                </label>
                <label className="um-field um-span">Linked Engineer <span className="um-required">*</span>
                    <select aria-label="Linked Engineer" className="um-input" required value={account.engineer_id} onChange={e => setAccount(old => ({ ...old, engineer_id: e.target.value }))}>
                        <option value="">Select an active Engineer</option>
                        {eligible.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} · {e.rank}</option>)}
                    </select>
                    <small>{eligible.length} available profile(s). {eligible.length === 0 && 'Add an Engineer profile first.'}</small>
                    {errors.engineer_id && <small role="alert" className="um-required">{errors.engineer_id}</small>}
                </label>
                {af('password', 'Password', 'password', 'At least 12 characters with upper/lowercase, numbers and symbols.')}
                {af('password_confirmation', 'Confirm password', 'password')}
            </div>
        </> : <>
            <div className="um-form-grid">
                {ef('first_name', 'First name')}
                {ef('middle_name', 'Middle name', true)}
                {ef('last_name', 'Last name')}
                {ef('contact_no', 'Contact number')}
                {ef('rank', 'Rank')}
            </div>
            <div className="um-form-note">New Engineer profiles start Active. Create a linked account separately if the Engineer needs system access. No LGU assignment is required.</div>
        </>}
        {Object.keys(errors).length > 0 && <div role="alert" className="um-error">{Object.values(errors).join(' ')}</div>}
        <footer className="um-dialog-actions">
            <button type="button" className="um-secondary" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="submit" className="um-primary" disabled={busy || (isAccount && (!eligible.length || !allowed.length))}>{busy ? 'Saving…' : isAccount ? 'Create account' : 'Create engineer'}</button>
        </footer>
    </form>;
}

export default function CanonicalUserManagement({ accounts, engineers, eligibleEngineers, actorId, canCreateRoles, accountTotal, status }: Props) {
    const [tab, setTab] = useState<'accounts' | 'engineers'>('accounts');
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('all');
    const [state, setState] = useState('all');
    const [page, setPage] = useState(1);
    const [modal, setModal] = useState<Modal | null>(null);
    const [busy, setBusy] = useState(false);
    const [dismissed, setDismissed] = useState<string | null>(null);
    const activeAccounts = accounts.filter(a => a.is_active).length;
    const activeEngineers = engineers.filter(e => e.engineer_status === 'Active').length;
    const byEngineer = new Map(engineers.map(e => [e.id, e]));
    const linkedAccounts = new Map(accounts.filter(a => a.engineer_id !== null).map(a => [a.engineer_id, a]));
    const q = search.trim().toLowerCase();
    const filteredAccounts = accounts.filter(a => {
        const e = a.engineer_id === null ? undefined : byEngineer.get(a.engineer_id);
        return [a.username, a.email, a.id, a.account_type, e ? nameOf(e) : ''].join(' ').toLowerCase().includes(q)
            && (role === 'all' || a.account_type === role)
            && (state === 'all' || (state === 'active') === a.is_active);
    });
    const filteredEngineers = engineers.filter(e => [nameOf(e), e.rank, e.contact_no, e.id, linkedAccounts.get(e.id)?.username].join(' ').toLowerCase().includes(q)
        && (state === 'all' || (state === 'active') === (e.engineer_status === 'Active')));
    const count = tab === 'accounts' ? filteredAccounts.length : filteredEngineers.length;
    const last = Math.max(1, Math.ceil(count / pageSize));
    const current = Math.min(page, last);
    const start = (current - 1) * pageSize;
    function switchTab(next: typeof tab) { setTab(next); setSearch(''); setRole('all'); setState('all'); setPage(1); }
    function clear() { setSearch(''); setRole('all'); setState('all'); setPage(1); }
    function open(value: Modal) { setDismissed(status); setModal(value); }
    const modalTitle = modal?.kind === 'add-account' ? 'Add Account' : modal?.kind === 'add-engineer' ? 'Add Engineer' : modal?.kind === 'account' ? 'Manage Account' : 'Manage Engineer';
    const stats = [
        { label: 'Total accounts', value: accountTotal ?? accounts.length, detail: 'Registered system accounts', Icon: Users },
        { label: 'Active accounts', value: activeAccounts, detail: accountTotal !== null && accountTotal > accounts.length ? 'In loaded directory' : 'Enabled for sign-in', Icon: ShieldCheck },
        { label: 'Engineer profiles', value: engineers.length, detail: activeEngineers + ' active in directory', Icon: HardHat },
        { label: 'Available profiles', value: eligibleEngineers.length, detail: 'Ready to link to an account', Icon: UserRound },
    ];
    return <div className="um-workspace">
        <section className="um-metrics" aria-label="User management statistics">
            {stats.map(({label, value, detail, Icon}) => <div key={label} className="um-metric">
                <div className="um-metric-top"><span>{label}</span><span className="um-stat-icon"><Icon size={19}/></span></div>
                <strong>{value}</strong><small>{detail}</small>
            </div>)}
        </section>
        {status && status !== dismissed && <div role="status" className="um-notice"><CheckCircle2 size={18}/><span>{status}</span><button type="button" aria-label="Dismiss notice" onClick={() => setDismissed(status)}><X size={17}/></button></div>}
        <section className="um-directory">
            <div className="um-directory-head">
                <div><h2>People directory</h2><p>Manage access and professional profiles in one place.</p></div>
                <div className="um-header-actions">
                    <button type="button" className="um-secondary" onClick={() => open({kind:'add-engineer'})}><Plus size={16}/> Add Engineer</button>
                    <button type="button" className="um-primary" disabled={!canCreateRoles.length} onClick={() => open({kind:'add-account'})}><Plus size={16}/> Add Account</button>
                </div>
            </div>
            <nav className="um-tabs" aria-label="Directory views">
                <button type="button" aria-pressed={tab === 'accounts'} onClick={() => switchTab('accounts')}><Users size={17}/> User Accounts <span>{accounts.length}</span></button>
                <button type="button" aria-pressed={tab === 'engineers'} onClick={() => switchTab('engineers')}><HardHat size={17}/> Engineers <span>{engineers.length}</span></button>
            </nav>
            <div className="um-toolbar">
                <label className="um-search"><Search size={18}/><input aria-label={tab === 'accounts' ? 'Search accounts' : 'Search engineers'} placeholder={tab === 'accounts' ? 'Search username, email or Engineer…' : 'Search Engineer name, rank or contact…'} value={search} maxLength={255} onChange={e => { setSearch(e.target.value); setPage(1); }}/></label>
                {tab === 'accounts' && <select aria-label="Filter account type" className="um-filter" value={role} onChange={e => {setRole(e.target.value);setPage(1);}}><option value="all">All Account Types</option>{roles.map(r => <option key={r}>{r}</option>)}</select>}
                <select aria-label="Filter status" className="um-filter" value={state} onChange={e => {setState(e.target.value);setPage(1);}}><option value="all">All Statuses</option><option value="active">Active</option><option value="inactive">{tab === 'accounts' ? 'Inactive' : 'Retired'}</option></select>
                {(search || role !== 'all' || state !== 'all') && <button className="um-secondary" type="button" onClick={clear}>Clear filters</button>}
            </div>
            <div className="um-table-scroll" role="region" aria-label={tab === 'accounts' ? 'User Accounts table' : 'Engineers table'} tabIndex={0}>
                {tab === 'accounts' ? <table className="um-table">
                    <thead><tr><th>Account</th><th>Account Type</th><th>Linked Engineer</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{filteredAccounts.slice(start, start+pageSize).map(a => {
                        const e = a.engineer_id === null ? undefined : byEngineer.get(a.engineer_id);
                        return <tr key={a.id}>
                            <td><div className="um-person"><span className="um-avatar">{a.username.slice(0,2).toUpperCase()}</span><div><strong>{a.username}{a.id === actorId && <span className="um-you"> You</span>}</strong><small>{a.email}</small></div></div></td>
                            <td><span className="um-role" data-role={a.account_type}>{a.account_type}</span></td>
                            <td>{e ? <><strong>{nameOf(e)}</strong><small>{e.rank}</small></> : a.engineer_id ? 'Engineer #' + a.engineer_id : <span className="um-muted">Not linked</span>}</td>
                            <td><Status active={a.is_active}/></td>
                            <td><button className="um-secondary um-row-action" type="button" aria-label={'Manage account ' + a.username} onClick={() => open({kind:'account',id:a.id})}>Manage</button></td>
                        </tr>;
                    })}</tbody>
                </table> : <table className="um-table">
                    <thead><tr><th>Engineer</th><th>Rank</th><th>Linked Account</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>{filteredEngineers.slice(start, start+pageSize).map(e => {
                        const account = linkedAccounts.get(e.id);
                        return <tr key={e.id}>
                            <td><div className="um-person"><span className="um-avatar">{(e.first_name.slice(0,1)+e.last_name.slice(0,1)).toUpperCase()}</span><div><strong>{nameOf(e)}</strong><small>{e.contact_no || 'No contact number'}</small></div></div></td>
                            <td>{e.rank}</td><td>{account ? <><strong>{account.username}</strong><small>{account.account_type}</small></> : eligibleEngineers.some(x => x.id === e.id) ? <span className="um-muted">Available to link</span> : <span className="um-muted">Not in loaded account list</span>}</td>
                            <td><Status active={e.engineer_status === 'Active'} label={e.engineer_status}/></td>
                            <td><button className="um-secondary um-row-action" type="button" aria-label={'Manage engineer ' + nameOf(e)} onClick={() => open({kind:'engineer',id:e.id})}>Manage</button></td>
                        </tr>;
                    })}</tbody>
                </table>}
                {count === 0 && <div className="um-empty"><Search size={25}/><strong>No {tab === 'accounts' ? 'accounts' : 'engineers'} found</strong><p>Try changing your search or filters.</p><button type="button" className="um-secondary" onClick={clear}>Clear filters</button></div>}
            </div>
            <div className="um-footer"><span role="status">{count ? start+1 : 0}–{Math.min(start+pageSize,count)} of {count} {tab === 'accounts' ? 'accounts' : 'engineers'}</span><div><button type="button" aria-label="Previous page" disabled={current === 1} onClick={() => setPage(current-1)}><ChevronLeft size={18}/></button><span>{current} / {last}</span><button type="button" aria-label="Next page" disabled={current === last} onClick={() => setPage(current+1)}><ChevronRight size={18}/></button></div></div>
            {(accountTotal !== null && accountTotal > accounts.length || engineers.length === 200) && <p className="um-limit">Search and filters apply to the loaded directory. The server currently returns up to 200 accounts and 200 profiles.</p>}
        </section>
        <aside className="um-policy"><ShieldCheck size={20}/><div><strong>Access & record protection</strong><p>Account Type controls permissions. Deactivation and retirement preserve maintenance history. Engineer profiles are not restricted by LGU.</p></div></aside>
        <Dialog.Root open={modal !== null} onOpenChange={value => { if (!value && !busy) setModal(null); }}>
            <Dialog.Portal><Dialog.Overlay className="um-overlay"/><Dialog.Content className="um-dialog" onEscapeKeyDown={e => {if(busy)e.preventDefault();}} onPointerDownOutside={e => {if(busy)e.preventDefault();}}>
                <div className="um-dialog-head"><div><Dialog.Title>{modalTitle}</Dialog.Title><Dialog.Description>{modal?.kind === 'add-account' ? 'Set up sign-in details and account access.' : modal?.kind === 'add-engineer' ? 'Register a professional Engineer profile.' : 'Review details and make authorized changes.'}</Dialog.Description></div><Dialog.Close asChild><button type="button" aria-label="Close dialog" disabled={busy}><X size={20}/></button></Dialog.Close></div>
                <div className="um-dialog-body">
                    {modal?.kind === 'add-account' || modal?.kind === 'add-engineer' ? <CreateForm key={modal.kind} kind={modal.kind} eligible={eligibleEngineers} roles={canCreateRoles} onClose={() => {setModal(null);setBusy(false);setTab(modal.kind === 'add-account' ? 'accounts' : 'engineers');clear();}} onBusy={setBusy}/> : modal?.kind === 'account' ? <DdAccountLifecycle key={modal.id} accounts={accounts} actorId={actorId} initialAccountId={modal.id}/> : modal?.kind === 'engineer' ? <DdEngineerLifecycle key={modal.id} engineers={engineers} initialEngineerId={modal.id}/> : null}
                </div>
            </Dialog.Content></Dialog.Portal>
        </Dialog.Root>
    </div>;
}

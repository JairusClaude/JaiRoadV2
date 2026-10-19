import { Head, Link } from '@inertiajs/react';
import { Activity, ArrowRight, Building2, CircleAlert, Crown, FileText, FolderKanban, LockKeyhole, ShieldCheck, UserRoundCog, Users } from 'lucide-react';

type Counts = {
    accounts: number; activeAccounts: number; inactiveAccounts: number;
    superadmins: number; admins: number; engineerAccounts: number; viewers: number;
    unlinkedAdmins: number; engineers: number | null; retiredEngineers: number | null;
    lguAssignments: number | null; activeAssignments: number | null;
    projects: number | null; roadCoverages: number | null; maintenanceRecords: number | null;
};
type PrivilegedAccount = { id: number; username: string; role: string; active: boolean; linkedEngineer: number | null };
type AuditEvent = { id: number; actor: string; action: string; entity: string; createdAt: string };
type Props = {
    username: string;
    counts: Counts;
    privilegedAccounts: PrivilegedAccount[];
    recentEvents: AuditEvent[];
    supportedActions: { createAdmin: boolean; roleChange: boolean; adminDeactivation: boolean; securityPolicyEditing: boolean };
};
const panel = 'rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(30,45,67,.035)]';
const format = (value: number | null) => value === null ? '—' : value.toLocaleString();

export default function SuperAdminDashboard({ username, counts, privilegedAccounts, recentEvents, supportedActions }: Props) {
    const roles = [
        { name: 'SuperAdmin', value: counts.superadmins },
        { name: 'Admin', value: counts.admins },
        { name: 'Engineer', value: counts.engineerAccounts },
        { name: 'Viewer', value: counts.viewers },
    ];
    return <>
        <Head title="SuperAdmin Command Center" />
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[26px] bg-[#111c33] px-6 py-7 text-white sm:px-8 sm:py-9">
                <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border-[52px] border-amber-400/10" />
                <div className="relative flex flex-wrap items-start justify-between gap-6">
                    <div className="max-w-2xl space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[.13em] text-amber-300"><Crown className="h-3.5 w-3.5" /> Highest Authority · SuperAdmin</div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">System Command Center</h1>
                        <p className="text-sm leading-relaxed text-slate-300">Welcome, {username}. Govern privileged accounts, oversee platform integrity, and access all approved JaiROADS operations.</p>
                    </div>
                    <Link href="/user-management" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-bold text-[#1e2432] hover:bg-amber-200"><UserRoundCog className="h-4 w-4" /> Manage accounts <ArrowRight className="h-4 w-4" /></Link>
                </div>
                <div className="relative mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/15 pt-5 text-xs text-slate-300"><span><ShieldCheck className="mr-1 inline h-4 w-4 text-amber-300" /> Verified SuperAdmin access</span><span><LockKeyhole className="mr-1 inline h-4 w-4 text-amber-300" /> Server-enforced permissions</span><span>AuditLog remains append-only</span></div>
            </section>

            <section aria-label="System metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Active UserAccounts', value: counts.activeAccounts, detail: `${counts.inactiveAccounts} inactive retained`, icon: Users },
                    { label: 'Privileged Admin Accounts', value: counts.superadmins + counts.admins, detail: `${counts.superadmins} SuperAdmin · ${counts.admins} Admin`, icon: ShieldCheck },
                    { label: 'Active EngineerLGU Links', value: counts.activeAssignments, detail: `${format(counts.lguAssignments)} assignment rows retained`, icon: Building2 },
                    { label: 'Maintenance Records', value: counts.maintenanceRecords, detail: `${format(counts.projects)} long-term projects`, icon: Activity },
                ].map(({ label, value, detail, icon: Icon }) => <div key={label} className={`${panel} p-5`}><div className="flex items-center justify-between text-sm font-medium text-slate-600"><span>{label}</span><Icon className="h-5 w-5 text-amber-700" /></div><div className="mt-3 text-3xl font-bold tabular-nums">{format(value)}</div><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}
            </section>

            {counts.unlinkedAdmins > 0 && <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950" aria-label="Account integrity notice"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><h2 className="text-sm font-semibold">{counts.unlinkedAdmins} Admin account(s) without an Engineer link</h2><p className="mt-1 text-xs leading-relaxed">The final Data Dictionary expects Admin-to-Engineer linkage. Existing legacy exceptions are preserved for review; this dashboard will not silently modify them.</p></div></section>}

            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <section className={`${panel} p-5 sm:p-6`}>
                    <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Administrative authority</h2><p className="mt-1 text-sm text-slate-500">Privileges and guarded governance workflows</p></div><ShieldCheck className="h-6 w-6 text-amber-700" /></div>
                    <div className="mt-5 space-y-3">
                        <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><div><div className="text-sm font-bold">Create Admin accounts</div><p className="mt-1 text-xs leading-relaxed text-slate-600">Exclusive under the current provisioner. Use the existing authorized User Management form; no SuperAdmin is created publicly.</p></div><Link href="/user-management" className="shrink-0 rounded-lg bg-[#19243a] px-3 py-2 text-xs font-semibold text-white hover:bg-[#293b5b]">Open</Link></div>
                        {[
                            ['Privileged role transitions', supportedActions.roleChange],
                            ['Admin-account suspension / recovery', supportedActions.adminDeactivation],
                            ['System security policy configuration', supportedActions.securityPolicyEditing],
                        ].map(([label, ready]) => <div key={String(label)} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3"><div className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-slate-500" /><span className="text-sm font-medium">{String(label)}</span></div><span className="text-[11px] font-semibold text-slate-500">{ready ? 'Available' : 'Requires approved backend workflow'}</span></div>)}
                    </div>
                    <p className="mt-4 text-xs text-slate-500">Restricted features are intentionally not clickable until database constraints, recovery protections, transactional audit and HTTP authorization tests are complete.</p>
                </section>
                <section className={`${panel} p-5 sm:p-6`}>
                    <h2 className="text-lg font-bold">Role distribution</h2><p className="mt-1 text-sm text-slate-500">Real active and inactive UserAccount inventory</p>
                    <div className="mt-5 space-y-4">{roles.map(({ name, value }) => <div key={name}><div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{name}</span><span className="tabular-nums text-slate-600">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#c47b32]" style={{ width: `${counts.accounts ? Math.max(0, Math.min(100, value / counts.accounts * 100)) : 0}%` }} /></div></div>)}</div>
                    <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs text-slate-600">{format(counts.engineers)} Engineer profiles · {format(counts.retiredEngineers)} Retired · {format(counts.roadCoverages)} RoadCoverages</div>
                </section>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <section className={`${panel} overflow-hidden`}><div className="px-5 pb-3 pt-5 sm:px-6"><h2 className="text-lg font-bold">Privileged accounts</h2><p className="mt-1 text-sm text-slate-500">Read-only account governance overview</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Account</th><th className="px-3 py-3 font-semibold">Role</th><th className="px-3 py-3 font-semibold">Engineer</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{privilegedAccounts.map(a => <tr key={a.id}><td className="px-5 py-3 font-medium">{a.username}<div className="text-xs font-normal text-slate-400">#{a.id}</div></td><td className="px-3 py-3 capitalize">{a.role}</td><td className="px-3 py-3 text-slate-600">{a.linkedEngineer === null ? 'Unlinked' : `#${a.linkedEngineer}`}</td><td className="px-5 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${a.active ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{a.active ? 'Active' : 'Inactive'}</span></td></tr>)}{privilegedAccounts.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-500">No privileged accounts found</td></tr>}</tbody></table></div></section>
                <section className={`${panel} p-5 sm:p-6`}><div className="flex items-center gap-2"><FileText className="h-5 w-5 text-amber-700" /><h2 className="text-lg font-bold">Recent audit activity</h2></div><p className="mt-1 text-sm text-slate-500">Append-only AuditLog events, newest first</p><div className="mt-5 divide-y divide-slate-100">{recentEvents.map(e => <div key={e.id} className="flex justify-between gap-3 py-3"><div><div className="text-sm font-semibold">{e.action} · {e.entity}</div><div className="mt-1 text-xs text-slate-500">{e.actor} · #{e.id}</div></div><time className="shrink-0 text-right text-xs text-slate-400">{e.createdAt}</time></div>)}{recentEvents.length === 0 && <p className="py-6 text-sm text-slate-500">No audit events available.</p>}</div></section>
            </div>
            <section className={`${panel} flex flex-wrap items-center justify-between gap-3 p-5`}><div><h2 className="text-sm font-bold">Operational system access</h2><p className="mt-1 text-xs text-slate-500">SuperAdmin retains the same Data Dictionary operational CRUD scope as Admin, subject to retention rules.</p></div><div className="flex flex-wrap gap-2"><Link href="/maintenance-projects" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"><FolderKanban className="h-4 w-4" /> Projects</Link><Link href="/lgus-preview" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"><Building2 className="h-4 w-4" /> LGUs</Link></div></section>
        </div>
    </>;
}

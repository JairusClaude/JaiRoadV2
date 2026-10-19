import { Head } from '@inertiajs/react';
import { Activity, Building2, Crown, FileText, FolderKanban, LockKeyhole, ShieldCheck, Users } from 'lucide-react';

type Props = {
    username: string;
    counts: Record<string, number>;
    auditEvents: Array<{ action: string; entity: string; createdAt: string }>;
};

const cards = [
    { key: 'UserAccounts', label: 'UserAccounts', icon: Users },
    { key: 'ActiveUserAccounts', label: 'Active accounts', icon: ShieldCheck },
    { key: 'Engineers', label: 'Engineers', icon: Users },
    { key: 'LGUs', label: 'LGUs', icon: Building2 },
    { key: 'RoadCoverages', label: 'Road coverages', icon: Activity },
    { key: 'MaintenanceProjects', label: 'Maintenance projects', icon: FolderKanban },
    { key: 'MaintenanceRecords', label: 'Maintenance records', icon: FileText },
    { key: 'AuditLogs', label: 'Audit events', icon: LockKeyhole },
];

export default function DdSuperAdminLanding({ username, counts, auditEvents }: Props) {
    return (
        <>
            <Head title="JaiROADS Data Dictionary — SuperAdmin" />
            <div className="space-y-6">
                <section className="rounded-[26px] bg-[#111c33] px-6 py-8 text-white sm:px-8">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-300">
                        <Crown className="h-4 w-4" /> Verified Data Dictionary SuperAdmin
                    </div>
                    <h1 className="mt-4 text-3xl font-bold tracking-tight">JaiROADS system overview</h1>
                    <p className="mt-2 max-w-2xl text-sm text-slate-300">Welcome, {username}. This temporary, read-only landing page uses only the 11 approved Data Dictionary entities in jairoads_next.</p>
                    <p className="mt-3 text-xs text-amber-200">Operational modules are being migrated. This page does not activate legacy CRUD actions or grant access to unfinished modules.</p>
                </section>
                <section aria-label="Data Dictionary entity counts" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {cards.map(({ key, label, icon: Icon }) => (
                        <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between text-sm font-medium text-slate-600"><span>{label}</span><Icon className="h-5 w-5 text-amber-700" /></div>
                            <div className="mt-3 text-3xl font-bold tabular-nums text-slate-900">{counts[key] ?? 0}</div>
                        </div>
                    ))}
                </section>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                    <h2 className="text-lg font-semibold text-slate-900">AuditLog — recent event metadata</h2>
                    <p className="mt-1 text-sm text-slate-500">Append-only; sensitive old/new values are never displayed here.</p>
                    <div className="mt-4 divide-y divide-slate-100">
                        {auditEvents.length === 0 && <p className="py-3 text-sm text-slate-500">No audit events recorded.</p>}
                        {auditEvents.map((event, index) => (
                            <div key={`${event.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                                <div className="font-medium text-slate-800">{event.action} · {event.entity}</div>
                                <div className="text-xs text-slate-500">{event.createdAt}</div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </>
    );
}

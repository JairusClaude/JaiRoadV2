import { DdDashboardAnalytics, type DdDashboardSummary } from '@/components/dd-dashboard-analytics';
import { Head, Link } from '@inertiajs/react';
import { Bell, CircleAlert, FileText, FolderKanban, MapPinned, ShieldCheck, Route, Users } from 'lucide-react';
import type { ReactNode } from 'react';

type Role = 'engineer' | 'viewer';
type StatKey = 'assignedLgus' | 'managedRecords' | 'ongoingRecords' | 'roadCoverages' | 'projects' | 'lgus';
type Props = {
    role: Role;
    analytics: DdDashboardSummary;
    name: string;
    username: string;
    engineer: { id: number; name: string; rank: string; status: string } | null;
    assignedLgus: { id: number; name: string }[];
    limitedAccess: boolean;
    stats: Record<StatKey, number | null>;
    records: { id: number; projectId: number | null; projectTitle: string; period: string; status: string; inActiveLgu: boolean }[];
    notifications: { id: number; message: string; createdAt: string }[];
};

function Metric({ label, value, icon }: { label: string; value: number | null; icon: ReactNode }) {
    return <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5">
        <div className="flex items-start justify-between gap-3"><span className="text-sm text-slate-500">{label}</span><span className="text-amber-800">{icon}</span></div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums">{value ?? '—'}</div>
    </div>;
}

const cardLink = 'inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50';

export default function RoleDashboard({ role, name, username, engineer, assignedLgus, limitedAccess, stats, records, notifications, analytics }: Props) {
    const isEngineer = role === 'engineer';
    return <>
        <Head title={`${isEngineer ? 'Engineer' : 'Viewer'} Dashboard · JaiROADS`} />
        <div className="space-y-6">
            <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-800">JaiROADS · {isEngineer ? 'Engineer Workspace' : 'Viewer Workspace'}</p>
                        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-[28px]">Welcome, {engineer?.name || name}</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{isEngineer
                            ? 'Your LGU assignments, managed maintenance activities, and road coverage in one place.'
                            : 'A read-only view of road coverage, projects, and maintenance progress.'}</p>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900"><ShieldCheck className="h-4 w-4" /> {isEngineer ? 'Engineer' : 'Read-only Viewer'} account</span>
                </div>

                {isEngineer && <div className={`mt-6 flex items-start gap-3 rounded-xl border p-4 ${limitedAccess ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <CircleAlert className={`mt-0.5 h-5 w-5 shrink-0 ${limitedAccess ? 'text-amber-800' : 'text-emerald-700'}`} />
                    <div className="text-sm leading-6 text-slate-700"><strong className="block">{limitedAccess ? (engineer === null ? 'Engineer profile not linked' : 'No active LGU assignments') : 'LGU assignments available'}</strong>
                        {limitedAccess
                            ? (engineer === null ? 'Your account has not yet been linked to an Engineer profile. You can sign in, but LGU-scoped editing requires an Admin to link your profile and activate its LGU assignment.' : 'You can browse permitted information, but cannot create or update LGU-scoped operational records until an Admin activates your LGU assignment. Contact your administrator to request an assignment.')
                            : 'Your active LGU assignments determine the maintenance activities you can manage.'}
                    </div>
                </div>}

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {isEngineer ? <>
                        <Metric label="Active LGU assignments" value={stats.assignedLgus} icon={<MapPinned className="h-5 w-5" />} />
                        <Metric label="My maintenance records" value={stats.managedRecords} icon={<FileText className="h-5 w-5" />} />
                        <Metric label="My ongoing records" value={stats.ongoingRecords} icon={<FolderKanban className="h-5 w-5" />} />
                        <Metric label="Road coverages in my LGUs" value={stats.roadCoverages} icon={<Route className="h-5 w-5" />} />
                    </> : <>
                        <Metric label="Maintenance projects" value={stats.projects} icon={<FolderKanban className="h-5 w-5" />} />
                        <Metric label="Maintenance records" value={stats.managedRecords} icon={<FileText className="h-5 w-5" />} />
                        <Metric label="Road coverages" value={stats.roadCoverages} icon={<Route className="h-5 w-5" />} />
                        <Metric label="LGUs" value={stats.lgus} icon={<Users className="h-5 w-5" />} />
                    </>}
                </div>
            </section>

            <DdDashboardAnalytics data={analytics} compact />

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h2 className="text-lg font-bold text-slate-950">{isEngineer ? 'My workspaces' : 'Explore operations'}</h2>
                        <p className="mt-1 text-sm text-slate-500">{isEngineer
                            ? limitedAccess ? 'Browsing only until an active LGU assignment is available.' : 'Changes are allowed only for active LGU scope and owned maintenance activity.'
                            : 'Viewing privileges only. Editing and deletion controls are not available.'}</p></div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${isEngineer ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{isEngineer ? 'Create / Update where assigned' : 'Read only'}</span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        ['Maintenance Projects', '/dd-phase3/projects', isEngineer ? 'Project and maintenance history' : 'Browse projects'],
                        ['Monthly Updates', '/dd-phase3/updates', isEngineer ? 'My monthly progress reporting' : 'Browse monthly reports'],
                        ['Project Documents', '/dd-phase3/documents', isEngineer ? 'Assigned documentation' : 'Browse formal documents'],
                        ['Road Sections', '/dd-phase3/roads', 'Road coverage inventory'],
                        ['LGU Directory', '/dd-phase3/lgus', 'Municipality information'],
                    ].map(([label, href, summary]) =>
                        <Link key={href} href={href} className="rounded-xl border border-slate-200 p-4 transition hover:border-amber-300 hover:bg-amber-50">
                            <div className="text-sm font-semibold text-slate-900">{label} →</div>
                            <p className="mt-1 text-xs text-slate-500">{summary}</p>
                        </Link>) }
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.75fr)]">
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-950">{isEngineer ? 'My managed maintenance activities' : 'Recent maintenance projects'}</h2>
                    <p className="mt-1 text-sm text-slate-500">{isEngineer ? 'Maintenance activities assigned to you.' : 'Current projects across LGUs. Viewer actions are read-only.'}</p>
                    <div className="mt-5 divide-y divide-slate-100">
                        {records.map((record) => <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                            <div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-900">{record.projectTitle}</div>
                                {record.period && <div className="mt-1 text-xs text-slate-500">Record #{record.id} · {record.period} · {record.status}</div>}
                            </div>
                            <Link href="/dd-phase3/projects" className={cardLink}>View</Link>
                        </div>)}
                        {records.length === 0 && <p className="py-10 text-center text-sm text-slate-500">{isEngineer ? 'No maintenance records are currently assigned to your Engineer identity.' : 'No maintenance projects available.'}</p>}
                    </div>
                    <Link href="/dd-phase3/projects" className={`${cardLink} mt-4`}>Browse maintenance projects</Link>
                </section>

                <div className="space-y-6">
                    {isEngineer && <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-950">My active LGUs</h2>
                        <p className="mt-1 text-sm text-slate-500">Municipalities currently assigned to you.</p>
                        <div className="mt-4 flex flex-wrap gap-2">{assignedLgus.map((lgu) => <span key={lgu.id} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">{lgu.name}</span>)}</div>
                        {assignedLgus.length === 0 && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-600">No active LGU assignments. Contact your Administrator if access is needed.</p>}
                    </section>}
                    <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm" id="notifications">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950"><Bell className="h-5 w-5 text-amber-800" /> My notifications</h2>
                        <p className="mt-1 text-sm text-slate-500">Updates and messages for your account.</p>
                        <div className="mt-4 divide-y divide-slate-100">{notifications.map((notice) => <div key={notice.id} className="py-3"><p className="text-sm text-slate-700">{notice.message}</p><time className="mt-1 block text-xs text-slate-500">{notice.createdAt}</time></div>)}</div>
                        {notifications.length === 0 && <p className="mt-4 text-sm text-slate-500">No personal notifications.</p>}
                    </section>
                </div>
            </div>
            <div className="text-xs text-slate-500">Signed in as {username}. </div>
        </div>
    </>;
}

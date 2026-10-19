import { DdNotificationBell } from '@/components/dd-notification-bell';
import '../../css/jairoads-workspace-surfaces.css';
import { Link, usePage } from '@inertiajs/react';
import { useEffect, useState, type ReactNode } from 'react';
import {
    Bell, Building2, ChevronDown, ChevronRight, FileText, FolderKanban,
    LayoutDashboard, LogOut, Map, Menu, PanelLeftClose, Route, Settings,
    ShieldCheck, Users, X,
} from 'lucide-react';

type Identity = { role: string; username: string; name: string } | null;
type WorkspaceRole = 'admin' | 'engineer' | 'viewer';
type NavItem = { label: string; href: string; icon: typeof LayoutDashboard };

const commonLinks: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Maintenance Projects', href: '/maintenance-projects', icon: FolderKanban },
    { label: 'Monthly Updates', href: '/monthly-updates-preview', icon: FileText },
    { label: 'Project Documents', href: '/project-documents-preview', icon: FileText },
    { label: 'Road Sections', href: '/road-sections-preview', icon: Map },
    { label: 'LGU', href: '/lgus-preview', icon: Building2 },
    { label: 'Settings', href: '/settings-preview', icon: Settings },
];

const adminLinks: NavItem[] = [
    ...commonLinks.slice(0, 2),
    { label: 'User Management', href: '/user-management', icon: Users },
    ...commonLinks.slice(2),
];

// Explicit DD-only destinations for newly provisioned accounts. Never allow a
// DD-linked account to use legacy public-schema business routes via navigation.
const ddCommonLinks: NavItem[] = [
    { label: 'Dashboard', href: '/dd-phase3/dashboard', icon: LayoutDashboard },
    { label: 'Maintenance Projects', href: '/dd-phase3/projects', icon: FolderKanban },
    { label: 'Monthly Updates', href: '/dd-phase3/updates', icon: FileText },
    { label: 'Project Documents', href: '/dd-phase3/documents', icon: FileText },
    { label: 'Road Sections', href: '/dd-phase3/roads', icon: Map },
    { label: 'LGU', href: '/dd-phase3/lgus', icon: Building2 },
    { label: 'Settings', href: '/dd-phase3/settings', icon: Settings },
];

const ddAdminLinks: NavItem[] = [
    ...ddCommonLinks.slice(0, 2),
    { label: 'User Management', href: '/dd-phase3/users', icon: Users },
    ...ddCommonLinks.slice(2),
];

function belongsToPath(path: string, href: string): boolean {
    if (href === '/dashboard') return path === '/dashboard' || path.startsWith('/admin-dashboard') || path.startsWith('/role-dashboard');
    if (href === '/maintenance-projects') return path.startsWith('/maintenance-projects') || path.startsWith('/maintenance-records');
    if (href === '/settings-preview') return path.startsWith('/settings-preview') || path.startsWith('/settings/');
    return path === href || path.startsWith(href + '/');
}

function displayRole(role: WorkspaceRole): string {
    if (role === 'admin') return 'Admin Console';
    if (role === 'engineer') return 'Engineer Workspace';
    return 'Viewer Workspace';
}

/**
 * Shared visual foundation for Admin, Engineer and Viewer.
 * Only server-verified identity is used for navigation; Laravel policies still
 * decide what the account can read or change. SuperAdmin has a separate shell.
 */
export default function PolishedWorkspaceLayout({ children }: { children: ReactNode }) {
    const page = usePage<{ jairoadsIdentity?: Identity }>();
    const identity = page.props.jairoadsIdentity ?? null;
    const role = identity?.role;
    const isDdWorkspace = page.url.split('?')[0].startsWith('/dd-phase3/');
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    // The icon rail preference survives Inertia page navigation and reloads.
    useEffect(() => {
        try {
            setSidebarCollapsed(window.localStorage.getItem('jairoads.sidebar.collapsed') === 'true');
        } catch { /* Private browsing/storage restrictions: default to expanded. */ }
    }, []);
    const toggleSidebar = () => {
        setSidebarCollapsed((previous) => {
            const next = !previous;
            try { window.localStorage.setItem('jairoads.sidebar.collapsed', String(next)); } catch { /* safe */ }
            return next;
        });
    };
    const [accountOpen, setAccountOpen] = useState(false);

    // Do not display administrative or operational navigation for unexpected roles.
    if (role !== 'admin' && role !== 'engineer' && role !== 'viewer') {
        return <main role="alert" className="flex min-h-screen items-center justify-center p-6">JaiROADS workspace access is unavailable for this account.</main>;
    }

    const activeRole: WorkspaceRole = role;
    const nav = isDdWorkspace
        ? (activeRole === 'admin' ? ddAdminLinks : ddCommonLinks)
        : (activeRole === 'admin' ? adminLinks : commonLinks);
    const path = page.url.split('?')[0].split('#')[0];
    const current = nav.find(({ href }) => belongsToPath(path, href))?.label ?? 'Dashboard';
    const initials = (identity?.name || identity?.username || '?').trim().split(/\s+/).slice(0, 2)
        .map((part) => part[0] ?? '').join('').toUpperCase();

    return (
        <div className="min-h-screen bg-[#f4f5f8] font-sans text-[#15253b] dark:bg-slate-950 dark:text-slate-100 lg:flex">
            {mobileNavOpen && (
                <button type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}
                    className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden" />
            )}

            <aside aria-label="JaiROADS navigation"
                className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-[#e9e6e2] bg-[#fcfaf7] shadow-xl transition-[width,transform] duration-200 dark:border-slate-700 dark:bg-slate-900 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${sidebarCollapsed ? 'lg:w-[76px]' : 'lg:w-[280px]'} ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Center is y=44px, matching the header bar's center at y=44px. */}
                <div className={`flex h-[88px] shrink-0 items-center justify-between gap-3 border-b border-[#eeeae5] dark:border-slate-700 ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : 'px-5'}`}>
                    <Link href={isDdWorkspace ? "/dd-phase3/dashboard" : "/dashboard"} className={`flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-700 ${sidebarCollapsed ? 'lg:hidden' : ''}`} onClick={() => setMobileNavOpen(false)}>
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-200 bg-[#fff4e4] text-[#914116] shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"><Route className="h-6 w-6" /></span>
                        <span className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}><span className="block text-lg font-bold tracking-tight text-[#15253b] dark:text-white">JaiROADS</span>
                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{displayRole(activeRole)}</span></span>
                    </Link>
                    {/* Desktop collapsed rail: click the JaiROADS logo to reopen, ChatGPT-style. */}
                    <button type="button" onClick={toggleSidebar} aria-label="Expand sidebar" title="Expand sidebar"
                        className={`hidden h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-200 bg-[#fff4e4] text-[#914116] shadow-sm transition hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 ${sidebarCollapsed ? 'lg:grid' : ''}`}>
                        <Route className="h-6 w-6" aria-hidden="true" />
                    </button>
                    {/* Desktop expanded sidebar toggle belongs beside branding, never in the main header. */}
                    <button type="button" onClick={toggleSidebar} aria-label="Collapse sidebar" title="Collapse sidebar"
                        aria-expanded={!sidebarCollapsed}
                        className={`hidden shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-[#fff0df] hover:text-[#914116] focus-visible:outline-2 focus-visible:outline-amber-700 dark:text-slate-300 dark:hover:bg-slate-800 ${sidebarCollapsed ? '' : 'lg:inline-flex'}`}>
                        <PanelLeftClose className="h-[19px] w-[19px]" aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Close navigation" className="rounded-lg p-2 text-slate-600 hover:bg-amber-50 dark:text-slate-200 lg:hidden" onClick={() => setMobileNavOpen(false)}><X className="h-5 w-5" /></button>
                </div>

                <div className={`px-7 pb-3 pt-8 text-[11px] font-bold uppercase tracking-[.16em] text-slate-400 dark:text-slate-500 ${sidebarCollapsed ? 'lg:sr-only' : ''}`}>{activeRole === 'admin' ? 'Administration' : activeRole === 'engineer' ? 'Assigned Operations' : 'Read-only Exploration'}</div>
                <nav aria-label="Primary" className={`min-h-0 flex-1 space-y-1 overflow-y-auto pb-5 ${sidebarCollapsed ? 'lg:px-2' : 'px-4'}`}>
                    {nav.map(({ label, href, icon: Icon }) => {
                        const selected = belongsToPath(path, href);
                        return (
                            <Link key={href} href={href} aria-current={selected ? 'page' : undefined}
                                title={sidebarCollapsed ? label : undefined}
                                aria-label={sidebarCollapsed ? label : undefined}
                                onClick={() => setMobileNavOpen(false)}
                                className={`relative flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 ${sidebarCollapsed ? 'lg:justify-center lg:px-2' : ''} ${selected
                                    ? 'bg-[#fff0df] font-semibold text-[#843817] shadow-[inset_3px_0_0_#a54d1c] dark:bg-amber-900/30 dark:text-amber-200'
                                    : 'font-medium text-[#43526a] hover:bg-white hover:text-[#843817] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-amber-200'}`}>
                                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                                <span className={`truncate ${sidebarCollapsed ? 'lg:sr-only' : ''}`}>{label}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* Display-only identity placard; account actions appear only in header. */}
                <div className={`shrink-0 border-t border-[#eeebe8] dark:border-slate-700 ${sidebarCollapsed ? 'lg:p-2' : 'p-4'}`}>
                    <div className={`flex items-center gap-3 rounded-xl border border-[#e8e6e2] bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 ${sidebarCollapsed ? 'lg:justify-center lg:px-1' : ''}`}>
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fbead3] text-xs font-bold text-[#914116] dark:bg-amber-900 dark:text-amber-100">{initials}</span>
                        <span className={`min-w-0 ${sidebarCollapsed ? 'lg:sr-only' : ''}`}><span className="block truncate text-xs font-semibold text-[#15253b] dark:text-slate-100">{identity?.name || identity?.username || 'Signed-in account'}</span>
                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{activeRole[0].toUpperCase() + activeRole.slice(1)} · Signed in</span></span>
                    </div>
                </div>
            </aside>

            <div className="min-w-0 flex-1">
                {/* 16px top padding + 56px header produces the same 44px vertical center as sidebar branding. */}
                <div className="sticky top-0 z-30 bg-[#f4f5f8]/95 px-4 pb-3 pt-4 backdrop-blur dark:bg-slate-950/95 sm:px-6 lg:px-7">
                    <header className="flex h-14 items-center justify-between gap-3 rounded-2xl border border-[#e9e6e2] bg-white px-3 shadow-[0_3px_16px_rgba(32,39,55,.04)] dark:border-slate-700 dark:bg-slate-900 sm:px-5">
                        <div className="flex min-w-0 items-center gap-3">
                            <button type="button" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 lg:hidden" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu className="h-5 w-5" /></button>
                            <span className="truncate text-sm font-medium text-slate-400">{activeRole === 'admin' ? 'Admin Operations' : activeRole === 'engineer' ? 'Engineer Workspace' : 'Viewer Workspace'}</span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                            <span className="truncate text-sm font-semibold text-[#15253b] dark:text-slate-100">{current}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <DdNotificationBell />
                            <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                            <div className="relative">
                                <button type="button" aria-label="Account menu" aria-expanded={accountOpen}
                                    onClick={() => { setAccountOpen((v) => !v); }}
                                    className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-amber-700 dark:hover:bg-slate-800">
                                    <span className="grid h-9 w-9 place-items-center rounded-full border border-amber-200 bg-[#fff0d7] text-xs font-bold text-[#95431b] dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{initials}</span>
                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                </button>
                                {accountOpen && <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                                    <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-700">Signed in as <span className="font-semibold">{identity?.username}</span></div>
                                    <Link href={isDdWorkspace ? "/dd-phase3/settings" : "/settings-preview"} onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><Settings className="h-4 w-4" /> Settings</Link>
                                    <Link href="/logout" method="post" as="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"><LogOut className="h-4 w-4" /> Sign out</Link>
                                </div>}
                            </div>
                        </div>
                    </header>
                </div>
                <main className={`jr-normal-workspace mx-auto w-full max-w-[1680px] px-4 pb-8 pt-1 sm:px-6 lg:px-7 ${path === '/dashboard' || path === '/dd-phase3/dashboard' || path.startsWith('/admin-dashboard') || path.startsWith('/role-dashboard') ? 'jr-dashboard-view' : 'jr-content-view'} ${(path === '/maintenance-projects' || path === '/dd-phase3/projects') ? 'jr-projects-directory' : ''}`} id="jairoads-main-content">{children}</main>
            </div>
        </div>
    );
}

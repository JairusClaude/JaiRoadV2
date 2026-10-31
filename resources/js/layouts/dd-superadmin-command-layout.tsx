import { Link, usePage } from '@inertiajs/react';
import {
    Activity,
    Building2,
    ChevronDown,
    FileText,
    FolderKanban,
    LayoutDashboard,
    LockKeyhole,
    LogOut,
    MapPinned,
    Menu,
    Settings,
    Shield,
    ShieldCheck,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { DdNotificationBell } from '@/components/dd-notification-bell';

type Identity = { role: string; username: string; name: string } | null;

// All eight approved JaiROADS modules are represented. Only the DD-backed
// read-only dashboard is currently enabled; other endpoints still use legacy
// public.* CRUD and MUST NOT be exposed as functional DD operations.
const modules = [
    {
        label: 'Dashboard',
        icon: LayoutDashboard,
        group: 'governance',
        enabled: true,
    },
    {
        label: 'User Management',
        icon: Users,
        group: 'governance',
        enabled: true,
    },
    { label: 'Settings', icon: Settings, group: 'governance', enabled: true },
    {
        label: 'Maintenance Projects',
        icon: FolderKanban,
        group: 'operations',
        enabled: true,
    },
    {
        label: 'Monthly Updates',
        icon: Activity,
        group: 'operations',
        enabled: true,
    },
    {
        label: 'Project Documents',
        icon: FileText,
        group: 'operations',
        enabled: true,
    },
    {
        label: 'Road Sections',
        icon: MapPinned,
        group: 'operations',
        enabled: true,
    },
    { label: 'LGU', icon: Building2, group: 'operations', enabled: true },
] as const;

export default function DdSuperAdminCommandLayout({
    children,
}: {
    children: ReactNode;
}) {
    const page = usePage<{ jairoadsIdentity?: Identity }>();
    const identity = page.props.jairoadsIdentity ?? null;
    const [menuOpen, setMenuOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);

    // Presentation guard only; every DD route also authorizes on the server.
    if (
        !identity ||
        !['superadmin', 'admin', 'engineer', 'viewer'].includes(identity.role)
    ) {
        return (
            <main
                role="alert"
                className="grid min-h-screen place-items-center bg-[#10182b] p-8 text-white"
            >
                Your account is unavailable. Please contact your administrator.
            </main>
        );
    }

    const monogram = (identity.username?.[0] ?? 'S').toUpperCase();
    const routes: Record<string, string> = {
        Dashboard:
            identity.role === 'superadmin'
                ? '/dd-superadmin-landing'
                : '/dd-phase3/dashboard',
        'User Management': '/dd-phase3/users',
        Settings: '/dd-phase3/settings',
        'Maintenance Projects': '/dd-phase3/ui/maintenance-projects',
        'Monthly Updates': '/dd-phase3/ui/monthly-updates',
        'Project Documents': '/dd-phase3/ui/maintenance-documents',
        'Road Sections': '/dd-phase3/ui/road-coverages',
        LGU: '/dd-phase3/lgus',
    };
    const renderNav = (group: 'governance' | 'operations') =>
        modules
            .filter((item) => item.group === group)
            .map(({ label, icon: Icon }) => {
                const enabled =
                    label !== 'User Management' ||
                    identity.role === 'superadmin' ||
                    identity.role === 'admin';
                const url = routes[label];
                const selected =
                    page.url.split('?')[0] === url ||
                    (label === 'Dashboard' &&
                        page.url.split('?')[0] === '/dashboard');

                return enabled ? (
                    <Link
                        key={label}
                        href={url}
                        onClick={() => setMenuOpen(false)}
                        aria-current={selected ? 'page' : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${selected ? 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                    >
                        <Icon className="h-4.5 w-4.5 shrink-0" />
                        {label}
                    </Link>
                ) : null;
            });

    return (
        <div className="min-h-screen bg-[#f4f5f8] text-slate-900 lg:flex">
            {menuOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden"
                    onClick={() => setMenuOpen(false)}
                />
            )}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-[285px] flex-col bg-[#10182b] text-white shadow-[16px_0_48px_rgba(7,14,29,.16)] transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                aria-label="JaiROADS SuperAdmin navigation"
            >
                <div className="border-b border-white/10 px-6 pt-7 pb-6">
                    <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-600 text-slate-950">
                            <ShieldCheck className="h-6 w-6" />
                        </span>
                        <div>
                            <div className="text-xl font-bold tracking-tight">
                                JaiROADS
                            </div>
                            <div className="text-[10px] tracking-[.22em] text-amber-300 uppercase">
                                System Authority
                            </div>
                        </div>
                        <button
                            type="button"
                            className="ml-auto rounded-lg p-1.5 lg:hidden"
                            aria-label="Close menu"
                            onClick={() => setMenuOpen(false)}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="mt-6 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
                        <Shield className="h-4 w-4" />{' '}
                        {identity.role.toUpperCase()} CONSOLE
                    </div>
                </div>
                <nav
                    aria-label="Primary"
                    className="min-h-0 flex-1 overflow-y-auto px-4 py-5"
                >
                    <div className="px-3 pb-2 text-[10px] font-bold tracking-[.19em] text-slate-500 uppercase">
                        Governance
                    </div>
                    <div className="space-y-1">{renderNav('governance')}</div>
                    <div className="px-3 pt-7 pb-2 text-[10px] font-bold tracking-[.19em] text-slate-500 uppercase">
                        Operations
                    </div>
                    <div className="space-y-1">{renderNav('operations')}</div>
                </nav>
                <div className="border-t border-white/10 p-4">
                    <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-300/20 font-bold text-amber-200">
                            {monogram}
                        </span>
                        <div className="min-w-0">
                            <div className="truncate text-xs font-semibold">
                                {identity.username}
                            </div>
                            <div className="text-xs text-amber-300">
                                {identity.role} · Signed in
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
            <div className="min-w-0 flex-1">
                <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            className="rounded-lg p-2 lg:hidden"
                            aria-label="Open navigation"
                            onClick={() => setMenuOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <LockKeyhole className="h-4 w-4 text-amber-700" />
                        <span className="text-sm font-semibold">
                            JaiROADS Workspace
                        </span>
                        <span className="hidden text-xs text-slate-400 sm:inline">
                            / Privileged workspace
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <DdNotificationBell variant="dark" />
                        <div className="relative">
                            <button
                                type="button"
                                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                                aria-label="Account menu"
                                aria-expanded={accountOpen}
                                onClick={() => setAccountOpen(!accountOpen)}
                            >
                                <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-amber-200">
                                    {monogram}
                                </span>
                                <span className="hidden sm:inline">
                                    {identity.username}
                                </span>
                                <ChevronDown className="h-4 w-4 text-slate-500" />
                            </button>
                            {accountOpen && (
                                <div className="absolute top-12 right-0 z-50 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                    <Link
                                        href="/logout"
                                        method="post"
                                        as="button"
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
                                    >
                                        <LogOut className="h-4 w-4" /> Sign out
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                <main className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

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

type Identity = { role: string; username: string; name: string } | null;
const nav = [
    {
        label: 'Command Center',
        href: '/superadmin-command-center',
        icon: LayoutDashboard,
        group: 'governance',
    },
    {
        label: 'User Management',
        href: '/user-management',
        icon: Users,
        group: 'governance',
    },
    {
        label: 'Maintenance Projects',
        href: '/maintenance-projects',
        icon: FolderKanban,
        group: 'operations',
    },
    {
        label: 'Monthly Updates',
        href: '/monthly-updates-preview',
        icon: Activity,
        group: 'operations',
    },
    {
        label: 'Project Documents',
        href: '/project-documents-preview',
        icon: FileText,
        group: 'operations',
    },
    {
        label: 'Road Sections',
        href: '/road-sections-preview',
        icon: MapPinned,
        group: 'operations',
    },
    {
        label: 'LGU',
        href: '/lgus-preview',
        icon: Building2,
        group: 'operations',
    },
    {
        label: 'Settings',
        href: '/settings-preview',
        icon: Settings,
        group: 'governance',
    },
] as const;

/**
 * Visually distinct SuperAdmin shell. Existing eight logical modules retained.
 * Real permissions always enforced in Laravel, never by the sidebar.
 */
export default function SuperAdminCommandLayout({
    children,
}: {
    children: ReactNode;
}) {
    const page = usePage<{ jairoadsIdentity?: Identity }>();
    const identity = page.props.jairoadsIdentity ?? null;
    const [menuOpen, setMenuOpen] = useState(false);
    const [accountOpen, setAccountOpen] = useState(false);

    if (identity?.role !== 'superadmin') {
        return (
            <main
                className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white"
                role="alert"
            >
                SuperAdmin access is unavailable for this account.
            </main>
        );
    }

    const activePath = page.url.split('?')[0];
    const monogram = (identity?.username?.[0] ?? 'S').toUpperCase();
    const renderNav = (group: 'governance' | 'operations') =>
        nav
            .filter((item) => item.group === group)
            .map(({ label, href, icon: Icon }) => {
                const active =
                    activePath === href ||
                    (href !== '/superadmin-command-center' &&
                        activePath.startsWith(href + '/'));

                return (
                    <Link
                        key={href}
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${active ? 'bg-amber-400/15 font-semibold text-amber-200 ring-1 ring-amber-400/30' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                    >
                        <Icon
                            className="h-4.5 w-4.5 shrink-0"
                            aria-hidden="true"
                        />
                        {label}
                    </Link>
                );
            });

    return (
        <div className="min-h-screen bg-[#f4f5f8] text-slate-900 lg:flex">
            {menuOpen && (
                <button
                    aria-label="Close SuperAdmin navigation"
                    className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden"
                    onClick={() => setMenuOpen(false)}
                />
            )}
            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-[285px] flex-col bg-[#10182b] text-white shadow-[16px_0_48px_rgba(7,14,29,.16)] transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
                aria-label="SuperAdmin navigation"
            >
                <div className="border-b border-white/10 px-6 pt-7 pb-6">
                    <div className="flex items-center justify-between gap-3">
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
                        </div>
                        <button
                            className="rounded-lg p-1.5 text-slate-200 lg:hidden"
                            aria-label="Close menu"
                            onClick={() => setMenuOpen(false)}
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="mt-6 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200">
                        <Shield className="h-4 w-4" /> SUPERADMIN CONSOLE
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
                                SuperAdmin · Signed in
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
            <div className="min-w-0 flex-1">
                <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8">
                    <div className="flex items-center gap-3">
                        <button
                            className="rounded-lg p-2 lg:hidden"
                            aria-label="Open SuperAdmin navigation"
                            onClick={() => setMenuOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <LockKeyhole className="h-4 w-4 text-amber-700" />
                        <span className="text-sm font-semibold">
                            System Governance
                        </span>
                        <span className="hidden text-xs text-slate-400 sm:inline">
                            / Privileged workspace
                        </span>
                    </div>
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
                                    href="/settings-preview"
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100"
                                    onClick={() => setAccountOpen(false)}
                                >
                                    <Settings className="h-4 w-4" /> Settings
                                </Link>
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
                </header>
                <main className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

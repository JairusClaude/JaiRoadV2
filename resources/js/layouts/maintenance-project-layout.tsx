import { router, usePage } from '@inertiajs/react';
import {
    Bell,
    Building2,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    FileText,
    House,
    Route,
    LayoutDashboard,
    PanelLeftOpen,
    ScrollText,
    Settings,
    Users,
} from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { JaiRoadsQuickActions } from '@/components/jairoads/quick-actions';
import {
    AlternativeNavigation,
    isAlternativeNavigation,
} from '@/components/maintenance-projects/alternative-navigation';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarProvider,
    useSidebar,
} from '@/components/ui/sidebar';
import { UserMenuContent } from '@/components/user-menu-content';
import { useInitials } from '@/hooks/use-initials';
import { workspaceHref } from '@/lib/workspace-navigation';
import type { User } from '@/types';
import '../../css/maintenance-projects.css';
import '../../css/maintenance-documents.css';
import '../../css/maintenance-projects-exploration.css';
import '../../css/maintenance-projects-espresso-sidebar.css';
import '../../css/maintenance-projects-main-design.css';
import '../../css/jairoads-viewer-workspace.css';
import '../../css/jairoads-engineer-workspace.css';
import '../../css/jairoads-superadmin-workspace.css';
import '../../css/jairoads-admin-workspace.css';
import '../../css/jairoads-sidebar-waves.css';
import '../../css/jairoads-responsive-workspace.css';

const navigation = [
    { title: 'Dashboard', href: '/dashboard', icon: House },
    {
        title: 'Maintenance Projects',
        href: '/maintenance-projects',
        icon: LayoutDashboard,
    },
    { title: 'User Management', href: '/user-management', icon: Users },
    { title: 'Audit Log', href: '/audit-logs', icon: ScrollText },
    { title: 'Monthly Updates', href: '/monthly-updates', icon: CalendarDays },
    {
        title: 'Maintenance Documents',
        href: '/maintenance-documents',
        icon: FileText,
    },
    { title: 'Road Coverages', href: '/road-coverages', icon: Route },
    { title: 'LGU', href: '/lgus', icon: Building2 },
    { title: 'Settings', href: '/settings/profile', icon: Settings },
];

export function MaintenanceProjectShell({
    children,
    user,
}: {
    children: ReactNode;
    user: User;
}) {
    const { state, toggleSidebar, isMobile, openMobile, setOpenMobile } =
        useSidebar();
    const expanded = isMobile ? openMobile : state === 'expanded';
    const initials = useInitials()(user.name);
    const page = usePage();
    const preview = page.props.previewOnly === true;
    const canonical = page.props.canonicalFrontend === true;
    const operationPage =
        /^(MaintenanceProjects|MaintenanceRecords|MonthlyUpdates|MaintenanceDocuments|RoadCoverages|LGUs)\//.test(
            page.component,
        );
    useEffect(() => {
        // The Node-only preview historically supplies LGU success text as message.
        const status =
            page.props.status ??
            (preview && page.component.startsWith('LGUs/')
                ? page.props.message
                : undefined);

        if (operationPage && typeof status === 'string' && status) {
            toast.success(status, {
                id: 'jr-operation-status',
                duration: 3000,
            });
        }
    }, [page, operationPage, preview]);
    const role = (page.props.jairoadsIdentity as { role?: string } | undefined)
        ?.role;
    const viewerTheme = canonical && role === 'viewer';
    const engineerTheme = canonical && role === 'engineer';
    const superadminTheme = canonical && role === 'superadmin';
    const adminTheme = canonical && role === 'admin';
    const brandedTheme =
        viewerTheme || engineerTheme || superadminTheme || adminTheme;
    const sidebarTheme = viewerTheme
        ? ' jr-viewer-sidebar'
        : engineerTheme
          ? ' jr-engineer-sidebar'
          : superadminTheme
            ? ' jr-superadmin-sidebar'
            : adminTheme
              ? ' jr-admin-sidebar'
              : '';
    const path = page.url.split('?')[0].replace(/^\/workspace\/ui/, '');
    const alternativeNavigation = isAlternativeNavigation(page.component);
    const documentPageName = path.startsWith('/maintenance-documents')
        ? path.endsWith('/create')
            ? 'Upload Document'
            : path.endsWith('/edit')
              ? 'Edit Maintenance Document'
              : /^\/maintenance-documents\/\d+$/.test(path)
                ? 'Maintenance Document Details'
                : 'Maintenance Documents'
        : undefined;
    const lguPageName =
        path === '/lgus'
            ? 'LGU'
            : path === '/lgus/create'
              ? 'Add LGU'
              : /^\/lgus\/\d+\/edit$/.test(path)
                ? 'Edit LGU'
                : /^\/lgus\/\d+$/.test(path)
                  ? 'LGU Details'
                  : undefined;
    const pageName =
        (path === '/dashboard' ||
        path.startsWith('/workspace/dashboard') ||
        path.startsWith('/superadmin-home')
            ? 'Dashboard'
            : undefined) ??
        (path.startsWith('/settings') ||
        path.startsWith('/workspace/settings') ||
        path.startsWith('/workspace/ops/settings')
            ? 'Settings'
            : undefined) ??
        (path.startsWith('/road-coverages')
            ? path.endsWith('/create')
                ? 'Add Road Coverage'
                : path.endsWith('/edit')
                  ? 'Edit Road Coverage'
                  : /^\/road-coverages\/\d+$/.test(path)
                    ? 'Road Coverage Details'
                    : 'Road Coverages'
            : undefined) ??
        lguPageName ??
        documentPageName ??
        (path.startsWith('/audit-logs') ||
        path.startsWith('/workspace/audit-logs')
            ? 'Audit Log'
            : undefined) ??
        (path.startsWith('/user-management') ||
        path.startsWith('/user-accounts') ||
        path.startsWith('/workspace/users') ||
        path === '/users'
            ? 'User Management'
            : undefined) ??
        (typeof page.props.navigationTitle === 'string' && alternativeNavigation
            ? page.props.navigationTitle
            : path === '/maintenance-records/create'
              ? 'Add Maintenance Record'
              : /^\/monthly-updates\/\d+\/edit$/.test(path)
                ? 'Edit Monthly Update'
                : path === '/maintenance-records'
                  ? 'Maintenance Records'
                  : path === '/monthly-updates/create'
                    ? 'Add Monthly Update'
                    : /^\/monthly-updates\/\d+$/.test(path)
                      ? 'Monthly Update Details'
                      : path === '/monthly-updates'
                        ? 'Monthly Updates'
                        : /\/records\/create$/.test(path)
                          ? 'Add Maintenance Record'
                          : /\/records\/\d+\/edit$/.test(path)
                            ? 'Edit Maintenance Record'
                            : /\/records\/\d+$/.test(path)
                              ? 'Maintenance Record Details'
                              : path.endsWith('/create')
                                ? 'Add Project'
                                : path.endsWith('/edit')
                                  ? 'Edit Project'
                                  : /^\/maintenance-projects\/\d+$/.test(path)
                                    ? 'Project Details'
                                    : 'Maintenance Projects');

    return (
        <>
            <Sidebar
                collapsible="icon"
                className={`jr-sidebar-container${sidebarTheme}`}
            >
                <div
                    className={
                        isMobile
                            ? `jr-app jr-theme jr-mobile-shell${sidebarTheme}`
                            : 'contents'
                    }
                >
                    {brandedTheme && (
                        <div className="jr-sidebar-waves" aria-hidden="true">
                            <span className="jr-sidebar-wave jr-sidebar-wave--primary" />
                            <span className="jr-sidebar-wave jr-sidebar-wave--secondary" />
                        </div>
                    )}
                    <SidebarHeader className="jr-brand-header">
                        <div className="jr-brand">
                            <button
                                type="button"
                                className="jr-brand-control"
                                aria-label="Expand sidebar"
                                aria-expanded={expanded}
                                aria-controls="jr-sidebar-nav"
                                aria-hidden={expanded}
                                tabIndex={expanded ? -1 : 0}
                                onClick={() => {
                                    if (!expanded) {
                                        toggleSidebar();
                                    }
                                }}
                            >
                                <span
                                    className="jr-brand-icon"
                                    aria-hidden="true"
                                >
                                    {brandedTheme ? (
                                        <img
                                            src="/images/jairoads/peo-ddo-transparent.webp"
                                            alt=""
                                            className={
                                                viewerTheme
                                                    ? 'jr-viewer-brand-logo'
                                                    : engineerTheme
                                                      ? 'jr-engineer-brand-logo'
                                                      : superadminTheme
                                                        ? 'jr-superadmin-brand-logo'
                                                        : 'jr-admin-brand-logo'
                                            }
                                            width={144}
                                            height={144}
                                        />
                                    ) : (
                                        <svg viewBox="0 0 24 24">
                                            <path d="M7 3c-1 4 2 5 2 8s-3 4-2 10M17 3c1 4-2 5-2 8s3 4 2 10M12 4v2m0 4v2m0 4v2" />
                                        </svg>
                                    )}
                                </span>
                                <span
                                    className="jr-brand-toggle"
                                    aria-hidden="true"
                                >
                                    <svg viewBox="0 0 24 24">
                                        <rect
                                            x="3"
                                            y="3"
                                            width="18"
                                            height="18"
                                            rx="3"
                                        />
                                        <path d="M9 3v18m4-6 3-3-3-3" />
                                    </svg>
                                </span>
                            </button>
                            <span className="jr-brand-copy">
                                <strong className="jr-brand-wordmark">
                                    <span>Jai</span>
                                    <span>ROADS</span>
                                </strong>
                                <small>
                                    {canonical
                                        ? viewerTheme
                                            ? 'Viewer Workspace'
                                            : engineerTheme
                                              ? 'Engineer Workspace'
                                              : superadminTheme
                                                ? 'SuperAdmin Workspace'
                                                : adminTheme
                                                  ? 'Admin Workspace'
                                                  : `${String((page.props.jairoadsIdentity as { role?: string } | undefined)?.role ?? 'User')} Workspace`
                                        : 'Admin Console'}
                                </small>
                            </span>
                        </div>
                        <button
                            type="button"
                            className="jr-sidebar-collapse"
                            aria-label={
                                isMobile
                                    ? 'Close navigation'
                                    : 'Collapse sidebar'
                            }
                            aria-expanded={expanded}
                            aria-controls="jr-sidebar-nav"
                            aria-hidden={!expanded}
                            tabIndex={expanded ? 0 : -1}
                            onClick={() => {
                                if (expanded) {
                                    toggleSidebar();
                                }
                            }}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <rect
                                    x="3"
                                    y="3"
                                    width="18"
                                    height="18"
                                    rx="3"
                                />
                                <path d="M9 3v18m7-6-3-3 3-3" />
                            </svg>
                        </button>
                    </SidebarHeader>
                    <SidebarContent className="jr-nav-content">
                        <div className="jr-nav-caption">Workspace</div>
                        <AlternativeNavigation
                            items={navigation
                                .filter(
                                    (item) =>
                                        !canonical ||
                                        (item.title !== 'User Management' &&
                                            item.title !== 'Audit Log') ||
                                        ['admin', 'superadmin'].includes(
                                            String(
                                                (
                                                    page.props
                                                        .jairoadsIdentity as
                                                        | { role?: string }
                                                        | undefined
                                                )?.role,
                                            ),
                                        ),
                                )
                                .map((item) => ({
                                    ...item,
                                    href: canonical
                                        ? ({
                                              '/dashboard':
                                                  '/workspace/dashboard',
                                              '/user-management':
                                                  '/user-management',
                                              '/user-accounts':
                                                  '/user-management',
                                              '/audit-logs':
                                                  '/workspace/audit-logs',
                                              '/settings/profile':
                                                  '/workspace/settings',
                                          }[item.href] ??
                                          workspaceHref(item.href))
                                        : item.href,
                                }))}
                            expanded={expanded}
                            mainNavigation={!alternativeNavigation}
                            onNavigate={
                                isMobile
                                    ? () => setOpenMobile(false)
                                    : undefined
                            }
                        />
                    </SidebarContent>
                    <SidebarFooter className="jr-sidebar-footer">
                        <div
                            className="jr-identity"
                            title={`Signed in as ${user.name}`}
                        >
                            <span className="jr-initial">{initials}</span>
                            <span className="jr-identity-copy">
                                <strong>{user.name}</strong>
                                <small>Signed in</small>
                            </span>
                        </div>
                    </SidebarFooter>
                </div>
            </Sidebar>
            <div className="jr-stage">
                <header className="jr-global-header">
                    <div className="flex min-w-0 items-center gap-2">
                        {isMobile && (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Open navigation"
                                aria-expanded={openMobile}
                                data-jr-mobile-menu
                                onClick={toggleSidebar}
                            >
                                <PanelLeftOpen />
                            </Button>
                        )}
                        <span className="jr-header-brand">JaiROADS</span>
                        <ChevronRight
                            className="jr-header-chevron size-3"
                            aria-hidden="true"
                        />
                        <strong className="jr-header-page-title truncate">
                            {pageName}
                        </strong>
                    </div>
                    <div className="jr-top-actions">
                        <span
                            className="jr-navigation-status-slot"
                            data-jr-navigation-status
                        />
                        {canonical && <JaiRoadsQuickActions searchOnly />}
                        {viewerTheme ? null : canonical ? (
                            <NotificationBell />
                        ) : (
                            <button
                                type="button"
                                className="jr-icon-button"
                                aria-label="Notifications"
                            >
                                <Bell className="size-[18px]" />
                            </button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="jr-account-trigger"
                                    aria-label="Open account menu"
                                >
                                    <span className="jr-initial">
                                        {initials}
                                    </span>
                                    <ChevronDown className="size-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="jr-theme jr-menu min-w-56"
                            >
                                {preview ? (
                                    <>
                                        <DropdownMenuItem disabled>
                                            Account settings (preview
                                            unavailable)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onSelect={() => {
                                                router.clearHistory();
                                                router.post('/logout');
                                            }}
                                        >
                                            Sign out
                                        </DropdownMenuItem>
                                    </>
                                ) : (
                                    <UserMenuContent
                                        user={user}
                                        settingsHref={
                                            canonical
                                                ? '/workspace/settings'
                                                : undefined
                                        }
                                    />
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                <main className="jr-content">
                    {preview && (
                        <p className="jr-preview-note" role="note">
                            Local interface review · sample data in this preview
                            process · PostgreSQL is not connected.
                        </p>
                    )}
                    {!operationPage &&
                        typeof page.props.status === 'string' &&
                        page.props.status && (
                            <p
                                role="status"
                                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
                            >
                                {page.props.status}
                            </p>
                        )}
                    {children}
                </main>
            </div>
        </>
    );
}

export default function MaintenanceProjectLayout({
    children,
}: {
    children: ReactNode;
}) {
    const page = usePage();
    const { auth, sidebarOpen } = page.props;
    const mainDesign = !isAlternativeNavigation(page.component);
    const role = (page.props.jairoadsIdentity as { role?: string } | undefined)
        ?.role;
    const viewerTheme =
        page.props.canonicalFrontend === true && role === 'viewer';
    const engineerTheme =
        page.props.canonicalFrontend === true && role === 'engineer';
    const superadminTheme =
        page.props.canonicalFrontend === true && role === 'superadmin';
    const adminTheme =
        page.props.canonicalFrontend === true && role === 'admin';

    return (
        <SidebarProvider
            defaultOpen={sidebarOpen}
            className={
                viewerTheme
                    ? 'jr-app jr-theme jr-main-design jr-viewer-workspace'
                    : engineerTheme
                      ? 'jr-app jr-theme jr-main-design jr-engineer-workspace'
                      : superadminTheme
                        ? 'jr-app jr-theme jr-main-design jr-superadmin-workspace'
                        : adminTheme
                          ? 'jr-app jr-theme jr-main-design jr-admin-workspace'
                          : mainDesign
                            ? 'jr-app jr-theme jr-main-design jr-espresso-exploration'
                            : 'jr-app jr-theme'
            }
            style={
                {
                    '--sidebar-width': '244px',
                    '--sidebar-width-icon': '78px',
                } as React.CSSProperties
            }
        >
            <MaintenanceProjectShell user={auth.user}>
                {children}
            </MaintenanceProjectShell>
        </SidebarProvider>
    );
}

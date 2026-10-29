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
    Settings,
    Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import {
    AlternativeNavigation,
    isAlternativeNavigation,
} from '@/components/maintenance-projects/alternative-navigation';
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
import type { User } from '@/types';
import '../../css/maintenance-projects.css';
import '../../css/maintenance-documents.css';
import '../../css/maintenance-projects-exploration.css';
import '../../css/maintenance-projects-espresso-sidebar.css';
import '../../css/maintenance-projects-main-design.css';

const navigation = [
    { title: 'Dashboard', href: '/dashboard', icon: House },
    {
        title: 'Maintenance Projects',
        href: '/maintenance-projects',
        icon: LayoutDashboard,
    },
    { title: 'User Management', href: '/user-accounts', icon: Users },
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
    const { state, toggleSidebar, isMobile, openMobile } = useSidebar();
    const expanded = isMobile ? openMobile : state === 'expanded';
    const initials = useInitials()(user.name);
    const page = usePage();
    const preview = page.props.previewOnly === true;
    const path = page.url.split('?')[0];
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
            <Sidebar collapsible="icon" className="jr-sidebar-container">
                <div
                    className={
                        isMobile
                            ? 'jr-app jr-theme jr-mobile-shell'
                            : 'contents'
                    }
                >
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
                                    <svg viewBox="0 0 24 24">
                                        <path d="M7 3c-1 4 2 5 2 8s-3 4-2 10M17 3c1 4-2 5-2 8s3 4 2 10M12 4v2m0 4v2m0 4v2" />
                                    </svg>
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
                                <strong>JaiROADS</strong>
                                <small>Admin Console</small>
                            </span>
                        </div>
                        <button
                            type="button"
                            className="jr-sidebar-collapse"
                            aria-label="Collapse sidebar"
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
                            items={navigation}
                            expanded={expanded}
                            mainNavigation={!alternativeNavigation}
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
                                onClick={toggleSidebar}
                            >
                                <PanelLeftOpen />
                            </Button>
                        )}
                        <span>JaiROADS</span>
                        <ChevronRight className="size-3" />
                        <strong className="truncate">{pageName}</strong>
                    </div>
                    <div className="jr-top-actions">
                        <button
                            type="button"
                            className="jr-icon-button"
                            aria-label="Notifications"
                        >
                            <Bell className="size-[18px]" />
                        </button>
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
                                    <UserMenuContent user={user} />
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

    return (
        <SidebarProvider
            defaultOpen={sidebarOpen}
            className={
                mainDesign
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

import { Link, usePage } from '@inertiajs/react';
import {
    Building2,
    CalendarDays,
    ChevronDown,
    ChevronRight,
    FileText,
    House,
    Map,
    LayoutDashboard,
    PanelLeftOpen,
    Settings,
    Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
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
import { JaiRoadsNotifications } from '@/components/jairoads-notifications';
import { useInitials } from '@/hooks/use-initials';
import type { User } from '@/types';

import '../../css/maintenance-projects.css';
import '../../css/jairoads-settings-theme.css';

const navigation = [
    { title: 'Dashboard', href: '/admin-dashboard', icon: House },
    {
        title: 'Maintenance Projects',
        href: '/maintenance-projects',
        icon: LayoutDashboard,
    },
    { title: 'User Management', href: '/user-management', icon: Users },
    { title: 'Monthly Updates', href: '/monthly-updates-preview', icon: CalendarDays },
    { title: 'Project Documents', href: '/project-documents-preview', icon: FileText },
    { title: 'Road Sections', href: '/road-sections-preview', icon: Map },
    { title: 'LGU', href: '/lgus-preview', icon: Building2 },
    { title: 'Settings', href: '/settings-preview', icon: Settings },
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
    const pageName = (path.startsWith('/settings-preview') || path.startsWith('/settings/')) ? 'Settings' : path.startsWith('/lgus-preview') ? 'LGU' : path.startsWith('/road-sections-preview') ? 'Road Sections' : path.endsWith('/create')
        ? 'Add Project'
        : path.endsWith('/edit')
          ? 'Edit Project'
          : /^\/maintenance-projects\/\d+$/.test(path)
            ? 'Project Details'
            : path.startsWith('/user-management') ? 'User Management' : path.startsWith('/user-management') ? 'User Management' : path.startsWith('/monthly-updates') ? 'Monthly Updates' : path.startsWith('/project-documents-preview') ? 'Project Documents' : 'Maintenance Projects';

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
                        <nav id="jr-sidebar-nav" aria-label="Main navigation">
                            {navigation.map(({ title, href, icon: Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={(event) => {
                                        if (
                                            preview &&
                                            href !== '/maintenance-projects'
                                        ) {
                                            event.preventDefault();
                                        }
                                    }}
                                    className={`jr-nav-link ${((path === href || path.startsWith(href + '/') || (href === '/settings-preview' && path.startsWith('/settings/')))) ? 'jr-active' : ''}`}
                                    aria-current={
                                        ((path === href || path.startsWith(href + '/') || (href === '/settings-preview' && path.startsWith('/settings/'))))
                                            ? 'page'
                                            : undefined
                                    }
                                    title={
                                        state === 'collapsed'
                                            ? title
                                            : undefined
                                    }
                                >
                                    <Icon className="size-[18px]" />
                                    <span>{title}</span>
                                </Link>
                            ))}
                        </nav>
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
                        <strong className="truncate">{path.startsWith('/admin-dashboard') ? 'Dashboard' : pageName}</strong>
                    </div>
                    <div className="jr-top-actions">
                        
                        <JaiRoadsNotifications />
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
                                        <DropdownMenuItem>
                                            Account settings
                                        </DropdownMenuItem>
                                        <DropdownMenuItem>
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
                            Local interface review ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· sample data in this preview
                            process ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· PostgreSQL is not connected.
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
    const { auth, sidebarOpen } = usePage().props;

    return (
        <SidebarProvider
            defaultOpen={sidebarOpen}
            className="jr-app jr-theme"
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






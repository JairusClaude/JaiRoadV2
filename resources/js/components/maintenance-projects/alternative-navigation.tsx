import { Link, usePage } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { workspaceHref } from '@/lib/workspace-navigation';
import '../../../css/maintenance-projects-alternative-navigation.css';

export const alternativeDirectoryUrl = workspaceHref(
    '/maintenance-projects/design-exploration',
);

export function alternativeDirectoryFor(theme: unknown) {
    return alternativeDirectoryUrl + (theme === 'espresso' ? '/espresso' : '');
}

export function isAlternativeNavigation(component: string) {
    return [
        'MaintenanceProjects/DirectoryAlternative',
        'MaintenanceProjects/NavigationPreview',
    ].includes(component);
}

export function AlternativeNavigation({
    items,
    expanded,
    mainNavigation = false,
}: {
    items: { title: string; href: string; icon: LucideIcon }[];
    expanded: boolean;
    mainNavigation?: boolean;
}) {
    const page = usePage();
    const canonical = page.props.canonicalFrontend === true;
    const directoryUrl = alternativeDirectoryFor(page.props.sidebarTheme);
    const path = page.url.split('?')[0];
    const section = mainNavigation
        ? path.startsWith(workspaceHref('/maintenance-records')) ||
          path.includes('/records/')
            ? 'maintenance-records'
            : path.startsWith(workspaceHref('/road-coverages'))
              ? 'road-coverages'
              : path.startsWith('/lgus')
                ? 'lgus'
                : path.startsWith(workspaceHref('/maintenance-documents'))
                  ? 'maintenance-documents'
                  : path.startsWith(workspaceHref('/monthly-updates'))
                    ? 'monthly-updates'
                    : 'maintenance-projects'
        : typeof page.props.navigationSection === 'string'
          ? page.props.navigationSection
          : 'maintenance-projects';
    const recordsActive = section === 'maintenance-records';
    const [submenu, setSubmenu] = useState(false);
    const submenuId = useId();

    const [visibility, setVisibility] = useState({
        expanded,
        recordsActive,
        reveal: recordsActive,
    });

    if (
        visibility.expanded !== expanded ||
        visibility.recordsActive !== recordsActive
    ) {
        setVisibility({
            expanded,
            recordsActive,
            reveal: recordsActive && expanded,
        });
    }

    const open = expanded && (submenu || visibility.reveal);

    return (
        <nav
            id="jr-sidebar-nav"
            className="jr-alternative-nav"
            aria-label="Main navigation"
        >
            {items.map(({ title, href, icon: Icon }) => {
                const moduleHref = href.replace(/^\/dd-phase3\/ui(?=\/)/, '');
                const key =
                    (
                        {
                            '/settings/profile': 'settings',
                            '/dd-phase3/dashboard': 'dashboard',
                            '/dd-phase3/users': 'user-accounts',
                            '/dd-phase3/lgus': 'lgus',
                            '/dd-phase3/settings': 'settings',
                        } as Record<string, string>
                    )[moduleHref] ?? moduleHref.slice(1);
                const parent = key === 'maintenance-projects';
                const active = section === key;
                const link = (
                    <Link
                        href={
                            mainNavigation
                                ? href
                                : parent
                                  ? directoryUrl
                                  : key === 'road-coverages'
                                    ? workspaceHref('/road-coverages')
                                    : `${directoryUrl}/navigation/${key}`
                        }
                        onClick={(event) => {
                            if (
                                mainNavigation &&
                                page.props.previewOnly === true &&
                                ![
                                    workspaceHref('/maintenance-projects'),
                                    workspaceHref('/monthly-updates'),
                                    workspaceHref('/maintenance-documents'),
                                    '/lgus',
                                    workspaceHref('/road-coverages'),
                                ].includes(href)
                            ) {
                                event.preventDefault();
                            }

                            if (parent) {
                                setSubmenu(true);
                            }
                        }}
                        className={`jr-nav-link ${active ? 'jr-active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        title={expanded ? undefined : title}
                    >
                        <Icon className="size-[18px]" />
                        <span
                            className={
                                expanded && key === 'maintenance-documents'
                                    ? 'jr-document-nav-label'
                                    : undefined
                            }
                        >
                            {title}
                        </span>
                    </Link>
                );

                return parent ? (
                    <div key={href} className="jr-alternative-project-group">
                        <div className="jr-alternative-parent">
                            {link}
                            {expanded && (
                                <button
                                    type="button"
                                    className="jr-alternative-chevron"
                                    aria-label={
                                        open
                                            ? 'Collapse Maintenance Projects submenu'
                                            : 'Expand Maintenance Projects submenu'
                                    }
                                    aria-expanded={open}
                                    aria-controls={submenuId}
                                    onClick={() => {
                                        setSubmenu(!open);
                                        setVisibility({
                                            ...visibility,
                                            reveal: false,
                                        });
                                    }}
                                >
                                    <ChevronDown
                                        aria-hidden="true"
                                        data-open={open}
                                    />
                                </button>
                            )}
                        </div>
                        <div
                            id={submenuId}
                            className="jr-alternative-submenu-transition"
                            data-open={open}
                            aria-hidden={!open}
                            inert={!open}
                        >
                            <div className="jr-alternative-submenu-clip">
                                <div className="jr-alternative-submenu">
                                    {mainNavigation &&
                                    page.props.previewOnly !== true &&
                                    !canonical ? (
                                        <button
                                            type="button"
                                            disabled
                                            className={`jr-nav-link jr-pending-nav w-full ${recordsActive ? 'jr-active' : ''}`}
                                            aria-current={
                                                recordsActive
                                                    ? 'page'
                                                    : undefined
                                            }
                                            title="Maintenance Records directory is pending backend route integration. Open individual records from Project Details."
                                        >
                                            <span className="jr-alternative-record-label">
                                                Maintenance Records
                                            </span>
                                            <span
                                                className="jr-alternative-record-abbreviation"
                                                aria-hidden="true"
                                            >
                                                MR
                                            </span>
                                        </button>
                                    ) : (
                                        <Link
                                            href={
                                                mainNavigation
                                                    ? workspaceHref(
                                                          '/maintenance-records',
                                                      )
                                                    : `${directoryUrl}/navigation/maintenance-records`
                                            }
                                            className={`jr-nav-link ${recordsActive ? 'jr-active' : ''}`}
                                            aria-current={
                                                recordsActive
                                                    ? 'page'
                                                    : undefined
                                            }
                                            title={
                                                expanded
                                                    ? undefined
                                                    : 'Maintenance Records'
                                            }
                                        >
                                            <span className="jr-alternative-record-label">
                                                Maintenance Records
                                            </span>
                                            <span
                                                className="jr-alternative-record-abbreviation"
                                                aria-hidden="true"
                                            >
                                                MR
                                            </span>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div key={href}>
                        {mainNavigation &&
                        key === 'road-coverages' &&
                        page.props.previewOnly !== true &&
                        !canonical ? (
                            <button
                                type="button"
                                disabled
                                className="jr-nav-link jr-pending-nav w-full"
                                title="Road Coverage directory backend integration is pending."
                            >
                                <Icon className="size-[18px]" />
                                <span>{title}</span>
                            </button>
                        ) : (
                            link
                        )}
                    </div>
                );
            })}
        </nav>
    );
}

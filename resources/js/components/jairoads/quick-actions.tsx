import { router, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Bell,
    Building2,
    CalendarDays,
    FileText,
    House,
    LayoutDashboard,
    Map,
    RefreshCw,
    Search,
    Settings,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const destinations = [
    { label: 'Dashboard', href: '/admin-dashboard', Icon: House },
    {
        label: 'Maintenance Projects',
        href: '/maintenance-projects',
        Icon: LayoutDashboard,
    },
    { label: 'User Management', href: '/user-management', Icon: Users },
    {
        label: 'Monthly Updates',
        href: '/monthly-updates-preview',
        Icon: CalendarDays,
    },
    {
        label: 'Project Documents',
        href: '/project-documents-preview',
        Icon: FileText,
    },
    { label: 'Road Sections', href: '/road-sections-preview', Icon: Map },
    { label: 'LGU', href: '/lgus-preview', Icon: Building2 },
    { label: 'Settings', href: '/settings-preview', Icon: Settings },
] as const;

const matchesRoute = (path: string, href: string) =>
    path === href ||
    path.startsWith(href + '/') ||
    (href === '/settings-preview' && path.startsWith('/settings/'));

/** A keyboard-friendly navigator to EXISTING routes; Laravel still authorizes visits. */
export function JaiRoadsQuickActions() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedHref, setSelectedHref] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [recordMatches, setRecordMatches] = useState<{
        term: string;
        items: { label: string; kind: string; href: string }[];
        failed: boolean;
    }>({ term: '', items: [], failed: false });
    const page = usePage<{ jairoadsIdentity?: { role: string } | null }>();
    const path = page.url.split('?')[0];
    const role = page.props.jairoadsIdentity?.role;
    const isCanonicalWorkspace =
        path.startsWith('/workspace/') ||
        path.startsWith('/workspace-superadmin-') ||
        path === '/superadmin-home';
    const canonicalPaths = [
        '/workspace/dashboard',
        '/workspace/projects',
        '/workspace/users',
        '/workspace/updates',
        '/workspace/documents',
        '/workspace/roads',
        '/workspace/lgus',
        '/workspace/settings',
    ];
    const allowedDestinations = destinations.flatMap((entry, index) => {
        if (
            entry.label === 'User Management' &&
            role !== 'admin' &&
            role !== 'superadmin'
        ) {
            return [];
        }

        return [
            {
                ...entry,
                href: isCanonicalWorkspace
                    ? index === 0 && role === 'superadmin'
                        ? '/superadmin-home'
                        : canonicalPaths[index]
                    : entry.href,
            },
        ];
    });

    const term = query.trim().slice(0, 120);
    const sectionResults = allowedDestinations.filter((entry) =>
        entry.label.toLowerCase().includes(term.toLowerCase()),
    );
    const recordDirectories = [
        {
            label: 'projects',
            path: 'maintenance-projects',
            Icon: LayoutDashboard,
        },
        { label: 'roads', path: 'road-coverages', Icon: Map },
        {
            label: 'monthly updates',
            path: 'monthly-updates',
            Icon: CalendarDays,
        },
        { label: 'documents', path: 'maintenance-documents', Icon: FileText },
        { label: 'LGUs', path: 'lgus', Icon: Building2 },
    ];
    const results = [
        ...sectionResults,
        ...(open && recordMatches.term === term && isCanonicalWorkspace
            ? recordMatches.items.map((item) => ({
                  label: item.kind + ': ' + item.label,
                  href: item.href,
                  Icon: FileText,
              }))
            : []),
        ...(isCanonicalWorkspace && role && term
            ? recordDirectories.map(({ label, path, Icon }) => ({
                  label: `Search ${label} for "${term}"`,
                  href: `/workspace/ui/${path}?search=${encodeURIComponent(term)}`,
                  Icon,
              }))
            : []),
    ];

    const selected = selectedHref ?? results[0]?.href;
    const moveSelection = (direction: number) => {
        const index = results.findIndex((item) => item.href === selected);
        const next = Math.max(
            0,
            Math.min(index + direction, results.length - 1),
        );
        setSelectedHref(results[next]?.href ?? null);
    };

    useEffect(() => {
        if (!open || !isCanonicalWorkspace || !role || term.length < 2) {
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(async () => {
            try {
                const response = await fetch(
                    '/workspace/ui/record-search?q=' + encodeURIComponent(term),
                    {
                        signal: AbortSignal.any([
                            controller.signal,
                            AbortSignal.timeout(12_000),
                        ]),
                        headers: { Accept: 'application/json' },
                        cache: 'no-store',
                    },
                );

                if (!response.ok) {
                    throw new Error('Search unavailable');
                }

                const data = await response.json();

                if (!controller.signal.aborted) {
                    setRecordMatches({
                        term,
                        items: data.results,
                        failed: false,
                    });
                }
            } catch {
                if (!controller.signal.aborted) {
                    setRecordMatches({ term, items: [], failed: true });
                }
            }
        }, 300);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [open, isCanonicalWorkspace, role, term]);

    useEffect(() => {
        const handleKeys = (event: KeyboardEvent) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === 'k'
            ) {
                event.preventDefault();
                setSelectedHref(null);
                setOpen((previous) => !previous);

                return;
            }

            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeys);

        return () => window.removeEventListener('keydown', handleKeys);
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }

        const previous = document.activeElement;
        inputRef.current?.focus();

        return () => {
            if (previous instanceof HTMLElement && previous.isConnected) {
                previous.focus();
            }
        };
    }, [open]);

    useEffect(() => {
        const unsubscribe = router.on('finish', () => setRefreshing(false));

        return () => unsubscribe();
    }, []);

    const close = () => {
        setOpen(false);
        setQuery('');
        setSelectedHref(null);
    };

    const navigate = (href: string) => {
        close();

        if (path !== href) {
            router.visit(href);
        }
    };

    const refresh = () => {
        if (refreshing) {
            return;
        }

        setRefreshing(true);
        router.reload();
    };

    return (
        <>
            <button
                type="button"
                className="jr-quick-search"
                onClick={() => {
                    setSelectedHref(null);
                    setOpen(true);
                }}
                aria-label="Search JaiROADS pages (Control K)"
                title="Search pages (Ctrl+K)"
            >
                <Search size={17} aria-hidden="true" />
                <span className="jr-quick-label">Quick find</span>
                <kbd>Ctrl K</kbd>
            </button>
            <button
                type="button"
                className="jr-quick-refresh"
                onClick={refresh}
                disabled={refreshing}
                title="Refresh current page"
                aria-label="Refresh current page"
            >
                <RefreshCw
                    size={17}
                    aria-hidden="true"
                    className={refreshing ? 'jr-spin' : undefined}
                />
            </button>
            {open && (
                <div
                    className="jr-command-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            close();
                        }
                    }}
                >
                    <div
                        className="jr-command-box"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Quick navigation"
                        onKeyDown={(event) => {
                            if (event.key !== 'Tab') {
                                return;
                            }

                            const controls = Array.from(
                                event.currentTarget.querySelectorAll<HTMLElement>(
                                    'button:not(:disabled), input:not(:disabled)',
                                ),
                            );
                            const first = controls[0];
                            const last = controls[controls.length - 1];

                            if (
                                event.shiftKey &&
                                document.activeElement === first
                            ) {
                                event.preventDefault();
                                last?.focus();
                            } else if (
                                !event.shiftKey &&
                                document.activeElement === last
                            ) {
                                event.preventDefault();
                                first?.focus();
                            }
                        }}
                    >
                        <div className="jr-command-search-row">
                            <Search size={19} aria-hidden="true" />
                            <input
                                ref={inputRef}
                                value={query}
                                type="search"
                                autoComplete="off"
                                aria-label="Search JaiROADS sections"
                                placeholder="Find a section or record…"
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setSelectedHref(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        moveSelection(1);
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        moveSelection(-1);
                                    } else if (
                                        e.key === 'Enter' &&
                                        results.some(
                                            (item) => item.href === selected,
                                        )
                                    ) {
                                        e.preventDefault();

                                        if (selected) {
                                            navigate(selected);
                                        }
                                    }
                                }}
                            />
                            <button
                                type="button"
                                className="jr-command-close"
                                onClick={close}
                                aria-label="Close quick navigation"
                            >
                                <X size={19} />
                            </button>
                        </div>
                        <div className="jr-command-heading">
                            JaiROADS workspace
                        </div>
                        {isCanonicalWorkspace &&
                            term.length >= 2 &&
                            recordMatches.term === term &&
                            recordMatches.failed && (
                                <p className="jr-command-empty" role="status">
                                    Record search unavailable. Directory search
                                    is still available.
                                </p>
                            )}
                        <div className="jr-command-items">
                            {results.length ? (
                                results.map(({ label, href, Icon }) => (
                                    <button
                                        key={href}
                                        type="button"
                                        className={`jr-command-item ${selected === href ? 'jr-command-selected' : ''}`}
                                        aria-current={
                                            matchesRoute(path, href)
                                                ? 'page'
                                                : undefined
                                        }
                                        onMouseEnter={() =>
                                            setSelectedHref(href)
                                        }
                                        onClick={() => navigate(href)}
                                    >
                                        <Icon size={18} aria-hidden="true" />
                                        <span>{label}</span>
                                        {matchesRoute(path, href) && (
                                            <span className="jr-command-current">
                                                Current
                                            </span>
                                        )}
                                        <ArrowRight
                                            size={16}
                                            className="jr-command-arrow"
                                            aria-hidden="true"
                                        />
                                    </button>
                                ))
                            ) : (
                                <div className="jr-command-empty">
                                    No matching section. Try a different search.
                                </div>
                            )}
                        </div>
                        <div className="jr-command-footer">
                            <span>
                                <kbd>↑</kbd> <kbd>↓</kbd> Select
                            </span>
                            <span>
                                <kbd>Enter</kbd> Open
                            </span>
                            <span>
                                <kbd>Esc</kbd> Close
                            </span>
                            <span className="jr-command-footer-note">
                                <Bell size={13} /> JaiROADS
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

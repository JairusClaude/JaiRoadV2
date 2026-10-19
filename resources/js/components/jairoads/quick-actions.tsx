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
import { useEffect, useMemo, useRef, useState } from 'react';

const destinations = [
    { label: 'Dashboard', href: '/admin-dashboard', Icon: House },
    { label: 'Maintenance Projects', href: '/maintenance-projects', Icon: LayoutDashboard },
    { label: 'User Management', href: '/user-management', Icon: Users },
    { label: 'Monthly Updates', href: '/monthly-updates-preview', Icon: CalendarDays },
    { label: 'Project Documents', href: '/project-documents-preview', Icon: FileText },
    { label: 'Road Sections', href: '/road-sections-preview', Icon: Map },
    { label: 'LGU', href: '/lgus-preview', Icon: Building2 },
    { label: 'Settings', href: '/settings-preview', Icon: Settings },
] as const;

const matchesRoute = (path: string, href: string) =>
    path === href || path.startsWith(href + '/') ||
    (href === '/settings-preview' && path.startsWith('/settings/'));

/** A keyboard-friendly navigator to EXISTING routes; Laravel still authorizes visits. */
export function JaiRoadsQuickActions() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const page = usePage<{jairoadsIdentity?:{role:string}|null}>();
    const path = page.url.split('?')[0];
    const role = page.props.jairoadsIdentity?.role;
    const isDd = path.startsWith('/dd-phase3/') || path.startsWith('/dd-superadmin-');
    const ddPaths = ['/dd-phase3/dashboard','/dd-phase3/projects','/dd-phase3/users','/dd-phase3/updates','/dd-phase3/documents','/dd-phase3/roads','/dd-phase3/lgus','/dd-phase3/settings'];
    const allowedDestinations = destinations.flatMap((entry,index) => {
        if (entry.label === 'User Management' && role !== 'admin' && role !== 'superadmin') return [];
        return [{...entry,href:isDd ? (index===0 && role==='superadmin'?'/dd-superadmin-landing':ddPaths[index]) : entry.href}];
    });

    const results = useMemo(() => allowedDestinations.filter((entry) =>
        entry.label.toLowerCase().includes(query.trim().toLowerCase())
    ), [query, path, role]);

    useEffect(() => {
        const handleKeys = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen((previous) => !previous);
                return;
            }
            if (event.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, []);

    useEffect(() => {
        if (!open) return;
        setSelected(0);
        inputRef.current?.focus();
    }, [open]);

    useEffect(() => {
        if (open) setSelected(0);
    }, [query, open]);

    useEffect(() => {
        const unsubscribe = router.on('finish', () => setRefreshing(false));
        return () => unsubscribe();
    }, []);

    const close = () => {
        setOpen(false);
        setQuery('');
        setSelected(0);
    };

    const navigate = (href: string) => {
        close();
        if (path !== href) router.visit(href);
    };

    const refresh = () => {
        if (refreshing) return;
        setRefreshing(true);
        router.reload();
    };

    return (
        <>
            <button type="button" className="jr-quick-search" onClick={() => setOpen(true)}
                aria-label="Search JaiROADS pages (Control K)" title="Search pages (Ctrl+K)">
                <Search size={17} aria-hidden="true" />
                <span className="jr-quick-label">Quick find</span>
                <kbd>Ctrl K</kbd>
            </button>
            <button type="button" className="jr-quick-refresh" onClick={refresh} disabled={refreshing}
                title="Refresh current page" aria-label="Refresh current page">
                <RefreshCw size={17} aria-hidden="true" className={refreshing ? 'jr-spin' : undefined} />
            </button>
            {open && (
                <div className="jr-command-overlay" onMouseDown={(e) => {
                    if (e.target === e.currentTarget) close();
                }}>
                    <div className="jr-command-box" role="dialog" aria-modal="true" aria-label="Quick navigation">
                        <div className="jr-command-search-row">
                            <Search size={19} aria-hidden="true" />
                            <input ref={inputRef} value={query} type="search" autoComplete="off"
                                aria-label="Search JaiROADS sections" placeholder="Find a section…"
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowDown') {
                                        e.preventDefault();
                                        setSelected((i) => Math.min(i + 1, results.length - 1));
                                    } else if (e.key === 'ArrowUp') {
                                        e.preventDefault();
                                        setSelected((i) => Math.max(0, i - 1));
                                    } else if (e.key === 'Enter' && results[selected]) {
                                        e.preventDefault();
                                        navigate(results[selected].href);
                                    }
                                }}
                            />
                            <button type="button" className="jr-command-close" onClick={close} aria-label="Close quick navigation">
                                <X size={19} />
                            </button>
                        </div>
                        <div className="jr-command-heading">JaiROADS workspace</div>
                        <div className="jr-command-items">
                            {results.length ? results.map(({ label, href, Icon }, index) => (
                                <button key={href} type="button"
                                    className={`jr-command-item ${selected === index ? 'jr-command-selected' : ''}`}
                                    aria-current={matchesRoute(path, href) ? 'page' : undefined}
                                    onMouseEnter={() => setSelected(index)}
                                    onClick={() => navigate(href)}>
                                    <Icon size={18} aria-hidden="true" />
                                    <span>{label}</span>
                                    {matchesRoute(path, href) && <span className="jr-command-current">Current</span>}
                                    <ArrowRight size={16} className="jr-command-arrow" aria-hidden="true" />
                                </button>
                            )) : (
                                <div className="jr-command-empty">No matching section. Try a different search.</div>
                            )}
                        </div>
                        <div className="jr-command-footer">
                            <span><kbd>↑</kbd> <kbd>↓</kbd> Select</span>
                            <span><kbd>Enter</kbd> Open</span>
                            <span><kbd>Esc</kbd> Close</span>
                            <span className="jr-command-footer-note"><Bell size={13} /> JaiROADS</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

import { createInertiaApp, router } from '@inertiajs/react';
import { androidWorkspace, fieldHttp, installFieldResources } from '@/lib/android-workspace-bridge';
import { lazy, Suspense, useEffect } from 'react';
import '../css/jairoads-role-components.css';
import '../css/jairoads-dark-appearance.css';
import {
    AndroidFieldFeedback,
    JaiRoadsNavigationFeedback,
} from '@/components/jairoads/navigation-feedback';
import { RenderErrorBoundary } from '@/components/jairoads/render-error-boundary';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import '../css/jairoads-motion.css';

// Load workspace shells only after the corresponding page is requested.
const AppLayout = lazy(() => import('@/layouts/app-layout'));
const AuthLayout = lazy(() => import('@/layouts/auth-layout'));
const MaintenanceProjectLayout = lazy(
    () => import('@/layouts/maintenance-project-layout'),
);
const RoleAwareWorkspaceLayout = lazy(
    () => import('@/layouts/role-aware-workspace-layout'),
);
const RoleWorkspaceLayout = lazy(
    () => import('@/layouts/role-workspace-layout'),
);
const SettingsLayout = lazy(() => import('@/layouts/settings/layout'));

const appName = import.meta.env.VITE_APP_NAME || 'JaiROADS';

function DismissStartupMessage() {
    useEffect(() => {
        document.getElementById('jairoads-startup')?.remove();
    }, []);

    return null;
}

const fieldWorkspace = androidWorkspace();
if (fieldWorkspace) {
    installFieldResources(fieldWorkspace);
    void import('@/lib/road-coverages/offline-map-packs').then(({prepareOfflineMapPacks})=>{
        const prepare=()=>{void prepareOfflineMapPacks(()=>!fieldWorkspace.status().offline);};
        window.addEventListener('jairoads-field-status',prepare);
        prepare();
    });
}

void createInertiaApp({
    ...(fieldWorkspace ? { page: fieldWorkspace.initial, http: fieldHttp(fieldWorkspace) } : {}),
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'SuperAdminDashboard/CommandCenter':
            case name === 'AuditLogs/History':
            case name === 'Workspace/Operations':
            case name === 'Workspace/Directory':
            case name === 'RoleDashboard/Canonical':
                return MaintenanceProjectLayout;
            case name === 'welcome':
                return null;
            case name === 'auth/login':
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('RoadCoverages/'):
            case name.startsWith('MaintenanceDocuments/'):
            case name.startsWith('MonthlyUpdates/'):
            case name.startsWith('MaintenanceProjects/'):
            case name.startsWith('MaintenanceRecords/'):
            case name.startsWith('LGUs/'):
            case name.startsWith('AuditLogs/'):
            case name.startsWith('user-management/'):
                return MaintenanceProjectLayout;
            case name.startsWith('RoleDashboard/'):
                return RoleWorkspaceLayout;
            case name.startsWith('SuperAdminDashboard/'):
                return RoleAwareWorkspaceLayout;
            case name.startsWith('monthly-updates/'):
            case name.startsWith('project-documents-preview/'):
            case name.startsWith('road-sections-preview/'):
            case name.startsWith('lgus-preview/'):
            case name.startsWith('settings-preview/'):
            case name.startsWith('AdminDashboard/'):
                return RoleAwareWorkspaceLayout;
            case name === 'settings/profile':
            case name === 'settings/security':
            case name === 'settings/appearance':
                return RoleAwareWorkspaceLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                <RenderErrorBoundary
                    fallback={
                        <div className="grid min-h-screen place-items-center text-sm">
                            <div className="text-center">
                                <p role="alert">
                                    JaiROADS could not open this page. Check the
                                    record before retrying a submission.
                                </p>
                                <button
                                    type="button"
                                    className="mt-3 rounded px-3 py-2 underline focus-visible:ring-2"
                                    onClick={() => window.location.reload()}
                                >
                                    Reload page
                                </button>
                            </div>
                        </div>
                    }
                >
                    <Suspense
                        fallback={
                            <div
                                role="status"
                                className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-4 p-6 text-sm"
                            >
                                <span>Loading JaiROADS workspace…</span>
                                <div
                                    aria-hidden="true"
                                    className="space-y-4 motion-safe:animate-pulse"
                                >
                                    <div className="h-9 w-2/5 rounded-lg bg-muted" />
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="h-24 rounded-xl bg-muted" />
                                        <div className="h-24 rounded-xl bg-muted" />
                                        <div className="h-24 rounded-xl bg-muted" />
                                    </div>
                                    <div className="h-48 rounded-xl bg-muted" />
                                </div>
                            </div>
                        }
                    >
                        {app}
                    </Suspense>
                </RenderErrorBoundary>
                <DismissStartupMessage />
                <JaiRoadsNavigationFeedback />
                <AndroidFieldFeedback />
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: false,
}).then(() => {
    if (fieldWorkspace) {
        router.on('navigate', (event) => fieldWorkspace.current(event.detail.page));
        window.addEventListener('jairoads-field-back',()=>router.visit('/workspace/dashboard'));
        fieldWorkspace.ready();
    }
}).catch(() => {
    fieldWorkspace?.fail();
    const message = document.getElementById('jairoads-startup-message');

    if (message) {
        message.textContent =
            'JaiROADS could not load. Check your connection and reload the page.';
    }
});

// This will set light / dark mode on load...
initializeTheme();

// Restore the user's JaiROADS reduced-motion preference on every page load.
try {
    if (window.localStorage.getItem('jairoads-reduce-motion') === 'true') {
        document.documentElement.classList.add('jr-reduce-motion');
    }
} catch {
    /* Storage can be disabled by the browser. */
}

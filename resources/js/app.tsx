import { createInertiaApp } from '@inertiajs/react';
import { JaiRoadsNavigationFeedback } from '@/components/jairoads/navigation-feedback';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import DdPhase3RoleLayout from '@/layouts/dd-phase3-role-layout';
import DdSuperAdminCommandLayout from '@/layouts/dd-superadmin-command-layout';
import RoleAwareWorkspaceLayout from '@/layouts/role-aware-workspace-layout';
import RoleWorkspaceLayout from '@/layouts/role-workspace-layout';
import SettingsLayout from '@/layouts/settings/layout';

const appName = import.meta.env.VITE_APP_NAME || 'JaiROADS';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name.startsWith('dd-superadmin-command-center/'):
                return DdSuperAdminCommandLayout;
            case name.startsWith('dd-phase3/'):
                return DdPhase3RoleLayout;
            case name === 'welcome':
                return null;
            case name === 'auth/login':
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('RoleDashboard/'):
                return RoleWorkspaceLayout;
            case name.startsWith('SuperAdminDashboard/'):
                return RoleAwareWorkspaceLayout;
            case name.startsWith('MaintenanceProjects/'):
            case name.startsWith('MaintenanceRecords/'):
            case name.startsWith('user-management/'):
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
                {app}
                <JaiRoadsNavigationFeedback />
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: false,
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

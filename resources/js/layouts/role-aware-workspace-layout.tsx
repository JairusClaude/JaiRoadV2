import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import PolishedWorkspaceLayout from '@/layouts/polished-workspace-layout';
import SuperAdminCommandLayout from '@/layouts/superadmin-command-layout';

type Identity = { role: string; username: string; name: string } | null;

/** Shared warm JaiROADS shell for ordinary roles; SuperAdmin remains separate. */
export default function RoleAwareWorkspaceLayout({
    children,
}: {
    children: ReactNode;
}) {
    const page = usePage<{ jairoadsIdentity?: Identity }>();
    const { jairoadsIdentity } = page.props;
    const path = page.url.split('?')[0].split('#')[0];
    const isSettings = path === '/settings-preview' || path.startsWith('/settings/');
    // Settings lives in the polished layout, which has no role marker by default.
    // Add one only on Settings pages so existing role-specific controls and tokens apply.
    const settingsRole =
        isSettings &&
        (jairoadsIdentity?.role === 'admin' ||
            jairoadsIdentity?.role === 'engineer' ||
            jairoadsIdentity?.role === 'viewer')
            ? jairoadsIdentity.role
            : null;

    if (jairoadsIdentity?.role === 'superadmin') {
        return <SuperAdminCommandLayout>{children}</SuperAdminCommandLayout>;
    }

    // The polished shell rejects all unexpected or missing identities itself.
    return (
        <PolishedWorkspaceLayout>
            {settingsRole ? (
                <div className={`contents jr-${settingsRole}-workspace`}>
                    {children}
                </div>
            ) : (
                children
            )}
        </PolishedWorkspaceLayout>
    );
}

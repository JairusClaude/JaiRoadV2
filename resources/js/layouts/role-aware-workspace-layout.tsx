import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import PolishedWorkspaceLayout from '@/layouts/polished-workspace-layout';
import SuperAdminCommandLayout from '@/layouts/superadmin-command-layout';

type Identity = { role: string; username: string; name: string } | null;

/** Shared warm JaiROADS shell for ordinary roles; SuperAdmin remains separate. */
export default function RoleAwareWorkspaceLayout({ children }: { children: ReactNode }) {
    const { jairoadsIdentity } = usePage<{ jairoadsIdentity?: Identity }>().props;
    if (jairoadsIdentity?.role === 'superadmin') {
        return <SuperAdminCommandLayout>{children}</SuperAdminCommandLayout>;
    }
    // The polished shell rejects all unexpected or missing identities itself.
    return <PolishedWorkspaceLayout>{children}</PolishedWorkspaceLayout>;
}

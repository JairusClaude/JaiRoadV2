import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import DdSuperAdminCommandLayout from '@/layouts/dd-superadmin-command-layout';
import PolishedWorkspaceLayout from '@/layouts/polished-workspace-layout';

type VerifiedIdentity = { role: string; username: string; name: string } | null;

/**
 * One Data Dictionary route family, two approved visual treatments.
 * Server-side DD policies remain the sole authority; this only chooses a shell.
 * The same PolishedWorkspaceLayout is shared by legacy and DD ordinary roles.
 */
export default function DdPhase3RoleLayout({ children }: { children: ReactNode }) {
    const { jairoadsIdentity } = usePage<{ jairoadsIdentity?: VerifiedIdentity }>().props;
    const role = jairoadsIdentity?.role;
    if (role === 'superadmin') {
        return <DdSuperAdminCommandLayout>{children}</DdSuperAdminCommandLayout>;
    }
    if (role === 'admin' || role === 'engineer' || role === 'viewer') {
        return <PolishedWorkspaceLayout>{children}</PolishedWorkspaceLayout>;
    }
    return <main role="alert" className="grid min-h-screen place-items-center bg-[#f4f5f8] p-8 text-slate-900">
        Your account is unavailable. Please contact your administrator.
    </main>;
}

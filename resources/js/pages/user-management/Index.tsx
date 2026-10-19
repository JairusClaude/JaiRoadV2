import { Head } from '@inertiajs/react';
import UserManagementPage from '@/components/user-management/user-management-page';
import type { UserManagementPageProps } from '@/components/user-management/user-management-page';

/** Same thin Inertia page convention as maintenance-projects/Index.tsx. */
export default function Index(props: UserManagementPageProps) {
    return (
        <>
            <Head title="User Management" />
            <UserManagementPage {...props} />
        </>
    );
}

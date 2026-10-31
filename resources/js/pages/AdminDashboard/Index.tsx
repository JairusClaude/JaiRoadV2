import { Head } from '@inertiajs/react';
import AdminDashboardPage from '@/components/admin-dashboard/admin-dashboard-page';
import type { AdminDashboardProps } from '@/components/admin-dashboard/admin-dashboard-page';

export default function Index(props: AdminDashboardProps) {
    return (
        <>
            <Head title="Admin Dashboard" />
            <AdminDashboardPage {...props} />
        </>
    );
}

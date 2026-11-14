import { Head } from '@inertiajs/react';
import MonthlyUpdatesPage from '@/components/monthly-updates/monthly-updates-page';
import type { MonthlyUpdatesPageProps } from '@/components/monthly-updates/monthly-updates-page';

export default function Index(props: MonthlyUpdatesPageProps) {
    return (
        <>
            <Head title="Monthly Updates" />
            <MonthlyUpdatesPage {...props} />
        </>
    );
}

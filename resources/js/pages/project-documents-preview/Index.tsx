import { Head } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import MaintenanceDocumentsPage from '@/components/maintenance-documents/maintenance-documents-page';

/** Rendered inside the existing JaiROADS MaintenanceProjectLayout (app.tsx). */
export default function Index(
    props: ComponentProps<typeof MaintenanceDocumentsPage>,
) {
    return (
        <>
            <Head title="Project Documents" />
            <MaintenanceDocumentsPage {...props} />
        </>
    );
}

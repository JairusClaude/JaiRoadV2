import { Head } from '@inertiajs/react';
import LguDirectory from '@/components/lgus-preview/lgu-directory';
import type { LguDirectoryProps } from '@/components/lgus-preview/lgu-directory';

/** Uses the existing JaiROADS MaintenanceProjectLayout from app.tsx. */
export default function Index(props: LguDirectoryProps) {
    return (
        <>
            <Head title="LGU" />
            <LguDirectory {...props} />
        </>
    );
}

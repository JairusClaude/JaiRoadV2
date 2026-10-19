import { Head } from '@inertiajs/react';
import RoadSectionsPage from '@/components/road-sections-preview/road-sections-page';
import type { RoadSectionsPageProps } from '@/components/road-sections-preview/road-sections-page';

/** Shared JaiROADS MaintenanceProjectLayout is selected in resources/js/app.tsx. */
export default function Index(props: RoadSectionsPageProps) {
    return (
        <>
            <Head title="Road Sections" />
            <RoadSectionsPage {...props} />
        </>
    );
}

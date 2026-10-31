import { Head } from '@inertiajs/react';
import SettingsPage from '@/components/settings-preview/settings-page';
import type { SettingsPreviewProps } from '@/components/settings-preview/settings-page';

/** Existing JaiROADS sidebar/layout is assigned in resources/js/app.tsx. */
export default function Index(props: SettingsPreviewProps) {
    return (
        <>
            <Head title="Settings" />
            <SettingsPage {...props} />
        </>
    );
}

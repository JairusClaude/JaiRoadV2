import { Head, Link, usePage } from '@inertiajs/react';
import { alternativeDirectoryFor } from '@/components/maintenance-projects/alternative-navigation';
import { Button } from '@/components/ui/button';
import '../../../css/maintenance-projects-exploration.css';
import '../../../css/maintenance-projects-espresso-sidebar.css';

export default function NavigationPreview({
    navigationTitle,
    navigationSection,
}: {
    navigationTitle: string;
    navigationSection: string;
}) {
    const espresso = usePage().props.sidebarTheme === 'espresso';
    const directoryUrl = alternativeDirectoryFor(
        espresso ? 'espresso' : undefined,
    );

    return (
        <div
            className={
                espresso
                    ? 'jr-directory-exploration jr-espresso-exploration'
                    : 'jr-directory-exploration'
            }
        >
            <Head title={`${navigationTitle} · Navigation preview`} />
            <section className="jr-workspace">
                <div className="jr-page-head">
                    <div>
                        <h1>{navigationTitle}</h1>
                        <p>Alternative sidebar navigation preview</p>
                    </div>
                </div>
                <div className="jr-empty">
                    <strong>Navigation preview only</strong>
                    <p>
                        {navigationSection === 'maintenance-records'
                            ? 'A dedicated Maintenance Records directory is not implemented yet. Existing records remain accessible through Project Details.'
                            : 'This destination lets you review the alternative sidebar’s selected state. The module interface has not been cloned.'}
                    </p>
                    <Button asChild className="jr-primary">
                        <Link href={directoryUrl}>
                            Return to Maintenance Projects
                        </Link>
                    </Button>
                    {navigationSection === 'monthly-updates' && (
                        <p>
                            <Link href="/monthly-updates">
                                Open the existing Monthly Updates directory
                            </Link>
                        </p>
                    )}
                </div>
            </section>
        </div>
    );
}

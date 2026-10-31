import { Head, Link } from '@inertiajs/react';
import { login } from '@/routes';

/**
 * Public registration is disabled by the approved JaiROADS UserAccount
 * permission matrix. Keep this unmounted Inertia page fail-closed rather
 * than referencing the removed Wayfinder register route.
 */
export default function Register() {
    return (
        <>
            <Head title="Account registration unavailable" />
            <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
                <h1 className="text-2xl font-semibold">
                    Account registration is unavailable
                </h1>
                <p className="text-sm text-muted-foreground">
                    JaiROADS accounts are provisioned by authorized
                    administrators. Contact your JaiROADS administrator if you
                    need access.
                </p>
                <Link
                    href={login()}
                    className="text-sm font-medium underline underline-offset-4"
                >
                    Sign in
                </Link>
            </main>
        </>
    );
}

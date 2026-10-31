import { Form, Head, Link } from '@inertiajs/react';
import { LogOut, MailCheck } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

/** Branding only; preserves Laravel's verified-email requirement and delivery settings. */
export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <>
            <Head title="Verify email · JaiROADS" />
            <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex gap-3">
                    <span className="rounded-xl bg-amber-100 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <MailCheck className="size-6" />
                    </span>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                            Verify your email
                        </h1>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            Before continuing to protected JaiROADS features,
                            confirm the email address on your sign-in account.
                        </p>
                    </div>
                </div>
                {status === 'verification-link-sent' && (
                    <p
                        role="status"
                        className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    >
                        A verification link has been requested. Check your
                        inbox. If the server uses a log-only mailer, an
                        administrator must configure delivery.
                    </p>
                )}
                <Form {...send.form()} className="space-y-3">
                    {({ processing }) => (
                        <button
                            disabled={processing}
                            type="submit"
                            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#90451F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#773917] disabled:opacity-60 dark:bg-amber-700"
                        >
                            {processing && <Spinner />}Resend verification link
                        </button>
                    )}
                </Form>
                <Link
                    href={logout()}
                    as="button"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 underline dark:text-slate-300"
                >
                    <LogOut className="size-4" />
                    Log out
                </Link>
            </div>
        </>
    );
}
VerifyEmail.layout = {
    title: 'Verify your email',
    description: 'Required for some protected JaiROADS account actions.',
};

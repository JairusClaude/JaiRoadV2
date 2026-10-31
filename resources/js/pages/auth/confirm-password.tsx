import { Form, Head } from '@inertiajs/react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import {
    index as confirmOptions,
    store as confirmStore,
} from '@/actions/Laravel/Passkeys/Http/Controllers/PasskeyConfirmationController';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/password/confirm';

/** Branded version of the existing protected password confirmation; never bypasses it. */
export default function ConfirmPassword() {
    return (
        <>
            <Head title="Confirm access · JaiROADS" />
            <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-amber-100 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                        <ShieldCheck className="size-6" />
                    </span>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                            Confirm your identity
                        </h1>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                            This JaiROADS security action requires password
                            confirmation.
                        </p>
                    </div>
                </div>
                <PasskeyVerify
                    routes={{
                        options: confirmOptions(),
                        submit: confirmStore(),
                    }}
                    label="Confirm with passkey"
                    loadingLabel="Confirming…"
                    separator="Or confirm with password"
                />
                <Form {...store.form()} resetOnSuccess={['password']}>
                    {({ processing, errors }) => (
                        <div className="space-y-4">
                            <div>
                                <label
                                    htmlFor="jr-confirm-current"
                                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                                >
                                    Current password
                                </label>
                                <PasswordInput
                                    id="jr-confirm-current"
                                    name="password"
                                    autoComplete="current-password"
                                    autoFocus
                                    className="mt-2 w-full rounded-xl border border-slate-300 p-3 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                                />
                                <InputError message={errors.password} />
                            </div>
                            <button
                                type="submit"
                                disabled={processing}
                                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#90451F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#773917] disabled:opacity-60 dark:bg-amber-700"
                            >
                                <LockKeyhole className="size-4" />
                                {processing && <Spinner />}Confirm password
                            </button>
                        </div>
                    )}
                </Form>
            </div>
        </>
    );
}
ConfirmPassword.layout = {
    title: 'Confirm access',
    description:
        'JaiROADS protects account security with recent authentication.',
};

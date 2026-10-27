import { Form, Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    Fingerprint,
    KeyRound,
    LockKeyhole,
    ShieldCheck,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import InputError from '@/components/input-error';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import ManagePasskeys from '@/components/manage-passkeys';
import type { Props as ManagePasskeysProps } from '@/components/manage-passkeys';
import ManageTwoFactor from '@/components/manage-two-factor';
import type { Props as ManageTwoFactorProps } from '@/components/manage-two-factor';
import PasswordInput from '@/components/password-input';

type Props = { passwordRules: string } & ManagePasskeysProps &
    ManageTwoFactorProps;
type Tab = 'password' | 'two-factor' | 'passkeys';
const sections: { id: Tab; title: string; icon: typeof LockKeyhole }[] = [
    { id: 'password', title: 'Change password', icon: LockKeyhole },
    { id: 'two-factor', title: 'Two-factor authentication', icon: Fingerprint },
    { id: 'passkeys', title: 'Passkeys', icon: KeyRound },
];
const inputClass =
    'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
function PanelTitle({
    icon: Icon,
    title,
    detail,
}: {
    icon: typeof LockKeyhole;
    title: string;
    detail: string;
}) {
    return (
        <div className="mb-5 flex gap-3 border-b border-slate-200 pb-5 dark:border-slate-700">
            <span className="rounded-xl bg-amber-100 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <Icon className="size-5" />
            </span>
            <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {title}
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {detail}
                </p>
            </div>
        </div>
    );
}
function Container({ children }: { children: ReactNode }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-700 dark:bg-slate-900">
            {children}
        </div>
    );
}
/** Uses Fortify's existing credential routes and native 2FA/passkey components, not a second auth system. */
export default function Security(props: Props) {
    const [tab, setTab] = useState<Tab>(() => {
        const requested =
            typeof window === 'undefined'
                ? null
                : new URLSearchParams(window.location.search).get('tab');

        return requested === 'two-factor' || requested === 'passkeys'
            ? requested
            : 'password';
    });
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);
    const switchTab = (next: Tab) => {
        setTab(next);
        window.history.replaceState(
            window.history.state,
            '',
            `/settings/security?tab=${next}`,
        );
    };

    return (
        <ProjectWorkspace>
            <Head title="Account Security · JaiROADS" />
            <div className="jr-settings mx-auto max-w-5xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Account & Security
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Protect your JaiROADS sign-in account with Laravel
                            Fortify.
                        </p>
                    </div>
                    <Link
                        href="/settings-preview"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <ArrowLeft className="size-4" />
                        Back to Settings
                    </Link>
                </div>
                <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
                    <nav
                        aria-label="Security options"
                        className="flex flex-col gap-2"
                    >
                        {sections.map(({ id, title, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => switchTab(id)}
                                aria-current={tab === id ? 'page' : undefined}
                                className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-amber-600 ${tab === id ? 'bg-orange-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
                            >
                                <Icon className="size-5 shrink-0" />
                                {title}
                            </button>
                        ))}
                    </nav>
                    <section
                        aria-label={sections.find((x) => x.id === tab)?.title}
                        className="min-w-0"
                    >
                        {tab === 'password' && (
                            <Container>
                                <PanelTitle
                                    icon={LockKeyhole}
                                    title="Change password"
                                    detail="Enter your current password and choose a strong new password. This updates your actual JaiROADS login password."
                                />
                                <Form
                                    {...SecurityController.update.form()}
                                    options={{ preserveScroll: true }}
                                    resetOnError={[
                                        'current_password',
                                        'password',
                                        'password_confirmation',
                                    ]}
                                    resetOnSuccess
                                    onError={(errors) => {
                                        if (errors.current_password) {
                                            currentPasswordInput.current?.focus();
                                        } else if (errors.password) {
                                            passwordInput.current?.focus();
                                        }
                                    }}
                                    className="max-w-xl space-y-5"
                                >
                                    {({
                                        errors,
                                        processing,
                                        recentlySuccessful,
                                    }) => (
                                        <>
                                            <div>
                                                <label
                                                    htmlFor="jr-current-password"
                                                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                                                >
                                                    Current password
                                                </label>
                                                <PasswordInput
                                                    id="jr-current-password"
                                                    name="current_password"
                                                    ref={currentPasswordInput}
                                                    autoComplete="current-password"
                                                    placeholder="Current password"
                                                    className={inputClass}
                                                />
                                                <InputError
                                                    message={
                                                        errors.current_password
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label
                                                    htmlFor="jr-new-password"
                                                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                                                >
                                                    New password
                                                </label>
                                                <PasswordInput
                                                    id="jr-new-password"
                                                    name="password"
                                                    ref={passwordInput}
                                                    autoComplete="new-password"
                                                    placeholder="New password"
                                                    passwordrules={
                                                        props.passwordRules
                                                    }
                                                    className={inputClass}
                                                />
                                                <InputError
                                                    message={errors.password}
                                                />
                                            </div>
                                            <div>
                                                <label
                                                    htmlFor="jr-confirm-password"
                                                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                                                >
                                                    Confirm new password
                                                </label>
                                                <PasswordInput
                                                    id="jr-confirm-password"
                                                    name="password_confirmation"
                                                    autoComplete="new-password"
                                                    placeholder="Confirm new password"
                                                    className={inputClass}
                                                />
                                                <InputError
                                                    message={
                                                        errors.password_confirmation
                                                    }
                                                />
                                            </div>
                                            <div className="flex items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
                                                <button
                                                    type="submit"
                                                    disabled={processing}
                                                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#90451F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#773917] disabled:opacity-60 dark:bg-amber-700 dark:hover:bg-amber-600"
                                                >
                                                    <ShieldCheck className="size-4" />
                                                    {processing
                                                        ? 'Updating…'
                                                        : 'Update password'}
                                                </button>
                                                {recentlySuccessful && (
                                                    <span
                                                        role="status"
                                                        className="text-sm font-semibold text-emerald-700 dark:text-emerald-300"
                                                    >
                                                        Password updated.
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </Form>
                            </Container>
                        )}
                        {tab === 'two-factor' && (
                            <Container>
                                <PanelTitle
                                    icon={Fingerprint}
                                    title="Two-factor authentication"
                                    detail="Use an authenticator app and recovery codes to protect your login."
                                />
                                {props.canManageTwoFactor ? (
                                    <ManageTwoFactor
                                        canManageTwoFactor={
                                            props.canManageTwoFactor
                                        }
                                        requiresConfirmation={
                                            props.requiresConfirmation
                                        }
                                        twoFactorEnabled={
                                            props.twoFactorEnabled
                                        }
                                    />
                                ) : (
                                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        Two-factor authentication is not
                                        currently enabled in the Laravel Fortify
                                        configuration. It cannot be activated
                                        from the frontend alone.
                                    </p>
                                )}
                            </Container>
                        )}
                        {tab === 'passkeys' && (
                            <Container>
                                <PanelTitle
                                    icon={KeyRound}
                                    title="Manage passkeys"
                                    detail="Register a device passkey for passwordless sign-in, if enabled on this server."
                                />
                                {props.canManagePasskeys ? (
                                    <ManagePasskeys
                                        canManagePasskeys={
                                            props.canManagePasskeys
                                        }
                                        passkeys={props.passkeys}
                                    />
                                ) : (
                                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                        Passkeys are not currently enabled in
                                        Laravel Fortify. Secure registration
                                        requires the backend passkey feature and
                                        compatible HTTPS/origin settings.
                                    </p>
                                )}
                            </Container>
                        )}
                    </section>
                </div>
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Changing password, 2FA, or passkeys may require recent
                    password confirmation. Your administrative permissions,
                    Engineer assignment and operational account role are not
                    changed here.
                </p>
            </div>
        </ProjectWorkspace>
    );
}

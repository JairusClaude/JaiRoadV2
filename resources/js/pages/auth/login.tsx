import { Form, Head } from '@inertiajs/react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import AuthShell from '@/components/jairoads/auth-shell';
import InputError from '@/components/input-error';
import PasskeyVerify from '@/components/passkey-verify';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = { status?: string; canResetPassword: boolean; passkeyReady?: boolean };
export default function Login({ status, canResetPassword, passkeyReady = true }: Props) {
    const [remember, setRemember] = useState(false);
    return <>
        <Head title="Sign in · JaiROADS" />
        <AuthShell eyebrow="Welcome to JaiROADS" title="Welcome back" description="Sign in to your JaiROADS workspace.">
                            {status && (
                                <p
                                    role="status"
                                    className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                                >
                                    {status}
                                </p>
                            )}

                            <Form
                                {...store.form()}
                                transform={(data) => ({ ...data, remember: remember ? '1' : '0' })}
                                resetOnSuccess={['password']}
                                className="space-y-4"
                            >
                                {({ processing, errors }) => (
                                    <>
                                        <div className="space-y-2">
                                            <Label
                                                htmlFor="email"
                                                className="text-sm font-semibold text-[#263c53]"
                                            >
                                                Email address
                                            </Label>
                                            <Input
                                                id="email"
                                                type="email"
                                                name="email"
                                                required
                                                autoFocus
                                                autoComplete="email"
                                                placeholder="you@example.com"
                                                aria-invalid={Boolean(
                                                    errors.email,
                                                )}
                                                className="h-12 rounded-xl border-[#dce4ec] bg-[#fdfefe] px-4 text-sm text-[#17283e] placeholder:text-[#a1afbd] focus-visible:border-[#a45b30] focus-visible:ring-[#a45b30]/20"
                                            />
                                            <InputError
                                                message={errors.email}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <Label
                                                    htmlFor="password"
                                                    className="text-sm font-semibold text-[#263c53]"
                                                >
                                                    Password
                                                </Label>
                                                {canResetPassword && (
                                                    <a
                                                        href={request().url}
                                                        className="text-xs font-semibold text-[#965027] underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#965027]"
                                                    >
                                                        Forgot password?
                                                    </a>
                                                )}
                                            </div>
                                            <PasswordInput
                                                id="password"
                                                name="password"
                                                required
                                                autoComplete="current-password"
                                                placeholder="Enter your password"
                                                aria-invalid={Boolean(
                                                    errors.password,
                                                )}
                                                className="h-12 rounded-xl border-[#dce4ec] bg-[#fdfefe] px-4 text-sm text-[#17283e] placeholder:text-[#a1afbd] focus-visible:border-[#a45b30] focus-visible:ring-[#a45b30]/20"
                                            />
                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2.5 py-1">
                                            <input
                                                id="remember"
                                                name="remember"
                                                type="checkbox"
                                                value="1"
                                                checked={remember}
                                                onChange={(event) => setRemember(event.target.checked)}
                                                disabled={processing}
                                                className="size-4 accent-[#965027]"
                                            />
                                            <Label
                                                htmlFor="remember"
                                                className="cursor-pointer text-sm font-normal text-[#53687d]"
                                            >
                                                Keep me signed in
                                            </Label>
                                        </div>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                            data-test="login-button"
                                            className="mt-1 h-12 w-full rounded-xl bg-[#964b23] text-sm font-semibold text-white shadow-[0_6px_18px_rgba(121,56,21,0.17)] transition hover:bg-[#783a1a] focus-visible:ring-[#bd835a]/30 disabled:opacity-65"
                                        >
                                            {processing ? (
                                                <>
                                                    <Spinner /> Signing in…
                                                </>
                                            ) : (
                                                <>
                                                    Sign in{' '}
                                                    <ArrowRight
                                                        aria-hidden="true"
                                                        className="ml-1 size-4"
                                                    />
                                                </>
                                            )}
                                        </Button>
                                    </>
                                )}
                            </Form>

                            <p className="mt-2 text-xs leading-5 text-[#738398]">Use Keep me signed in only on a private, trusted device. It applies to email/password sign-in.</p>
                            <div className="mt-5 space-y-2 border-t border-[#edf0f4] pt-5">
                                {passkeyReady ? <PasskeyVerify label="Sign in with a passkey" routes={{ options: { url: '/passkeys/login/options', method: 'get' }, submit: { url: '/passkeys/login', method: 'post' } }} loginMode hideSeparator /> : <p role="status" className="text-sm text-[#697b90]">Passkey sign-in is unavailable on this address. Use your password or contact your administrator.</p>}
                                <p className="text-xs leading-5 text-[#738398]">First time using a passkey? Sign in with your password, then open Account & Security → Passkeys and add one. Use the same device or a synced passkey to sign in.</p>
                            </div>

                            <div className="mt-5">
                                <div className="flex items-start gap-3">
                                    <LockKeyhole
                                        aria-hidden="true"
                                        className="mt-0.5 size-[18px] shrink-0 text-[#8a9db0]"
                                    />
                                    <p className="text-xs leading-5 text-[#738398]">
                                        Need an account? Contact your system
                                        administrator.
                                    </p>
                                </div>
                            </div>

        </AuthShell>
    </>;
}

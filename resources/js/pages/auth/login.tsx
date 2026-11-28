import { Form, Head } from '@inertiajs/react';
import { ArrowRight, Info, LockKeyhole, Mail } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import AuthShell, {
    authButtonClass,
    authInputClass,
} from '@/components/jairoads/auth-shell';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/login';

type Props = {
    status?: string;
};
export default function Login({ status }: Props) {
    const [remember, setRemember] = useState(false);
    const [capsLock, setCapsLock] = useState(false);

    return (
        <>
            <Head title="Sign in · JaiROADS" />
            <AuthShell
                eyebrow="Welcome to JaiROADS"
                title="Welcome back"
                description="Sign in to your JaiROADS workspace."
                showMobileIntro
            >
                {status && (
                    <p
                        role="status"
                        className="jr-login-status mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                    >
                        {status}
                    </p>
                )}

                <Form
                    {...store.form()}
                    transform={(data) => ({
                        ...data,
                        remember: remember ? '1' : '0',
                    })}
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
                                <div className="jr-login-input-wrap">
                                    <Mail
                                        aria-hidden="true"
                                        className="jr-login-input-icon"
                                    />
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        required
                                        autoComplete="email"
                                        inputMode="email"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        aria-describedby={
                                            errors.email
                                                ? 'login-email-error'
                                                : undefined
                                        }
                                        placeholder="you@example.com"
                                        aria-invalid={Boolean(errors.email)}
                                        className={`${authInputClass} pl-10`}
                                    />
                                </div>
                                <InputError
                                    id="login-email-error"
                                    role="alert"
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
                                </div>
                                <div className="jr-login-input-wrap">
                                    <LockKeyhole
                                        aria-hidden="true"
                                        className="jr-login-input-icon"
                                    />
                                    <PasswordInput
                                        id="password"
                                        name="password"
                                        required
                                        autoComplete="current-password"
                                        onKeyDown={(event) =>
                                            setCapsLock(
                                                event.getModifierState(
                                                    'CapsLock',
                                                ),
                                            )
                                        }
                                        onKeyUp={(event) =>
                                            setCapsLock(
                                                event.getModifierState(
                                                    'CapsLock',
                                                ),
                                            )
                                        }
                                        onBlur={() => setCapsLock(false)}
                                        aria-describedby={
                                            [
                                                errors.password
                                                    ? 'login-password-error'
                                                    : '',
                                                capsLock
                                                    ? 'login-caps-lock'
                                                    : '',
                                            ]
                                                .filter(Boolean)
                                                .join(' ') || undefined
                                        }
                                        placeholder="Enter your password"
                                        aria-invalid={Boolean(errors.password)}
                                        className={`${authInputClass} pl-10`}
                                    />
                                </div>
                                <InputError
                                    id="login-password-error"
                                    role="alert"
                                    message={errors.password}
                                />
                                {capsLock && (
                                    <p
                                        id="login-caps-lock"
                                        role="status"
                                        className="jr-login-caps-warning"
                                    >
                                        <Info
                                            aria-hidden="true"
                                            className="size-4 shrink-0"
                                        />{' '}
                                        Caps Lock is on.
                                    </p>
                                )}
                            </div>
                            <div className="jr-login-remember flex items-center gap-2.5">
                                <input
                                    id="remember"
                                    name="remember"
                                    type="checkbox"
                                    value="1"
                                    checked={remember}
                                    onChange={(event) =>
                                        setRemember(event.target.checked)
                                    }
                                    disabled={processing}
                                    aria-describedby="login-remember-help"
                                    className="size-4 shrink-0 accent-[#965027]"
                                />
                                <Label
                                    htmlFor="remember"
                                    className="flex min-h-10 flex-1 cursor-pointer items-center text-sm font-normal text-[#53687d]"
                                >
                                    Keep me signed in
                                </Label>
                            </div>
                            <Button
                                type="submit"
                                disabled={processing}
                                data-test="login-button"
                                aria-busy={processing}
                                className={`${authButtonClass} mt-1 transition`}
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

                <p
                    id="login-remember-help"
                    className="jr-login-help mt-2 text-xs leading-5"
                >
                    Use only on a private, trusted device.
                </p>
                <div className="jr-login-support mt-5">
                    <div className="flex items-start gap-3">
                        <LockKeyhole
                            aria-hidden="true"
                            className="mt-0.5 size-[18px] shrink-0 text-[#8a9db0]"
                        />
                        <p className="jr-login-help text-xs leading-5">
                            Need help? Contact your administrator.
                        </p>
                    </div>
                </div>
            </AuthShell>
        </>
    );
}

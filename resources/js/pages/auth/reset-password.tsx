import { Form, Head, Link } from '@inertiajs/react';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
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
import { login } from '@/routes';
import { request, update } from '@/routes/password';

type Props = { token: string; email: string; passwordRules: string };
export default function ResetPassword({ token, email, passwordRules }: Props) {
    return (
        <>
            <Head title="Reset password · JaiROADS">
                <meta name="referrer" content="no-referrer" />
            </Head>
            <AuthShell
                eyebrow="Account recovery"
                title="Create a new password"
                description="Choose a strong new password for your JaiROADS account. Your existing sign-in sessions will be revoked when you reset it."
            >
                <Form
                    {...update.form()}
                    transform={(data) => ({ ...data, token, email })}
                    resetOnSuccess={['password', 'password_confirmation']}
                    className="space-y-4"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="email"
                                    className="font-semibold text-[#263c53]"
                                >
                                    Email address
                                </Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={email}
                                    readOnly
                                    autoComplete="email"
                                    className={authInputClass}
                                />
                                <InputError message={errors.email} />
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="password"
                                    className="font-semibold text-[#263c53]"
                                >
                                    New password
                                </Label>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    autoFocus
                                    autoComplete="new-password"
                                    placeholder="Enter new password"
                                    passwordrules={passwordRules}
                                    className={authInputClass}
                                    aria-invalid={!!errors.password}
                                />
                                <InputError message={errors.password} />
                                <p className="text-xs leading-5 text-[#738398]">
                                    Use at least 12 characters with uppercase
                                    and lowercase letters, numbers and symbols
                                    in production.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label
                                    htmlFor="password_confirmation"
                                    className="font-semibold text-[#263c53]"
                                >
                                    Confirm password
                                </Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    required
                                    autoComplete="new-password"
                                    placeholder="Repeat new password"
                                    passwordrules={passwordRules}
                                    className={authInputClass}
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>
                            <Button
                                type="submit"
                                className={authButtonClass}
                                disabled={processing}
                                data-test="reset-password-button"
                            >
                                {processing ? (
                                    <Spinner />
                                ) : (
                                    <LockKeyhole className="size-4" />
                                )}
                                {processing
                                    ? 'Resetting password…'
                                    : 'Reset password'}
                            </Button>
                        </>
                    )}
                </Form>
                <div className="mt-5 flex flex-wrap justify-between gap-3 text-sm font-semibold text-[#965027]">
                    <Link
                        href={login().url}
                        className="inline-flex items-center gap-2 hover:underline"
                    >
                        <ArrowLeft className="size-4" /> Back to sign in
                    </Link>
                    <Link href={request().url} className="hover:underline">
                        Request a new link
                    </Link>
                </div>
            </AuthShell>
        </>
    );
}

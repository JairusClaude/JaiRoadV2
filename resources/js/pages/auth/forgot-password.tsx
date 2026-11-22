import { Form, Head, Link } from '@inertiajs/react';
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import AuthShell, {
    authButtonClass,
    authInputClass,
} from '@/components/jairoads/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { email } from '@/routes/password';

export default function ForgotPassword({ status }: { status?: string }) {
    return (
        <>
            <Head title="Forgot password · JaiROADS" />
            <AuthShell
                eyebrow="Account recovery"
                title="Forgot your password?"
                description="Enter the email address linked to your JaiROADS account. We’ll send a secure link to reset your password."
            >
                {status && (
                    <div
                        role="status"
                        className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
                    >
                        <strong>Check your email</strong>
                        <p className="mt-1">{status}</p>
                        <p className="mt-1">
                            Check your spam or junk folder too. The link expires
                            in 60 minutes.
                        </p>
                    </div>
                )}
                <Form {...email.form()} className="space-y-5">
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
                                    required
                                    autoComplete="email"
                                    autoFocus
                                    placeholder="you@example.com"
                                    className={authInputClass}
                                    aria-invalid={!!errors.email}
                                />
                                <InputError message={errors.email} />
                            </div>
                            <Button
                                type="submit"
                                className={authButtonClass}
                                disabled={processing}
                                data-test="email-password-reset-link-button"
                            >
                                {processing ? (
                                    <Spinner />
                                ) : (
                                    <Mail className="size-4" />
                                )}
                                {processing
                                    ? 'Sending reset link…'
                                    : 'Email password reset link'}
                            </Button>
                        </>
                    )}
                </Form>
                <div className="jr-recovery-note">
                    <ShieldCheck className="size-5 shrink-0" />
                    <p>
                        Never share your reset link or password. If you no
                        longer have access to your email, contact your system
                        administrator.
                    </p>
                </div>
                <Link
                    href={login().url}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#965027] hover:underline"
                >
                    <ArrowLeft className="size-4" /> Back to sign in
                </Link>
            </AuthShell>
        </>
    );
}

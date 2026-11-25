import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import AuthShell, { authButtonClass, authInputClass } from '@/components/jairoads/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PasswordInput from '@/components/password-input';
import { recoveryRequest } from '@/lib/internal-recovery';

export default function ForgotPassword() {
    const [mode, setMode] = useState<'request' | 'redeem' | 'done'>('request');
    const [identifier, setIdentifier] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || mode === 'done') return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            if (mode === 'request') {
                const result = await recoveryRequest<{ message: string }>('/internal-recovery/request', { identifier: identifier.trim() });
                setNotice(result.message);
                setMode('redeem');
            } else {
                const result = await recoveryRequest<{ message: string }>('/internal-recovery/redeem', {
                    identifier: identifier.trim(), code, password, password_confirmation: confirmation,
                });
                setNotice(result.message);
                setMode('done');
            }
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Recovery unavailable.');
        } finally {
            setCode('');
            setPassword('');
            setConfirmation('');
            setBusy(false);
        }
    }

    return (
        <>
            <Head title="Account recovery · JaiROADS" />
            <AuthShell eyebrow="Secure account recovery" title={mode === 'done' ? 'Password updated' : 'Forgot your password?'}
                description="Recover access through your SuperAdmin. No email or SMS delivery is required.">
                {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
                {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
                {mode !== 'done' && (
                    <>
                        <div className="mb-5 grid grid-cols-2 gap-2">
                            <Button type="button" variant={mode === 'request' ? 'default' : 'outline'} disabled={busy} aria-pressed={mode === 'request'} onClick={() => { setMode('request'); setError(''); }}>Request code</Button>
                            <Button type="button" variant={mode === 'redeem' ? 'default' : 'outline'} disabled={busy} aria-pressed={mode === 'redeem'} onClick={() => { setMode('redeem'); setError(''); }}>I have a code</Button>
                        </div>
                        <form className="space-y-4" onSubmit={submit}>
                            <div className="space-y-2">
                                <Label htmlFor="recovery-identifier">Username or registered email</Label>
                                <Input id="recovery-identifier" required maxLength={255} autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} disabled={busy} className={authInputClass} />
                            </div>
                            {mode === 'redeem' && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="recovery-code">One-time recovery code</Label>
                                        <Input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))} disabled={busy} className={authInputClass} />
                                        <p className="jr-login-help text-xs">Get this code directly from your SuperAdmin after identity verification. It expires 10 minutes after approval.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="recovery-password">New password</Label>
                                        <PasswordInput id="recovery-password" required autoComplete="new-password" minLength={12} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} className={authInputClass} />
                                        <p className="jr-login-help text-xs">At least 12 characters, upper and lowercase letters, numbers and symbols.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="recovery-confirmation">Confirm new password</Label>
                                        <PasswordInput id="recovery-confirmation" required autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy} className={authInputClass} />
                                    </div>
                                </>
                            )}
                            <Button type="submit" className={authButtonClass} disabled={busy || (mode === 'redeem' && (code.length !== 6 || password !== confirmation))}>
                                {busy ? 'Processing…' : mode === 'request' ? 'Submit recovery request' : 'Reset my password'}
                            </Button>
                        </form>
                    </>
                )}
                <div className="jr-recovery-note"><ShieldCheck className="size-5 shrink-0" /><p>Never share your password. SuperAdmin accounts follow the separate approved owner recovery procedure.</p></div>
                <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#965027] hover:underline"><ArrowLeft className="size-4" /> Back to sign in</Link>
            </AuthShell>
        </>
    );
}

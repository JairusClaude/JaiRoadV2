import { KeyRound, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { recoveryRequest } from '@/lib/internal-recovery';

type RecoveryRow = { id: number; username: string; email: string; account_type: string; requested_at: string };

export default function InternalRecoveryQueue() {
    const [rows, setRows] = useState<RecoveryRow[]>([]);
    const [expanded, setExpanded] = useState(false);
    const [selected, setSelected] = useState<RecoveryRow | null>(null);
    const [password, setPassword] = useState('');
    const [verified, setVerified] = useState(false);
    const [issued, setIssued] = useState<{ username: string; code: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [loadError, setLoadError] = useState('');
    const refresh = useCallback(async () => {
        try {
            const result = await recoveryRequest<{ requests: RecoveryRow[] }>('/dd-phase3/password-recovery/requests');
            setRows(result.requests);
            setLoadError('');
        } catch (cause) {
            setLoadError(cause instanceof Error ? cause.message : 'Recovery queue unavailable.');
        }
    }, []);
    useEffect(() => {
        void refresh();
        const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
        return () => window.clearInterval(timer);
    }, [refresh]);
    useEffect(() => {
        if (!issued) return;
        const timer = window.setTimeout(() => setIssued(null), 600000);
        return () => window.clearTimeout(timer);
    }, [issued]);
    async function approve(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selected || !verified || busy) return;
        setBusy(true);
        setError('');
        try {
            const result = await recoveryRequest<{ code: string }>('/dd-phase3/password-recovery/requests/' + selected.id + '/approve', { current_password: password, identity_verified: verified });
            setIssued({ username: selected.username, code: result.code });
            setSelected(null);
            setVerified(false);
            await refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Approval unavailable.');
        } finally {
            setPassword('');
            setBusy(false);
        }
    }
    return (
        <section className="um-directory" aria-label="Password recovery requests">
            <div className="um-directory-head">
                <div>
                    <h2 className="flex items-center gap-2"><KeyRound size={18} /> Password recovery requests</h2>
                    <p>{loadError ? 'Recovery queue unavailable' : rows.length + (rows.length === 100 ? '+' : '') + ' pending request(s)'} · Verify identity before issuing a code.</p>
                </div>
                <div className="um-header-actions">
                    <button type="button" className="um-secondary" onClick={() => void refresh()} aria-label="Refresh recovery requests"><RefreshCw size={16} /> Refresh</button>
                    <button type="button" className="um-primary" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); setIssued(null); setSelected(null); setPassword(''); setVerified(false); setError(''); }}>{expanded ? 'Close requests' : 'View requests'}</button>
                </div>
            </div>
            {expanded && (
                <div className="space-y-4 p-4 sm:p-5">
                    {loadError && <p role="alert" className="um-error">{loadError}</p>}
                    {error && <p role="alert" className="um-error">{error}</p>}
                    {issued && (
                        <div className="rounded-xl border border-violet-300 bg-violet-50 p-4 text-violet-950 dark:bg-violet-950 dark:text-violet-100">
                            <strong>One-time code for {issued.username}</strong>
                            <p className="my-3 text-3xl font-bold tracking-widest tabular-nums" aria-label="Issued recovery code">{issued.code}</p>
                            <p className="text-sm">Share privately with the verified account holder. Expires 10 minutes after approval. It cannot be retrieved again after closing this display.</p>
                            <button type="button" className="um-secondary mt-3" onClick={() => setIssued(null)}>Hide code</button>
                        </div>
                    )}
                    {selected && (
                        <form className="um-form rounded-xl border p-4" onSubmit={approve}>
                            <strong>Approve request for {selected.username} ({selected.email})</strong>
                            <p>Confirm the person through a trusted workplace process. Do not rely on the email or username alone.</p>
                            <label className="flex items-start gap-2"><input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} required disabled={busy} /> I have independently verified the account holder's identity.</label>
                            <label className="um-field">Your SuperAdmin password<input className="um-input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} /></label>
                            <div className="flex flex-wrap gap-2">
                                <button className="um-primary" type="submit" disabled={busy || !verified || !password}>{busy ? 'Approving…' : 'Approve and generate code'}</button>
                                <button className="um-secondary" type="button" disabled={busy} onClick={() => { setSelected(null); setPassword(''); setVerified(false); setError(''); }}>Cancel</button>
                            </div>
                        </form>
                    )}
                    {!rows.length && !loadError && <p className="um-muted">No pending password recovery requests.</p>}
                    {rows.length > 0 && <div className="um-table-scroll"><table className="um-table"><thead><tr><th>Account</th><th>Type</th><th>Requested</th><th>Action</th></tr></thead><tbody>
                        {rows.map((row) => <tr key={row.id}><td><strong>{row.username}</strong><small>{row.email}</small></td><td>{row.account_type}</td><td>{row.requested_at}</td><td><button type="button" className="um-secondary" disabled={busy} onClick={() => { setSelected(row); setIssued(null); setPassword(''); setVerified(false); setError(''); }}>Review request</button></td></tr>)}
                    </tbody></table></div>}
                </div>
            )}
        </section>
    );
}

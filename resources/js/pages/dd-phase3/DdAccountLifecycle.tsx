import { router } from '@inertiajs/react';
import { KeyRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import AccountTypeBadge from '@/components/user-management/account-type-badge';

type Account = {
    id: number;
    username: string;
    email: string;
    account_type: string;
    engineer_id: number | null;
    is_active: boolean;
};
type Details = {
    account: Account;
    can_reset_password: boolean;
    password_reset_blocker?: string | null;
    engineer: {
        first_name: string;
        last_name: string;
        rank: string;
        engineer_status: string;
    } | null;
};
export default function DdAccountLifecycle({
    accounts,
    actorId,
    initialAccountId,
    onBusy,
}: {
    accounts: Account[];
    actorId: number;
    initialAccountId?: number;
    onBusy?: (busy: boolean) => void;
}) {
    const [detail, setDetail] = useState<Details | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const sequence = useRef(0);
    const [resetOpen, setResetOpen] = useState(false);
    const [credentials, setCredentials] = useState({
        current_password: '',
        password: '',
        password_confirmation: '',
    });
    const clearReset = () => {
        setCredentials({
            current_password: '',
            password: '',
            password_confirmation: '',
        });
        setResetOpen(false);
    };
    async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!detail?.can_reset_password || busy) {
            return;
        }

        setBusy(true);
        onBusy?.(true);
        setErrors({});
        setNotice('');

        try {
            const cookie = document.cookie
                .split('; ')
                .find((value) => value.startsWith('XSRF-TOKEN='));

            if (!cookie) {
                throw new Error(
                    'Session verification is unavailable. Refresh the page and try again.',
                );
            }

            const response = await fetch(
                `/dd-phase3/accounts/${detail.account.id}/password-reset`,
                {
                    method: 'POST',
                    credentials: 'same-origin',
                    cache: 'no-store',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)),
                    },
                    body: JSON.stringify(credentials),
                },
            );
            const data = await response.json();

            if (!response.ok) {
                const messages = Object.fromEntries(
                    Object.entries(data.errors ?? {}).map(([key, value]) => [
                        key,
                        Array.isArray(value) ? String(value[0]) : String(value),
                    ]),
                );
                setErrors(
                    Object.keys(messages).length
                        ? messages
                        : {
                              password:
                                  response.status === 429
                                      ? 'Too many attempts. Please try again in a minute.'
                                      : 'Password reset was not confirmed. Check your permissions and try again.',
                          },
                );

                return;
            }

            clearReset();
            setNotice(
                'Password reset successfully. Sign in to the selected account with its new password. Existing reset links and remember-me cookies have been invalidated.',
            );
        } catch {
            setErrors({
                password:
                    'Password reset could not be confirmed. Refresh and check before retrying.',
            });
        } finally {
            setCredentials({
                current_password: '',
                password: '',
                password_confirmation: '',
            });
            setBusy(false);
            onBusy?.(false);
        }
    }
    const load = useCallback(async (id: string) => {
        const current = ++sequence.current;
        setDetail(null);
        setErrors({});
        setNotice('');
        setResetOpen(false);
        setCredentials({
            current_password: '',
            password: '',
            password_confirmation: '',
        });

        if (!id) {
            return;
        }

        try {
            const response = await fetch(`/dd-phase3/accounts/${id}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error('Account details are unavailable.');
            }

            const data = (await response.json()) as Details;

            if (current === sequence.current) {
                setDetail(data);
            }
        } catch {
            if (current === sequence.current) {
                setErrors({ details: 'Account details are unavailable.' });
            }
        }
    }, []);
    useEffect(() => {
        const generation = sequence.current;
        // Account detail loading is asynchronous. Avoid synchronously calling
        // setState during the React effect setup phase.
        void Promise.resolve().then(() => {
            if (initialAccountId !== undefined && sequence.current === generation) {
                void load(String(initialAccountId));
            }
        });

        const sequenceRef = sequence;
        return () => {
            sequenceRef.current++;
        };
    }, [initialAccountId, load]);

    return (
        <section aria-label="UserAccount lifecycle" className="space-y-4">
            <h2 className="text-lg font-semibold">
                Account details and access
            </h2>
            {initialAccountId === undefined && (
                <label className="block text-sm">
                    Account to manage
                    <select
                        className="mt-1 block rounded border p-2"
                        disabled={busy}
                        defaultValue=""
                        onChange={(e) => void load(e.target.value)}
                    >
                        <option value="">Select account</option>
                        {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.username} · {a.account_type}
                            </option>
                        ))}
                    </select>
                </label>
            )}
            {!detail &&
                !Object.keys(errors).length &&
                initialAccountId !== undefined && (
                    <p role="status" className="text-sm text-slate-500">
                        Loading account details…
                    </p>
                )}
            {detail && (
                <div className="space-y-3">
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                            <dt>Username</dt>
                            <dd>{detail.account.username}</dd>
                        </div>
                        <div>
                            <dt>Email</dt>
                            <dd>{detail.account.email}</dd>
                        </div>
                        <div>
                            <dt>Account Type</dt>
                            <dd>
                                <AccountTypeBadge
                                    role={detail.account.account_type}
                                />
                            </dd>
                        </div>
                        <div>
                            <dt>Access</dt>
                            <dd>
                                {detail.account.is_active
                                    ? 'Active'
                                    : 'Inactive'}
                            </dd>
                        </div>
                        <div>
                            <dt>Linked Engineer</dt>
                            <dd>
                                {detail.engineer
                                    ? `${detail.engineer.first_name} ${detail.engineer.last_name} · ${detail.engineer.rank} · ${detail.engineer.engineer_status}`
                                    : 'No linked profile'}
                            </dd>
                        </div>
                    </dl>
                    <p className="text-sm text-slate-600">
                        Deactivation retains the account and its historical
                        records. Reactivation requires eligible identity links.
                        Account Type cannot be changed here.
                    </p>
                    <button
                        className={
                            detail.account.is_active
                                ? 'um-danger'
                                : 'um-primary'
                        }
                        disabled={
                            busy ||
                            (detail.account.id === actorId &&
                                detail.account.is_active)
                        }
                        onClick={() => {
                            const active = !detail.account.is_active;

                            if (
                                window.confirm(
                                    `${active ? 'Reactivate' : 'Deactivate'} ${detail.account.username}? Historical records and passwords will be retained.`,
                                )
                            ) {
                                setBusy(true);
                                onBusy?.(true);
                                setErrors({});
                                router.patch(
                                    `/dd-phase3/accounts/${detail.account.id}/status`,
                                    { is_active: active },
                                    {
                                        preserveScroll: true,
                                        onError: setErrors,
                                        onSuccess: () => {
                                            void load(
                                                String(detail.account.id),
                                            ).then(() =>
                                                setNotice(
                                                    'Account status saved.',
                                                ),
                                            );
                                        },
                                        onFinish: () => {
                                            setBusy(false);
                                            onBusy?.(false);
                                        },
                                    },
                                );
                            }
                        }}
                    >
                        {detail.account.is_active
                            ? 'Deactivate account'
                            : 'Reactivate account'}
                    </button>
                    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <KeyRound className="size-4" /> Password recovery
                        </div>
                        <p className="text-sm text-slate-600">
                            Set a new password for this account without sending
                            an email. Existing sign-in sessions are revoked;
                            registered passkeys and two-factor authentication
                            are unchanged.
                        </p>
                        {!detail.can_reset_password && (
                            <p role="status" className="um-form-note">
                                {detail.password_reset_blocker ||
                                    'Password recovery eligibility is unavailable. Refresh the page and check that the latest backend has been deployed.'}
                            </p>
                        )}
                        {!resetOpen || !detail.can_reset_password ? (
                            <button
                                type="button"
                                className="um-primary"
                                disabled={busy || !detail.can_reset_password}
                                onClick={() => {
                                    setErrors({});
                                    setNotice('');
                                    setResetOpen(true);
                                }}
                            >
                                {' '}
                                <KeyRound className="size-4" /> Reset Password
                            </button>
                        ) : (
                            <form className="um-form" onSubmit={resetPassword}>
                                <p className="um-form-note">
                                    Resetting password for{' '}
                                    <strong>{detail.account.username}</strong> (
                                    {detail.account.email}). Confirm your own
                                    SuperAdmin password before continuing.
                                </p>
                                <label className="um-field">
                                    Your SuperAdmin password{' '}
                                    <span className="um-required">*</span>
                                    <input
                                        className="um-input"
                                        type="password"
                                        required
                                        autoComplete="current-password"
                                        disabled={busy}
                                        value={credentials.current_password}
                                        onChange={(e) =>
                                            setCredentials((old) => ({
                                                ...old,
                                                current_password:
                                                    e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <label className="um-field">
                                    New password{' '}
                                    <span className="um-required">*</span>
                                    <input
                                        className="um-input"
                                        type="password"
                                        required
                                        minLength={12}
                                        maxLength={72}
                                        autoComplete="new-password"
                                        disabled={busy}
                                        value={credentials.password}
                                        onChange={(e) =>
                                            setCredentials((old) => ({
                                                ...old,
                                                password: e.target.value,
                                            }))
                                        }
                                    />
                                    <small>
                                        At least 12 characters, with uppercase,
                                        lowercase, a number and a symbol.
                                    </small>
                                </label>
                                <label className="um-field">
                                    Confirm new password{' '}
                                    <span className="um-required">*</span>
                                    <input
                                        className="um-input"
                                        type="password"
                                        required
                                        autoComplete="new-password"
                                        disabled={busy}
                                        value={
                                            credentials.password_confirmation
                                        }
                                        onChange={(e) =>
                                            setCredentials((old) => ({
                                                ...old,
                                                password_confirmation:
                                                    e.target.value,
                                            }))
                                        }
                                    />
                                </label>
                                <div className="um-dialog-actions">
                                    <button
                                        type="button"
                                        className="um-secondary"
                                        disabled={busy}
                                        onClick={() => {
                                            clearReset();
                                            setErrors({});
                                        }}
                                    >
                                        Cancel reset
                                    </button>
                                    <button
                                        type="submit"
                                        className="um-primary"
                                        disabled={
                                            busy ||
                                            !credentials.current_password ||
                                            credentials.password.length < 12 ||
                                            credentials.password !==
                                                credentials.password_confirmation
                                        }
                                    >
                                        {busy
                                            ? 'Resetting…'
                                            : 'Save new password'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                    {detail.account.id === actorId && (
                        <p className="text-sm text-slate-600">
                            Your own account cannot be deactivated here.
                        </p>
                    )}
                </div>
            )}
            {Object.entries(errors).map(([key, error]) => (
                <p key={key} role="alert" className="text-sm text-red-700">
                    {error}
                </p>
            ))}
            {notice && <p role="status">{notice}</p>}
        </section>
    );
}

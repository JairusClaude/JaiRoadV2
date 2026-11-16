import { router } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

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
    const load = useCallback(async (id: string) => {
        const current = ++sequence.current;
        setDetail(null);
        setErrors({});
        setNotice('');

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
        if (initialAccountId !== undefined) void load(String(initialAccountId));
        return () => { sequence.current++; };
    }, [initialAccountId, load]);

    return (
        <section
            aria-label="UserAccount lifecycle"
            className="space-y-4"
        >
            <h2 className="text-lg font-semibold">
                Account details and access
            </h2>
            {initialAccountId === undefined && <label className="block text-sm">
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
            </label>}
            {!detail && !Object.keys(errors).length && initialAccountId !== undefined && <p role="status" className="text-sm text-slate-500">Loading account details…</p>}
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
                            <dd>{detail.account.account_type}</dd>
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
                        Account Type and passwords cannot be changed here.
                    </p>
                    <button
                        className={detail.account.is_active ? 'um-danger' : 'um-primary'}
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
                                            setDetail({
                                                ...detail,
                                                account: {
                                                    ...detail.account,
                                                    is_active: active,
                                                },
                                            });
                                            setNotice('Account status saved.');
                                        },
                                        onFinish: () => { setBusy(false); onBusy?.(false); },
                                    },
                                );
                            }
                        }}
                    >
                        {detail.account.is_active
                            ? 'Deactivate account'
                            : 'Reactivate account'}
                    </button>
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

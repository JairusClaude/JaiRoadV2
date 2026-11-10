import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';

const initial = {
    account_type: '',
    username: '',
    email: '',
    name: '',
    password: '',
    password_confirmation: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    contact_no: '',
    rank: '',
};
type Field = keyof typeof initial;
const profileFields: Field[] = [
    'first_name',
    'middle_name',
    'last_name',
    'contact_no',
    'rank',
];
const inputStyle =
    'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';

export default function CanonicalAccountCreationForm({
    roles,
}: {
    roles: string[];
}) {
    const form = useForm(initial);
    const permitted = roles.filter((role) =>
        ['Admin', 'Engineer', 'Viewer'].includes(role),
    );
    const selected = permitted.includes(form.data.account_type);
    const professional = ['Admin', 'Engineer'].includes(form.data.account_type);
    const fields: [Field, string, string, boolean][] = [
        ['username', 'Username', 'text', true],
        ['email', 'Login email', 'email', true],
        ...(professional
            ? ([
                  ['first_name', 'First name', 'text', true],
                  ['middle_name', 'Middle name (optional)', 'text', false],
                  ['last_name', 'Last name', 'text', true],
                  ['contact_no', 'Contact number', 'tel', true],
                  ['rank', 'Rank', 'text', true],
              ] as [Field, string, string, boolean][])
            : ([['name', 'Display name', 'text', true]] as [
                  Field,
                  string,
                  string,
                  boolean,
              ][])),
        ['password', 'Password', 'password', true],
        ['password_confirmation', 'Confirm password', 'password', true],
    ];
    const incomplete = fields.some(
        ([key, , , required]) => required && !form.data[key].trim(),
    );
    function submit(event: FormEvent) {
        event.preventDefault();

        if (!selected || incomplete || form.processing) {
            return;
        }

        form.transform((data) => {
            const common = {
                account_type: data.account_type,
                username: data.username,
                email: data.email,
                password: data.password,
                password_confirmation: data.password_confirmation,
            };

            return professional
                ? {
                      ...common,
                      first_name: data.first_name,
                      middle_name: data.middle_name,
                      last_name: data.last_name,
                      contact_no: data.contact_no,
                      rank: data.rank,
                  }
                : { ...common, name: data.name };
        });
        form.post('/dd-phase3/accounts', {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    }

    return (
        <form
            onSubmit={submit}
            className="mt-5 grid gap-4 sm:grid-cols-2"
            aria-label="Create canonical account"
        >
            <label
                className="text-xs font-semibold text-slate-600 sm:col-span-2"
                htmlFor="new-account-type"
            >
                Account Type
                <select
                    id="new-account-type"
                    className={inputStyle}
                    value={form.data.account_type}
                    required
                    disabled={form.processing}
                    onChange={(event) => {
                        form.setData({
                            ...form.data,
                            account_type: event.target.value,
                            name: '',
                            first_name: '',
                            middle_name: '',
                            last_name: '',
                            contact_no: '',
                            rank: '',
                        });
                        form.clearErrors(
                            'account_type',
                            'name',
                            ...profileFields,
                        );
                    }}
                >
                    <option value="">Select Account Type first</option>
                    {permitted.map((role) => (
                        <option key={role} value={role}>
                            {role}
                        </option>
                    ))}
                </select>
                {form.errors.account_type && (
                    <span
                        role="alert"
                        className="mt-1 block text-xs text-red-700"
                    >
                        {form.errors.account_type}
                    </span>
                )}
            </label>
            {selected && (
                <>
                    <p className="text-sm text-slate-600 sm:col-span-2">
                        {professional
                            ? 'An active Engineer profile will be created and linked with this account. Assign an LGU afterward through EngineerLGU management.'
                            : 'Viewer accounts have no Engineer profile and remain read-only.'}
                    </p>
                    {fields.map(([key, label, type, required]) => (
                        <label
                            key={key}
                            htmlFor={`new-account-${key}`}
                            className="block text-xs font-semibold text-slate-600"
                        >
                            {label}
                            <input
                                id={`new-account-${key}`}
                                name={key}
                                type={type}
                                required={required}
                                className={inputStyle}
                                value={form.data[key]}
                                disabled={form.processing}
                                autoComplete={
                                    type === 'password' ? 'new-password' : 'off'
                                }
                                maxLength={
                                    key === 'username' ||
                                    profileFields.includes(key)
                                        ? key === 'contact_no'
                                            ? 30
                                            : 100
                                        : key === 'name' || key === 'email'
                                          ? 255
                                          : undefined
                                }
                                onChange={(event) =>
                                    form.setData(key, event.target.value)
                                }
                            />
                            {form.errors[key] && (
                                <span
                                    role="alert"
                                    className="mt-1 block text-xs text-red-700"
                                >
                                    {form.errors[key]}
                                </span>
                            )}
                        </label>
                    ))}
                    <p className="text-xs text-slate-500 sm:col-span-2">
                        Use at least 12 password characters with upper/lowercase
                        letters, numbers, and symbols. Username and login email
                        must be unique.
                    </p>
                    <div className="flex flex-wrap gap-3 sm:col-span-2">
                        <button
                            type="submit"
                            disabled={form.processing || incomplete}
                            className="rounded-xl bg-[#90451f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#773917] disabled:opacity-50"
                        >
                            {form.processing
                                ? 'Creating account…'
                                : 'Create account'}
                        </button>
                        <button
                            type="button"
                            disabled={form.processing}
                            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => {
                                form.reset();
                                form.clearErrors();
                            }}
                        >
                            Reset form
                        </button>
                    </div>
                </>
            )}
        </form>
    );
}

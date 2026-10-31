import { Form, Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Mail, Save, UserRound } from 'lucide-react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import InputError from '@/components/input-error';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import type { Auth } from '@/types';

type PageProps = { auth: Auth };
const inputClass =
    'mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
const labelClass =
    'block text-sm font-semibold text-slate-700 dark:text-slate-200';

/** Reuses Laravel's authenticated profile update route; no UserAccount/Engineer writes. */
export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { auth } = usePage<PageProps>().props;

    return (
        <ProjectWorkspace>
            <Head title="Edit profile · JaiROADS" />
            <div className="jr-settings mx-auto max-w-4xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                            Edit Profile
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Update your JaiROADS sign-in name and email.
                        </p>
                    </div>
                    <Link
                        href="/settings-preview"
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        <ArrowLeft className="size-4" /> Back to Settings
                    </Link>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-6 flex items-start gap-3 border-b border-slate-200 pb-5 dark:border-slate-700">
                        <span className="rounded-xl bg-amber-100 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            <UserRound className="size-5" />
                        </span>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                Personal information
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                Changes to your operational role, Engineer
                                profile, or LGU assignment remain
                                administrator-managed.
                            </p>
                        </div>
                    </div>
                    <Form
                        {...ProfileController.update.form()}
                        options={{ preserveScroll: true }}
                        className="max-w-2xl space-y-5"
                    >
                        {({ processing, errors, recentlySuccessful }) => (
                            <>
                                <div>
                                    <label
                                        className={labelClass}
                                        htmlFor="jr-profile-name"
                                    >
                                        Full name
                                    </label>
                                    <input
                                        id="jr-profile-name"
                                        name="name"
                                        required
                                        autoComplete="name"
                                        maxLength={255}
                                        defaultValue={auth.user.name}
                                        className={inputClass}
                                    />
                                    <InputError message={errors.name} />
                                </div>
                                <div>
                                    <label
                                        className={labelClass}
                                        htmlFor="jr-profile-email"
                                    >
                                        Login email address
                                    </label>
                                    <div className="relative">
                                        <Mail className="pointer-events-none absolute top-[22px] left-3 size-4 text-slate-400" />
                                        <input
                                            id="jr-profile-email"
                                            type="email"
                                            name="email"
                                            required
                                            autoComplete="email"
                                            maxLength={255}
                                            defaultValue={auth.user.email}
                                            className={`${inputClass} pl-10`}
                                        />
                                    </div>
                                    <InputError message={errors.email} />
                                </div>
                                {mustVerifyEmail &&
                                    auth.user.email_verified_at === null && (
                                        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                                            Your login email has not been
                                            verified. Changing your email may
                                            require verification before some
                                            security actions are available.
                                        </p>
                                    )}
                                {status === 'verification-link-sent' && (
                                    <p
                                        role="status"
                                        className="text-sm text-emerald-700 dark:text-emerald-300"
                                    >
                                        Verification email requested. Check your
                                        mailbox or your configured mail
                                        delivery.
                                    </p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#90451F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#773917] disabled:opacity-60 dark:bg-amber-700 dark:hover:bg-amber-600"
                                    >
                                        <Save className="size-4" />
                                        {processing
                                            ? 'Saving…'
                                            : 'Save changes'}
                                    </button>
                                    {recentlySuccessful && (
                                        <span
                                            role="status"
                                            className="text-sm font-semibold text-emerald-700 dark:text-emerald-300"
                                        >
                                            Profile updated successfully.
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </Form>
                </div>
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Profile updates modify only your authenticated Laravel
                    sign-in record. They do not change your operational JaiROADS
                    account role, Engineer identity, or the shared database
                    schema.
                </p>
            </div>
        </ProjectWorkspace>
    );
}

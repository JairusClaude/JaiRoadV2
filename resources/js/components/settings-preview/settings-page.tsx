import { Link } from '@inertiajs/react';
import {
    ArrowUpRight,
    Bell,
    ChevronRight,
    CircleHelp,
    Fingerprint,
    Info,
    LockKeyhole,
    Monitor,
    Moon,
    Palette,
    RefreshCw,
    ShieldCheck,
    Sun,
    UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ProjectWorkspace } from '@/components/maintenance-projects/project-workspace';
import { useJaiRoadsNotificationFeed } from '@/components/use-jairoads-notification-feed';
import { useAppearance } from '@/hooks/use-appearance';
import type { Appearance } from '@/hooks/use-appearance';

type Section =
    'profile' | 'security' | 'appearance' | 'notifications' | 'about';
type NullableLink = string | null;

export type SettingsPreviewProps = {
    account: {
        name: string;
        email: string;
        verified: boolean;
        joinedAt: string | null;
        username: string | null;
        accountType: string | null;
        active: boolean | null;
        engineerName: string | null;
        engineerPosition: string | null;
        municipality: string | null;
    };
    availableLinks: {
        profile: NullableLink;
        password: NullableLink;
        appearance: NullableLink;
        twoFactor: NullableLink;
        passkeys: NullableLink;
    };
};

const sections: { id: Section; title: string; icon: typeof UserRound }[] = [
    { id: 'profile', title: 'My Profile', icon: UserRound },
    { id: 'security', title: 'Account & Security', icon: ShieldCheck },
    { id: 'appearance', title: 'Appearance', icon: Palette },
    { id: 'notifications', title: 'Notifications', icon: Bell },
    { id: 'about', title: 'About JaiROADS', icon: Info },
];

const primary =
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#90451F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#773917] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:bg-amber-700 dark:hover:bg-amber-600';
const secondary =
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';
const infoPanel =
    'rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70';

function Heading({
    title,
    subtitle,
    action,
}: {
    title: string;
    subtitle: string;
    action?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {title}
                </h2>
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {subtitle}
                </p>
            </div>
            {action}
        </div>
    );
}
function Value({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0 space-y-1 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
            <dt className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </dt>
            <dd className="text-sm font-medium break-words text-slate-800 dark:text-slate-100">
                {children}
            </dd>
        </div>
    );
}
function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
    return (
        <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'}`}
        >
            <span
                className={`size-1.5 rounded-full ${ok ? 'bg-emerald-600' : 'bg-orange-600'}`}
            />
            {children}
        </span>
    );
}
function GoTo({
    href,
    children,
    important = false,
}: {
    href: NullableLink;
    children: ReactNode;
    important?: boolean;
}) {
    if (!href) {
        return (
            <span className="text-xs text-slate-500 dark:text-slate-400">
                Not enabled for this application
            </span>
        );
    }

    return (
        <Link href={href} className={important ? primary : secondary}>
            {children}
            <ArrowUpRight className="size-4" />
        </Link>
    );
}
function Feature({
    icon: Icon,
    title,
    details,
    href,
    button,
}: {
    icon: typeof UserRound;
    title: string;
    details: string;
    href: NullableLink;
    button: string;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 py-4 last:border-none dark:border-slate-700">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <Icon className="size-[19px]" />
                </span>
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {title}
                    </h3>
                    <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                        {details}
                    </p>
                </div>
            </div>
            <GoTo href={href}>{button}</GoTo>
        </div>
    );
}
function Profile({
    account,
    links,
}: {
    account: SettingsPreviewProps['account'];
    links: SettingsPreviewProps['availableLinks'];
}) {
    return (
        <div className="space-y-6">
            <Heading
                title="Personal information"
                subtitle="Your sign-in identity and linked JaiROADS operational account."
                action={
                    <GoTo href={links.profile} important>
                        Edit profile
                    </GoTo>
                }
            />
            <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-100 p-4 dark:bg-slate-800">
                <div
                    aria-hidden="true"
                    className="flex size-14 items-center justify-center rounded-xl bg-amber-100 font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                >
                    {account.name
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((v) => v[0]?.toUpperCase() ?? '')
                        .join('')}
                </div>
                <div className="min-w-0">
                    <p className="font-semibold break-words text-slate-900 dark:text-slate-100">
                        {account.name}
                    </p>
                    <p className="text-sm break-all text-slate-500 dark:text-slate-400">
                        {account.email}
                    </p>
                </div>
                <div className="ml-auto">
                    <Status ok={account.verified}>
                        {account.verified
                            ? 'Email verified'
                            : 'Email not verified'}
                    </Status>
                </div>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
                <Value label="Full name">{account.name}</Value>
                <Value label="Email address">{account.email}</Value>
                <Value label="Member since">
                    {account.joinedAt ?? 'Not available'}
                </Value>
                <Value label="Email verification">
                    <Status ok={account.verified}>
                        {account.verified ? 'Verified' : 'Pending verification'}
                    </Status>
                </Value>
            </dl>
            <div className="space-y-4 border-t border-slate-200 pt-6 dark:border-slate-700">
                <Heading
                    title="Operational account"
                    subtitle="Roles, account status, and Engineer assignments are controlled through User Management."
                />
                <dl className="grid gap-3 sm:grid-cols-2">
                    <Value label="Operational username">
                        {account.username ?? 'Not linked'}
                    </Value>
                    <Value label="Account type">
                        {account.accountType ?? 'Not linked'}
                    </Value>
                    <Value label="Account status">
                        {account.active === null ? (
                            'Not linked'
                        ) : (
                            <Status ok={account.active}>
                                {account.active ? 'Active' : 'Inactive'}
                            </Status>
                        )}
                    </Value>
                    <Value label="Linked Engineer">
                        {account.engineerName ?? 'Not assigned'}
                    </Value>
                    <Value label="Engineer position">
                        {account.engineerPosition ?? 'Not recorded'}
                    </Value>
                    <Value label="Engineer LGU reference">
                        {account.municipality ?? 'Not assigned'}
                    </Value>
                </dl>
            </div>
        </div>
    );
}
function Security({
    account,
    links,
}: {
    account: SettingsPreviewProps['account'];
    links: SettingsPreviewProps['availableLinks'];
}) {
    return (
        <div className="space-y-6">
            <Heading
                title="Account & security"
                subtitle="Manage your actual Laravel sign-in credentials and available account protection."
                action={
                    <GoTo href={links.password} important>
                        Open security settings
                    </GoTo>
                }
            />
            <div className={infoPanel}>
                <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                    <span>
                        {account.verified
                            ? 'Your login email is verified.'
                            : 'Your login email is not yet verified.'}{' '}
                        Password and sign-in security use your Laravel login
                        account. Do not change the separate legacy UserAccount
                        password here.
                    </span>
                </div>
            </div>
            <div>
                <Feature
                    icon={LockKeyhole}
                    title="Change password"
                    details="Open the protected Laravel form: current password, new password, and confirmation. This changes your actual login password."
                    href={
                        links.password ? `${links.password}?tab=password` : null
                    }
                    button="Change password"
                />
                <Feature
                    icon={Fingerprint}
                    title="Two-factor authentication"
                    details="Configure an authenticator and recovery codes if Fortify two-factor support is enabled."
                    href={
                        links.twoFactor
                            ? `${links.twoFactor}?tab=two-factor`
                            : null
                    }
                    button="Manage 2FA"
                />
                <Feature
                    icon={ShieldCheck}
                    title="Passkeys"
                    details="Register or manage passwordless sign-in only when Fortify passkey support is enabled."
                    href={
                        links.passkeys ? `${links.passkeys}?tab=passkeys` : null
                    }
                    button="Manage passkeys"
                />
            </div>
            <div className={infoPanel}>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                    These settings may ask you to confirm your password before
                    allowing access. Account roles, deactivation, and Engineer
                    assignments remain administrator-managed. Sign out through
                    the top-right account menu.
                </p>
            </div>
        </div>
    );
}

const modes: {
    id: Appearance;
    label: string;
    icon: typeof Sun;
    hint: string;
}[] = [
    {
        id: 'light',
        label: 'Light',
        icon: Sun,
        hint: 'Always use a light interface',
    },
    { id: 'dark', label: 'Dark', icon: Moon, hint: 'Use a darker interface' },
    {
        id: 'system',
        label: 'System',
        icon: Monitor,
        hint: 'Follow your device preference',
    },
];
function AppearancePanel() {
    const { appearance, updateAppearance } = useAppearance();
    const [showForm, setShowForm] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(() => {
        try {
            return (
                typeof window !== 'undefined' &&
                window.localStorage.getItem('jairoads-reduce-motion') === 'true'
            );
        } catch {
            return false;
        }
    });
    const saveMotion = (next: boolean) => {
        setReduceMotion(next);
        document.documentElement.classList.toggle('jr-reduce-motion', next);

        try {
            window.localStorage.setItem('jairoads-reduce-motion', String(next));
        } catch {
            /* Preference applies to this page even if storage is disabled. */
        }
    };

    return (
        <div className="space-y-6">
            <Heading
                title="Appearance"
                subtitle="Choose how JaiROADS looks on this device."
                action={
                    <button
                        type="button"
                        className={primary}
                        onClick={() => setShowForm((v) => !v)}
                        aria-expanded={showForm}
                        aria-controls="jairoads-appearance-form"
                    >
                        {showForm
                            ? 'Close appearance settings'
                            : 'Open appearance settings'}
                        <Palette className="size-4" />
                    </button>
                }
            />
            <div className={`flex items-start gap-4 ${infoPanel}`}>
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    <Monitor className="size-6" />
                </span>
                <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Current display preference
                    </h3>
                    <p className="mt-1 text-xl font-semibold text-amber-800 capitalize dark:text-amber-300">
                        {appearance}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Saved using the existing Laravel appearance preference.
                        System mode follows your operating system.
                    </p>
                </div>
            </div>
            {showForm && (
                <div
                    id="jairoads-appearance-form"
                    className="space-y-5 rounded-2xl border border-slate-200 p-5 dark:border-slate-700"
                >
                    <fieldset>
                        <legend className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Color theme
                        </legend>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {modes.map(({ id, label, icon: Icon, hint }) => (
                                <button
                                    key={id}
                                    type="button"
                                    aria-pressed={appearance === id}
                                    onClick={() => updateAppearance(id)}
                                    className={`min-h-32 rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${appearance === id ? 'border-amber-600 bg-amber-50 ring-1 ring-amber-600 dark:border-amber-400 dark:bg-amber-950 dark:ring-amber-400' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800'}`}
                                >
                                    <Icon className="mb-3 size-6 text-slate-700 dark:text-slate-200" />
                                    <span className="block font-semibold text-slate-900 dark:text-slate-100">
                                        {label} {appearance === id ? '✓' : ''}
                                    </span>
                                    <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                                        {hint}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    <div className="border-t border-slate-200 pt-5 dark:border-slate-700">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Accessibility
                        </h3>
                        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
                            <input
                                className="mt-1 size-4 accent-amber-700"
                                type="checkbox"
                                checked={reduceMotion}
                                onChange={(e) => saveMotion(e.target.checked)}
                            />
                            <span>
                                <strong className="block">
                                    Reduce interface animations
                                </strong>
                                <span className="mt-1 block text-slate-500 dark:text-slate-400">
                                    Minimize transitions and motion throughout
                                    JaiROADS on this browser.
                                </span>
                            </span>
                        </label>
                    </div>
                    <p
                        role="status"
                        className="text-xs text-slate-500 dark:text-slate-400"
                    >
                        Your theme choice is applied immediately and is stored
                        on this device; it does not change Supabase or other
                        users' preferences.
                    </p>
                </div>
            )}
        </div>
    );
}
function NotificationsPanel() {
    const { status, items, message, refresh } = useJaiRoadsNotificationFeed();
    useEffect(() => {
        void refresh();
    }, [refresh]);

    return (
        <div className="space-y-6">
            <Heading
                title="Notifications"
                subtitle="Read-only activity messages addressed specifically to your account."
                action={
                    <button
                        type="button"
                        className={secondary}
                        onClick={() => void refresh()}
                        disabled={status === 'loading'}
                    >
                        <RefreshCw
                            className={`size-4 ${status === 'loading' ? 'animate-spin' : ''}`}
                        />
                        Refresh
                    </button>
                }
            />
            <div className={infoPanel}>
                <div className="flex items-start gap-3">
                    <Bell className="mt-1 size-5 shrink-0 text-slate-600 dark:text-slate-200" />
                    <div>
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                            In-app activity notifications
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                            Eligible maintenance assignments and administrator
                            updates may appear here once their audit
                            notification triggers are implemented. No unread
                            badges, dismissal, or email delivery.
                        </p>
                    </div>
                </div>
            </div>
            <div
                className="rounded-xl border border-slate-200 p-5 dark:border-slate-700"
                aria-live="polite"
            >
                {status === 'loading' || status === 'idle' ? (
                    <p
                        role="status"
                        className="text-sm text-slate-600 dark:text-slate-300"
                    >
                        Loading notifications…
                    </p>
                ) : status === 'error' ? (
                    <div role="alert" className="space-y-3">
                        <p className="text-sm text-red-700 dark:text-red-300">
                            {message}
                        </p>
                        <button
                            type="button"
                            className={secondary}
                            onClick={() => void refresh()}
                        >
                            Try again
                        </button>
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-center text-sm text-slate-600 dark:text-slate-300">
                        No notifications yet.
                    </p>
                ) : (
                    <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="py-3 first:pt-0 last:pb-0"
                            >
                                <p className="text-sm break-words whitespace-pre-wrap text-slate-900 dark:text-slate-100">
                                    {item.notification_message}
                                </p>
                                <time className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                    {item.created_at}
                                </time>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <p className="flex gap-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                <CircleHelp className="mt-0.5 size-4 shrink-0" />
                Viewing a notification does not itself grant access to the
                underlying maintenance record. Notifications are never marked as
                read or deleted from this page.
            </p>
        </div>
    );
}
function AboutPanel() {
    return (
        <div className="space-y-6">
            <Heading
                title="About JaiROADS"
                subtitle="Road coverage, maintenance projects, and progress tracking in one workspace."
            />
            <div className={infoPanel}>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    JaiROADS · Road Management System
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Manage road coverage, maintenance projects, quarterly
                    maintenance records, progress updates, and formal documents.
                </p>
            </div>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                Account permissions are enforced on the Laravel server using
                your active operational UserAccount. Engineer operations
                additionally depend on their assigned Engineer and LGU where
                implemented.
            </p>
            <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                Formal maintenance documents are stored privately in Supabase
                Storage and linked to Maintenance Records when upload
                integration is configured.
            </p>
        </div>
    );
}
export default function SettingsPage({
    account,
    availableLinks,
}: SettingsPreviewProps) {
    const [activeSection, setActiveSection] = useState<Section>('profile');
    const active = sections.find((s) => s.id === activeSection) ?? sections[0];

    return (
        <ProjectWorkspace>
            <div className="jr-settings space-y-6">
                <div className="jr-page-head">
                    <div>
                        <h1>Settings</h1>
                        <p>
                            Manage your profile, account security, and
                            application preferences.
                        </p>
                    </div>
                </div>
                <div className="grid gap-6 lg:grid-cols-[252px_minmax(0,1fr)]">
                    <nav
                        aria-label="Settings sections"
                        className="lg:border-r lg:border-slate-200 lg:pr-5 dark:lg:border-slate-700"
                    >
                        <p className="mb-3 px-3 text-[11px] font-semibold tracking-widest text-slate-500 uppercase dark:text-slate-400">
                            Personal settings
                        </p>
                        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
                            {sections.map(({ id, title, icon: Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    aria-current={
                                        activeSection === id
                                            ? 'page'
                                            : undefined
                                    }
                                    onClick={() => setActiveSection(id)}
                                    className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${activeSection === id ? 'bg-orange-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                                >
                                    <span className="flex min-w-0 items-center gap-2.5">
                                        <Icon className="size-[18px] shrink-0" />
                                        <span className="truncate">
                                            {title}
                                        </span>
                                    </span>
                                    {activeSection === id && (
                                        <ChevronRight className="hidden size-4 lg:block" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </nav>
                    <section
                        aria-label={active.title}
                        className="min-w-0 pb-2 lg:pl-1"
                    >
                        {activeSection === 'profile' && (
                            <Profile account={account} links={availableLinks} />
                        )}
                        {activeSection === 'security' && (
                            <Security
                                account={account}
                                links={availableLinks}
                            />
                        )}
                        {activeSection === 'appearance' && <AppearancePanel />}
                        {activeSection === 'notifications' && (
                            <NotificationsPanel />
                        )}
                        {activeSection === 'about' && <AboutPanel />}
                    </section>
                </div>
            </div>
        </ProjectWorkspace>
    );
}

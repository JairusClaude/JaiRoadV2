import { usePage } from '@inertiajs/react';
import { Bell, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useJaiRoadsNotificationFeed } from '@/components/use-jairoads-notification-feed';
import { useIsPhone } from '@/hooks/use-mobile';
import { manilaTimestamp } from '@/lib/manila-time';

type Props = { variant?: 'light' | 'dark' };

export function NotificationBell(props: Props) {
    const { jairoadsIdentity } = usePage<{
        jairoadsIdentity?: { accountId: number };
    }>().props;
    const accountId = jairoadsIdentity?.accountId;

    return (
        <AccountNotifications
            key={accountId}
            accountId={accountId}
            {...props}
        />
    );
}

function AccountNotifications({
    variant = 'light',
    accountId,
}: Props & { accountId?: number }) {
    const phone = useIsPhone();
    const [open, setOpen] = useState(false);
    const storageKey = accountId
        ? `jairoads-notifications-seen:${accountId}`
        : null;
    const [seenThrough, setSeenThrough] = useState(() => {
        try {
            return storageKey
                ? Number(window.sessionStorage.getItem(storageKey)) || 0
                : 0;
        } catch {
            return 0;
        }
    });
    const { status, items, message, refresh, cancel } =
        useJaiRoadsNotificationFeed();
    const newCount = items.filter((item) => item.id > seenThrough).length;

    useEffect(() => {
        void refresh();
    }, [refresh]);

    function changeOpen(next: boolean) {
        setOpen(next);

        if (next) {
            void refresh();

            return;
        }

        const latest =
            status === 'ready'
                ? items.reduce(
                      (max, item) => Math.max(max, item.id),
                      seenThrough,
                  )
                : seenThrough;
        setSeenThrough(latest);
        cancel();

        if (storageKey) {
            try {
                window.sessionStorage.setItem(storageKey, String(latest));
            } catch {
                // The badge still works while the header is mounted.
            }
        }
    }

    const trigger = (
        <button
            type="button"
            aria-label="My account notifications"
            aria-description={
                newCount > 0
                    ? `${newCount} new ${newCount === 1 ? 'notification' : 'notifications'} in this browser tab`
                    : undefined
            }
            title="Account notifications"
            className={`jr-notification-trigger jr-icon-button relative inline-flex items-center justify-center rounded-xl p-2.5 transition focus-visible:outline-2 focus-visible:outline-amber-600 ${
                variant === 'dark'
                    ? 'border border-slate-700 text-slate-200 hover:bg-slate-800'
                    : 'border border-transparent text-[#475569] hover:border-[#e2e7f0] hover:bg-[#f4f6f9]'
            }`}
        >
            <Bell className="size-[18px]" aria-hidden="true" />
            {newCount > 0 && (
                <span
                    aria-hidden="true"
                    className="jr-notification-dot absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-600 ring-2 ring-white"
                />
            )}
        </button>
    );
    const itemsContent = (
        <>
            <div className="jr-notification-toolbar flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-700">
                <span className="text-xs text-slate-600 dark:text-slate-300">
                    {newCount > 0
                        ? `${newCount} new in this tab`
                        : 'Account activity'}
                </span>
                <button
                    type="button"
                    onClick={() => void refresh()}
                    disabled={status === 'loading'}
                    className="jr-notification-refresh inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-slate-800"
                >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {status === 'error' ? 'Retry' : 'Refresh'}
                </button>
            </div>
            {status === 'loading' || status === 'idle' ? (
                <p
                    role="status"
                    className="py-5 text-center text-sm text-slate-600 dark:text-slate-300"
                >
                    Loading account notifications…
                </p>
            ) : status === 'error' ? (
                <p
                    role="alert"
                    className="py-5 text-center text-sm text-red-700 dark:text-red-300"
                >
                    {message || 'Notifications unavailable.'}
                </p>
            ) : items.length === 0 ? (
                <p
                    role="status"
                    className="py-5 text-center text-sm text-slate-600 dark:text-slate-300"
                >
                    No account activity notifications yet.
                </p>
            ) : (
                <ul className="jr-notification-list max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
                    {items.map((item) => (
                        <li key={item.id} className="py-3 text-sm">
                            <p className="font-medium break-words text-slate-800 dark:text-slate-100">
                                {item.id > seenThrough && (
                                    <span className="mr-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-950 dark:bg-amber-900 dark:text-amber-100">
                                        New
                                    </span>
                                )}
                                {item.notification_message}
                            </p>
                            <time
                                dateTime={item.created_at}
                                className="mt-1 block text-xs text-slate-600 dark:text-slate-300"
                            >
                                {manilaTimestamp(item.created_at)}
                            </time>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );

    if (phone) {
        return (
            <Dialog open={open} onOpenChange={changeOpen}>
                <DialogTrigger asChild>{trigger}</DialogTrigger>
                <DialogContent className="jr-theme jr-menu jr-notification-popover jr-notification-sheet">
                    <DialogHeader>
                        <DialogTitle>My notifications</DialogTitle>
                        <DialogDescription>
                            Recent activity addressed to your account.
                        </DialogDescription>
                    </DialogHeader>
                    {itemsContent}
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Popover open={open} onOpenChange={changeOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                className="jr-notification-popover z-50 w-[min(90vw,370px)] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
                <p className="mb-2 text-sm font-semibold">My notifications</p>
                {itemsContent}
            </PopoverContent>
        </Popover>
    );
}

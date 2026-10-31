import { Bell, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useJaiRoadsNotificationFeed } from '@/components/use-jairoads-notification-feed';

/** Read-only, recipient-scoped notifications; no unread counter or dismissals. */
export function JaiRoadsNotifications() {
    const [open, setOpen] = useState(false);
    const { status, items, message, refresh, cancel } =
        useJaiRoadsNotificationFeed();

    return (
        <DropdownMenu
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (next) {
                    void refresh();
                } else {
                    cancel();
                }
            }}
        >
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="jr-icon-button"
                    aria-label="Open notifications"
                    title="Notifications"
                >
                    <Bell className="size-[18px]" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="jr-theme jr-menu max-h-[70vh] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto p-0"
            >
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                    <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Notifications
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Only messages addressed to your account
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={(event) => {
                            event.preventDefault();
                            void refresh();
                        }}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-amber-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        title="Refresh notifications"
                        aria-label="Refresh notifications"
                        disabled={status === 'loading'}
                    >
                        <RefreshCw
                            className={`size-4 ${status === 'loading' ? 'animate-spin' : ''}`}
                        />
                    </button>
                </div>
                <div
                    aria-live="polite"
                    className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200"
                >
                    {status === 'loading' || status === 'idle' ? (
                        <p role="status">Loading notifications…</p>
                    ) : status === 'error' ? (
                        <div role="alert" className="space-y-2">
                            <p className="text-red-700 dark:text-red-300">
                                {message}
                            </p>
                            <button
                                type="button"
                                className="text-sm font-semibold underline"
                                onClick={() => void refresh()}
                            >
                                Try again
                            </button>
                        </div>
                    ) : items.length === 0 ? (
                        <p className="py-3 text-center">
                            No notifications yet.
                        </p>
                    ) : (
                        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
                            {items.map((item) => (
                                <li
                                    key={item.id}
                                    className="py-3 first:pt-0 last:pb-0"
                                >
                                    <p className="break-words whitespace-pre-wrap">
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
                {status === 'ready' && items.length > 0 && (
                    <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Showing up to 20 latest messages
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

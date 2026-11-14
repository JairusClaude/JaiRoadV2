import { Bell, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useJaiRoadsNotificationFeed } from '@/components/use-jairoads-notification-feed';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

/** Header feed: the API enforces recipient_user_id against the authenticated DD identity. */
export function DdNotificationBell({
    variant = 'light',
}: {
    variant?: 'light' | 'dark';
}) {
    const [open, setOpen] = useState(false);
    const { status, items, message, refresh } = useJaiRoadsNotificationFeed();
    const dark = variant === 'dark';

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (next) {
                    void refresh();
                }
            }}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="My account notifications"
                    title="Account notifications"
                    className={`jr-icon-button relative inline-flex items-center justify-center rounded-xl p-2.5 transition focus-visible:outline-2 focus-visible:outline-amber-600 ${
                        dark
                            ? 'border border-slate-700 text-slate-200 hover:bg-slate-800'
                            : 'border border-transparent text-[#475569] hover:border-[#e2e7f0] hover:bg-[#f4f6f9]'
                    }`}
                >
                    <Bell className="size-[18px]" aria-hidden="true" />
                    {status === 'ready' && items.length > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-600 ring-2 ring-white"
                        />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={8}
                className="z-50 w-[min(90vw,370px)] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-700">
                    <strong className="text-sm font-semibold">My notifications</strong>
                    <button
                        type="button"
                        onClick={() => void refresh()}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-slate-800"
                    >
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                    </button>
                </div>
                <div role="status" aria-atomic="true">
                    {status === 'loading' || status === 'idle' ? (
                        <p className="py-5 text-center text-sm text-slate-500">
                            Loading account notifications…
                        </p>
                    ) : status === 'error' ? (
                        <p role="alert" className="py-5 text-center text-sm text-red-700">
                            {message || 'Notifications unavailable.'}
                        </p>
                    ) : items.length === 0 ? (
                        <p className="py-5 text-center text-sm text-slate-500">
                            No account activity notifications yet.
                        </p>
                    ) : (
                        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
                            {items.map((item) => (
                                <li key={item.id} className="py-3 text-sm">
                                    <p className="font-medium text-slate-800 dark:text-slate-100 break-words">
                                        {item.notification_message}
                                    </p>
                                    <time className="mt-1 block text-xs text-slate-400">
                                        {item.created_at}
                                    </time>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-5 text-slate-500 dark:border-slate-700">
                    Only activity addressed to this signed-in account. The dot means recent items exist, not unread status.
                </p>
            </PopoverContent>
        </Popover>
    );
}

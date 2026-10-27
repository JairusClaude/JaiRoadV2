import { Bell, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useJaiRoadsNotificationFeed } from '@/components/use-jairoads-notification-feed';

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
        <div className="relative">
            <button
                type="button"
                aria-label="My account notifications"
                aria-expanded={open}
                title="Account notifications"
                onClick={() => {
                    const next = !open;
                    setOpen(next);

                    if (next) {
                        void refresh();
                    }
                }}
                className={`relative rounded-xl border p-2.5 transition focus-visible:outline-2 focus-visible:outline-amber-600 ${dark ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-slate-200 text-slate-700 hover:bg-amber-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800'}`}
            >
                <Bell className="h-5 w-5" aria-hidden="true" />
                {status === 'ready' && items.length > 0 && (
                    <span
                        aria-hidden="true"
                        className="absolute top-1 right-1 h-2 w-2 rounded-full bg-orange-600"
                    />
                )}
            </button>
            {open && (
                <section
                    aria-label="My account notifications"
                    className="absolute top-12 right-0 z-50 w-[min(88vw,370px)] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-700">
                        <strong className="text-sm">My notifications</strong>
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
                            <p className="py-5 text-sm text-slate-500">
                                Loading account notifications…
                            </p>
                        ) : status === 'error' ? (
                            <p
                                role="alert"
                                className="py-5 text-sm text-red-700"
                            >
                                {message || 'Notifications unavailable.'}
                            </p>
                        ) : items.length === 0 ? (
                            <p className="py-5 text-sm text-slate-500">
                                No account activity notifications yet.
                            </p>
                        ) : (
                            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
                                {items.map((item) => (
                                    <li key={item.id} className="py-3 text-sm">
                                        <p className="font-medium break-words">
                                            {item.notification_message}
                                        </p>
                                        <time className="mt-1 block text-xs text-slate-500">
                                            {item.created_at}
                                        </time>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <p className="mt-3 border-t border-slate-100 pt-2 text-[11px] leading-5 text-slate-500 dark:border-slate-700">
                        Only activity addressed to this signed-in account. The
                        dot means recent items exist, not unread status.
                    </p>
                </section>
            )}
        </div>
    );
}

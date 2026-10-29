import { Head, router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import {
    MonthlyDeletionDialog,
    useMonthlyDeletion,
} from '@/components/monthly-updates/monthly-update-deletion';
import { MonthlyUpdateDirectory } from '@/components/monthly-updates/monthly-update-directory';
import type { MonthlyDirectoryProps } from '@/components/monthly-updates/monthly-update-directory';
import { editUrl } from '@/lib/form-navigation';
import type { MonthlyUpdateFilters } from '@/types/monthly-updates';

export default function Index(props: MonthlyDirectoryProps) {
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const request = useRef<{ cancel: () => void } | null>(null);
    const cancelSearch = () => {
        clearTimeout(timer.current);
        request.current?.cancel();
    };
    useEffect(
        () => () => {
            clearTimeout(timer.current);
            request.current?.cancel();
        },
        [],
    );
    const visit = (filters: MonthlyUpdateFilters, page = 1) => {
        cancelSearch();
        router.get(
            '/monthly-updates',
            { ...filters, page },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onCancelToken: (token) => {
                    request.current = token;
                },
            },
        );
    };
    const deletion = useMonthlyDeletion(
        new URLSearchParams({
            ...props.filters,
            page: String(props.updates.current_page),
        }).toString(),
    );

    return (
        <div className="jr-directory-exploration">
            <Head title="Monthly Updates" />
            <MonthlyUpdateDirectory
                {...props}
                busy={deletion.processing}
                onSearch={(search) => {
                    cancelSearch();
                    timer.current = setTimeout(
                        () => visit({ ...props.filters, search }),
                        250,
                    );
                }}
                onFilters={visit}
                onPage={(page, search) =>
                    visit({ ...props.filters, search }, page)
                }
                onDelete={(updates, multiple) => {
                    cancelSearch();
                    deletion.open(updates, multiple);
                }}
                onAction={(action, update) => {
                    if (action === 'Add') {
                        cancelSearch();
                        router.visit('/monthly-updates/create');

                        return;
                    }

                    if (action === 'Details' && update) {
                        cancelSearch();
                        const query = new URLSearchParams({
                            ...props.filters,
                            page: String(props.updates.current_page),
                        });
                        router.visit(`/monthly-updates/${update.id}?${query}`);

                        return;
                    }

                    if (action === 'Edit' && update) {
                        cancelSearch();
                        const origin = `/monthly-updates?${new URLSearchParams({ ...props.filters, page: String(props.updates.current_page) })}`;
                        router.visit(
                            editUrl(
                                `/monthly-updates/${update.id}/edit`,
                                origin,
                            ),
                        );
                    }
                }}
            />
            <MonthlyDeletionDialog deletion={deletion} />
        </div>
    );
}

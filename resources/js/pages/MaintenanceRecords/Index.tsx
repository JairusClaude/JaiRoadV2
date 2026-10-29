import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import {
    RecordDeletionDialog,
    useRecordDeletion,
} from '@/components/maintenance-projects/record-deletion';
import { RecordDirectory } from '@/components/maintenance-records/record-directory';
import { editUrl } from '@/lib/form-navigation';
import type {
    RecordDirectoryFilters,
    RecordDirectoryProps,
} from '@/types/maintenance-record-directory';
import '../../../css/maintenance-record-directory.css';

export default function Index(props: RecordDirectoryProps) {
    const page = usePage();
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
    const visit = (filters: RecordDirectoryFilters, page = 1) => {
        cancelSearch();
        router.get(
            '/maintenance-records',
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
    const returnUrl = `/maintenance-records?${new URLSearchParams({ ...props.filters, page: String(props.records.current_page) })}`;
    const deletion = useRecordDeletion(returnUrl);
    const addButton = useRef<HTMLButtonElement>(null);
    const navigate = (url: string) => {
        cancelSearch();
        router.visit(url.includes('/edit') ? editUrl(url, page.url) : url);
    };

    return (
        <div className="jr-directory-exploration jr-record-directory">
            <Head title="Maintenance Records" />
            <RecordDirectory
                {...props}
                busy={deletion.processing}
                addButtonRef={addButton}
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
                onNavigate={navigate}
                onAdd={() =>
                    navigate(editUrl('/maintenance-records/create', page.url))
                }
                onDelete={(record) => {
                    cancelSearch();
                    deletion.open(record);
                }}
            />
            <RecordDeletionDialog deletion={deletion} />
        </div>
    );
}

import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { validProjectPage } from '@/lib/project-choice-page';

export function MonthlyProjectFilter({
    projects,
    choicesUrl,
    value,
    onChange,
}: {
    projects: { id: number; project_title: string }[];
    choicesUrl?: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const id = useId();
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const key = JSON.stringify([query.trim(), page, retry]);
    const [response, setResponse] = useState<{
        key: string;
        data?: typeof projects;
        page?: number;
        last_page?: number;
        error?: boolean;
    } | null>(null);

    useEffect(() => {
        if (!open || !choicesUrl) {
            return;
        }

        const controller = new AbortController();
        const deadline = window.setTimeout(() => {
            controller.abort();
            setResponse({ key, error: true });
        }, 12_000);
        const timer = window.setTimeout(async () => {
            const params = new URLSearchParams({
                search: query.trim(),
                page: String(page),
            });

            try {
                const url = `${choicesUrl}?${params}`;
                const result = await fetch(url, {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: controller.signal,
                });

                if (!result.ok) {
                    throw new Error('Project choices unavailable');
                }

                const payload = await result.json();

                if (!validProjectPage(payload)) {
                    throw new Error('Invalid project choices');
                }

                if (!controller.signal.aborted) {
                    setResponse({
                        key,
                        data: payload.data,
                        page: payload.page,
                        last_page: payload.last_page,
                    });
                }
            } catch {
                if (!controller.signal.aborted) {
                    setResponse({ key, error: true });
                }
            } finally {
                window.clearTimeout(deadline);
            }
        }, 200);

        return () => {
            window.clearTimeout(timer);
            window.clearTimeout(deadline);
            controller.abort();
        };
    }, [choicesUrl, key, open, page, query]);

    const current = response?.key === key ? response : null;
    const loading = Boolean(choicesUrl && !current);
    const options = [
        { value: '', label: 'All Projects' },
        ...(choicesUrl ? (current?.data ?? []) : projects).map((project) => ({
            value: String(project.id),
            label: project.project_title,
        })),
    ];
    const selectedProject = projects.find(
        (project) => String(project.id) === value,
    );
    const selected = selectedProject
        ? { value, label: selectedProject.project_title }
        : options.find((option) => option.value === value);
    const matches = options.filter((option) =>
        option.label
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
    );
    const currentPage = current?.page ?? 1;
    const lastPage = current?.last_page ?? 1;
    const select = (next: string) => {
        setOpen(false);
        onChange(next);
    };
    const returnKeyboardFocus = (event: MouseEvent<HTMLButtonElement>) => {
        if (event.detail === 0) {
            input.current?.focus({ preventScroll: true });
        }
    };

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (next) {
                    setQuery('');
                    setPage(1);
                    setRetry((previous) => previous + 1);
                }
            }}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    data-slot="select-trigger"
                    className="jr-monthly-project-filter flex min-w-0 items-center justify-between gap-2 border text-left whitespace-nowrap"
                    aria-label="Project filter"
                    title={selected?.label}
                    onKeyDown={(event) => {
                        if (
                            event.key === 'ArrowDown' ||
                            event.key === 'ArrowUp'
                        ) {
                            event.preventDefault();
                            setQuery('');
                            setPage(1);
                            setRetry((previous) => previous + 1);
                            setOpen(true);
                        }
                    }}
                >
                    <span className="block min-w-0 truncate">
                        {selected?.label ?? 'All Projects'}
                    </span>
                    <ChevronDown />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="jr-theme jr-menu jr-monthly-project-menu"
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    input.current?.focus();
                }}
                onKeyDown={(event) => {
                    const fromSearch = event.target === input.current;

                    if (fromSearch && event.key === 'Enter') {
                        event.preventDefault();

                        if (!loading && !current?.error && matches[0]) {
                            select(matches[0].value);
                        }

                        return;
                    }

                    if (
                        !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(
                            event.key,
                        ) ||
                        (fromSearch && ['Home', 'End'].includes(event.key))
                    ) {
                        return;
                    }

                    const buttons = Array.from(
                        list.current?.querySelectorAll<HTMLButtonElement>(
                            '[role="option"]',
                        ) ?? [],
                    );

                    if (!buttons.length) {
                        return;
                    }

                    event.preventDefault();
                    const focusedIndex = buttons.indexOf(
                        document.activeElement as HTMLButtonElement,
                    );
                    const next =
                        event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? buttons.length - 1
                              : event.key === 'ArrowDown'
                                ? (focusedIndex + 1) % buttons.length
                                : focusedIndex < 0
                                  ? buttons.length - 1
                                  : (focusedIndex - 1 + buttons.length) %
                                    buttons.length;
                    buttons[next]?.focus();
                }}
            >
                <div className="jr-search mb-1">
                    <Search className="size-4" />
                    <Input
                        ref={input}
                        placeholder="Search maintenance projects..."
                        aria-label="Search maintenance projects"
                        aria-controls={id}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(1);
                        }}
                    />
                </div>
                <div
                    ref={list}
                    id={id}
                    role="listbox"
                    aria-label="Maintenance Projects"
                    className="jr-project-picker-options"
                >
                    {matches.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="option"
                            title={option.label}
                            aria-selected={value === option.value}
                            onClick={() => select(option.value)}
                        >
                            <span className="min-w-0 wrap-anywhere whitespace-normal">
                                {option.label}
                            </span>
                            {value === option.value && (
                                <Check className="size-4 shrink-0" />
                            )}
                        </button>
                    ))}
                    {loading && (
                        <p role="status" className="jr-field-hint p-3">
                            Loading projects…
                        </p>
                    )}
                    {current?.error && (
                        <div role="alert" className="p-3">
                            Unable to load projects.{' '}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={(event) => {
                                    returnKeyboardFocus(event);
                                    setRetry((previous) => previous + 1);
                                }}
                            >
                                Retry
                            </Button>
                        </div>
                    )}
                    {!loading && !current?.error && !matches.length && (
                        <p role="status" className="jr-field-hint p-3">
                            No matching projects found
                        </p>
                    )}
                </div>
                {lastPage > 1 && (
                    <div className="flex items-center justify-between gap-2 p-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={currentPage <= 1}
                            onClick={(event) => {
                                returnKeyboardFocus(event);
                                setPage(currentPage - 1);
                            }}
                        >
                            Previous
                        </Button>
                        <span className="text-xs">
                            Page {currentPage} of {lastPage}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= lastPage}
                            onClick={(event) => {
                                returnKeyboardFocus(event);
                                setPage(currentPage + 1);
                            }}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

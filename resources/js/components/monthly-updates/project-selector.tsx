import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { MonthlyParentProject } from '@/types/monthly-updates';

// Search input and option buttons share the established menu surface. Native
// buttons keep keyboard navigation separate from Radix Select's typeahead.
export function ProjectSelector<T extends MonthlyParentProject>({
    projects,
    choicesUrl,
    value,
    disabled,
    invalid,
    onChange,
}: {
    projects: T[];
    choicesUrl?: string;
    value: string;
    disabled: boolean;
    invalid: boolean;
    onChange: (value: string, project?: T) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const search = useRef<HTMLInputElement>(null);
    const id = useId();
    const [remembered, setRemembered] = useState<T | null>(null);
    const [page, setPage] = useState(1);
    const [attempt, setAttempt] = useState(0);
    const key = JSON.stringify([query.trim(), page, attempt]);
    const [result, setResult] = useState<{
        key: string;
        data?: T[];
        page?: number;
        last_page?: number;
        failed?: boolean;
    } | null>(null);

    useEffect(() => {
        if (!open || !choicesUrl) {
            return;
        }

        const controller = new AbortController();
        const deadline = window.setTimeout(() => {
            controller.abort();
            setResult({ key, failed: true });
        }, 12_000);
        const timer = window.setTimeout(async () => {
            const params = new URLSearchParams({
                search: query.trim(),
                page: String(page),
                include_municipality: '1',
            });

            try {
                const response = await fetch(`${choicesUrl}?${params}`, {
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' },
                    cache: 'no-store',
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('Project choices unavailable');
                }

                const data = await response.json();

                if (!controller.signal.aborted) {
                    setResult({ key, ...data });
                }
            } catch {
                if (!controller.signal.aborted) {
                    setResult({ key, failed: true });
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

    const current = result?.key === key ? result : null;
    const loading = Boolean(choicesUrl && !current);
    const selected =
        projects.find((item) => String(item.id) === value) ??
        (String(remembered?.id) === value ? remembered : null);
    const options = choicesUrl
        ? (current?.data ?? [])
        : projects.filter((item) =>
              `${item.project_title} ${item.municipality ?? ''}`
                  .toLocaleLowerCase()
                  .includes(query.trim().toLocaleLowerCase()),
          );
    useEffect(() => {
        if (!open) {
            return;
        }

        search.current?.focus();
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('pointerdown', outside);

        return () => document.removeEventListener('pointerdown', outside);
    }, [open]);
    const close = () => {
        setOpen(false);
        trigger.current?.focus();
    };

    return (
        <div
            className="jr-project-picker"
            ref={root}
            onBlur={(event) => {
                if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                    setOpen(false);
                }
            }}
            onKeyDown={(event) => {
                if (
                    open &&
                    event.key === 'Enter' &&
                    event.target === search.current
                ) {
                    event.preventDefault();

                    if (options.length === 1) {
                        setRemembered(options[0]);
                        onChange(String(options[0].id), options[0]);
                        close();
                    }
                }

                if (event.key === 'Escape' && open) {
                    event.preventDefault();
                    event.stopPropagation();
                    close();
                }

                if (
                    open &&
                    ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)
                ) {
                    if (
                        event.target instanceof HTMLInputElement &&
                        event.key !== 'ArrowDown'
                    ) {
                        return;
                    }

                    const buttons = Array.from(
                        root.current?.querySelectorAll<HTMLButtonElement>(
                            '[role="option"]',
                        ) ?? [],
                    );

                    if (!buttons.length) {
                        return;
                    }

                    event.preventDefault();
                    const current = buttons.indexOf(
                        document.activeElement as HTMLButtonElement,
                    );
                    const next =
                        event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? buttons.length - 1
                              : event.key === 'ArrowDown'
                                ? (current + 1) % buttons.length
                                : (current - 1 + buttons.length) %
                                  buttons.length;
                    buttons[next]?.focus();
                }
            }}
        >
            <button
                ref={trigger}
                id="project_id"
                type="button"
                className="jr-record-select jr-project-picker-trigger"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                aria-haspopup="listbox"
                aria-required="true"
                aria-invalid={invalid}
                aria-describedby={invalid ? 'project_id-error' : undefined}
                disabled={disabled}
                onClick={() => {
                    setQuery('');
                    setPage(1);
                    setAttempt((value) => value + 1);
                    setOpen(!open);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && !open) {
                        event.preventDefault();
                        setQuery('');
                        setPage(1);
                        setAttempt((value) => value + 1);
                        setOpen(true);
                    }
                }}
            >
                <span className={selected ? '' : 'jr-muted'}>
                    {selected?.project_title ?? 'Select project'}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
            </button>
            {open && (
                <div className="jr-theme jr-menu jr-project-picker-menu">
                    <div className="jr-search">
                        <Search className="size-4" />
                        <Input
                            aria-label="Search maintenance projects"
                            placeholder="Search projects..."
                            value={query}
                            ref={search}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setPage(1);
                            }}
                        />
                    </div>
                    <div
                        id={id}
                        role="listbox"
                        aria-label="Maintenance Projects"
                        className="jr-project-picker-options"
                    >
                        {options.map((project) => (
                            <button
                                type="button"
                                role="option"
                                aria-selected={String(project.id) === value}
                                key={project.id}
                                onClick={() => {
                                    setRemembered(project);
                                    onChange(String(project.id), project);
                                    close();
                                }}
                            >
                                <span>
                                    {project.project_title}
                                    <small>
                                        {project.municipality ??
                                            'Municipality unavailable'}{' '}
                                        · Project ID: {project.id}
                                    </small>
                                </span>
                                {String(project.id) === value && (
                                    <Check className="size-4 shrink-0" />
                                )}
                            </button>
                        ))}
                        {loading && (
                            <p className="jr-field-hint p-3" role="status">
                                Loading projects…
                            </p>
                        )}
                        {current?.failed && (
                            <div className="p-3" role="alert">
                                Could not load projects.{' '}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setAttempt((value) => value + 1)
                                    }
                                >
                                    Retry
                                </Button>
                            </div>
                        )}
                        {!loading && !current?.failed && !options.length && (
                            <p className="jr-field-hint p-3" role="status">
                                No matching projects.
                            </p>
                        )}
                    </div>
                    {(current?.last_page ?? 1) > 1 && (
                        <div className="flex items-center justify-between gap-2 p-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={(current?.page ?? 1) <= 1}
                                onClick={() =>
                                    setPage((current?.page ?? 1) - 1)
                                }
                            >
                                Previous
                            </Button>
                            <span className="text-xs">
                                Page {current?.page} of {current?.last_page}
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                    (current?.page ?? 1) >=
                                    (current?.last_page ?? 1)
                                }
                                onClick={() =>
                                    setPage((current?.page ?? 1) + 1)
                                }
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

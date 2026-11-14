import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { MonthlyParentProject } from '@/types/monthly-updates';

// Search input and option buttons share the established menu surface. Native
// buttons keep keyboard navigation separate from Radix Select's typeahead.
export function ProjectSelector({
    projects,
    value,
    disabled,
    invalid,
    onChange,
}: {
    projects: MonthlyParentProject[];
    value: string;
    disabled: boolean;
    invalid: boolean;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const root = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const search = useRef<HTMLInputElement>(null);
    const id = useId();
    const selected = projects.find((item) => String(item.id) === value);
    const options = projects.filter((item) =>
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
                        onChange(String(options[0].id));
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
                    setOpen(!open);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'ArrowDown' && !open) {
                        event.preventDefault();
                        setQuery('');
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
                            onChange={(event) => setQuery(event.target.value)}
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
                                    onChange(String(project.id));
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
                        {!options.length && (
                            <p className="jr-field-hint p-3" role="status">
                                No matching projects.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

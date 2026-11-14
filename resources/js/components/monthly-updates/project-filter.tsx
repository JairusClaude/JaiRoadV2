import { Check, ChevronDown, Search } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

export function MonthlyProjectFilter({
    projects,
    value,
    onChange,
}: {
    projects: { id: number; project_title: string }[];
    value: string;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLDivElement>(null);
    const id = useId();
    const options = [
        { value: '', label: 'All Projects' },
        ...projects.map((project) => ({
            value: String(project.id),
            label: project.project_title,
        })),
    ];
    const selected = options.find((option) => option.value === value);
    const matches = options.filter((option) =>
        option.label
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase()),
    );
    const select = (next: string) => {
        setOpen(false);
        onChange(next);
    };

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (next) {
                    setQuery('');
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

                        if (matches[0]) {
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
                                : current < 0
                                  ? buttons.length - 1
                                  : (current - 1 + buttons.length) %
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
                        onChange={(event) => setQuery(event.target.value)}
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
                    {!matches.length && (
                        <p role="status" className="jr-field-hint p-3">
                            No matching projects found
                        </p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

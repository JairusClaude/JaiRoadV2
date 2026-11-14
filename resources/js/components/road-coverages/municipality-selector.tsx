import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
// Same searchable menu interaction as the Monthly Update ProjectSelector.
export function MunicipalitySelector({
    options,
    value,
    disabled,
    invalid,
    onChange,
}: {
    options: { id: number; municipality_name: string }[];
    value: string;
    disabled: boolean;
    invalid: boolean;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false),
        [query, setQuery] = useState('');
    const root = useRef<HTMLDivElement>(null),
        trigger = useRef<HTMLButtonElement>(null),
        search = useRef<HTMLInputElement>(null);
    const id = useId();
    const selected = options.find((item) => String(item.id) === value);
    const filtered = options.filter((item) =>
        item.municipality_name
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
            onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setOpen(false);
                }
            }}
            onKeyDown={(e) => {
                if (!open) {
                    return;
                }

                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    close();
                }

                if (e.key === 'Enter' && e.target === search.current) {
                    e.preventDefault();

                    if (filtered.length) {
                        onChange(String(filtered[0].id));
                        close();
                    }
                }

                if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                    if (
                        e.target instanceof HTMLInputElement &&
                        e.key !== 'ArrowDown'
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

                    e.preventDefault();
                    const current = buttons.indexOf(
                        document.activeElement as HTMLButtonElement,
                    );
                    const next =
                        e.key === 'Home'
                            ? 0
                            : e.key === 'End'
                              ? buttons.length - 1
                              : e.key === 'ArrowDown'
                                ? (current + 1) % buttons.length
                                : (current - 1 + buttons.length) %
                                  buttons.length;
                    buttons[next]?.focus();
                }
            }}
        >
            <button
                ref={trigger}
                id="lgus_id"
                type="button"
                className="jr-record-select jr-project-picker-trigger"
                aria-expanded={open}
                aria-controls={open ? id : undefined}
                aria-haspopup="listbox"
                aria-required="true"
                aria-invalid={invalid}
                aria-describedby={invalid ? 'lgus_id-error' : undefined}
                disabled={disabled}
                onClick={() => {
                    setQuery('');
                    setOpen(!open);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown' && !open) {
                        e.preventDefault();
                        setQuery('');
                        setOpen(true);
                    }
                }}
            >
                <span className={selected ? '' : 'jr-muted'}>
                    {selected?.municipality_name ?? 'Select municipality'}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-slate-400" />
            </button>
            {open && (
                <div className="jr-theme jr-menu jr-project-picker-menu">
                    <div className="jr-search">
                        <Search className="size-4" />
                        <Input
                            ref={search}
                            aria-label="Search municipalities"
                            placeholder="Search municipalities..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <div
                        id={id}
                        role="listbox"
                        aria-label="Municipalities"
                        className="jr-project-picker-options"
                    >
                        {filtered.map((item) => (
                            <button
                                type="button"
                                role="option"
                                aria-selected={String(item.id) === value}
                                key={item.id}
                                onClick={() => {
                                    onChange(String(item.id));
                                    close();
                                }}
                            >
                                <span>{item.municipality_name}</span>
                                {String(item.id) === value && (
                                    <Check className="size-4 shrink-0" />
                                )}
                            </button>
                        ))}
                        {!filtered.length && (
                            <p className="jr-field-hint p-3" role="status">
                                No matching municipalities found.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

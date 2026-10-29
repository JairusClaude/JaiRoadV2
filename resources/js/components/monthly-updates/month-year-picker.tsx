import {
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];
const yearText = (year: number) => String(year).padStart(4, '0');

export function MonthYearPicker({
    id,
    value,
    disabled,
    onChange,
    'aria-invalid': invalid,
    'aria-describedby': describedBy,
}: {
    id: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
}) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
    const selected =
        match && Number(match[1]) > 0
            ? { year: Number(match[1]), month: Number(match[2]) - 1 }
            : null;
    const [open, setOpen] = useState(false);
    const [year, setYear] = useState(
        selected?.year ?? new Date().getFullYear(),
    );
    const [focusedMonth, setFocusedMonth] = useState(
        selected?.month ?? new Date().getMonth(),
    );
    const [editingYear, setEditingYear] = useState(false);
    const [draftYear, setDraftYear] = useState('');
    const [yearError, setYearError] = useState('');
    const monthButtons = useRef<(HTMLButtonElement | null)[]>([]);
    const yearInput = useRef<HTMLInputElement>(null);
    const pickerId = useId();
    useEffect(() => {
        if (editingYear) {
            yearInput.current?.focus();
            yearInput.current?.select();
        }
    }, [editingYear]);
    const applyYear = () => {
        if (!/^\d{4}$/.test(draftYear) || Number(draftYear) < 1) {
            setYearError('Enter a year from 0001 to 9999.');

            return;
        }

        setYear(Number(draftYear));
        setEditingYear(false);
        setYearError('');
        monthButtons.current[focusedMonth]?.focus();
    };
    const changeYear = (offset: number) => {
        setYear((current) => Math.min(9999, Math.max(1, current + offset)));
        setEditingYear(false);
        setYearError('');
    };

    return (
        <>
            <input type="hidden" name="update_month" value={value} />
            <Popover
                open={open}
                onOpenChange={(next) => {
                    if (next) {
                        setYear(selected?.year ?? new Date().getFullYear());
                        setFocusedMonth(
                            selected?.month ?? new Date().getMonth(),
                        );
                        setEditingYear(false);
                        setYearError('');
                    }

                    setOpen(next);
                }}
            >
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-required="true"
                        aria-invalid={invalid}
                        aria-describedby={describedBy}
                        disabled={disabled}
                        className="jr-record-select jr-month-picker-trigger font-normal"
                    >
                        <span className={selected ? undefined : 'jr-muted'}>
                            {selected
                                ? `${months[selected.month]} ${yearText(selected.year)}`
                                : 'Select month and year'}
                        </span>
                        <CalendarDays
                            className="size-4 text-slate-400"
                            aria-hidden="true"
                        />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="jr-theme jr-menu jr-month-picker-popover"
                    align="start"
                    sideOffset={5}
                    collisionPadding={12}
                    aria-label="Choose reporting month and year"
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        monthButtons.current[focusedMonth]?.focus();
                    }}
                >
                    <div className="jr-month-picker-header">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Previous year"
                            disabled={year === 1}
                            onClick={() => changeYear(-1)}
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        <h3 id={`${pickerId}-year`}>
                            <Button
                                type="button"
                                variant="ghost"
                                aria-label={`Change reporting year, ${yearText(year)}`}
                                aria-expanded={editingYear}
                                aria-controls={
                                    editingYear
                                        ? `${pickerId}-year-editor`
                                        : undefined
                                }
                                onClick={() => {
                                    if (editingYear) {
                                        setEditingYear(false);
                                        monthButtons.current[
                                            focusedMonth
                                        ]?.focus();
                                    } else {
                                        setDraftYear(yearText(year));
                                        setYearError('');
                                        setEditingYear(true);
                                    }
                                }}
                            >
                                {yearText(year)}
                                <ChevronDown
                                    className="size-3"
                                    aria-hidden="true"
                                />
                            </Button>
                        </h3>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Next year"
                            disabled={year === 9999}
                            onClick={() => changeYear(1)}
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                    {editingYear && (
                        <div
                            id={`${pickerId}-year-editor`}
                            className="jr-month-year-editor"
                        >
                            <Label htmlFor={`${pickerId}-year-input`}>
                                Go to year
                            </Label>
                            <div>
                                <Input
                                    ref={yearInput}
                                    id={`${pickerId}-year-input`}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={4}
                                    value={draftYear}
                                    aria-invalid={Boolean(yearError)}
                                    aria-describedby={
                                        yearError
                                            ? `${pickerId}-year-error`
                                            : undefined
                                    }
                                    onChange={(event) => {
                                        setDraftYear(event.target.value);
                                        setYearError('');
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            applyYear();
                                        }
                                    }}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={applyYear}
                                >
                                    Go
                                </Button>
                            </div>
                            {yearError && (
                                <p
                                    className="jr-field-error"
                                    id={`${pickerId}-year-error`}
                                    role="alert"
                                >
                                    {yearError}
                                </p>
                            )}
                        </div>
                    )}
                    <p className="sr-only" role="status" aria-live="polite">
                        Months for {yearText(year)}
                    </p>
                    <div
                        role="grid"
                        aria-label={`Months for ${yearText(year)}`}
                        className="jr-month-grid"
                        onKeyDown={(event) => {
                            const button = (
                                event.target as HTMLElement
                            ).closest<HTMLButtonElement>('button[data-month]');

                            if (!button) {
                                return;
                            }

                            const current = Number(button.dataset.month);

                            if (
                                event.key === 'PageUp' ||
                                event.key === 'PageDown'
                            ) {
                                event.preventDefault();
                                changeYear(event.key === 'PageUp' ? -1 : 1);

                                return;
                            }

                            const next =
                                event.key === 'ArrowRight'
                                    ? (current + 1) % 12
                                    : event.key === 'ArrowLeft'
                                      ? (current + 11) % 12
                                      : event.key === 'ArrowDown'
                                        ? current + 3 < 12
                                            ? current + 3
                                            : current
                                        : event.key === 'ArrowUp'
                                          ? current >= 3
                                              ? current - 3
                                              : current
                                          : event.key === 'Home'
                                            ? event.ctrlKey
                                                ? 0
                                                : current - (current % 3)
                                            : event.key === 'End'
                                              ? event.ctrlKey
                                                  ? 11
                                                  : current - (current % 3) + 2
                                              : null;

                            if (next === null) {
                                return;
                            }

                            event.preventDefault();
                            setFocusedMonth(next);
                            monthButtons.current[next]?.focus();
                        }}
                    >
                        {[0, 1, 2, 3].map((row) => (
                            <div role="row" key={row}>
                                {months
                                    .slice(row * 3, row * 3 + 3)
                                    .map((label, column) => {
                                        const month = row * 3 + column;
                                        const checked =
                                            selected?.year === year &&
                                            selected.month === month;

                                        return (
                                            <div
                                                role="gridcell"
                                                key={label}
                                                aria-selected={checked}
                                            >
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    data-month={month}
                                                    data-selected={checked}
                                                    aria-label={`${label} ${yearText(year)}`}
                                                    tabIndex={
                                                        focusedMonth === month
                                                            ? 0
                                                            : -1
                                                    }
                                                    ref={(element) => {
                                                        monthButtons.current[
                                                            month
                                                        ] = element;
                                                    }}
                                                    onFocus={() =>
                                                        setFocusedMonth(month)
                                                    }
                                                    onClick={() => {
                                                        onChange(
                                                            `${yearText(year)}-${String(month + 1).padStart(2, '0')}`,
                                                        );
                                                        setOpen(false);
                                                    }}
                                                >
                                                    {label.slice(0, 3)}
                                                </Button>
                                            </div>
                                        );
                                    })}
                            </div>
                        ))}
                    </div>
                    <p className="jr-month-picker-hint">
                        Choose a month. Click the year to jump to another year.
                    </p>
                </PopoverContent>
            </Popover>
        </>
    );
}

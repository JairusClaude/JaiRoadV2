import { CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export function DirectoryFilter({
    label,
    value,
    options,
    onChange,
    className,
    disabled = false,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
}) {
    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger aria-label={label} className={className}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent
                className="jr-theme jr-menu jr-filter-menu"
                align="start"
                sideOffset={4}
            >
                {options.map((option) => (
                    <SelectItem
                        key={option.value}
                        value={option.value}
                        title={option.label}
                        className="[&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
                    >
                        <span className="block truncate">{option.label}</span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export function DirectorySelectionToolbar({
    selecting,
    selectedCount,
    total,
    singular,
    plural,
    canDelete,
    disabled,
    onSelect,
    onCancel,
    onDelete,
}: {
    selecting: boolean;
    selectedCount: number;
    total: number;
    singular: string;
    plural: string;
    canDelete: boolean;
    disabled: boolean;
    onSelect: () => void;
    onCancel: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="jr-table-toolbar">
            <span role="status">
                {selecting
                    ? `${selectedCount} selected`
                    : `${total} ${total === 1 ? singular : plural} found`}
            </span>
            {selecting ? (
                <div className="flex gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        Cancel selection
                    </Button>
                    {canDelete && (
                        <Button
                            className="jr-danger"
                            disabled={selectedCount === 0 || disabled}
                            onClick={onDelete}
                        >
                            Delete selected
                        </Button>
                    )}
                </div>
            ) : (
                <Button
                    variant="outline"
                    disabled={disabled || total === 0}
                    onClick={onSelect}
                >
                    <CheckSquare />
                    Select {plural}
                </Button>
            )}
        </div>
    );
}

export function DirectoryPagination({
    total,
    from,
    to,
    currentPage,
    lastPage,
    plural,
    label,
    ready = true,
    busy = false,
    readOnly = false,
    onPage,
}: {
    total: number;
    from: number | null;
    to: number | null;
    currentPage: number;
    lastPage: number;
    plural: string;
    label: string;
    ready?: boolean;
    busy?: boolean;
    readOnly?: boolean;
    onPage: (page: number) => void;
}) {
    const first = Math.max(1, Math.min(currentPage - 2, lastPage - 4));
    const pages = Array.from(
        { length: Math.min(5, lastPage) },
        (_, i) => first + i,
    );

    return (
        <footer className="jr-table-footer">
            <span>
                {total > 0
                    ? `Showing ${from}–${to} of ${total} ${plural}`
                    : `0 ${plural}`}
                {readOnly && ready ? ' · Read-only access' : ''}
            </span>
            <nav aria-label={label} className="flex gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Previous page"
                    disabled={busy || currentPage <= 1}
                    onClick={() => onPage(currentPage - 1)}
                >
                    <ChevronLeft />
                </Button>
                {pages.map((page) => (
                    <Button
                        key={page}
                        variant={page === currentPage ? 'secondary' : 'ghost'}
                        size="icon"
                        aria-current={page === currentPage ? 'page' : undefined}
                        disabled={busy || !ready}
                        onClick={() => onPage(page)}
                    >
                        {page}
                    </Button>
                ))}
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Next page"
                    disabled={busy || currentPage >= lastPage}
                    onClick={() => onPage(currentPage + 1)}
                >
                    <ChevronRight />
                </Button>
            </nav>
        </footer>
    );
}

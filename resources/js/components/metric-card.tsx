import type { ReactNode } from 'react';

export interface MetricCardProps {
    title: string;
    value: ReactNode;
    subtitle?: string;
    highlight?: boolean;
    className?: string;
    icon?: ReactNode;
}

export function MetricCard({
    title,
    value,
    subtitle,
    highlight = false,
    className = '',
    icon,
}: MetricCardProps) {
    return (
        <div
            className={`jr-metric-card relative rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm ${className}`}
        >
            <p
                className={`text-xs font-semibold tracking-wider uppercase ${
                    highlight ? 'text-[#98502D]' : 'text-[#64748B]'
                }`}
            >
                {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-[#1E293B]">{value}</p>
            {subtitle && (
                <p className="mt-1 text-xs text-[#64748B]">{subtitle}</p>
            )}
            {icon && (
                <span
                    className="jr-metric-icon absolute top-4 right-4 flex size-10 items-center justify-center rounded-xl bg-[var(--jr-role-accent-soft,#f4e9dc)] text-[var(--jr-role-accent,#90451f)]"
                    aria-hidden="true"
                >
                    {icon}
                </span>
            )}
        </div>
    );
}

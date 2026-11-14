import type { ReactNode } from 'react';

export interface MetricCardProps {
    title: string;
    value: ReactNode;
    subtitle?: string;
    highlight?: boolean;
    className?: string;
}

export function MetricCard({
    title,
    value,
    subtitle,
    highlight = false,
    className = '',
}: MetricCardProps) {
    return (
        <div
            className={`jr-metric-card rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm ${className}`}
        >
            <p
                className={`text-xs font-semibold uppercase tracking-wider ${
                    highlight ? 'text-[#98502D]' : 'text-[#64748B]'
                }`}
            >
                {title}
            </p>
            <p className="mt-2 text-3xl font-bold text-[#1E293B]">{value}</p>
            {subtitle && (
                <p className="mt-1 text-xs text-[#64748B]">{subtitle}</p>
            )}
        </div>
    );
}

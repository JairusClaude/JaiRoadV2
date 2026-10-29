export function MonthlyProgress({
    value,
    label = 'Maintenance progress',
}: {
    value: number;
    label?: string;
}) {
    return (
        <div className="jr-monthly-progress">
            <span>{value}%</span>
            <div
                className="jr-monthly-progress-track"
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
            >
                <span style={{ width: `${value}%` }} />
            </div>
        </div>
    );
}

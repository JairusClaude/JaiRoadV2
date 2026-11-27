import { useState } from 'react';

export type MaintenanceIntelligenceSummary = {
    asOf: string;
    reportingMonth: string;
    conditions: Record<'Good' | 'Fair' | 'Bad', number>;
    noCurrentReport: number;
    pastEstimate: number;
    ongoingCount: number;
    calendar: {
        id: number;
        projectTitle: string;
        startDate: string;
        estimatedFinish: string;
    }[];
};

const factors = [
    { label: 'Condition severity', weight: 30 },
    { label: 'Maintenance urgency', weight: 25 },
    { label: 'Road importance', weight: 20 },
    { label: 'Overdue severity', weight: 15 },
    { label: 'Safety concern', weight: 10 },
];

function downloadCalendar(items: MaintenanceIntelligenceSummary['calendar']) {
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    const escape = (value: string) =>
        value
            .replace(/\\/g, '\\\\')
            .replace(/\r?\n|\r/g, '\\n')
            .replace(/;/g, '\\;')
            .replace(/,/g, '\\,');
    const events = items.flatMap((item) => [
        'BEGIN:VEVENT',
        'UID:jairoads-estimate-' + item.id + '@jairoads',
        'DTSTAMP:' + timestamp,
        'DTSTART;VALUE=DATE:' + item.estimatedFinish.replaceAll('-', ''),
        'SUMMARY:' + escape('Estimated finish: ' + item.projectTitle),
        'DESCRIPTION:Estimated date only. Confirm the official schedule before acting.',
        'END:VEVENT',
    ]);
    const url = URL.createObjectURL(
        new Blob(
            [
                [
                    'BEGIN:VCALENDAR',
                    'VERSION:2.0',
                    'PRODID:-//JaiROADS//Maintenance estimates//EN',
                    ...events,
                    'END:VCALENDAR',
                    '',
                ].join('\r\n'),
            ],
            { type: 'text/calendar;charset=utf-8' },
        ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'jairoads-maintenance-estimates.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function PriorityScenario() {
    const [values, setValues] = useState([0, 0, 0, 0, 0]);
    const score = factors.reduce(
        (sum, factor, index) => sum + (values[index] * factor.weight) / 100,
        0,
    );

    return (
        <details className="mt-4 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer font-semibold">
                Maintenance priority scenario
            </summary>
            <p className="mt-2 text-sm text-slate-600">
                Illustrative weights only. Enter assumed severity values from 0
                to 100. This does not assess or rank actual roads.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {factors.map((factor, index) => (
                    <label key={factor.label} className="grid gap-1 text-sm">
                        {factor.label} ({factor.weight}%): {values[index]}
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={values[index]}
                            onChange={(event) => {
                                const value = Number(event.target.value);
                                setValues((previous) =>
                                    previous.map((item, i) =>
                                        i === index ? value : item,
                                    ),
                                );
                            }}
                        />
                    </label>
                ))}
            </div>
            <p className="mt-3 font-semibold" aria-live="polite">
                Scenario score: {score.toFixed(1)} / 100
            </p>
        </details>
    );
}

export function MaintenanceIntelligencePanel({
    data,
}: {
    data: MaintenanceIntelligenceSummary;
}) {
    return (
        <section
            aria-label="Maintenance intelligence"
            className="jr-command-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
        >
            <h2 className="text-lg font-bold">Maintenance intelligence</h2>
            <p className="mt-1 text-sm text-slate-500">
                Stored road conditions and reporting indicators as of{' '}
                {data.asOf}. Estimates are not approved deadlines.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Object.entries(data.conditions).map(([condition, count]) => (
                    <div
                        key={condition}
                        className="rounded-xl border border-slate-200 p-3"
                    >
                        <dt className="text-sm">{condition} road condition</dt>
                        <dd className="text-xl font-bold tabular-nums">
                            {count}
                        </dd>
                    </div>
                ))}
                <div className="rounded-xl border border-slate-200 p-3">
                    <dt className="text-sm">
                        Started ongoing records without {data.reportingMonth}{' '}
                        report
                    </dt>
                    <dd className="text-xl font-bold tabular-nums">
                        {data.noCurrentReport}
                    </dd>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                    <dt className="text-sm">Ongoing past estimated finish</dt>
                    <dd className="text-xl font-bold tabular-nums">
                        {data.pastEstimate}
                    </dd>
                </div>
            </dl>
            <h3 className="mt-5 font-semibold">Maintenance schedule</h3>
            <p className="text-sm text-slate-500">
                Showing {data.calendar.length} of {data.ongoingCount} ongoing
                records, earliest estimated finish first.
            </p>
            {data.calendar.length > 0 && (
                <button
                    type="button"
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                    onClick={() => downloadCalendar(data.calendar)}
                >
                    Download estimated schedule (.ics)
                </button>
            )}
            <ul className="mt-3 space-y-2">
                {data.calendar.map((item) => (
                    <li
                        key={item.id}
                        className="rounded-lg border border-slate-200 p-3"
                    >
                        <strong className="break-words">
                            {item.projectTitle}
                        </strong>
                        <p className="text-sm text-slate-600">
                            Start: {item.startDate} · Estimated finish:{' '}
                            {item.estimatedFinish}
                        </p>
                    </li>
                ))}
            </ul>
            {data.calendar.length === 0 && (
                <p className="mt-2 text-sm">No ongoing maintenance records.</p>
            )}
            <PriorityScenario />
        </section>
    );
}

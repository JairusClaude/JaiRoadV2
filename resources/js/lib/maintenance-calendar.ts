type CalendarEstimate = {
    id: number;
    projectTitle: string;
    estimatedFinish: string;
};

const escapeText = (value: string) =>
    value
        .replace(/\\/g, '\\\\')
        .replace(/\r\n|\r|\n/g, '\\n')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,');

// RFC 5545 content lines are folded at 75 octets, not UTF-16 code units.
// A continuation starts with one space; preserve complete UTF-8 characters.
function foldLine(line: string): string {
    const encoder = new TextEncoder();
    let bytes = 0;
    let result = '';

    for (const character of line) {
        const length = encoder.encode(character).length;

        if (bytes + length > 75) {
            result += '\r\n ';
            bytes = 1;
        }

        result += character;
        bytes += length;
    }

    return result;
}

export function maintenanceCalendar(
    items: CalendarEstimate[],
    generatedAt = new Date(),
): string {
    const timestamp = generatedAt
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    const events = items.flatMap((item) => [
        'BEGIN:VEVENT',
        'UID:jairoads-estimate-' + item.id + '@jairoads',
        'DTSTAMP:' + timestamp,
        'DTSTART;VALUE=DATE:' + item.estimatedFinish.replaceAll('-', ''),
        'SUMMARY:' + escapeText('Estimated finish: ' + item.projectTitle),
        'DESCRIPTION:Estimated date only. Confirm the official schedule before acting.',
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        'DESCRIPTION:Review estimated maintenance finish date',
        'END:VALARM',
        'END:VEVENT',
    ]);

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//JaiROADS//Maintenance estimates//EN',
        'CALSCALE:GREGORIAN',
        ...events,
        'END:VCALENDAR',
    ];

    return lines.map(foldLine).join('\r\n') + '\r\n';
}

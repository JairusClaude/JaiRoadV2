type Cell = string | number;

export type AnalyticsReport = {
    scope: string;
    id: string;
    generatedAt: string;
    reportingMonth: string;
    cards: { label: string; value: number }[];
    reportingCoverage: number | null;
    trend: { month: string; count: number }[];
};

const encoder = new TextEncoder();
const xml = (text: string) =>
    Array.from(text)
        .filter((character) => {
            const code = character.codePointAt(0) ?? 0;

            return (
                code === 9 ||
                code === 10 ||
                code === 13 ||
                (code >= 32 && code <= 0xd7ff) ||
                (code >= 0xe000 && code <= 0xfffd) ||
                code >= 0x10000
            );
        })
        .join('')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

function csvCell(value: Cell) {
    if (typeof value === 'number') {
        return String(value);
    }

    // Neutralize spreadsheet formulas and leading spreadsheet control prefixes.
    const safe = /^(?:[\t\r\n]|\s*[=+\-@])/.test(value) ? "'" + value : value;

    return '"' + safe.replaceAll('"', '""') + '"';
}

export function analyticsCsv(report: AnalyticsReport) {
    const rows: Cell[][] = [
        ['report_scope', 'category', 'metric', 'period', 'value', 'unit'],
        ...report.cards.map(({ label, value }) => [
            report.scope,
            'maintenance',
            label,
            '',
            value,
            'count',
        ]),
        [
            report.scope,
            'maintenance',
            'Reporting coverage',
            report.reportingMonth,
            report.reportingCoverage ?? '',
            'percent',
        ],
        ...report.trend.map(({ month, count }) => [
            report.scope,
            'monthly_trend',
            'Monthly updates',
            month,
            count,
            'count',
        ]),
    ];

    return (
        '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
    );
}

function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;

    for (const byte of bytes) {
        crc ^= byte;

        for (let bit = 0; bit < 8; bit++) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }

    return (crc ^ 0xffffffff) >>> 0;
}

function zip(files: Record<string, string>) {
    const chunks: Uint8Array[] = [];
    const directory: Uint8Array[] = [];
    let offset = 0;
    let directorySize = 0;

    for (const [name, content] of Object.entries(files)) {
        const fileName = encoder.encode(name);
        const bytes = encoder.encode(content);
        const crc = crc32(bytes);
        const local = new Uint8Array(30 + fileName.length);
        const lh = new DataView(local.buffer);
        lh.setUint32(0, 0x04034b50, true);
        lh.setUint16(4, 20, true);
        lh.setUint16(10, 0, true);
        lh.setUint16(12, 33, true);
        lh.setUint32(14, crc, true);
        lh.setUint32(18, bytes.length, true);
        lh.setUint32(22, bytes.length, true);
        lh.setUint16(26, fileName.length, true);
        local.set(fileName, 30);

        const central = new Uint8Array(46 + fileName.length);
        const ch = new DataView(central.buffer);
        ch.setUint32(0, 0x02014b50, true);
        ch.setUint16(4, 20, true);
        ch.setUint16(6, 20, true);
        ch.setUint16(12, 0, true);
        ch.setUint16(14, 33, true);
        ch.setUint32(16, crc, true);
        ch.setUint32(20, bytes.length, true);
        ch.setUint32(24, bytes.length, true);
        ch.setUint16(28, fileName.length, true);
        ch.setUint32(42, offset, true);
        central.set(fileName, 46);

        chunks.push(local, bytes);
        directory.push(central);
        offset += local.length + bytes.length;
        directorySize += central.length;
    }

    const footer = new Uint8Array(22);
    const end = new DataView(footer.buffer);
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, directory.length, true);
    end.setUint16(10, directory.length, true);
    end.setUint32(12, directorySize, true);
    end.setUint32(16, offset, true);
    const result = new Uint8Array(offset + directorySize + footer.length);
    let position = 0;

    for (const chunk of [...chunks, ...directory, footer]) {
        result.set(chunk, position);
        position += chunk.length;
    }

    return result;
}

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const sheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relNs =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkgNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
const typeNs = 'http://schemas.openxmlformats.org/package/2006/content-types';

function reportSheets(report: AnalyticsReport) {
    return [
        {
            name: 'Overview',
            rows: [
                ['Inventory snapshot', 'Value'],
                ['Scope', report.scope],
                ['Current reporting month', report.reportingMonth],
                [
                    'Updates in period',
                    report.trend.reduce((total, item) => total + item.count, 0),
                ],
                [
                    'Current reporting coverage',
                    report.reportingCoverage === null
                        ? 'Not applicable'
                        : report.reportingCoverage / 100,
                ],
            ],
            percentageRow: 5,
        },
        {
            name: 'Maintenance',
            rows: [
                ['Metric', 'Count'],
                ...report.cards.map(({ label, value }) => [label, value]),
            ],
        },
        {
            name: 'Monthly Trends',
            dataBars: report.trend.length > 0,
            rows: [
                ['Reporting month', 'Update count'],
                ...report.trend.map(({ month, count }) => [month, count]),
            ],
        },
        {
            name: 'Report Information',
            rows: [
                ['Field', 'Value'],
                ['Report ID', report.id],
                ['Generated (UTC)', report.generatedAt],
                ['Scope', report.scope],
                ['Classification', 'Operational aggregate summary'],
                ['Source', 'Visible JaiROADS dashboard aggregates'],
                [
                    'Coverage basis',
                    'Ongoing records with a report in the current month',
                ],
                [
                    'Missing coverage',
                    'Not applicable when there are no ongoing records',
                ],
            ],
        },
    ];
}

function worksheet(rows: Cell[][], dataBars = false, percentageRow?: number) {
    const body = rows
        .map((row, index) => {
            const rowNumber = index + 1;
            const cells = row
                .map((value, column) => {
                    const ref = String.fromCharCode(65 + column) + rowNumber;
                    const style =
                        index === 0
                            ? 1
                            : typeof value === 'number' &&
                                rowNumber === percentageRow &&
                                column === 1
                              ? 3
                              : index % 2 === 0
                                ? 2
                                : 0;
                    const attr = ' r="' + ref + '" s="' + style + '"';

                    return typeof value === 'number' && Number.isFinite(value)
                        ? '<c' + attr + '><v>' + value + '</v></c>'
                        : '<c' +
                              attr +
                              ' t="inlineStr"><is><t xml:space="preserve">' +
                              xml(String(value)) +
                              '</t></is></c>';
                })
                .join('');

            return '<row r="' + rowNumber + '">' + cells + '</row>';
        })
        .join('');

    return (
        xmlHeader +
        '<worksheet xmlns="' +
        sheetNs +
        '">' +
        '<sheetViews><sheetView workbookViewId="0">' +
        '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
        '</sheetView></sheetViews>' +
        '<cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="2" width="60" customWidth="1"/></cols>' +
        '<sheetData>' +
        body +
        '</sheetData>' +
        '<autoFilter ref="A1:B' +
        rows.length +
        '"/>' +
        (dataBars
            ? '<conditionalFormatting sqref="B2:B' +
              rows.length +
              '"><cfRule type="dataBar" priority="1"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FF2F61AB"/></dataBar></cfRule></conditionalFormatting>'
            : '') +
        '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>' +
        '<pageSetup paperSize="9" orientation="portrait"/>' +
        '</worksheet>'
    );
}

export function analyticsXlsx(report: AnalyticsReport) {
    const sheets = reportSheets(report);
    const paths = sheets.map((_, i) => 'worksheets/sheet' + (i + 1) + '.xml');
    const overrides = paths
        .map(
            (path) =>
                '<Override PartName="/xl/' +
                path +
                '" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
        )
        .join('');
    const entries = Object.fromEntries(
        sheets.map(({ rows, dataBars, percentageRow }, i) => [
            'xl/' + paths[i],
            worksheet(rows, dataBars, percentageRow),
        ]),
    );

    return zip({
        '[Content_Types].xml':
            xmlHeader +
            '<Types xmlns="' +
            typeNs +
            '">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
            overrides +
            '</Types>',
        '_rels/.rels':
            xmlHeader +
            '<Relationships xmlns="' +
            pkgNs +
            '"><Relationship Id="rId1" Type="' +
            relNs +
            '/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml':
            xmlHeader +
            '<workbook xmlns="' +
            sheetNs +
            '" xmlns:r="' +
            relNs +
            '"><bookViews><workbookView/></bookViews><sheets>' +
            sheets
                .map(
                    ({ name }, i) =>
                        '<sheet name="' +
                        xml(name) +
                        '" sheetId="' +
                        (i + 1) +
                        '" r:id="rId' +
                        (i + 1) +
                        '"/>',
                )
                .join('') +
            '</sheets></workbook>',
        'xl/_rels/workbook.xml.rels':
            xmlHeader +
            '<Relationships xmlns="' +
            pkgNs +
            '">' +
            paths
                .map(
                    (path, i) =>
                        '<Relationship Id="rId' +
                        (i + 1) +
                        '" Type="' +
                        relNs +
                        '/worksheet" Target="' +
                        path +
                        '"/>',
                )
                .join('') +
            '<Relationship Id="styles" Type="' +
            relNs +
            '/styles" Target="styles.xml"/></Relationships>',
        'xl/styles.xml':
            xmlHeader +
            '<styleSheet xmlns="' +
            sheetNs +
            '">' +
            '<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts>' +
            '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
            '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
            '<fills count="4"><fill><patternFill patternType="none"/></fill>' +
            '<fill><patternFill patternType="gray125"/></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FF102B54"/><bgColor indexed="64"/></patternFill></fill>' +
            '<fill><patternFill patternType="solid"><fgColor rgb="FFF0F4FA"/><bgColor indexed="64"/></patternFill></fill></fills>' +
            '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
            '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
            '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
            '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
            '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>' +
            '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
            '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
        ...entries,
    });
}

function pdfLiteral(value: string) {
    return Array.from(value, (character) => {
        const code = character.codePointAt(0) ?? 0;

        if (code >= 160 && code <= 255) {
            return '\\' + code.toString(8).padStart(3, '0');
        }

        return code >= 32 && code <= 126
            ? character.replace(/[\\()]/g, '\\$&')
            : '?';
    }).join('');
}

function pdfText(
    value: string,
    x: number,
    y: number,
    size: number,
    bold = false,
) {
    return (
        'BT /F' +
        (bold ? '2' : '1') +
        ' ' +
        size +
        ' Tf ' +
        x +
        ' ' +
        y +
        ' Td (' +
        pdfLiteral(value) +
        ') Tj ET'
    );
}

function wrapPdfText(text: string, width: number) {
    let remaining = text.trim();
    const lines = [];

    while (remaining.length > width) {
        const space = remaining.lastIndexOf(' ', width);
        const split = space > 0 ? space : width;
        lines.push(remaining.slice(0, split));
        remaining = remaining.slice(split).trimStart();
    }

    return [...lines, remaining];
}

export function analyticsPdf(report: AnalyticsReport) {
    const rows = reportSheets(report).flatMap(({ name, rows }) => [
        { title: true, label: name, value: '' },
        ...rows.slice(1).flatMap(([label, value]) => {
            const labels = wrapPdfText(String(label), 31);
            const values = wrapPdfText(
                label === 'Current reporting coverage' &&
                    typeof value === 'number'
                    ? (value * 100).toFixed(1) + '%'
                    : String(value),
                50,
            );

            return Array.from(
                { length: Math.max(labels.length, values.length) },
                (_, i) => ({
                    title: false,
                    label: labels[i] ?? '',
                    value: values[i] ?? '',
                }),
            );
        }),
    ]);
    const pages = Array.from({ length: Math.ceil(rows.length / 26) }, (_, i) =>
        rows.slice(i * 26, (i + 1) * 26),
    );
    const kids = pages.map((_, i) => 5 + i * 2 + ' 0 R').join(' ');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ];
    const peak = Math.max(1, ...report.trend.map(({ count }) => count));
    const trend = new Map(
        report.trend.map(({ month, count }) => [month, count]),
    );

    pages.forEach((page, index) => {
        const stream = [
            '0.06 0.17 0.33 rg 0 726 595 116 re f',
            '1 1 1 rg',
            pdfText('JaiROADS | Inventory Analytics', 42, 795, 23, true),
            pdfText(
                report.scope + ' | Operational aggregate summary',
                42,
                770,
                11,
            ),
            pdfText('Reporting month ' + report.reportingMonth, 42, 749, 10),
            ...page.flatMap(({ title, label, value }, row) => {
                const y = 692 - row * 23;

                if (title) {
                    return [
                        '0.88 0.92 0.98 rg 42 ' + (y - 6) + ' 511 21 re f',
                        '0.06 0.17 0.33 rg',
                        pdfText(label, 49, y, 11, true),
                    ];
                }

                const count = trend.get(label);
                const bar = count ? Math.round((count / peak) * 120) : 0;

                return [
                    '0.92 0.94 0.97 rg 42 ' + (y - 7) + ' 511 1 re f',
                    ...(bar
                        ? [
                              '0.18 0.38 0.67 rg 360 ' +
                                  (y - 2) +
                                  ' ' +
                                  bar +
                                  ' 8 re f',
                          ]
                        : []),
                    '0.11 0.18 0.28 rg',
                    pdfText(label, 49, y, 10),
                    pdfText(value, 238, y, 10),
                ];
            }),
            '0.25 0.34 0.49 rg',
            pdfText(report.id, 42, 56, 8),
            pdfText('Page ' + (index + 1) + ' of ' + pages.length, 493, 56, 8),
        ].join('\n');
        const content = 6 + index * 2;
        objects.push(
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' +
                content +
                ' 0 R >>',
            '<< /Length ' +
                encoder.encode(stream).length +
                ' >>\nstream\n' +
                stream +
                '\nendstream',
        );
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((object, index) => {
        offsets.push(encoder.encode(pdf).length);
        pdf += index + 1 + ' 0 obj\n' + object + '\nendobj\n';
    });

    const xref = encoder.encode(pdf).length;
    pdf += 'xref\n0 ' + offsets.length + '\n0000000000 65535 f \n';
    pdf += offsets
        .slice(1)
        .map((offset) => String(offset).padStart(10, '0') + ' 00000 n \n')
        .join('');
    pdf +=
        'trailer\n<< /Size ' +
        offsets.length +
        ' /Root 1 0 R >>\nstartxref\n' +
        xref +
        '\n%%EOF\n';

    return encoder.encode(pdf);
}

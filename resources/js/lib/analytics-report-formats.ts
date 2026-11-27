// Small, dependency-free formats for the bounded two-column dashboard summary.
// XLSX uses a standard uncompressed ZIP and inline-string cells. PDF uses the
// standard built-in Helvetica font; no markup or formula execution is involved.
type Cell = string | number;
const encoder = new TextEncoder();
const xml = (text: string) =>
    Array.from(text)
        .filter((character) => {
            const code = character.charCodeAt(0);

            return code >= 32 || code === 9 || code === 10 || code === 13;
        })
        .join('')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');

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

export function analyticsXlsx(rows: Cell[][]) {
    const body = rows
        .map((row, index) => {
            const cells = row
                .map((value, column) => {
                    const ref = String.fromCharCode(65 + column) + (index + 1);

                    return typeof value === 'number' && Number.isFinite(value)
                        ? '<c r="' + ref + '"><v>' + value + '</v></c>'
                        : '<c r="' +
                              ref +
                              '" t="inlineStr"><is><t xml:space="preserve">' +
                              xml(String(value)) +
                              '</t></is></c>';
                })
                .join('');

            return '<row r="' + (index + 1) + '">' + cells + '</row>';
        })
        .join('');
    const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const sheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const relNs =
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const pkgNs =
        'http://schemas.openxmlformats.org/package/2006/relationships';
    const typeNs =
        'http://schemas.openxmlformats.org/package/2006/content-types';

    return zip({
        '[Content_Types].xml':
            header +
            '<Types xmlns="' +
            typeNs +
            '">' +
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
            '<Default Extension="xml" ContentType="application/xml"/>' +
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
            '</Types>',
        '_rels/.rels':
            header +
            '<Relationships xmlns="' +
            pkgNs +
            '">' +
            '<Relationship Id="rId1" Type="' +
            relNs +
            '/officeDocument" Target="xl/workbook.xml"/>' +
            '</Relationships>',
        'xl/workbook.xml':
            header +
            '<workbook xmlns="' +
            sheetNs +
            '" xmlns:r="' +
            relNs +
            '">' +
            '<sheets><sheet name="Summary" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'xl/_rels/workbook.xml.rels':
            header +
            '<Relationships xmlns="' +
            pkgNs +
            '">' +
            '<Relationship Id="rId1" Type="' +
            relNs +
            '/worksheet" Target="worksheets/sheet1.xml"/>' +
            '</Relationships>',
        'xl/worksheets/sheet1.xml':
            header +
            '<worksheet xmlns="' +
            sheetNs +
            '">' +
            '<cols><col min="1" max="1" width="35" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/></cols>' +
            '<sheetData>' +
            body +
            '</sheetData></worksheet>',
    });
}

export function analyticsPdf(rows: Cell[][]) {
    // Dashboard labels, scope and numerical metrics are bounded ASCII. Strip
    // unsupported characters rather than emitting malformed font encodings.
    const literal = (value: string) =>
        value.replace(/[^\x20-\x7e]/g, '?').replace(/[\\()]/g, '\\    // Dashboard labels, scope and numerical metrics are bounded ASCII. Strip
    // unsupported characters rather than emitting malformed font encodings.
    const literal = (value: string) =>
        value
            .replace(/[^\x20-\x7e]/g, '?')
            .replace(/[\\()]/g, '\\$&');
    const lines = [
        'JaiROADS | Dashboard summary',
        'Visible aggregate metrics only',');
    const lines = [
        'JaiROADS | Dashboard summary',
        'Visible aggregate metrics only',
        '',
        ...rows.map((row) => row.map(String).join('   |   ')),
    ];
    const stream = [
        'BT /F1 12 Tf 48 790 Td 18 TL',
        ...lines.map(
            (line, index) =>
                (index ? 'T* ' : '') + '(' + literal(line) + ') Tj',
        ),
        'ET',
    ].join('\n');
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< /Length ' +
            encoder.encode(stream).length +
            ' >>\nstream\n' +
            stream +
            '\nendstream',
    ];
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

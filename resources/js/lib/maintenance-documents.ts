export const documentFormats: Record<string, { name: string; mime: string }> = {
    pdf: { name: 'PDF', mime: 'application/pdf' },
    docx: {
        name: 'Word document',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    xlsx: {
        name: 'Excel workbook',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    pptx: {
        name: 'PowerPoint presentation',
        mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    },
};
export const documentExtension = (name: string) =>
    name.split('.').pop()?.toLowerCase() ?? '';
export const documentType = (name: string) =>
    documentFormats[documentExtension(name)]?.name ?? 'Document';
export const documentAccept = Object.keys(documentFormats)
    .map((ext) => `.${ext}`)
    .join(',');
export function documentFileError(file: File) {
    const format = documentFormats[documentExtension(file.name)];

    if (
        !format ||
        (file.type &&
            file.type !== format.mime &&
            file.type !== 'application/octet-stream')
    ) {
        return 'Choose a PDF, DOCX, XLSX, or PPTX document.';
    }

    if (!file.size) {
        return 'Choose a document that is not empty.';
    }

    return '';
}

export const documentDate = (value: string) =>
    Number.isFinite(Date.parse(value))
        ? new Intl.DateTimeFormat('en-PH', {
              dateStyle: 'medium',
              timeZone: 'UTC',
          }).format(new Date(value))
        : 'Unavailable';

export const documentFormats = {
    pdf: { name: 'PDF', mime: 'application/pdf' },
    docx: { name: 'Word document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    xlsx: { name: 'Excel workbook', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    pptx: { name: 'PowerPoint presentation', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
};
export const documentExtension = (name) => name.split('.').pop()?.toLowerCase() ?? '';

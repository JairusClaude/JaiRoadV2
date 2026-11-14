import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { documentFormats, documentExtension } from './document-formats.mjs';
import { maintenanceDocuments as documents, records } from './records.mjs';
const bytes = new Map();
let nextId = 1;
const base = '/maintenance-documents';
const context = (doc, projects, summary) => {
    const record = records.find(r => r.id === doc.maintenance_id);
    const project = projects.find(p => p.id === record?.project_id);

    return record && project ? { ...doc, record: { id: record.id, project_id: record.project_id, quarter: record.quarter, year: record.year }, project: summary(project), available: bytes.has(doc.id) } : null;
};
export function documentPage(url, projects, summary) {
    const match = url.pathname.match(/^\/maintenance-documents(?:\/(create|\d+)(\/edit)?)?$/);

    if (!match) {
return null;
}

    const document = /^\d+$/.test(match[1] || '') ? documents.find(d => d.id === Number(match[1])) : null;

    if (match[1] && match[1] !== 'create' && !document) {
return null;
}

    if (match[1] === 'create' || match[2]) {
        const id = document?.maintenance_id ?? Number(url.searchParams.get('record'));
        const record = records.find(r => r.id === id);

        if ((id || url.searchParams.has('record')) && !record) {
return null;
}

        return { component: 'MaintenanceDocuments/Form', props: {
            projects: projects.map(summary), records: records.map(({id, project_id, quarter, year}) => ({id, project_id, quarter, year})),
            contextRecordId: record?.id, document: document ? context(document, projects, summary) : undefined,
            cancelUrl: document ? `${base}/${document.id}` : record ? `/maintenance-projects/${record.project_id}/records/${record.id}` : base,
            submitUrl: document ? `${base}/${document.id}${url.search}` : `${base}${url.search}`,
        } };
    }

    if (document) {
return { component: 'MaintenanceDocuments/Show', props: { document: context(document, projects, summary) } };
}

    const filters = { search: url.searchParams.get('search') || '', project: url.searchParams.get('project') || '', sort: url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest' };
    const rows = documents.map(d => context(d, projects, summary)).filter(Boolean).filter(d =>
        `${d.document_title}\n${d.file_name}`.toLowerCase().includes(filters.search.trim().toLowerCase()) && (!filters.project || String(d.project.id) === filters.project));
    rows.sort((a,b) => (a.uploaded_at.localeCompare(b.uploaded_at) || a.id - b.id) * (filters.sort === 'oldest' ? 1 : -1));
    const last = Math.max(1, Math.ceil(rows.length/10));
    const page = Math.min(last, Math.max(1, Math.trunc(Number(url.searchParams.get('page'))) || 1));

    return { component: 'MaintenanceDocuments/Index', props: { projects: projects.map(summary), filters, documents: { data: rows.slice((page-1)*10,page*10), total: rows.length, current_page: page, last_page: last, from: rows.length ? (page-1)*10+1 : null, to: rows.length ? Math.min(page*10, rows.length) : null } } };
}
function officeSignature(data, ext) {
    // Inspect the central directory, without extracting or executing file contents.
    if (data.readUInt32LE(0) !== 0x04034b50) {
return false;
}

    const names = new Set();

    for (let i=0; i+46<=data.length; i++) {
        if (data.readUInt32LE(i) !== 0x02014b50) {
continue;
}

        const n=data.readUInt16LE(i+28), extra=data.readUInt16LE(i+30), comment=data.readUInt16LE(i+32);

        if (i+46+n+extra+comment>data.length) {
return false;
}

        names.add(data.toString('utf8',i+46,i+46+n));
        i+=45+n+extra+comment;
    }

    return names.has('[Content_Types].xml') && names.has({docx:'word/document.xml',xlsx:'xl/workbook.xml',pptx:'ppt/presentation.xml'}[ext]);
}
export async function mutateDocument(method, url, data, files, projects) {
    const match = url.pathname.match(/^\/maintenance-documents(?:\/(bulk|\d+))?$/);

    if (!match) {
return null;
}

    const id = Number(match[1]);

    if (method === 'DELETE') {
        const ids = match[1] === 'bulk' ? data.document_ids : [id];

        if (!Array.isArray(ids) || !ids.length || ids.length>100 || new Set(ids.map(Number)).size!==ids.length || ids.some(i=>!documents.some(d=>d.id===Number(i)))) {
return { location: base, errors: { document_ids: 'Select valid existing documents.' } };
}

        const returnRecord = records.find(r => String(r.id) === url.searchParams.get('record'));
        const back = returnRecord && ids.every(id => documents.some(d => d.id === Number(id) && d.maintenance_id === returnRecord.id)) ? `/maintenance-projects/${returnRecord.project_id}/records/${returnRecord.id}` : base;

        for (let i=documents.length-1;i>=0;i--) {
if (ids.map(Number).includes(documents[i].id)) {
 bytes.delete(documents[i].id); documents.splice(i,1);
}
}

        return { location: back };
    }

    if (!['POST','PUT'].includes(method) || (method==='POST' && match[1]) || (method==='PUT' && !id)) {
return null;
}

    // Read bytes before resolving mutable associations; deletion during upload must not create orphans.
    const prepared = files.length===1 ? { data: Buffer.from(await files[0].arrayBuffer()), name: files[0].name, type: files[0].type } : null;
    const current = id ? documents.find(d=>d.id===id) : null;

    if (id && !current) {
return null;
}

    const location = current ? `${base}/${id}/edit${url.search}` : `${base}/create${url.search}`;
    const errors = {};
    const title = String(data.document_title || '').trim();

    if (!title || title.length>255) {
errors.document_title = 'Enter a document title of 255 characters or fewer.';
}

    const record = records.find(r=>r.id===Number(data.maintenance_id));

    if (!record || !projects.some(p=>p.id===record.project_id) || Number(data.project_id)!==record.project_id) {
errors.maintenance_id='Select a valid Maintenance Record for the selected project.';
}

    const fixed = current?.maintenance_id ?? Number(url.searchParams.get('record'));

    if (fixed && record?.id!==fixed) {
errors.maintenance_id='The associated Maintenance Record cannot be changed.';
}

    if ((!current && !prepared) || files.length>1) {
errors.attachment='Select exactly one document file.';
}

    if (prepared) {
        const ext=documentExtension(prepared.name), format=documentFormats[ext];

        if (!format || prepared.name.length>255 || (prepared.type && ![format.mime,'application/octet-stream'].includes(prepared.type))) {
errors.attachment='Choose a PDF, DOCX, XLSX, or PPTX document with a filename of 255 characters or fewer.';
} else if (prepared.data.length<8 || (ext==='pdf' ? prepared.data.toString('ascii',0,5)!=='%PDF-' : !officeSignature(prepared.data,ext))) {
errors.attachment='The file contents do not match the selected document format.';
}
    }

    if (Object.keys(errors).length) {
return { location, errors };
}

    const now=new Date().toISOString();
    const doc=current ?? { id:nextId++, uploaded_by:'demoAdmin', uploaded_at:now };
    Object.assign(doc, { maintenance_id:record.id, document_title:title, description:String(data.description || '') || null, updated_at:now });

    if (prepared) {
        doc.file_name=prepared.name;
        doc.file_path=`/preview-documents/${doc.id}`;
        prepared.type=documentFormats[documentExtension(prepared.name)].mime;
        bytes.set(doc.id,prepared);
    }

    if (!current) {
documents.push(doc);
}

    return { location:`${base}/${doc.id}` };
}
export function pruneDocumentBytes() {
 for (const id of bytes.keys()) {
if (!documents.some(d=>d.id===id)) {
bytes.delete(id);
}
}
}
export function serveDocument(request,response,id,url) {
    const file=documents.some(d=>d.id===id) && bytes.get(id);

    if (!file) {
 response.writeHead(404,{'Content-Type':'text/plain'}).end('Document unavailable. It may have been deleted or reset with the preview.');

 return;
}

    const name=file.name.replace(/[\r\n"\\]/g,'_').replace(/[^\x20-\x7E]/g,'_');
    response.writeHead(200, { 'Content-Type':file.type, 'Content-Length':file.data.length, 'Content-Disposition':`${url.searchParams.has('download') ? 'attachment' : 'inline'}; filename="${name}"; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store', 'Content-Security-Policy':"default-src 'none'; frame-ancestors 'self'" }).end(request.method==='HEAD' ? undefined : file.data);
}

// Explicit, illustrative preview fixtures. Reuse the normal upload validation
// and byte store so View, Download, Edit and Delete work for these rows too.
export async function initializeDocumentPreview(projects) {
    if (documents.length) {
return;
}

    const fixtures = [
        { record: 2, title: 'Sample — Quarterly Inspection Report', name: 'quarterly-inspection.pdf', date: '2026-10-22T08:00:00Z' },
        { record: 1, title: 'Sample — Inspection Notes', name: 'inspection-notes.docx', date: '2026-10-21T08:00:00Z' },
        { record: 3, title: 'Sample — Inspection Register', name: 'inspection-register.xlsx', date: '2026-10-20T08:00:00Z' },
    ];

    for (const fixture of fixtures) {
        const record = records.find(r => r.id === fixture.record);

        if (!record || !projects.some(p => p.id === record.project_id)) {
throw new Error('Document sample parent is unavailable.');
}

        const file = new File([await readFile(new URL('./document-samples/' + fixture.name, import.meta.url))], fixture.name, { type: documentFormats[documentExtension(fixture.name)].mime });
        const result = await mutateDocument('POST', new URL('http://localhost/maintenance-documents'), {
            project_id: String(record.project_id), maintenance_id: String(record.id), document_title: fixture.title,
            description: 'Illustrative document for local JaiROADS interface review only.\nThis is not an actual LGU maintenance document.',
        }, [file], projects);

        if (result.errors) {
throw new Error('Document sample validation failed.');
}

        const document = documents.at(-1);
        document.uploaded_at = fixture.date;
        document.updated_at = fixture.date;
    }
}

export function documentsForRecord(projects, summary, recordId) {
    return documents.filter(doc => doc.maintenance_id === recordId).map(doc => context(doc, projects, summary)).filter(Boolean);
}

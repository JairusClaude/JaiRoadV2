import { Buffer } from 'node:buffer';
import { media } from './records.mjs';

// Temporary byte storage, keyed by the existing Media ownership graph. Never
// writes files or contacts Laravel/Supabase. Restarting Node discards everything.
const bytes = new Map();
let nextMediaId = 9004;
export const uploadBodyLimit = 64 * 1024 * 1024; // Local technical safeguard only.
const supported = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);
const signatureMatches = (type, data) => {
    if (type === 'image/jpeg') {
return data.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
}

    if (type === 'image/png') {
return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

    if (type === 'image/webp') {
return data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP';
}

    if (type === 'video/mp4') {
return data.toString('ascii', 4, 8) === 'ftyp';
}

    if (type === 'video/webm') {
return data.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
}

    return false;
};
export async function prepareMedia(files) {
    const prepared = [];

    for (const file of files) {
        if (!file || typeof file.arrayBuffer !== 'function' || !supported.has(file.type)) {
return { error: 'Use JPEG, PNG, WebP, MP4, or WebM files only.' };
}

        const data = Buffer.from(await file.arrayBuffer());

        if (!data.length || !signatureMatches(file.type, data)) {
return { error: `The contents of ${file.name} do not match a supported media format.` };
}

        prepared.push({ data, name: file.name, type: file.type });
    }

    return { prepared };
}
export function attachMedia(updateId, prepared) {
    for (const file of prepared) {
        const id = nextMediaId++;
        media.push({ id, monthly_update_id: updateId, file_name: file.name, mime_type: file.type, size: file.data.length, preview_url: `/preview-media/${id}` });
        bytes.set(id, file);
    }
}
export function monthlyMediaPreview(updateId) {
    return media.filter(item => item.monthly_update_id === updateId).map(item => {
        const file = bytes.get(item.id);

        return { id: item.id, file_name: file?.name ?? item.file_name ?? `Attachment ${item.id}`, mime_type: file?.type ?? item.mime_type ?? null, size: file?.data.length ?? item.size ?? null, preview_url: file ? `/preview-media/${item.id}` : null, available: !!file };
    });
}
export function pruneMediaBytes() {
    const retained = new Set(media.map((item) => item.id));

    for (const id of bytes.keys()) {
if (!retained.has(id)) {
bytes.delete(id);
}
}
}
export function servePreviewMedia(request, response, id) {
    const file = bytes.get(id);

    if (!file || !media.some((item) => item.id === id)) {
 response.writeHead(404).end('Preview media unavailable.');

 return;
}

    const headers = { 'Content-Type': file.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };
    const range = request.headers.range;

    if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        const length = file.data.length;
        const start = match ? (match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]))) : NaN;
        const end = match ? (match[1] ? (match[2] ? Math.min(Number(match[2]), length - 1) : length - 1) : length - 1) : NaN;

        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= length || end < 0) {
 response.writeHead(416, { ...headers, 'Content-Range': `bytes */${length}` }).end();

 return;
}

        response.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${length}` }).end(request.method === 'HEAD' ? undefined : file.data.subarray(start, end + 1));
    } else {
response.writeHead(200, { ...headers, 'Content-Length': file.data.length }).end(request.method === 'HEAD' ? undefined : file.data);
}
}

export function removeMonthlyMedia(updateId, ids) {
    for (let i = media.length - 1; i >= 0; i--) {
        if (media[i].monthly_update_id === updateId && ids.includes(media[i].id)) {
 bytes.delete(media[i].id); media.splice(i, 1);
}
    }
}

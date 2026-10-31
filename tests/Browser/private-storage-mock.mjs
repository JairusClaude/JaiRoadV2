import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import http from 'node:http';
import process from 'node:process';

export const pdf = Buffer.from('%PDF-1.4\nDisposable inspection\n%%EOF');
export const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',
    'base64',
);
export async function startStorageMock(port = 5799) {
    assert.equal(
        process.env.JAIROADS_SCRATCH_APPROVAL,
        'DISPOSABLE_LOCAL_ONLY',
    );
    const objects = new Map();
    const counts = { uploads: 0, downloads: 0, compensations: 0 };
    const server = http.createServer(async (request, response) => {
        if (request.headers.apikey !== 'disposable-storage-only') {
            response.writeHead(403).end('Missing disposable test key');

            return;
        }

        const path = new URL(request.url, 'http://127.0.0.1').pathname.replace(
            /^\/storage\/v1\/object\/(authenticated\/)?/,
            '',
        );

        if (request.method === 'POST') {
            const chunks = [];

            for await (const part of request) {
                chunks.push(part);
            }

            objects.set(path, Buffer.concat(chunks));
            counts.uploads++;
            response
                .writeHead(200, { 'Content-Type': 'application/json' })
                .end('{"Key":"disposable"}');
        } else if (request.method === 'DELETE') {
            objects.delete(path);
            counts.compensations++;
            response.writeHead(200).end('{}');
        } else if (request.method === 'GET') {
            counts.downloads++;
            const seed = path.includes('00000000-0000-4000-8000-000000000001');
            const bytes =
                objects.get(path) ||
                (seed ? (path.endsWith('.pdf') ? pdf : png) : null);

            if (!bytes) {
                response.writeHead(404).end('Missing test object');

                return;
            }

            response
                .writeHead(200, {
                    'Content-Type': path.endsWith('.pdf')
                        ? 'application/pdf'
                        : 'image/png',
                })
                .end(bytes);
        } else {
            response.writeHead(405).end();
        }
    });
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));

    return {
        counts,
        close: () => new Promise((resolve) => server.close(resolve)),
    };
}

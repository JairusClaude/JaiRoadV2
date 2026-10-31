import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import process from 'node:process';
import { pdf, startStorageMock } from './private-storage-mock.mjs';
const base = process.env.JAIROADS_DOCKER_URL || 'http://127.0.0.1:10000';
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');
const fixture = JSON.parse(
    await readFile(process.env.QUARTERLY_BROWSER_FIXTURE, 'utf8'),
);
const mock = await startStorageMock();
async function assertLoginAssetOrigin(target, host, headers, expected) {
    const html = await new Promise((resolve, reject) => {
        const request = httpRequest(
            new URL(base),
            { path: target, headers: { Host: host, ...headers } },
            (response) => {
                assert.equal(response.statusCode, 200);
                let body = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => resolve(body));
            },
        );
        request.on('error', reject);
        request.end();
    });
    const assets = [
        ...html.matchAll(/(?:href|src)="([^"]*\/build\/assets\/[^"]+)"/g),
    ];
    assert.ok(assets.length >= 2);

    for (const [, asset] of assets) {
        assert.equal(
            new URL(asset, base).origin,
            expected,
            `Host ${host}; target ${target}: ${asset}`,
        );
    }
}
async function session() {
    const cookies = new Map();
    async function request(path, options = {}) {
        const response = await fetch(`${base}${path}`, {
            ...options,
            redirect: 'manual',
            headers: {
                ...(options.headers || {}),
                Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
            },
        });

        for (const cookie of response.headers.getSetCookie()) {
            const pair = cookie.split(';')[0];
            const index = pair.indexOf('=');
            cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }

        return response;
    }
    async function post(path, data) {
        return request(path, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-XSRF-TOKEN': decodeURIComponent(
                    cookies.get('XSRF-TOKEN') || '',
                ),
                Accept: 'application/json',
                Origin: base,
            },
            body: new URLSearchParams(data),
        });
    }
    await request('/login');

    return { request, post };
}

try {
    if (process.env.JAIROADS_EXPECT_DB_FAILURE === '1') {
        const client = await session();
        const response = await client.post('/login', {
            email: fixture.admin_email,
            password: 'Disposable-Test!123',
        });
        assert.equal(response.status, 500);
        assert.doesNotMatch(
            await response.text(),
            /SQLSTATE|PDOException|disposable-ci-only|Stack trace/,
        );
        console.log(
            'PASS: unreachable disposable database returns sanitized production error; startup did not initialize or migrate it.',
        );
    } else {
        assert.equal((await fetch(`${base}/up`)).status, 200);
        const login = await fetch(`${base}/login`);
        assert.equal(login.status, 200);
        const html = await login.text();
        const assets = [
            ...html.matchAll(/(?:href|src)="([^"]*\/build\/assets\/[^"]+)"/g),
        ].map((m) => m[1]);
        assert.ok(
            assets.length >= 2,
            'Built manifest must render scripts/styles',
        );

        const assetUrls = [
            ...new Set(assets.map((asset) => new URL(asset, base).href)),
        ];
        console.log('Login HTML asset URLs:', JSON.stringify(assetUrls));
        assert.ok(
            assetUrls.some((asset) => new URL(asset).pathname.endsWith('.js')),
            'Login must include built JavaScript',
        );
        assert.ok(
            assetUrls.some((asset) => new URL(asset).pathname.endsWith('.css')),
            'Login must include built CSS',
        );

        for (const asset of assetUrls) {
            assert.equal(
                new URL(asset).origin,
                new URL(base).origin,
                `Unexpected rendered asset origin: ${asset}`,
            );
            const response = await fetch(asset, { redirect: 'manual' });
            assert.equal(
                response.status,
                200,
                `Asset ${asset}: HTTP ${response.status}; Location=${response.headers.get('location')}`,
            );

            if (new URL(asset).pathname.endsWith('.css')) {
                assert.match(
                    response.headers.get('content-type') || '',
                    /text\/css/,
                );
            } else if (new URL(asset).pathname.endsWith('.js')) {
                assert.match(
                    response.headers.get('content-type') || '',
                    /javascript/,
                );
            }

            assert.ok(
                (await response.arrayBuffer()).byteLength > 0,
                `Empty asset: ${asset}`,
            );
        }

        await assertLoginAssetOrigin(
            '/login',
            'roads.example.test',
            { 'X-Forwarded-Proto': 'https' },
            'https://roads.example.test',
        );
        await assertLoginAssetOrigin(
            '/login',
            'roads.example.test:8443',
            { 'X-Forwarded-Proto': 'https' },
            'https://roads.example.test:8443',
        );
        await assertLoginAssetOrigin(
            '/login',
            '[::1]:10000',
            {},
            'http://[::1]:10000',
        );
        await assertLoginAssetOrigin(
            'http://target.example.test:10000/login',
            'spoofed.example.test:1234',
            {},
            'http://target.example.test:10000',
        );
        await assertLoginAssetOrigin(
            'http://target.example.test/login',
            'spoofed.example.test:1234',
            {},
            'http://target.example.test',
        );
        console.log(
            'PASS: rendered asset authority preserves ports, HTTPS proxy origins and absolute-form target precedence.',
        );

        for (const [role, email] of [
            ['SuperAdmin', fixture.superadmin_email],
            ['Admin', fixture.admin_email],
            ['Engineer', fixture.engineer_email],
            ['Viewer', fixture.viewer_email],
        ]) {
            const s = await session();
            const result = await s.post('/login', {
                email,
                password: 'Disposable-Test!123',
            });
            assert.ok(
                [200, 204, 302, 303].includes(result.status),
                `${role} login: ${result.status}`,
            );
            const target = await s.request('/dashboard');
            assert.equal(target.status, 302);
            const location = new URL(target.headers.get('location'), base);
            assert.equal(
                location.pathname,
                role === 'SuperAdmin'
                    ? '/dd-superadmin-landing'
                    : '/dd-phase3/dashboard',
            );
            assert.equal((await s.request(location.pathname)).status, 200);

            if (role === 'Viewer') {
                assert.equal(
                    (
                        await s.post('/dd-phase3/ops/projects', {
                            project_title: 'Denied',
                            road_coverage_id: '1',
                        })
                    ).status,
                    403,
                );
                assert.equal((await s.request('/dd-phase3/users')).status, 403);
            }

            if (role === 'Engineer') {
                const file = await s.request(
                    `/dd-phase3/files/document/${fixture.document_id}`,
                );
                assert.equal(file.status, 200);
                assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
                assert.match(file.headers.get('cache-control'), /private/);
            }
        }

        const rogue = await session();
        await rogue.post('/login', {
            email: fixture.rogue_email,
            password: 'Disposable-Test!123',
        });
        const before = mock.counts.downloads;
        assert.equal(
            (
                await rogue.request(
                    `/dd-phase3/files/document/${fixture.document_id}`,
                )
            ).status,
            403,
        );
        assert.equal(mock.counts.downloads, before);
        console.log(
            'PASS: Docker Laravel health/startup, built assets, PostgreSQL-backed four-role authentication/routing, Viewer direct-HTTP denial, private Storage mock download and cross-LGU denial.',
        );
    }
} finally {
    await mock.close();
}

// Real WebAuthn signatures via a Chromium virtual authenticator, real Fortify
// sessions and guarded local PostgreSQL. Never real accounts or credentials.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const base = process.env.QUARTERLY_BROWSER_URL;
assert.match(base || '', /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');
const fixture = JSON.parse(
    await readFile(process.env.PASSKEY_BROWSER_FIXTURE, 'utf8'),
);
const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
function state(user, action) {
    return execFileSync(
        process.env.TEST_PHP_BINARY || 'php',
        ['tests/Browser/passkey-state.php', String(user.id), action],
        { encoding: 'utf8' },
    );
}
async function request(page, path, data, method = 'POST') {
    return page.evaluate(
        async ({ path, data, method }) => {
            const cookie = document.cookie
                .split('; ')
                .find((c) => c.startsWith('XSRF-TOKEN='));
            const response = await fetch(path, {
                method,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)),
                },
                body: JSON.stringify(data),
            });
            const text = await response.text();

            return {
                status: response.status,
                body: text ? JSON.parse(text) : null,
            };
        },
        { path, data, method },
    );
}
async function assertion(page, path = '/passkeys/login/options') {
    return page.evaluate(async (path) => {
        const result = await fetch(path, {
            headers: { Accept: 'application/json' },
        });
        const { options } = await result.json();
        // Empty descriptors intentionally allow the foreign-key confirmation
        // test to reach the server's credential-ownership check.
        options.allowCredentials = [];
        const credential = await navigator.credentials.get({
            publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
        });

        return credential.toJSON();
    }, path);
}
async function guest(page) {
    await page.goto(base + '/login');

    for (const path of [
        '/dashboard',
        '/settings/security',
        '/user/passkeys/options',
    ]) {
        const response = await page.request.get(base + path, {
            headers: { Accept: 'application/json' },
            maxRedirects: 0,
        });
        assert.equal(
            response.status(),
            401,
            `Rejected login must remain guest: ${path}`,
        );
    }
}

try {
    const sessions = [];

    for (const user of fixture.users) {
        const context = await browser.newContext();
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('WebAuthn.enable');
        const { authenticatorId } = await cdp.send(
            'WebAuthn.addVirtualAuthenticator',
            {
                options: {
                    protocol: 'ctap2',
                    transport: 'internal',
                    hasResidentKey: true,
                    hasUserVerification: true,
                    isUserVerified: true,
                    automaticPresenceSimulation: true,
                },
            },
        );
        await page.goto(base + '/login');
        assert.equal(
            (
                await request(page, '/login', {
                    email: user.email,
                    password: 'Disposable-Test!123',
                })
            ).status,
            200,
        );
        assert.equal(
            (
                await request(page, '/user/confirm-password', {
                    password: 'Disposable-Test!123',
                })
            ).status,
            201,
        );
        const registration = await page.evaluate(async () => {
            const response = await fetch('/user/passkeys/options', {
                headers: { Accept: 'application/json' },
            });
            const { options } = await response.json();

            return (
                await navigator.credentials.create({
                    publicKey:
                        PublicKeyCredential.parseCreationOptionsFromJSON(
                            options,
                        ),
                })
            ).toJSON();
        });
        const stored = await request(page, '/user/passkeys', {
            name: 'Disposable virtual authenticator',
            credential: registration,
        });
        assert.equal(stored.status, 200);
        const keyIds = state(user, 'snapshot');
        await request(page, '/logout', {});
        await page.goto(base + '/login');
        const credential = await assertion(page);
        assert.equal(
            (await request(page, '/passkeys/login', { credential })).status,
            200,
            `Valid ${user.role} passkey login`,
        );

        if (user.role !== 'Legacy') {
            const response = await page.request.get(base + '/dashboard');
            assert.equal(response.status(), 200);
            state(user, 'inactive');

            for (const path of [
                '/settings/security',
                '/user/passkeys/options',
                '/passkeys/confirm/options',
            ]) {
                const denied = await page.request.get(base + path, {
                    headers: { Accept: 'application/json' },
                    maxRedirects: 0,
                });
                assert.equal(
                    denied.status(),
                    403,
                    'Existing revoked session cannot manage credentials',
                );
            }
        } else {
            assert.equal(
                (
                    await page.request.get(
                        base + '/dd-phase3/ui/maintenance-projects',
                        { headers: { Accept: 'application/json' } },
                    )
                ).status(),
                403,
            );
        }

        assert.equal(
            (await request(page, '/logout', {})).status,
            204,
            'Revoked sessions may still log out',
        );

        if (user.role !== 'Legacy') {
            state(user, 'reset');
        }

        await page.goto(base + '/login');
        assert.equal(
            (await request(page, '/passkeys/login', { credential })).status,
            422,
            'Consumed challenge cannot replay',
        );
        await guest(page);
        sessions.push({ user, context, page, cdp, authenticatorId, keyIds });
        console.log(
            `PASS: real ${user.role} passkey registration/authentication, NULL verification, logout and replay rejection.`,
        );
    }

    const engineer = sessions.find((s) => s.user.role === 'Engineer');
    const { user, page, cdp, authenticatorId, keyIds } = engineer;

    for (const action of [
        'inactive',
        'retired',
        'missing',
        'invalid-link',
        'email',
        'hash',
    ]) {
        state(user, action);
        await page.goto(base + '/login');
        const password = await request(page, '/login', {
            email: user.email,
            password: 'Disposable-Test!123',
        });
        assert.equal(password.status, 422);
        const credential = await assertion(page);
        const result = await request(page, '/passkeys/login', { credential });
        assert.equal(
            result.status,
            422,
            `${action}: passkey eligibility matches password login`,
        );
        await guest(page);
        console.log(
            `PASS: ${action} canonical passkey denied; DD and credential-management routes remain guest.`,
        );
        assert.equal(
            state(user, 'snapshot'),
            keyIds,
            'No credential deleted or reassigned',
        );
        state(user, 'reset');
    }

    // A valid virtual key signs a wrong-origin assertion. This reaches server
    // origin validation rather than relying only on a browser SecurityError.
    await page.goto(base + '/login');
    const wrong = await assertion(page);
    const client = JSON.parse(
        Buffer.from(wrong.response.clientDataJSON, 'base64url'),
    );
    client.origin = 'https://wrong-origin.example.test';
    const clientBytes = Buffer.from(JSON.stringify(client));
    const { credentials } = await cdp.send('WebAuthn.getCredentials', {
        authenticatorId,
    });
    const privateKey = createPrivateKey({
        key: Buffer.from(credentials[0].privateKey, 'base64'),
        format: 'der',
        type: 'pkcs8',
    });
    wrong.response.clientDataJSON = clientBytes.toString('base64url');
    wrong.response.signature = sign(
        'sha256',
        Buffer.concat([
            Buffer.from(wrong.response.authenticatorData, 'base64url'),
            createHash('sha256').update(clientBytes).digest(),
        ]),
        privateKey,
    ).toString('base64url');
    assert.equal(
        (await request(page, '/passkeys/login', { credential: wrong })).status,
        422,
    );
    await guest(page);
    // A correctly signed assertion bound to another RP is also rejected.
    const wrongRp = await assertion(page);
    const authData = Buffer.from(
        wrongRp.response.authenticatorData,
        'base64url',
    );
    createHash('sha256')
        .update('wrong-rp.example.test')
        .digest()
        .copy(authData, 0);
    wrongRp.response.authenticatorData = authData.toString('base64url');
    wrongRp.response.signature = sign(
        'sha256',
        Buffer.concat([
            authData,
            createHash('sha256')
                .update(
                    Buffer.from(wrongRp.response.clientDataJSON, 'base64url'),
                )
                .digest(),
        ]),
        privateKey,
    ).toString('base64url');
    assert.equal(
        (await request(page, '/passkeys/login', { credential: wrongRp }))
            .status,
        422,
    );
    await guest(page);
    // Actual user-bound confirmation must reject another user's valid passkey.
    const viewer = sessions.find((s) => s.user.role === 'Viewer');
    assert.equal(
        (
            await request(page, '/login', {
                email: viewer.user.email,
                password: 'Disposable-Test!123',
            })
        ).status,
        200,
    );
    const foreign = await assertion(page, '/passkeys/confirm/options');
    assert.equal(
        (await request(page, '/passkeys/confirm', { credential: foreign }))
            .status,
        422,
    );
    await request(page, '/logout', {});
    const token = state(user, 'recovery-token').trim();
    const password = 'Recovered-Disposable!123';
    await page.goto(base + '/login');
    assert.equal(
        (
            await request(page, '/reset-password', {
                email: user.email,
                token,
                password,
                password_confirmation: password,
            })
        ).status,
        200,
    );
    const recovered = await assertion(page);
    assert.equal(
        (await request(page, '/passkeys/login', { credential: recovered }))
            .status,
        200,
        'Registered passkey still authenticates after actual Fortify password recovery',
    );
    await request(page, '/logout', {});
    assert.equal(
        (
            await request(page, '/login', {
                email: user.email,
                password: 'Disposable-Test!123',
            })
        ).status,
        422,
    );
    assert.equal(
        (await request(page, '/login', { email: user.email, password })).status,
        200,
    );
    assert.equal((await page.request.get(base + '/dashboard')).status(), 200);
    assert.equal(state(user, 'snapshot'), keyIds);
    console.log(
        'PASS: signed wrong-origin assertion and foreign credential confirmation rejected; legacy compatibility retained.',
    );

    for (const session of sessions) {
        await session.context.close();
    }
} finally {
    await browser.close();
}

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
                body:
                    text &&
                    response.headers
                        .get('content-type')
                        ?.includes('application/json')
                        ? JSON.parse(text)
                        : null,
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

        if (user.role === 'Legacy') {
            state(user, 'legacy');
        }

        const credential = await assertion(page);
        assert.equal(
            (await request(page, '/passkeys/login', { credential })).status,
            user.role === 'Legacy' ? 422 : 200,
            `${user.role} passkey policy`,
        );

        if (user.role !== 'Legacy') {
            const response = await page.request.get(base + '/dashboard');
            assert.equal(response.status(), 200);
            state(user, 'inactive');

            for (const [index, path] of [
                '/settings/security',
                '/user/passkeys/options',
                '/passkeys/confirm/options',
            ].entries()) {
                const denied = await page.request.get(base + path, {
                    headers: { Accept: 'application/json' },
                    maxRedirects: 0,
                });
                assert.equal(
                    denied.status(),
                    index === 0 ? 403 : 401,
                    'Revocation invalidates the session and denies credential management',
                );
            }
        } else {
            assert.equal(
                (
                    await request(page, '/login', {
                        email: user.email,
                        password: 'Disposable-Test!123',
                    })
                ).status,
                422,
            );
            await guest(page);
        }

        // Revoked sessions have already been invalidated; an explicit logout
        // remains available while an ineligible principal is still authenticated.
        assert.equal((await request(page, '/logout', {})).status, 401);

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
            user.role === 'Legacy'
                ? 'PASS: real registered legacy-only passkey and password denied after bridge removal.'
                : `PASS: real ${user.role} passkey registration/authentication, NULL verification, logout and replay rejection.`,
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
        'unlinked',
        'provenance',
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
        'PASS: signed wrong-origin assertion and foreign credential confirmation rejected; legacy-only login denied.',
    );

    // Exercise the real remember-me cookie, with the session cookie removed.
    const adminSession = sessions.find((s) => s.user.role === 'Admin');
    await adminSession.page.goto(base + '/login');
    assert.equal(
        (
            await request(adminSession.page, '/login', {
                email: adminSession.user.email,
                password: 'Disposable-Test!123',
                remember: true,
            })
        ).status,
        200,
    );
    const rememberCookies = (await adminSession.context.cookies()).filter(
        (cookie) => cookie.name.startsWith('remember_'),
    );
    assert.equal(rememberCookies.length, 1);
    await adminSession.context.clearCookies();
    await adminSession.context.addCookies(rememberCookies);
    assert.equal(
        (
            await adminSession.page.request.get(base + '/dashboard', {
                headers: { Accept: 'application/json' },
                maxRedirects: 0,
            })
        ).status(),
        302,
    );
    state(adminSession.user, 'inactive');
    await adminSession.context.clearCookies();
    await adminSession.context.addCookies(rememberCookies);
    assert.equal(
        (
            await adminSession.page.request.get(base + '/dashboard', {
                headers: { Accept: 'application/json' },
                maxRedirects: 0,
            })
        ).status(),
        401,
    );
    state(adminSession.user, 'reset');
    console.log(
        'PASS: real remember-me cookie restores an eligible identity and rejects a revoked identity without a session cookie.',
    );

    // Real Inertia provisioning form: Viewer creates no Engineer profile
    // and retains read-only permissions.
    const root = sessions.find((s) => s.user.role === 'SuperAdmin');
    await root.page.goto(base + '/login');
    assert.equal(
        (
            await request(root.page, '/login', {
                email: root.user.email,
                password: 'Disposable-Test!123',
            })
        ).status,
        200,
    );
    assert.equal(
        (
            await request(root.page, '/dd-phase3/engineers', {
                first_name: 'Browser',
                last_name: 'Provisioning',
                contact_no: '09000000000',
                rank: 'Engineer I',
            })
        ).status,
        200,
    );
    await root.page.goto(base + '/dd-phase3/users');
    const form = root.page
        .getByRole('heading', { name: 'Create account', exact: true })
        .locator('xpath=ancestor::section[1]')
        .locator('form');
    await form
        .getByLabel('Account Type', { exact: false })
        .selectOption('Viewer');
    await form
        .getByLabel('Username', { exact: false })
        .fill('browser-provisioned-viewer');
    await form
        .getByLabel('Login email', { exact: true })
        .fill('browser-provisioned-viewer@example.test');
    await form
        .getByLabel('Display name', { exact: true })
        .fill('Browser provisioned Viewer');
    assert.equal(
        await form.getByLabel('Linked Engineer', { exact: false }).count(),
        0,
    );
    assert.equal(await form.getByLabel('Rank', { exact: true }).count(), 0);
    await form
        .getByLabel('Password', { exact: false })
        .first()
        .fill('Browser-Provisioned!123');
    await form
        .getByLabel('Confirm password', { exact: true })
        .fill('Browser-Provisioned!123');
    const saved = root.page.waitForResponse(
        (response) =>
            response.url().endsWith('/dd-phase3/accounts') &&
            response.request().method() === 'POST',
    );
    await form
        .getByRole('button', { name: 'Create account', exact: true })
        .click();
    assert.equal((await saved).status(), 302);
    await root.page.getByText('Account created.', { exact: true }).waitFor();
    await request(root.page, '/logout', {});
    await root.page.goto(base + '/login');
    assert.equal(
        (
            await request(root.page, '/login', {
                email: 'browser-provisioned-viewer@example.test',
                password: 'Browser-Provisioned!123',
            })
        ).status,
        200,
    );
    assert.equal(
        (
            await request(root.page, '/dd-phase3/ops/projects', {
                project_title: 'Forbidden',
            })
        ).status,
        403,
    );
    await request(root.page, '/logout', {});
    console.log(
        'PASS: actual Inertia Viewer form creates no Engineer link; provisioned Viewer logs in and remains read-only.',
    );

    await root.page.goto(base + '/login');
    assert.equal(
        (
            await request(root.page, '/login', {
                email: root.user.email,
                password: 'Disposable-Test!123',
            })
        ).status,
        200,
    );
    await root.page.goto(base + '/dd-phase3/audit-logs');
    const history = await root.page.request.get(
        base + '/dd-phase3/audit-logs?auth_event=LOGIN',
        {
            headers: {
                'X-Inertia': 'true',
                'X-Inertia-Version': JSON.parse(
                    await root.page.locator('script[data-page]').textContent(),
                ).version,
            },
        },
    );
    assert.equal(history.status(), 200);
    const telemetry = (await history.json()).props.authentication.data;

    for (const role of ['SuperAdmin', 'Admin', 'Engineer', 'Viewer']) {
        assert.ok(
            telemetry.some(
                (event) =>
                    event.event === 'LOGIN' &&
                    event.method === 'passkey' &&
                    event.account_type === role,
            ),
            `${role} completed passkey login recorded separately`,
        );
    }

    assert.equal(
        JSON.stringify(telemetry).includes('session_reference'),
        false,
    );
    console.log(
        'PASS: completed real WebAuthn logins for all four roles appear in separate, safe authentication history.',
    );

    for (const session of sessions) {
        await session.context.close();
    }
} finally {
    await browser.close();
}

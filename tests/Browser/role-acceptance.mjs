import assert from 'node:assert/strict';
import process from 'node:process';

/**
 * Real browser sessions, actual Fortify CSRF and canonical route guards.
 * Only localhost PostgreSQL 17 synthetic fixtures are authorized.
 * External map and private Storage service behaviors are covered elsewhere.
 */
export async function verifyRoleAcceptanceMatrix({
    browser,
    base,
    admin,
    superadmin,
    engineer,
    viewer,
}) {
    assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');

    const roles = {
        SuperAdmin: superadmin,
        Admin: admin,
        Engineer: engineer,
        Viewer: viewer,
    };

    const guest = await browser.newContext();

    try {
        for (const path of [
            '/workspace/dashboard',
            '/workspace/users',
            '/dd-phase3/users',
            '/workspace/audit-logs',
            '/workspace/ui/road-coverages',
            '/jairoads/notifications',
        ]) {
            const response = await guest.request.get(`${base}${path}`, {
                headers: { Accept: 'application/json' },
                maxRedirects: 0,
            });
            assert.equal(response.status(), 401, `Guest may not read ${path}`);
        }
    } finally {
        await guest.close();
    }

    const expectations = [
        {
            path: '/workspace/dashboard',
            statuses: [200, 200, 200, 200],
        },
        {
            path: '/workspace/users',
            statuses: [200, 200, 403, 403],
        },
        {
            path: '/workspace/audit-logs',
            statuses: [200, 200, 403, 403],
        },
        {
            path: '/workspace/ui/road-coverages',
            statuses: [200, 200, 200, 200],
        },
        {
            path: '/workspace/ui/road-coverages/create',
            statuses: [200, 200, 200, 403],
        },
        {
            path: '/workspace/ui/maintenance-projects/create',
            statuses: [200, 200, 200, 403],
        },
    ];

    for (const { path, statuses } of expectations) {
        for (const [index, [role, page]] of Object.entries(roles).entries()) {
            const response = await page.request.get(`${base}${path}`, {
                headers: { Accept: 'application/json' },
            });
            assert.equal(
                response.status(),
                statuses[index],
                `${role}: ${path} should return ${statuses[index]}`,
            );
        }
    }

    async function deniedWrite(page, path) {
        const result = await page.evaluate(async (target) => {
            const csrfCookie = document.cookie
                .split('; ')
                .find((cookie) => cookie.startsWith('XSRF-TOKEN='));

            if (!csrfCookie) {
                throw new Error('Missing real Fortify CSRF session');
            }

            const response = await fetch(target, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(csrfCookie.slice(11)),
                },
                body: JSON.stringify({}),
            });

            return response.status;
        }, path);
        assert.equal(result, 403, `Unauthorized mutation must be denied: ${path}`);
    }

    const version = JSON.parse(
        await admin.locator('script[data-page]').textContent(),
    ).version;
    const oldPage = '/dd-phase3/users?search=Test%20Member&page=2';
    const currentPage = '/workspace/users?search=Test%20Member&page=2';
    const inertiaHeaders = {
        'X-Inertia': 'true',
        'X-Inertia-Version': version,
    };
    const redirect = await admin.request.get(`${base}${oldPage}`, {
        headers: inertiaHeaders,
        maxRedirects: 0,
    });
    assert.equal(redirect.status(), 302);
    assert.equal(redirect.headers().location, `${base}${currentPage}`);
    const destination = await admin.request.get(`${base}${currentPage}`, {
        headers: inertiaHeaders,
    });
    assert.equal(destination.status(), 200);
    assert.equal((await destination.json()).component, 'Workspace/Directory');

    const csrfDenied = await admin.request.post(`${base}/dd-phase3/lgus`, {
        headers: { Accept: 'application/json' },
        data: {},
    });
    assert.equal(csrfDenied.status(), 419);
    await deniedWrite(viewer, '/dd-phase3/lgus');

    // These are genuine HTTP POST attempts, not simply hidden buttons.
    // Authorization must run before validation, and no business row is created.
    await deniedWrite(viewer, '/workspace/ops/roads');
    await deniedWrite(viewer, '/workspace/ops/projects');
    await deniedWrite(viewer, '/workspace/ops/updates');
    await deniedWrite(viewer, '/workspace/ops/documents');
    await deniedWrite(viewer, '/workspace/accounts');
    await deniedWrite(engineer, '/workspace/accounts');
    await deniedWrite(engineer, '/workspace/lgus');

    console.log(
        'PASS: real-session SuperAdmin/Admin/Engineer/Viewer route matrix; guest JSON denial; privileged audit/account reads; Viewer write denial and Engineer account/LGU governance denial.',
    );
}

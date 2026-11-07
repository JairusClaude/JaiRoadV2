import assert from 'node:assert/strict';

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
            '/dd-phase3/dashboard',
            '/dd-phase3/users',
            '/dd-phase3/audit-logs',
            '/dd-phase3/ui/road-coverages',
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
            path: '/dd-phase3/dashboard',
            statuses: [200, 200, 200, 200],
        },
        {
            path: '/dd-phase3/users',
            statuses: [200, 200, 403, 403],
        },
        {
            path: '/dd-phase3/audit-logs',
            statuses: [200, 200, 403, 403],
        },
        {
            path: '/dd-phase3/ui/road-coverages',
            statuses: [200, 200, 200, 200],
        },
        {
            path: '/dd-phase3/ui/road-coverages/create',
            statuses: [200, 200, 200, 403],
        },
        {
            path: '/dd-phase3/ui/maintenance-projects/create',
            statuses: [200, 200, 200, 403],
        },
    ];

    for (const { path, statuses } of expectations) {
        for (const [index, [role, page]] of Object.entries(roles).entries()) {
            const response = await page.request.get(`${base}${path}`, {
                headers: { Accept: 'application/json' },
                maxRedirects: 0,
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

    // These are genuine HTTP POST attempts, not simply hidden buttons.
    // Authorization must run before validation, and no business row is created.
    await deniedWrite(viewer, '/dd-phase3/ops/roads');
    await deniedWrite(viewer, '/dd-phase3/ops/projects');
    await deniedWrite(viewer, '/dd-phase3/ops/updates');
    await deniedWrite(viewer, '/dd-phase3/ops/documents');
    await deniedWrite(viewer, '/dd-phase3/accounts');
    await deniedWrite(engineer, '/dd-phase3/accounts');
    await deniedWrite(engineer, '/dd-phase3/lgus');

    console.log(
        'PASS: real-session SuperAdmin/Admin/Engineer/Viewer route matrix; guest JSON denial; privileged audit/account reads; Viewer write denial and Engineer account/LGU governance denial.',
    );
}

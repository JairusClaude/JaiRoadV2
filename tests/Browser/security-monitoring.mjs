import assert from 'node:assert/strict';
import process from 'node:process';

export async function verifySecurityMonitoring({
    browser,
    admin,
    superadmin,
    engineer,
    viewer,
    base,
    fixture,
}) {
    const history = async (page, query = '') => {
        const version = JSON.parse(
            await page.locator('script[data-page]').textContent(),
        ).version;
        const response = await page.request.get(
            `${base}/dd-phase3/audit-logs${query}`,
            { headers: { 'X-Inertia': 'true', 'X-Inertia-Version': version } },
        );
        assert.equal(response.status(), 200);

        return (await response.json()).props;
    };

    for (const page of [admin, superadmin]) {
        await page.goto(`${base}/dd-phase3/audit-logs`);
        await page
            .getByRole('heading', { name: 'Audit Log', exact: true })
            .waitFor();

        for (const name of [
            'System Activity History',
            'Authentication History',
            'Currently Online Users',
        ]) {
            await page.getByRole('heading', { name, exact: true }).waitFor();
        }

        assert.equal(
            await page
                .getByRole('link', { name: 'Audit Log', exact: true })
                .count(),
            1,
        );
        const props = await history(page);
        assert.equal(props.monitoring.available, true);
        assert.equal(props.presence.available, true);
        assert.ok(
            props.authentication.data.some(
                (e) => e.event === 'LOGIN' && e.user_account_id !== null,
            ),
        );
        const safe = JSON.stringify({
            history: props.authentication.data,
            online: props.presence.accounts,
        });

        for (const key of [
            'session_reference',
            'credential_reference',
            'attempt_reference',
            'password',
            'recovery_codes',
        ]) {
            assert.equal(safe.includes(`"${key}":`), false);
        }

        assert.equal(
            await page
                .getByRole('button', {
                    name: /reset history|clear audit history/i,
                })
                .count(),
            0,
        );

        for (const width of [320, 390, 768, 1440]) {
            await page.setViewportSize({ width, height: 1000 });
            const dimensions = await page.evaluate(() => ({
                client: document.documentElement.clientWidth,
                scroll: document.documentElement.scrollWidth,
            }));
            assert.equal(
                dimensions.scroll,
                dimensions.client,
                `Audit page width ${width}`,
            );
            await page
                .getByRole('region', {
                    name: 'Authentication History',
                    exact: true,
                })
                .scrollIntoViewIfNeeded();
            await page
                .getByRole('button', {
                    name: 'Refresh monitoring',
                    exact: true,
                })
                .click();
            await page
                .getByRole('button', {
                    name: 'Refresh monitoring',
                    exact: true,
                })
                .waitFor();

            if (process.env.SECURITY_MONITOR_SCREENSHOT_DIR) {
                await page.screenshot({
                    path: `${process.env.SECURITY_MONITOR_SCREENSHOT_DIR}/${page === admin ? 'admin' : 'superadmin'}-${width}.png`,
                    fullPage: true,
                });
            }
        }
    }

    for (const page of [engineer, viewer]) {
        assert.equal(
            await page
                .getByRole('link', { name: 'Audit Log', exact: true })
                .count(),
            0,
        );
        assert.equal(
            (await page.request.get(`${base}/dd-phase3/audit-logs`)).status(),
            403,
        );
    }

    await viewer.goto(`${base}/dd-phase3/dashboard`);
    const before = await history(admin);
    const context = await browser.newContext();
    const guest = await context.newPage();
    await guest.goto(`${base}/login`);
    const send = async (path, data) =>
        guest.evaluate(
            async ({ path, data }) => {
                const cookie = document.cookie
                    .split('; ')
                    .find((c) => c.startsWith('XSRF-TOKEN='));
                const response = await fetch(path, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)),
                    },
                    body: JSON.stringify(data),
                });

                return response.status;
            },
            { path, data },
        );
    assert.equal(
        await send('/login', {
            email: 'unknown-monitoring@private.example.test',
            password: 'NEVER-PERSIST-THIS',
        }),
        422,
    );
    const failed = await history(
        admin,
        '?auth_event=FAILED_LOGIN&auth_search=unknown-monitoring@private.example.test',
    );
    assert.equal(failed.authentication.total, 1);
    assert.equal(failed.authentication.data[0].user_account_id, null);
    assert.equal(failed.authentication.data[0].account_type, null);
    assert.equal(
        JSON.stringify(failed.authentication.data).includes(
            'private.example.test',
        ),
        false,
    );
    assert.equal(
        JSON.stringify(failed.authentication.data).includes(
            'NEVER-PERSIST-THIS',
        ),
        false,
    );
    assert.equal(
        await send('/login', {
            email: fixture.viewer_email,
            password: 'Disposable-Test!123',
        }),
        200,
    );
    let online = await history(admin);
    const duplicate = online.presence.accounts.find(
        (a) => a.account_type === 'Viewer',
    );
    assert.ok(duplicate && duplicate.session_count >= 2);
    assert.equal(
        online.presence.accounts.filter((a) => a.account_type === 'Viewer')
            .length,
        1,
    );
    assert.equal(await send('/logout', {}), 204);
    online = await history(admin);
    assert.equal(
        online.presence.accounts.find((a) => a.account_type === 'Viewer')
            .session_count,
        duplicate.session_count - 1,
    );
    assert.equal(online.events.total, before.events.total);
    const logout = await history(admin, '?auth_event=LOGOUT');
    assert.ok(
        logout.authentication.data.some(
            (e) => e.event === 'LOGOUT' && e.account_type === 'Viewer',
        ),
    );
    await context.close();
    const form = admin.getByRole('form', {
        name: 'Activity filters',
        exact: true,
    });
    await form.getByLabel('Action', { exact: false }).selectOption('UPDATE');
    await form
        .getByRole('button', { name: 'Apply filters', exact: true })
        .click();
    await admin.waitForURL(/activity_action=UPDATE/);
    assert.ok(
        (await history(admin, '?activity_action=UPDATE')).events.data.every(
            (e) => e.action === 'UPDATE',
        ),
    );
    await admin
        .getByRole('form', { name: 'Activity filters', exact: true })
        .getByRole('button', { name: 'Clear activity filters', exact: true })
        .click();
    await admin.waitForURL(`${base}/dd-phase3/audit-logs`);
    console.log(
        'PASS: real Admin/SuperAdmin three-table Audit Log, safe authentication and unique online presence, masked failure, per-session logout, direct Engineer/Viewer denials, independent filters and 320/390/768/1440 layouts; no Reset History.',
    );
}

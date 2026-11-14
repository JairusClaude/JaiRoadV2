import assert from 'node:assert/strict';
import process from 'node:process';

export async function verifyAuthenticatedHistory(
    page,
    ui,
    email,
    sessionCookieName,
) {
    const base = new URL(ui).origin;
    const context = page.context();
    const oldCookies = await context.cookies(base);
    const otherTab = await context.newPage();
    await otherTab.goto(`${ui}/monthly-updates`);
    await otherTab
        .getByRole('heading', { name: 'Monthly Updates', exact: true })
        .waitFor();
    await page.locator('[data-test=logout-button]').click();
    await page.waitForURL(`${base}/login`);
    await page.getByLabel('Email address').waitFor();
    // Replay the actual pre-logout session cookie: Fortify invalidates it server-side.
    const replay = await page.request.get(`${ui}/monthly-updates`, {
        headers: {
            Cookie: oldCookies
                .map((cookie) => `${cookie.name}=${cookie.value}`)
                .join('; '),
        },
        maxRedirects: 0,
    });

    if (replay.status() !== 302) {
        const body = await replay.text();
        console.log(
            'Logout replay diagnostic:',
            JSON.stringify({
                status: replay.status(),
                url: replay.url(),
                location: replay.headers().location,
                contentType: replay.headers()['content-type'],
                hasMonthlyComponent: body.includes('MonthlyUpdates/Index'),
                hasLoginComponent: body.includes('auth/login'),
            }),
        );
    }

    assert.equal(replay.status(), 302);
    const historyResponse = page.waitForResponse(
        (response) =>
            response.status() === 409 &&
            response.headers()['x-inertia-location'] === `${base}/login`,
    );
    await page.goBack();
    await historyResponse;
    await page.waitForURL(`${base}/login`);
    await page.getByLabel('Email address').waitFor();
    assert.equal(await page.locator('.jr-workspace').count(), 0);
    await page.reload();
    await page.getByLabel('Email address').waitFor();
    assert.equal(new URL(page.url()).pathname, '/login');
    assert.equal(
        (
            await otherTab.request.get(`${ui}/monthly-updates`, {
                maxRedirects: 0,
            })
        ).status(),
        302,
    );
    await otherTab
        .getByRole('link', { name: 'Road Coverages', exact: true })
        .first()
        .click();
    await otherTab.waitForURL(`${base}/login`);
    await otherTab.getByLabel('Email address').waitFor();
    assert.equal(await otherTab.locator('.jr-workspace').count(), 0);
    await otherTab.close();

    if (process.env.UNIFIED_BROWSER_EVIDENCE_DIR) {
        await page.screenshot({
            path: `${process.env.UNIFIED_BROWSER_EVIDENCE_DIR}/logout-back-after.png`,
            fullPage: true,
        });
    }

    // A fresh real login must leave normal Inertia Back/Forward navigation usable.
    await page.getByLabel('Email address').fill(email);
    await page
        .getByLabel('Password', { exact: true })
        .fill('Disposable-Test!123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL((url) => url.pathname.startsWith('/dd-phase3/'));
    await page
        .getByRole('link', { name: 'Road Coverages', exact: true })
        .first()
        .click();
    await page.waitForURL(`${ui}/road-coverages`);
    await page
        .getByRole('link', { name: 'Monthly Updates', exact: true })
        .first()
        .click();
    await page.waitForURL(`${ui}/monthly-updates`);
    await page.goBack();
    await page.waitForURL(`${ui}/road-coverages`);
    await page
        .getByRole('heading', { name: 'Road Coverages', exact: true })
        .waitFor();
    await page.goForward();
    await page.waitForURL(`${ui}/monthly-updates`);
    await page
        .getByRole('heading', { name: 'Monthly Updates', exact: true })
        .waitFor();

    // Expire the real session cookie in the browser, without a logout event or
    // a frontend session flag, to exercise unauthenticated navigation independently.
    const session = (await context.cookies(base)).find(
        (cookie) => cookie.name === sessionCookieName,
    );
    assert.ok(session, 'A real Laravel session cookie must exist');
    await context.addCookies([
        { ...session, expires: Math.floor(Date.now() / 1000) - 10 },
    ]);
    await page
        .getByRole('link', { name: 'Road Coverages', exact: true })
        .first()
        .click();
    await page.waitForURL(`${base}/login`);
    await page.getByLabel('Email address').waitFor();
    assert.equal(await page.locator('.jr-workspace').count(), 0);
    await page.goBack();
    await page.waitForURL(`${base}/login`);
    await page.getByLabel('Email address').waitFor();
    assert.equal(await page.locator('.jr-workspace').count(), 0);
    console.log(
        'PASS: Fortify invalidates the old session; logout/Back URL is /login; reload and another tab remain unauthorized; fresh-login Back/Forward works; expired session cookie redirects safely.',
    );
}

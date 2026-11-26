// Real password-only authentication with disposable PostgreSQL and Chromium.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QUARTERLY_BROWSER_URL;
assert.match(base || '', /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');
const fixture = JSON.parse(await readFile(process.env.PASSKEY_BROWSER_FIXTURE, 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
async function request(page, path, data) {
    return page.evaluate(async ({ path, data }) => {
        const cookie = document.cookie.split('; ').find(c => c.startsWith('XSRF-TOKEN='));
        const response = await fetch(path, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)) }, body: JSON.stringify(data) });
        return response.status;
    }, { path, data });
}
try {
    // Verify the real shared auth shell, including failed remote images.
    const showcaseContext = await browser.newContext({ reducedMotion: 'no-preference' });
    const showcasePage = await showcaseContext.newPage();
    await showcasePage.route('https://images.unsplash.com/**', route => route.abort());
    await showcasePage.goto(base + '/login');
    const showcase = showcasePage.locator('.jr-login-showcase');
    assert.equal(await showcase.getAttribute('data-active-slide'), '0');
    await showcase.hover();
    await showcasePage.waitForFunction(() => document.querySelector('.jr-login-showcase')?.getAttribute('data-active-slide') === '1', null, { timeout: 15000 });
    assert.equal(await showcase.locator('img[src="/images/jairoads/road-mapping-fallback.svg"]').evaluate(image => image.complete && image.naturalWidth > 0), true);
    await showcasePage.waitForFunction(() => document.querySelector('.jr-login-showcase')?.getAttribute('data-active-slide') === '2', null, { timeout: 15000 });
    await showcasePage.getByRole('button', { name: 'Pause slideshow' }).click();
    await showcasePage.getByRole('button', { name: 'Previous slide' }).click();
    assert.equal(await showcase.getAttribute('data-active-slide'), '1');
    await showcasePage.getByRole('button', { name: 'Resume slideshow' }).click();
    assert.equal(await showcasePage.getByRole('link', { name: 'Forgot password?' }).count(), 0);
    assert.equal(await showcasePage.getByRole('button', { name: 'Sign in with a passkey' }).count(), 0);
    await showcaseContext.close();
    for (const user of fixture.users) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(base + '/login');
        if (user.role === 'Legacy') {
            execFileSync(process.env.TEST_PHP_BINARY || 'php', ['tests/Browser/passkey-state.php', String(user.id), 'legacy']);
            assert.equal(await request(page, '/login', { email: user.email, password: 'Disposable-Test!123' }), 422);
        } else {
            await page.getByLabel('Email address').fill(user.email);
            await page.getByLabel('Password', { exact: true }).fill('Disposable-Test!123');
            await page.getByRole('button', { name: 'Sign in', exact: true }).click();
            await page.waitForURL(url => url.pathname !== '/login');
            assert.equal((await page.request.get(base + '/dashboard', { headers: { Accept: 'application/json' } })).status(), 200);
            assert.equal(await request(page, '/logout', {}), 204);
            await page.goto(base + '/login');
            for (const action of ['inactive', 'email', 'hash', 'legacy', 'reset']) {
                execFileSync(process.env.TEST_PHP_BINARY || 'php', ['tests/Browser/passkey-state.php', String(user.id), action]);
                if (action !== 'reset') {
                    assert.equal(await request(page, '/login', { email: user.email, password: 'Disposable-Test!123' }), 422);
                }
            }
        }
        for (const [path, payload] of [['/passkeys/login', { credential: {} }], ['/two-factor-challenge', { code: '123456' }], ['/reset-password', { email: user.email, password: 'Disposable-New!123' }]]) {
            assert.equal(await request(page, path, payload), 404, path);
        }
        assert.equal((await page.request.get(base + '/settings/security', { headers: { Accept: 'application/json' } })).status(), 401);
        await context.close();
    }
    console.log('PASS: password-only role sign-in, identity revocation, retired endpoints, and login slideshow.');
} finally {
    await browser.close();
}

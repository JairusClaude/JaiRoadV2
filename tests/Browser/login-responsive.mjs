// Read-only login UX smoke test against a running JaiROADS application.
import assert from 'node:assert/strict';
import process from 'node:process';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.env.JAIROADS_LOGIN_TEST_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const evidence = process.env.LOGIN_BROWSER_EVIDENCE_DIR;
if (evidence) await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE || undefined,
    headless: true,
});
try {
    for (const [width, height] of [[320, 568], [360, 800], [390, 844], [412, 915], [768, 1024], [1024, 768], [1440, 900]]) {
        const context = await browser.newContext({
            viewport: { width, height },
            isMobile: width < 768,
            hasTouch: width < 768,
            reducedMotion: 'no-preference',
            deviceScaleFactor: 1,
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://images.unsplash.com/**', route => route.abort());
        await page.goto(base + '/login');
        await page.getByLabel('Email address').waitFor();
        const layout = await page.evaluate(() => {
            const rect = selector => document.querySelector(selector).getBoundingClientRect();
            return {
                width: innerWidth,
                scrollWidth: document.documentElement.scrollWidth,
                banner: rect('.jr-login-showcase').height,
                signInBottom: rect('[data-test="login-button"]').bottom,
                caption: getComputedStyle(document.querySelector('.jr-login-caption')).display,
                focused: document.activeElement?.id,
            };
        });
        assert.ok(layout.scrollWidth <= layout.width + 1, 'Horizontal overflow at ' + width);
        assert.notEqual(layout.focused, 'email', 'No unsolicited focus at ' + width);
        if (width <= 1023) {
            assert.ok(layout.banner <= 110, 'Mobile brand is too tall at ' + width);
            assert.equal(layout.caption, 'none');
            assert.equal(await page.locator('.jr-login-photo').count(), 1);
            assert.equal(await page.locator('.jr-login-showcase').getAttribute('data-playing'), 'false');
            assert.ok(layout.signInBottom <= height + 30, 'Sign-in button too far below initial viewport at ' + width);
        } else {
            assert.equal(await page.locator('.jr-login-photo').count(), 3);
            await page.getByRole('button', { name: 'Pause slideshow' }).click();
            await page.getByRole('button', { name: 'Next slide' }).click();
            assert.equal(await page.locator('.jr-login-showcase').getAttribute('data-active-slide'), '1');
            await page.getByRole('button', { name: 'Previous slide' }).click();
            await page.getByRole('button', { name: 'Resume slideshow' }).click();
        }
        const password = page.getByLabel('Password', { exact: true });
        await password.fill('Disposable-visual-test');
        await page.getByRole('button', { name: 'Show password' }).click();
        assert.equal(await password.getAttribute('type'), 'text');
        await page.getByRole('button', { name: 'Hide password' }).click();
        assert.equal(await password.getAttribute('type'), 'password');
        await password.clear();
        const remember = page.getByLabel('Keep me signed in');
        assert.equal(await remember.isChecked(), false);
        await remember.check();
        assert.equal(await remember.isChecked(), true);
        await remember.uncheck();
        const help = page.locator('.jr-login-passkey-help');
        if (await help.count()) {
            await help.locator('summary').click();
            assert.equal(await help.evaluate(element => element.open), true);
            await help.locator('summary').click();
        }
        assert.deepEqual(errors, [], 'Browser exceptions at ' + width);
        if (evidence) await page.screenshot({ path: evidence + '/login-' + width + '.png', fullPage: true });
        console.log('PASS', width, height, JSON.stringify(layout));
        await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(base + '/login');
    await page.getByLabel('Email address').waitFor();
    assert.equal(await page.locator('.jr-login-showcase').getAttribute('data-playing'), 'false');
    assert.equal(await page.locator('.jr-login-headline').evaluate(el => getComputedStyle(el.closest('.jr-login-caption')).animationName), 'none');
    await context.close();
    console.log('PASS: reduced motion');
} finally {
    await browser.close();
}

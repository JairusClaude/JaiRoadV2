// Real authenticated Laravel/PostgreSQL on a separate disposable fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');
assert.equal(process.env.DB_DATABASE, 'jairoads_scratch_receipt_browser');
assert.equal(process.env.JAIROADS_MONTHLY_RECEIPTS_ENABLED, 'true');
const base = process.env.QUARTERLY_BROWSER_URL;
assert.equal(base, 'http://127.0.0.1:8012');
const fixture = JSON.parse(
    await readFile(process.env.QUARTERLY_BROWSER_FIXTURE, 'utf8'),
);
const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: 'reduce',
});
const path = '/workspace/ui/monthly-updates';
const createUrl = `${base}${path}/create?maintenance_id=${fixture.record_id}`;
const passphrase = 'synthetic-durable-queue-passphrase';
const summary = 'Encrypted queue lifecycle fixture';
const key = 'jairoads:encrypted-receipt-queue:v1';
let posts = 0;
context.on('request', (request) => {
    if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname === path
    ) {
        posts++;
    }
});

try {
    let page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(base + '/login');
    await page.getByLabel('Email address').fill(fixture.engineer_email);
    await page
        .getByLabel('Password', { exact: true })
        .fill('Disposable-Test!123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/workspace\/dashboard/);
    await page.goto(createUrl);
    await page
        .getByRole('button', { name: 'Select month and year', exact: true })
        .click();
    await page.getByRole('button', { name: 'April 2026', exact: true }).click();
    await page.getByLabel(/^Progress Percentage/).fill('31.5');
    await page.getByLabel(/^Progress Summary/).fill(summary);
    const consent = (page) =>
        page.getByLabel(/I consent to encrypted local storage/);
    const password = (page) => page.getByLabel(/^Queue passphrase/);
    await consent(page).check();
    await password(page).fill(passphrase);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Save encrypted queue' }).click();
    await page
        .getByText('Encrypted report saved on this device. Not submitted.', {
            exact: true,
        })
        .waitFor();
    const stored = await page.evaluate((key) => localStorage.getItem(key), key);
    assert.ok(stored);
    assert.equal(JSON.parse(stored).format, 'jairoads-encrypted-draft-v1');
    assert.ok(!stored.includes(summary));
    assert.ok(!stored.includes(passphrase));
    assert.equal(posts, 0);
    await page.close();

    await context.setOffline(false);
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(createUrl);
    await page.getByRole('button', { name: 'Unlock saved queue' }).waitFor();
    assert.equal(posts, 0);
    assert.equal(await page.getByText(summary, { exact: true }).count(), 0);
    await consent(page).check();
    await password(page).fill(passphrase);
    await page.getByRole('button', { name: 'Unlock saved queue' }).click();
    await page.getByText(summary, { exact: true }).waitFor();
    await password(page).fill(passphrase);
    await page
        .getByRole('button', { name: 'Submit saved report once' })
        .click();
    await page.waitForURL(/\/workspace\/ui\/monthly-updates\/\d+$/);
    assert.equal(posts, 1);
    const reportUrl = page.url();
    await page.getByText(summary, { exact: true }).first().waitFor();
    const attempted = await page.evaluate(
        (key) => localStorage.getItem(key),
        key,
    );
    assert.notEqual(attempted, stored);
    assert.ok(!attempted.includes(summary));
    await page.close();

    page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(createUrl);
    await consent(page).check();
    await password(page).fill(passphrase);
    await page.getByRole('button', { name: 'Unlock saved queue' }).click();
    await page
        .getByText('Attempted; check receipt only.', { exact: true })
        .waitFor();
    assert.equal(
        await page
            .getByRole('button', { name: 'Submit saved report once' })
            .isDisabled(),
        true,
    );
    await password(page).fill(passphrase);
    await page
        .getByRole('button', { name: 'Check submission receipt' })
        .click();
    await page
        .getByText('The original submission receipt is confirmed.', {
            exact: true,
        })
        .waitFor();
    assert.equal(
        new URL(
            await page
                .getByRole('link', { name: 'Open confirmed report' })
                .getAttribute('href'),
            base,
        ).href,
        reportUrl,
    );
    assert.equal(posts, 1);
    await password(page).fill(passphrase);
    await page.getByRole('button', { name: 'Remove local queue' }).click();
    await page
        .getByText('Local encrypted queue removed. Server reports unchanged.', {
            exact: true,
        })
        .waitFor();
    assert.equal(
        await page.evaluate((key) => localStorage.getItem(key), key),
        null,
    );
    assert.equal((await page.request.get(reportUrl)).status(), 200);
    console.log(
        'PASS: real encrypted queue survives closure, submits once, confirms receipt and removes local data without deleting the report.',
    );
} finally {
    await browser.close();
}

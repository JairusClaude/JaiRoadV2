// Run against the disposable fixtures only; never a production or shared application.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const base = process.env.QUARTERLY_BROWSER_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');
const fixture = JSON.parse(
    await readFile(process.env.QUARTERLY_BROWSER_FIXTURE, 'utf8'),
);
const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    args: ['--no-sandbox'],
});

try {
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1100 },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/login`);
    await page.getByLabel('Email address').fill(fixture.email);
    await page
        .getByLabel('Password', { exact: true })
        .fill('Disposable-Test!123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/dd-phase3\/dashboard/);
    await page.goto(
        `${base}/dd-phase3/projects?view=show&project=${fixture.project}`,
    );
    await page
        .getByText('No quarterly records scheduled yet.', { exact: true })
        .waitFor();
    await page.getByLabel('Active maintenance year').fill('2026');
    await page.getByLabel('Annual pattern').selectOption('Q2');
    await page
        .getByRole('button', { name: 'Create Q2 record', exact: true })
        .click();
    const form = page
        .locator('form')
        .filter({ hasText: 'Create maintenance record · 2026 Q2' });
    await form.getByLabel('Estimated duration (days)').fill('5');
    await form.getByLabel('Maintenance status').selectOption('Completed');
    await form.getByLabel('Actual start date').fill('2026-04-01');
    await form.getByLabel('Completion date').fill('2026-04-05');
    await form
        .getByRole('button', { name: 'Save maintenance record', exact: true })
        .click();
    await page
        .getByText('Maintenance record saved.', { exact: true })
        .waitFor();
    await page
        .getByText('Next expected period: 2026 Q4', { exact: true })
        .waitFor();
    await page
        .getByRole('button', {
            name: 'Create next quarterly record',
            exact: true,
        })
        .click();
    const next = page
        .locator('form')
        .filter({ hasText: 'Create maintenance record · 2026 Q4' });
    assert.match(
        await next.getByLabel('Actual start date').inputValue(),
        /^2026-(10|11|12)-\d\d$/,
    );
    assert.equal(await next.getByLabel('Maintenance status').inputValue(), '');
    await next.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload();
    await page
        .getByText('Expected slot · no activity recorded', { exact: true })
        .waitFor();
    await page
        .getByRole('button', { name: 'Edit details', exact: true })
        .click();
    assert.equal(
        await page
            .getByLabel('ManagingEngineer', { exact: false })
            .isDisabled(),
        true,
    );
    assert.deepEqual(errors, []);

    if (process.env.QUARTERLY_SCREENSHOT) {
        await page.screenshot({
            path: process.env.QUARTERLY_SCREENSHOT,
            fullPage: true,
        });
    }

    console.log(
        'PASS: Project Details, Q2 record save, refreshed Q4 expectation, unsaved future slot, immutable manager; no browser errors.',
    );
} finally {
    await browser.close();
}

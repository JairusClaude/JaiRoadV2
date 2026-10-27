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
        .getByText('No quarterly records recorded yet.', { exact: true })
        .waitFor();
    assert.equal(await page.getByLabel('Annual pattern').count(), 0);
    assert.doesNotMatch(
        await page.locator('body').innerText(),
        /Two maintenance periods per year/,
    );
    await page.getByLabel('Active maintenance year').fill('2026');

    for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
        assert.equal(
            await page
                .getByRole('button', {
                    name: `Create ${quarter} record`,
                    exact: true,
                })
                .count(),
            1,
        );
    }

    for (const [quarter, start] of [
        ['Q4', '2026-10-01'],
        ['Q2', '2026-04-01'],
    ]) {
        await page
            .getByRole('button', {
                name: `Create ${quarter} record`,
                exact: true,
            })
            .click();
        const form = page
            .locator('form')
            .filter({ hasText: `Create maintenance record · 2026 ${quarter}` });
        await form.getByLabel('Estimated duration (days)').fill('5');
        await form.getByLabel('Maintenance status').selectOption('Ongoing');
        await form.getByLabel('Actual start date').fill(start);
        await form
            .getByRole('button', {
                name: 'Save maintenance record',
                exact: true,
            })
            .click();
        await form.waitFor({ state: 'hidden' });
        await page
            .getByRole('cell', { name: `2026 ${quarter}`, exact: true })
            .waitFor();
        await page.getByLabel('Active maintenance year').fill('2026');
        assert.equal(
            await page
                .getByRole('button', {
                    name: `Create ${quarter} record`,
                    exact: true,
                })
                .count(),
            0,
        );
    }

    await page
        .getByRole('button', { name: 'Create Q1 record', exact: true })
        .click();
    const unsaved = page
        .locator('form')
        .filter({ hasText: 'Create maintenance record · 2026 Q1' });
    assert.equal(
        await unsaved.getByLabel('Maintenance status').inputValue(),
        '',
    );
    await unsaved.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload();
    assert.equal(
        await page.getByRole('cell', { name: '2026 Q1', exact: true }).count(),
        0,
    );
    await page.getByLabel('Active maintenance year').fill('2027');
    await page
        .getByRole('button', { name: 'Create Q4 record', exact: true })
        .click();
    const nextYear = page
        .locator('form')
        .filter({ hasText: 'Create maintenance record · 2027 Q4' });
    assert.match(
        await nextYear.getByLabel('Actual start date').inputValue(),
        /^2027-(10|11|12)-\d\d$/,
    );
    await nextYear.getByLabel('Estimated duration (days)').fill('5');
    await nextYear.getByLabel('Maintenance status').selectOption('Ongoing');
    await nextYear
        .getByRole('button', { name: 'Save maintenance record', exact: true })
        .click();
    await nextYear.waitFor({ state: 'hidden' });
    await page.getByRole('cell', { name: '2027 Q4', exact: true }).waitFor();
    assert.equal(
        await page.getByLabel('Active maintenance year').inputValue(),
        '2027',
    );
    await page.getByLabel('Active maintenance year').fill('2026');
    await page
        .getByRole('button', { name: 'Edit details', exact: true })
        .first()
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
        'PASS: Engineer selects Q4 first then Q2; all quarters available independently; occupied quarters unavailable; no unsaved/future row; next-year reuse; immutable manager.',
    );
} finally {
    await browser.close();
}

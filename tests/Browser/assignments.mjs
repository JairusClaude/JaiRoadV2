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
const errors = [];
async function signIn(email) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/login`);
    await page.getByLabel('Email address').fill(email);
    await page
        .getByLabel('Password', { exact: true })
        .fill('Disposable-Test!123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/dd-phase3\/dashboard/);

    return page;
}
async function createProject(page, roadName, title) {
    await page.goto(`${base}/dd-phase3/projects`);
    await page
        .getByRole('button', { name: 'Add Project', exact: true })
        .click();
    await page.waitForURL(/view=create/);
    await page.getByRole('radio', { name: new RegExp(roadName) }).check();
    await page.getByLabel('Project title', { exact: false }).fill(title);
    assert.equal(
        await page.getByLabel('ManagingEngineer', { exact: false }).count(),
        0,
    );
    assert.equal(await page.locator('input[name="municipality"]').count(), 0);
    await page
        .getByRole('button', { name: /save project|create project/i })
        .click();
    await page.waitForURL(`${base}/dd-phase3/projects`);
    await page.getByText(title, { exact: true }).first().click();
    await page.waitForURL(/view=show/);
    await page
        .getByText('No quarterly records scheduled yet.', { exact: true })
        .waitFor();
}
async function prepareRecord(page, quarter) {
    await page.getByLabel('Active maintenance year').fill('2026');
    await page
        .getByRole('button', { name: `Create ${quarter} record`, exact: true })
        .click();
    const form = page
        .locator('form')
        .filter({ hasText: `Create maintenance record · 2026 ${quarter}` });
    await form.getByLabel('Estimated duration (days)').fill('5');
    await form.getByLabel('Maintenance status').selectOption('Ongoing');

    return form;
}
async function saveRecord(page, form) {
    await form
        .getByRole('button', { name: 'Save maintenance record', exact: true })
        .click();
    await form.waitFor({ state: 'hidden' });
    await page
        .getByText('Maintenance record saved.', { exact: true })
        .waitFor();
}

try {
    const engineer = await signIn(fixture.engineer_email);
    await createProject(
        engineer,
        'Engineer available road',
        'Engineer UI project',
    );
    const own = await prepareRecord(engineer, 'Q1');
    const ownSelect = own.getByLabel('ManagingEngineer', { exact: false });
    assert.equal(await ownSelect.locator('option').count(), 2);
    assert.equal(await ownSelect.inputValue(), String(fixture.engineer_id));
    await saveRecord(engineer, own);
    await engineer
        .getByRole('button', { name: 'Edit details', exact: true })
        .click();
    assert.equal(
        await engineer
            .getByLabel('ManagingEngineer', { exact: false })
            .isDisabled(),
        true,
    );
    assert.equal(
        await engineer
            .getByRole('button', { name: 'Delete', exact: true })
            .count(),
        0,
    );
    const admin = await signIn(fixture.admin_email);
    await createProject(admin, 'Admin available road', 'Admin UI project');
    const self = await prepareRecord(admin, 'Q1');
    const choices = self.getByLabel('ManagingEngineer', { exact: false });
    const values = await choices
        .locator('option')
        .evaluateAll((options) =>
            options.map((option) => option.value).filter(Boolean),
        );
    assert.deepEqual(
        values.sort(),
        [
            String(fixture.admin_engineer_id),
            String(fixture.assigned_engineer_id),
        ].sort(),
    );
    await choices.selectOption(String(fixture.admin_engineer_id));
    await saveRecord(admin, self);
    const next = await prepareRecord(admin, 'Q3');
    await next
        .getByLabel('ManagingEngineer', { exact: false })
        .selectOption(String(fixture.assigned_engineer_id));
    await saveRecord(admin, next);
    await admin.getByLabel('Active maintenance year').fill('2026');
    await admin
        .getByRole('cell', { name: 'Admin Manager', exact: true })
        .waitFor();
    await admin
        .getByRole('cell', { name: 'Assigned Engineer', exact: true })
        .waitFor();
    assert.deepEqual(errors, []);
    console.log(
        'PASS: Engineer project creation and own record; no Engineer delete/reassignment; Admin unassigned project, self-management, and eligible Engineer on next period; municipality derived from RoadCoverage.',
    );
} finally {
    await browser.close();
}

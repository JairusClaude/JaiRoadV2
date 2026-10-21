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
async function signIn(email, password = 'Disposable-Test!123') {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/login`);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/dd-phase3\/dashboard|dd-superadmin-landing/);

    return page;
}

try {
    const page = await signIn(fixture.admin_email);
    const nav = page
        .getByRole('link', { name: 'User Management', exact: true })
        .first();
    assert.equal(await nav.getAttribute('href'), '/dd-phase3/users');
    await nav.click();
    await page.waitForURL(`${base}/dd-phase3/users`);
    await page
        .getByRole('columnheader', { name: 'Account Type', exact: true })
        .waitFor();
    assert.equal(
        await page
            .getByRole('columnheader', { name: 'Role', exact: true })
            .count(),
        0,
    );
    assert.equal(await page.getByLabel(/Position/i).count(), 0);
    const typeCells = await page
        .locator('tbody tr td:nth-child(2)')
        .allTextContents();

    for (const type of ['SuperAdmin', 'Admin', 'Engineer', 'Viewer']) {
        assert.ok(typeCells.some((value) => value.trim() === type));
    }

    const rank = page.getByLabel('Rank', { exact: true });
    const engineerForm = page.locator('form').filter({ has: rank });
    await engineerForm
        .getByLabel('First name', { exact: true })
        .fill('UI Rank');
    await engineerForm.getByLabel('Last name', { exact: true }).fill('Fixture');
    await engineerForm.getByLabel(/^Contact number/).fill('09123456789');
    await rank.fill('Engineer III');
    const engineerRequest = page.waitForRequest(
        (request) =>
            request.method() === 'POST' &&
            new URL(request.url()).pathname === '/dd-phase3/engineers',
    );
    await engineerForm
        .getByRole('button', { name: 'Create engineer', exact: true })
        .click();
    const engineerPayload = (await engineerRequest).postDataJSON();
    assert.equal(engineerPayload.rank, 'Engineer III');
    assert.equal(Object.hasOwn(engineerPayload, 'position'), false);
    const accountForm = page
        .locator('form')
        .filter({ has: page.getByLabel(/^Account Type/) });
    const accountType = accountForm.getByLabel(/^Account Type/);
    await accountType.selectOption('Engineer');
    const engineerSelect = accountForm.getByLabel(/^Engineer/);
    const option = engineerSelect
        .locator('option')
        .filter({ hasText: 'UI Rank Fixture · Engineer III' });
    await option.waitFor({ state: 'attached' });
    const engineerId = await option.getAttribute('value');
    await engineerSelect.selectOption(engineerId);
    await accountForm.getByLabel(/^Username/).fill('ui-type-engineer');
    await accountForm
        .getByLabel('Email', { exact: true })
        .fill('ui-type-engineer@example.test');
    await accountForm
        .getByLabel('Display name', { exact: true })
        .fill('UI Type Engineer');
    await accountForm.getByLabel(/^Password/).fill('Typed-Disposable!123');
    await accountForm
        .getByLabel(/^Confirm password/)
        .fill('Typed-Disposable!123');
    const accountRequest = page.waitForRequest(
        (request) =>
            request.method() === 'POST' &&
            new URL(request.url()).pathname === '/dd-phase3/accounts',
    );
    await accountForm
        .getByRole('button', { name: 'Create account', exact: true })
        .click();
    const accountPayload = (await accountRequest).postDataJSON();
    assert.equal(accountPayload.account_type, 'Engineer');
    assert.equal(String(accountPayload.engineer_id), engineerId);
    assert.equal(Object.hasOwn(accountPayload, 'position'), false);
    await page.getByText('Account created.', { exact: true }).waitFor();
    const row = page
        .getByRole('row')
        .filter({ hasText: 'ui-type-engineer@example.test' });
    await row.waitFor();
    assert.match(await row.innerText(), /Engineer/);
    assert.match(await row.innerText(), /UI Rank Fixture/);
    await page.goto(`${base}/dd-phase3/settings`);
    await page.getByText('Account Type', { exact: true }).waitFor();
    assert.equal(await page.getByText('Role', { exact: true }).count(), 0);
    await page.goto(`${base}/user-management`);
    await page.waitForURL(`${base}/dd-phase3/users`);
    assert.equal(await page.getByLabel(/Position/i).count(), 0);
    const created = await signIn(
        'ui-type-engineer@example.test',
        'Typed-Disposable!123',
    );
    const denied = await created.request.get(`${base}/dd-phase3/users`);
    assert.equal(denied.status(), 403);
    const superAdmin = await signIn(fixture.superadmin_email);
    await superAdmin
        .getByRole('heading', {
            name: 'Account Type distribution',
            exact: true,
        })
        .waitFor();
    await superAdmin
        .getByRole('columnheader', { name: 'Account Type', exact: true })
        .waitFor();
    assert.equal(
        await superAdmin
            .getByRole('link', { name: 'User Management', exact: true })
            .first()
            .getAttribute('href'),
        '/dd-phase3/users',
    );
    assert.deepEqual(errors, []);
    console.log(
        'PASS: Account Type labels and all four values; Rank-only Engineer creation; canonical account_type and Engineer link; new credentials work; settings/SuperAdmin labels; native DD navigation and no Position fields.',
    );
} finally {
    await browser.close();
}

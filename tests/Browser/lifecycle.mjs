import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const base = process.env.QUARTERLY_BROWSER_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');
const f = JSON.parse(
    await readFile(process.env.QUARTERLY_BROWSER_FIXTURE, 'utf8'),
);
const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    args: ['--no-sandbox'],
});
const errors = [];
async function signIn(email) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(`${base}/login`);
    await page.getByLabel('Email address').fill(email);
    await page
        .getByLabel('Password', { exact: true })
        .fill('Disposable-Test!123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/dd-phase3\/dashboard/);

    return page;
}

try {
    const former = await signIn(f.former_email);
    const viewer = await signIn(f.viewer_email);
    const admin = await signIn(f.admin_email);
    await admin.goto(`${base}/dd-phase3/users`);
    const engineer = admin.getByRole('region', {
        name: 'Engineer profile lifecycle',
    });
    await engineer
        .getByLabel(/^Engineer profile/)
        .selectOption(String(f.former_id));
    await engineer.getByLabel('Rank', { exact: true }).fill('Engineer IV');
    await engineer
        .getByRole('button', { name: 'Save profile', exact: true })
        .click();
    await engineer
        .getByRole('status')
        .filter({ hasText: 'Engineer profile saved.' })
        .waitFor();
    const accounts = admin.getByRole('region', {
        name: 'UserAccount lifecycle',
    });
    await accounts
        .getByLabel(/^Account to manage/)
        .selectOption(String(f.viewer_id));
    await accounts
        .getByRole('button', { name: 'Deactivate account', exact: true })
        .click();
    await accounts
        .getByRole('button', { name: 'Reactivate account', exact: true })
        .waitFor();
    assert.equal(
        (await viewer.request.get(`${base}/dd-phase3/dashboard`)).status(),
        403,
    );
    await accounts
        .getByRole('button', { name: 'Reactivate account', exact: true })
        .click();
    await accounts
        .getByRole('button', { name: 'Deactivate account', exact: true })
        .waitFor();
    await admin.goto(
        `${base}/dd-phase3/projects?view=show&project=${f.project_id}`,
    );
    await admin
        .getByRole('button', { name: 'Reassign manager', exact: true })
        .click();
    const reassign = admin.getByRole('form', {
        name: 'Reassign 2026 Q4',
        exact: true,
    });
    await reassign
        .getByLabel('Replacement ManagingEngineer')
        .selectOption(String(f.replacement_id));
    await reassign
        .getByRole('button', { name: 'Confirm reassignment', exact: true })
        .click();
    await reassign.waitFor({ state: 'detached' });
    await former.goto(
        `${base}/dd-phase3/projects?view=show&project=${f.project_id}`,
    );
    assert.equal(
        await former
            .getByRole('button', { name: 'Edit details', exact: true })
            .count(),
        0,
    );
    const replacement = await signIn(f.replacement_email);
    await replacement.goto(
        `${base}/dd-phase3/projects?view=show&project=${f.project_id}`,
    );
    await replacement
        .getByRole('button', { name: 'Edit details', exact: true })
        .waitFor();

    for (const [section, kind, filename] of [
        ['documents', 'document', 'fixture.pdf'],
        ['updates', 'media', 'fixture.png'],
    ]) {
        await admin.goto(`${base}/dd-phase3/${section}`);
        const review = admin.getByRole('region', {
            name: `${kind} removal preparation`,
        });
        assert.equal(
            await review
                .getByRole('button', {
                    name: 'Delete unavailable pending retention policy',
                })
                .isDisabled(),
            true,
        );
        await review
            .getByLabel(`Review ${kind}`)
            .selectOption({ label: filename });
        await review.getByRole('status').waitFor();
    }

    await admin.goto(`${base}/dd-phase3/users`);
    await engineer
        .getByLabel(/^Engineer profile/)
        .selectOption(String(f.former_id));
    await engineer
        .getByRole('button', { name: 'Retire Engineer', exact: true })
        .click();
    await engineer
        .getByRole('status')
        .filter({ hasText: 'Engineer retired.' })
        .waitFor();
    assert.equal(
        (await former.request.get(`${base}/dd-phase3/dashboard`)).status(),
        403,
    );
    assert.deepEqual(errors, []);
    console.log(
        'PASS: profile Rank edit; account status and existing-session denial; explicit reassignment changes manager editing rights; disabled document/media removal reviews; retirement denies existing Engineer session.',
    );
} finally {
    await browser.close();
}

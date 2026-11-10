import assert from 'node:assert/strict';

export async function verifyPostDemoUserManagement({
    admin,
    superadmin,
    base,
}) {
    let sequence = 0;

    for (const page of [admin, superadmin]) {
        for (const role of ['Admin', 'Engineer', 'Viewer']) {
            await page.goto(`${base}/dd-phase3/users`);
            const form = page.getByRole('form', {
                name: 'Create canonical account',
            });
            const type = form.getByRole('combobox', {
                name: 'Account Type',
                exact: true,
            });
            assert.equal(await type.inputValue(), '');
            assert.equal(
                await form.getByLabel('Username', { exact: true }).count(),
                0,
            );
            assert.equal(
                await type.locator('option[value=SuperAdmin]').count(),
                0,
            );
            await type.selectOption('Admin');
            await form
                .getByLabel('First name', { exact: true })
                .fill('Cleared');
            await form
                .getByLabel('Username', { exact: true })
                .fill(`postdemo-browser-${++sequence}`);
            await type.selectOption('Viewer');
            assert.equal(
                await form.getByLabel('First name', { exact: true }).count(),
                0,
            );
            assert.equal(
                await form.getByLabel('Rank', { exact: true }).count(),
                0,
            );
            assert.equal(
                await form
                    .getByLabel('Linked Engineer', { exact: false })
                    .count(),
                0,
            );
            assert.equal(
                await form.getByLabel('Username', { exact: true }).inputValue(),
                `postdemo-browser-${sequence}`,
            );
            await type.selectOption(role);

            if (role !== 'Viewer') {
                assert.equal(
                    await form
                        .getByLabel('First name', { exact: true })
                        .inputValue(),
                    '',
                );
                await form
                    .getByLabel('First name', { exact: true })
                    .fill('Browser');
                await form
                    .getByLabel('Middle name (optional)', { exact: true })
                    .fill('PostDemo');
                await form
                    .getByLabel('Last name', { exact: true })
                    .fill(`Person${sequence}`);
                await form
                    .getByLabel('Contact number', { exact: true })
                    .fill(`0901234500${sequence}`);
                await form
                    .getByLabel('Rank', { exact: true })
                    .fill('Engineer II');
            } else {
                await form
                    .getByLabel('Display name', { exact: true })
                    .fill('Independent browser Viewer');
            }

            await form
                .getByLabel('Login email', { exact: true })
                .fill(`postdemo-${sequence}@example.test`);
            await form
                .getByLabel('Password', { exact: true })
                .fill('Browser-PostDemo!123');
            const submit = form.getByRole('button', {
                name: 'Create account',
                exact: true,
            });
            assert.equal(await submit.isDisabled(), true);
            await form
                .getByLabel('Confirm password', { exact: true })
                .fill('Browser-PostDemo!123');
            const response = page.waitForResponse(
                (r) =>
                    r.url().endsWith('/dd-phase3/accounts') &&
                    r.request().method() === 'POST',
            );
            await submit.click();
            const saved = await response;
            assert.equal(saved.status(), 302);
            const payload = saved.request().postDataJSON();
            assert.equal(payload.account_type, role);
            assert.equal(Object.hasOwn(payload, 'engineer_id'), false);
            assert.equal(Object.hasOwn(payload, 'rank'), role !== 'Viewer');
            assert.equal(Object.hasOwn(payload, 'name'), role === 'Viewer');
            await page.getByText('Account created.', { exact: true }).waitFor();
            await page
                .getByRole('row')
                .filter({ hasText: `postdemo-${sequence}@example.test` })
                .waitFor();
            assert.equal(
                await form
                    .getByRole('combobox', {
                        name: 'Account Type',
                        exact: true,
                    })
                    .inputValue(),
                '',
            );

            for (const width of [390, 1440]) {
                await page.setViewportSize({ width, height: 1000 });
                const box = await form.boundingBox();
                assert.ok(
                    box &&
                        box.width <= width &&
                        box.x >= 0 &&
                        box.x + box.width <= width + 1,
                );
            }
        }
    }

    console.log(
        'PASS: PostDemo account type first; six Admin/SuperAdmin role-specific creations; cleared incompatible fields, safe payloads, refreshed directory and mobile/desktop form bounds.',
    );
}

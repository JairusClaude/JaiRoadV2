// Only run with prepare-municipality-change.php and a disposable local PostgreSQL 17 app.
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
    args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
    ],
});

try {
    const page = await browser.newPage({
        viewport: { width: 1360, height: 1000 },
    });
    const errors = [];
    const confirmations = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
        if (request.url().endsWith('/municipality/confirm')) {
            confirmations.push(request.method());
        }
    });

    async function login(email) {
        await page.context().clearCookies();
        await page.goto(`${base}/login`);
        await page.getByLabel('Email address').fill(email);
        await page
            .getByLabel('Password', { exact: true })
            .fill('Disposable-Test!123');
        await page
            .getByRole('button', { name: 'Sign in', exact: true })
            .click();
        await page.waitForURL(/dd-phase3\/dashboard/);
    }

    async function openReview(lgu) {
        await page.goto(`${base}/dd-phase3/roads`);
        await page
            .getByRole('button', {
                name: /Municipality acceptance road Coverage ID/,
            })
            .click();
        await page
            .getByRole('button', { name: 'Change municipality', exact: true })
            .click();
        await page
            .getByLabel('New municipality', { exact: true })
            .selectOption(String(lgu));
        await page
            .getByRole('button', { name: 'Review Changes', exact: true })
            .click();
        await page
            .getByRole('heading', {
                name: 'Review municipality change',
                exact: true,
            })
            .waitFor();
    }

    await login(fixture.admin_email);
    await openReview(fixture.destination_lgu_id);
    const dialog = page.getByRole('dialog');
    assert.match(
        await dialog.innerText(),
        /Previous municipality\s+Nabunturan/,
    );
    assert.match(await dialog.innerText(), /New municipality\s+Mawab/);
    assert.match(
        await dialog.innerText(),
        new RegExp(`MaintenanceProject #${fixture.project_id}`),
    );
    assert.match(
        await dialog.innerText(),
        /1 MaintenanceRecords · 1 MonthlyUpdates · 1 documents · 1 media/,
    );
    assert.match(
        await dialog.innerText(),
        /Existing historical AuditLog entries will not be changed/,
    );
    assert.equal(
        await dialog
            .getByRole('button', { name: 'Confirm Municipality Change' })
            .isEnabled(),
        true,
    );
    assert.equal(confirmations.length, 0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.match(
        await page
            .getByRole('row')
            .filter({ hasText: 'Municipality acceptance road' })
            .innerText(),
        /Nabunturan/,
    );
    assert.equal(confirmations.length, 0);
    console.log(
        'PASS: review shows server impact; Cancel sends no confirmation and retains the original municipality.',
    );

    await openReview(fixture.destination_lgu_id);
    // Modify the live disposable assignment through the existing authorized endpoint.
    const response = await page.evaluate(async (f) => {
        const xsrf = document.cookie
            .split('; ')
            .find((cookie) => cookie.startsWith('XSRF-TOKEN='));
        const result = await fetch('/dd-phase3/assignments', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': decodeURIComponent(
                    xsrf.slice('XSRF-TOKEN='.length),
                ),
            },
            body: JSON.stringify({
                engineer_id: f.engineer_id,
                lgu_id: f.destination_lgu_id,
                is_active: false,
            }),
        });

        return result.status;
    }, fixture);
    assert.equal(response, 200);
    await dialog
        .getByRole('button', { name: 'Confirm Municipality Change' })
        .click();
    await dialog.getByRole('alert').filter({ hasText: 'outdated' }).waitFor();
    await dialog
        .getByRole('button', { name: 'Review Changes', exact: true })
        .click();
    await dialog
        .getByRole('heading', { name: 'Review municipality change' })
        .waitFor();
    assert.equal(
        await dialog
            .getByRole('button', { name: 'Confirm Municipality Change' })
            .isDisabled(),
        true,
    );
    assert.match(
        await dialog.getByRole('alert').innerText(),
        new RegExp(`MaintenanceRecord #${fixture.record_id}`),
    );
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    // Restore only the disposable assignment, then obtain a fresh preview.
    await page.evaluate(async (f) => {
        const xsrf = document.cookie
            .split('; ')
            .find((cookie) => cookie.startsWith('XSRF-TOKEN='));
        const response = await fetch('/dd-phase3/assignments', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': decodeURIComponent(
                    xsrf.slice('XSRF-TOKEN='.length),
                ),
            },
            body: JSON.stringify({
                engineer_id: f.engineer_id,
                lgu_id: f.destination_lgu_id,
                is_active: true,
            }),
        });

        if (!response.ok) {
            throw new Error('Could not restore disposable assignment');
        }
    }, fixture);
    console.log(
        'PASS: stale confirmation rejected; refreshed conflict names the record and disables final confirmation.',
    );

    await openReview(fixture.destination_lgu_id);
    await dialog
        .getByRole('button', { name: 'Confirm Municipality Change' })
        .click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page
        .getByRole('status')
        .filter({ hasText: 'Municipality changed from Nabunturan to Mawab.' })
        .first()
        .waitFor();
    assert.match(
        await page
            .getByRole('row')
            .filter({ hasText: 'Municipality acceptance road' })
            .innerText(),
        /Mawab/,
    );
    console.log(
        'PASS: Admin final confirmation succeeds and reports old/new municipality.',
    );

    await login(fixture.engineer_email);
    await page.setViewportSize({ width: 390, height: 844 });
    await openReview(fixture.source_lgu_id);
    assert.equal(
        await dialog
            .getByRole('button', { name: 'Confirm Municipality Change' })
            .isEnabled(),
        true,
    );
    assert.ok(
        await dialog.evaluate(
            (element) =>
                element.getBoundingClientRect().width <= window.innerWidth,
        ),
    );
    await dialog
        .getByRole('button', { name: 'Confirm Municipality Change' })
        .click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page
        .getByRole('status')
        .filter({ hasText: 'Municipality changed from Mawab to Nabunturan.' })
        .first()
        .waitFor();
    console.log(
        'PASS: Engineer with both assignments confirms on a mobile viewport.',
    );

    await login(fixture.viewer_email);
    await page.goto(`${base}/dd-phase3/roads`);
    await page
        .getByRole('button', {
            name: /Municipality acceptance road Coverage ID/,
        })
        .click();
    assert.equal(
        await page
            .getByRole('button', { name: 'Change municipality', exact: true })
            .count(),
        0,
    );
    assert.deepEqual(errors, []);
    console.log(
        'PASS: Viewer has no municipality edit action; no browser JavaScript exceptions.',
    );
} finally {
    await browser.close();
}

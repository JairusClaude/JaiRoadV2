import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { pdf, png, startStorageMock } from './private-storage-mock.mjs';
const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const base = process.env.QUARTERLY_BROWSER_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');
const f = JSON.parse(
    await readFile(process.env.QUARTERLY_BROWSER_FIXTURE, 'utf8'),
);
const storage = await startStorageMock();
const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    args: [
        '--no-sandbox',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
    ],
});
const errors = [];
async function signIn(email) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1100 },
        acceptDownloads: true,
        reducedMotion: 'reduce',
    });
    await context.route('https://tiles.openfreemap.org/**', (route) =>
        route.fulfill({
            json: {
                version: 8,
                glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
                sources: {},
                layers: [
                    {
                        id: 'background',
                        type: 'background',
                        paint: { 'background-color': '#e8f0e5' },
                    },
                ],
            },
        }),
    );
    await context.route(
        'https://nominatim.openstreetmap.org/search**',
        async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 400));
            const q = new URL(route.request().url()).searchParams.get('q');

            if (q?.includes('unavailable')) {
                return route.fulfill({
                    status: 503,
                    body: 'Disposable unavailable geocoder',
                });
            }

            return route.fulfill({
                json: q?.includes('unknown')
                    ? []
                    : [
                          {
                              place_id: 1,
                              display_name:
                                  'Nabunturan, Davao de Oro, Philippines',
                              lat: '7.6021',
                              lon: '125.9687',
                          },
                      ],
            });
        },
    );
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(`${base}/login`);
    await page.getByLabel('Email address').fill(email);
    await page
        .getByLabel('Password', { exact: true })
        .fill('Disposable-Test!123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/dd-phase3\/dashboard|dd-superadmin-landing/);

    return page;
}
async function chooseMatching(select, text) {
    const option = select.locator('option').filter({ hasText: text }).first();
    await option.waitFor({ state: 'attached' });
    await select.selectOption(await option.getAttribute('value'));
}
async function mobile(page, section) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${base}/dd-phase3/${section}`);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    assert.ok(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 2,
        ),
        `${section} overflows mobile viewport`,
    );
    const menu = page
        .getByRole('button', {
            name: /open navigation|open menu|open sidebar/i,
        })
        .first();

    if (await menu.count()) {
        await menu.click();
        await page
            .getByRole('link', { name: 'Maintenance Projects', exact: true })
            .first()
            .waitFor();
    }

    await page.setViewportSize({ width: 1440, height: 1100 });
}

try {
    const engineer = await signIn(f.engineer_email);
    const admin = await signIn(f.admin_email);
    const viewer = await signIn(f.viewer_email);
    const superadmin = await signIn(f.superadmin_email);
    await superadmin
        .getByRole('heading', { name: /Account Type distribution/ })
        .waitFor();
    await engineer.goto(`${base}/dd-phase3/roads`);
    await engineer
        .getByText('Seeded three point road', { exact: true })
        .first()
        .waitFor();
    await engineer.getByRole('button', { name: /Add Road Coverage/i }).click();
    await engineer.getByLabel(/^Road name/).fill('Browser workflow road');
    await engineer
        .getByLabel(/^Municipality|^LGU/)
        .last()
        .selectOption(String(f.lgu_id));
    const editor = engineer.getByRole('region', {
        name: 'Accessible road tracing editor',
    });
    const search = editor.getByPlaceholder(
        'Search municipality, road, or landmark…',
    );
    await search.fill('Nabunturan');
    await editor.getByRole('button', { name: 'Search', exact: true }).click();
    await editor
        .getByRole('button', { name: 'Searching…', exact: true })
        .waitFor();
    await editor
        .getByRole('button', { name: /Nabunturan, Davao de Oro/ })
        .click();
    await editor.getByRole('button', { name: /Draw road/ }).click();
    const canvas = editor.locator('canvas.maplibregl-canvas');
    await canvas.waitFor();

    const box = await canvas.boundingBox();

    for (const [i, position] of [
        { x: box.width / 2, y: box.height / 2 },
        { x: box.width / 2 + 30, y: box.height / 2 + 20 },
        { x: box.width / 2 + 60, y: box.height / 2 + 40 },
    ].entries()) {
        await canvas.click({ position });

        try {
            await editor
                .getByText(`${i + 1} points`, { exact: true })
                .waitFor();
        } catch (error) {
            console.log(await editor.innerText());
            await engineer.screenshot({
                path: '../task4-road-failure.png',
                fullPage: true,
            });

            throw error;
        }
    }

    const roadRequest = engineer.waitForRequest(
        (r) =>
            r.method() === 'POST' &&
            new URL(r.url()).pathname === '/dd-phase3/ops/roads',
    );
    await engineer
        .getByRole('button', {
            name: /Save Road Coverage|Save coverage|Create coverage/i,
        })
        .click();
    const payload = (await roadRequest).postDataJSON();
    assert.equal(JSON.parse(payload.geojson).coordinates.length, 3);
    await engineer
        .getByText('Browser workflow road', { exact: true })
        .first()
        .waitFor();
    await engineer.goto(`${base}/dd-phase3/projects`);
    await engineer
        .getByRole('button', { name: 'Add Project', exact: true })
        .click();
    await engineer
        .getByRole('radio', { name: /Browser workflow road/ })
        .check();
    await engineer
        .getByLabel('Project title', { exact: false })
        .fill('Browser workflow project');
    await engineer
        .getByRole('button', { name: /save project|create project/i })
        .click();
    await engineer
        .getByText('Browser workflow project', { exact: true })
        .first()
        .click();
    await engineer.getByLabel('Active maintenance year').fill('2026');
    await engineer
        .getByRole('button', { name: 'Create Q4 record', exact: true })
        .click();
    const recordForm = engineer
        .locator('form')
        .filter({ hasText: 'Create maintenance record · 2026 Q4' });
    await recordForm.getByLabel('Estimated duration (days)').fill('5');
    await recordForm.getByLabel('Maintenance status').selectOption('Ongoing');
    await recordForm
        .getByRole('button', { name: 'Save maintenance record', exact: true })
        .click();
    await recordForm.waitFor({ state: 'hidden' });
    assert.equal(
        await engineer
            .getByRole('button', { name: 'Create Q4 record', exact: true })
            .count(),
        0,
    );
    await engineer.goto(`${base}/dd-phase3/updates`);
    await engineer
        .getByRole('button', { name: 'Add Update', exact: false })
        .click();
    const monthly = engineer.getByRole('dialog', {
        name: 'Add Monthly Update',
    });
    await chooseMatching(
        monthly.getByLabel(/^Maintenance Record/),
        'Browser workflow project',
    );
    await monthly.getByLabel(/^Update Month/).fill('2026-10');
    await monthly.getByLabel(/^Progress/).fill('45.5');
    await monthly
        .getByRole('button', {
            name: /Save update|Save monthly update|Create update/i,
        })
        .click();
    await monthly.waitFor({ state: 'hidden' });
    await engineer
        .getByText('Browser workflow project', { exact: false })
        .first()
        .click();
    const evidence = engineer.locator('form').filter({
        has: engineer.getByRole('button', {
            name: 'Upload evidence',
            exact: true,
        }),
    });
    await evidence.locator('input[type=file]').setInputFiles({
        name: 'browser-evidence.png',
        mimeType: 'image/png',
        buffer: png,
    });
    await evidence
        .getByRole('button', { name: 'Upload evidence', exact: true })
        .click();
    await engineer
        .getByText('browser-evidence.png', { exact: false })
        .first()
        .waitFor();
    await engineer.goto(`${base}/dd-phase3/documents`);
    await engineer
        .getByRole('button', { name: /Add Document|Upload Document/i })
        .first()
        .click();
    const document = engineer.getByRole('dialog');
    await chooseMatching(
        document.getByLabel(/^Maintenance Record/),
        'Browser workflow project',
    );
    await document
        .getByLabel(/^Document title/i)
        .fill('Browser private inspection');
    await document.locator('input[type=file]').setInputFiles({
        name: 'browser-inspection.pdf',
        mimeType: 'application/pdf',
        buffer: pdf,
    });
    await document
        .getByRole('button', { name: 'Upload document', exact: true })
        .click();
    await document.waitFor({ state: 'hidden' });
    await engineer
        .getByText('Browser private inspection', { exact: true })
        .first()
        .waitFor();

    for (const [kind, id, expected] of [
        ['document', f.document_id, pdf],
        ['media', f.media_id, png],
    ]) {
        const response = await engineer.request.get(
            `${base}/dd-phase3/files/${kind}/${id}`,
        );
        assert.equal(response.status(), 200);
        assert.deepEqual(await response.body(), expected);
        assert.match(response.headers()['cache-control'], /private/);
    }

    const rogue = await signIn(f.rogue_email);
    const downloadsBefore = storage.counts.downloads;

    for (const [kind, id] of [
        ['document', f.document_id],
        ['media', f.media_id],
    ]) {
        assert.equal(
            (
                await rogue.request.get(`${base}/dd-phase3/files/${kind}/${id}`)
            ).status(),
            403,
        );
    }

    assert.equal(storage.counts.downloads, downloadsBefore);
    assert.equal(
        (await viewer.request.get(`${base}/dd-phase3/users`)).status(),
        403,
    );

    for (const section of ['roads', 'projects', 'updates', 'documents']) {
        await viewer.goto(`${base}/dd-phase3/${section}`);
        assert.equal(
            await viewer
                .getByRole('button', {
                    name: /^(Add Project|Add Road Coverage|Add Update|Upload document|Add Document)$/i,
                })
                .count(),
            0,
        );
    }

    for (const section of [
        'roads',
        'projects',
        'updates',
        'documents',
        'users',
    ]) {
        await mobile(admin, section);
    }

    assert.ok(storage.counts.uploads >= 2);
    assert.deepEqual(errors, []);
    console.log(
        'PASS: all four role logins; 3-point drawn road and existing rendering; mocked place search/loading; Engineer project/Q4/monthly/private uploads; authorized downloads and cross-LGU denial; Viewer read-only; responsive modules/navigation; no browser exceptions.',
    );
} finally {
    await browser.close();
    await storage.close();
}

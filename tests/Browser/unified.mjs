// Real Laravel/Fortify sessions and canonical PostgreSQL. Only external map/Storage providers are mocked.
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
const ui = `${base}/dd-phase3/ui`;
const storage = await startStorageMock();
const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const errors = [];
let lastPage;
async function signIn(email) {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1080 },
        reducedMotion: 'reduce',
    });
    await context.route('https://*.tile.openstreetmap.org/**', (r) =>
        r.fulfill({ contentType: 'image/png', body: png }),
    );
    await context.route('https://tile.openstreetmap.org/**', (r) =>
        r.fulfill({ contentType: 'image/png', body: png }),
    );
    await context.route('https://photon.komoot.io/**', (r) =>
        r.fulfill({
            json: {
                features: [
                    {
                        geometry: {
                            type: 'Point',
                            coordinates: [125.967, 7.603],
                        },
                        properties: {
                            name: 'Disposable map result',
                            city: 'Compostela',
                        },
                    },
                ],
            },
        }),
    );
    await context.route('https://router.project-osrm.org/**', (r) => {
        const parts = new URL(r.request().url()).pathname
            .split('/')
            .at(-1)
            .split(';')
            .map((s) => s.split(',').map(Number));
        const middle = parts[0].map((n, i) => (n + parts[1][i]) / 2);

        return r.fulfill({
            json: {
                code: 'Ok',
                routes: [
                    {
                        geometry: {
                            type: 'LineString',
                            coordinates: [parts[0], middle, parts[1]],
                        },
                    },
                ],
            },
        });
    });
    const page = await context.newPage();
    lastPage = page;
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(`${base}/login`);
    await page.getByLabel('Email address').waitFor();
    assert.equal(await page.getByLabel('Email address').inputValue(), '');
    assert.equal(
        await page.getByLabel('Password', { exact: true }).inputValue(),
        '',
    );
    assert.equal(
        await page.getByText(/demo accounts|sample credentials/i).count(),
        0,
    );
    assert.ok(
        (await page.locator('img').count()) > 0,
        'Photographic login remains visible',
    );
    await page.getByLabel('Email address').fill(email);
    await page
        .getByLabel('Password', { exact: true })
        .fill('Disposable-Test!123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/dd-phase3\/dashboard|dd-superadmin-landing/);

    return page;
}
async function props(page, path) {
    const version = JSON.parse(
        await page.locator('script[data-page]').textContent(),
    ).version;
    const response = await page.request.get(`${ui}${path}`, {
        headers: { 'X-Inertia': 'true', 'X-Inertia-Version': version },
    });
    assert.equal(response.status(), 200, path);

    return (await response.json()).props;
}
async function choose(page, label, text) {
    await page.getByLabel(label).click();
    await page.getByRole('option', { name: text, exact: true }).click();
}
async function csrfPost(page, path, data) {
    return page.evaluate(
        async ({ path, data }) => {
            const cookie = document.cookie
                .split('; ')
                .find((c) => c.startsWith('XSRF-TOKEN='));
            const response = await fetch(path, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)),
                },
                body: JSON.stringify(data),
            });

            return { status: response.status, body: await response.text() };
        },
        { path, data },
    );
}

try {
    const engineer = await signIn(f.engineer_email);
    const admin = await signIn(f.admin_email);
    const viewer = await signIn(f.viewer_email);
    const superadmin = await signIn(f.superadmin_email);
    lastPage = engineer;

    for (const page of [engineer, admin, viewer, superadmin]) {
        await page.goto(`${ui}/road-coverages`);
        await page
            .getByRole('heading', { name: 'Road Coverages', exact: true })
            .waitFor();
    }

    console.log(
        'PASS: photographic Fortify login and authenticated canonical navigation for all four roles.',
    );
    await engineer.goto(`${ui}/road-coverages/${f.road_id}`);
    await engineer.locator('.jr-saved-coverage-line').waitFor();
    await engineer.getByText('Test project', { exact: true }).first().waitFor();
    await engineer.goto(`${ui}/road-coverages/create`);
    const information = engineer.getByRole('button', {
        name: 'Road Information',
        exact: true,
    });

    if ((await information.getAttribute('aria-expanded')) === 'false') {
        await information.click();
    }

    await engineer
        .getByLabel(/^Road (Coverage )?Name/i)
        .fill('Unified browser road');
    await choose(engineer, /^Municipality/, 'Compostela');
    await choose(engineer, /^Pavement Type/, 'Concrete');
    await choose(engineer, /^Road Condition|^Condition/, 'Good');
    const editor = engineer.locator('.jr-map-workspace');
    await editor
        .getByLabel('Search places', { exact: true })
        .fill('Compostela');
    await editor.locator('#jr-place-search').click();
    await editor.getByRole('button', { name: /Disposable map result/ }).click();
    const map = editor.locator('.jr-leaflet-map');
    await map.click({ position: { x: 250, y: 180 } });
    await map.click({ position: { x: 320, y: 210 } });
    await editor.getByText('Complete', { exact: true }).waitFor();
    assert.equal(await editor.locator('.jr-control-location').count(), 2);
    await editor
        .getByRole('button', { name: 'Add Location', exact: true })
        .click();
    await map.click({ position: { x: 385, y: 235 } });
    await editor.getByText('Complete', { exact: true }).nth(1).waitFor();
    assert.equal(await editor.locator('.jr-control-location').count(), 3);
    const saved = engineer.waitForResponse(
        (r) =>
            r.request().method() === 'POST' &&
            new URL(r.url()).pathname === '/dd-phase3/ui/road-coverages',
    );
    await engineer
        .getByRole('button', { name: 'Save Road Coverage', exact: true })
        .click();
    assert.ok((await saved).status() < 400);
    await engineer.waitForURL(`${ui}/road-coverages`);
    const road = (
        await props(engineer, '/road-coverages?search=Unified browser road')
    ).coverages.data[0];
    assert.equal(road.road_name, 'Unified browser road');
    assert.equal(
        road.geojson.properties.jairoads_mapping.control_points.length,
        3,
    );
    const geometry = JSON.stringify(road.geojson);
    await engineer.goto(`${ui}/road-coverages/${road.id}`);
    await engineer.locator('.jr-saved-coverage-line').waitFor();
    assert.equal(await engineer.locator('.jr-saved-location').count(), 3);
    await engineer.goto(`${ui}/maintenance-projects/create`);
    await engineer.getByRole('radio', { name: /Unified browser road/ }).check();
    await engineer
        .getByLabel(/^Project title/i)
        .fill('Unified browser project');
    await engineer
        .getByRole('button', { name: /Create Project|Save Project/ })
        .click();
    await engineer.waitForURL(`${ui}/maintenance-projects`);
    const project = (
        await props(
            engineer,
            '/maintenance-projects?search=Unified browser project',
        )
    ).projects.data[0];
    assert.equal(project.road_coverage_id, road.id);
    const period = {
        maintenance_year: 2026,
        quarter: 'Q2',
        engineers_id: f.engineer_id,
        start_date: '2026-04-01',
        estimated_duration_days: 5,
        status: 'Ongoing',
    };
    // Create through the real new record form, then exercise direct-HTTP duplicate validation.
    await engineer.goto(
        `${ui}/maintenance-projects/${project.id}/records/create`,
    );
    await engineer.getByLabel(/^Maintenance Year/).fill('2026');
    await choose(engineer, /^Quarter/, 'Q2');
    await choose(engineer, /^Managing Engineer/, 'Test Engineer');
    await choose(engineer, /^Status/, 'Ongoing');
    await engineer.getByLabel(/^Start Date/).fill('2026-04-01');
    await engineer.getByLabel(/^Estimated Duration/).fill('5');
    await engineer
        .getByRole('button', { name: 'Save Record', exact: true })
        .click();
    await engineer.waitForURL(`${ui}/maintenance-projects/${project.id}`);
    const history = await props(
        engineer,
        `/maintenance-projects/${project.id}`,
    );
    assert.equal(history.records.length, 1);
    assert.equal(history.records[0].quarter, 'Q2');
    const record = history.records[0];
    assert.equal(
        (
            await csrfPost(
                engineer,
                `/dd-phase3/ui/maintenance-projects/${project.id}/records`,
                period,
            )
        ).status,
        422,
    );
    await engineer.goto(
        `${ui}/monthly-updates/create?maintenance_id=${record.id}`,
    );
    await engineer.getByLabel(/^Reporting Month/).click();
    await engineer
        .getByRole('button', { name: 'April 2026', exact: true })
        .click();
    await engineer.getByLabel(/^Progress Percentage/).fill('43.5');
    await engineer
        .getByLabel(/^Progress Summary/)
        .fill('Canonical browser report');
    await engineer
        .getByRole('button', { name: /Save Monthly Update|Save Update/ })
        .click();
    await engineer.waitForURL(/dd-phase3\/ui\/monthly-updates\/\d+$/);
    const report = (
        await props(
            engineer,
            `/monthly-updates/${engineer.url().split('/').at(-1)}`,
        )
    ).update;
    assert.equal(Number(report.progress_percentage), 43.5);
    await engineer.locator('input[type=file]').setInputFiles({
        name: 'unified.png',
        mimeType: 'image/png',
        buffer: png,
    });
    await engineer
        .getByRole('button', { name: 'Upload Media', exact: true })
        .click();
    await engineer.getByText('unified.png', { exact: false }).first().waitFor();
    await engineer.goto(
        `${ui}/maintenance-documents/create?maintenance_id=${record.id}`,
    );
    await engineer
        .getByLabel(/^Document Title/)
        .fill('Unified private inspection');
    await engineer.locator('input[type=file]').setInputFiles({
        name: 'unified.pdf',
        mimeType: 'application/pdf',
        buffer: pdf,
    });
    await engineer
        .getByRole('button', { name: /Upload Document|Save Document/ })
        .click();
    await engineer.waitForURL(`${ui}/maintenance-documents`);
    const doc = (
        await props(
            engineer,
            '/maintenance-documents?search=Unified private inspection',
        )
    ).documents.data[0];
    assert.equal(doc.maintenance_id, record.id);
    assert.equal(doc.file_path, undefined);
    const download = await engineer.request.get(`${base}${doc.download_url}`);
    assert.equal(download.status(), 200);
    assert.deepEqual(await download.body(), pdf);
    console.log(
        'PASS: Leaflet search and 2/3-point road persisted; canonical project/Q2/monthly/media/document writes; duplicate rejection; private download.',
    );
    // Both confirmations use the unchanged server-side impact service and its signed snapshot.
    await engineer.goto(`${ui}/road-coverages/${road.id}`);
    await engineer
        .getByRole('button', { name: /Change municipality/i })
        .click();
    await engineer
        .getByLabel('New municipality', { exact: true })
        .selectOption(String(f.destination_id));
    await engineer
        .getByRole('button', { name: 'Review Changes', exact: true })
        .click();
    await engineer
        .getByRole('heading', { name: 'Review municipality change' })
        .waitFor();
    await engineer
        .getByText('Unified browser project', { exact: true })
        .waitFor();
    await engineer.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(
        (await props(engineer, `/road-coverages/${road.id}`)).coverage.lgus_id,
        f.lgu_id,
    );
    await engineer
        .getByRole('button', { name: /Change municipality/i })
        .click();
    await engineer
        .getByLabel('New municipality', { exact: true })
        .selectOption(String(f.destination_id));
    await engineer
        .getByRole('button', { name: 'Review Changes', exact: true })
        .click();
    await engineer
        .getByRole('button', {
            name: 'Confirm Municipality Change',
            exact: true,
        })
        .click();
    await engineer
        .getByText(/Municipality changed from Compostela to Destination town/)
        .first()
        .waitFor();
    const moved = (await props(engineer, `/road-coverages/${road.id}`))
        .coverage;
    assert.equal(moved.lgus_id, f.destination_id);
    assert.equal(JSON.stringify(moved.geojson), geometry);
    const rogue = await signIn(f.rogue_email);
    const before = storage.counts.downloads;
    assert.equal(
        (await rogue.request.get(`${base}${doc.download_url}`)).status(),
        403,
    );
    assert.equal(storage.counts.downloads, before);
    assert.equal(
        (
            await csrfPost(viewer, '/dd-phase3/ui/maintenance-projects', {
                road_coverage_id: road.id,
                project_title: 'Forbidden',
            })
        ).status,
        403,
    );
    assert.equal(
        (await viewer.request.get(`${ui}/road-coverages/create`)).status(),
        403,
    );
    assert.equal(
        (await props(rogue, '/maintenance-projects')).projects.data.length,
        0,
    );

    lastPage = admin;

    for (const path of [
        '/road-coverages',
        '/maintenance-projects',
        '/monthly-updates',
        '/maintenance-documents',
    ]) {
        await admin.setViewportSize({ width: 390, height: 844 });
        await admin.goto(`${ui}${path}`);
        await admin.getByRole('heading', { level: 1 }).first().waitFor();
        console.log(
            'Mobile dimensions',
            path,
            await admin.evaluate(() => ({
                width: innerWidth,
                scroll: document.documentElement.scrollWidth,
                overflow: [...document.querySelectorAll('body *')]
                    .filter(
                        (e) =>
                            e.getBoundingClientRect().right > innerWidth + 3 &&
                            e.getBoundingClientRect().width > innerWidth,
                    )
                    .slice(0, 12)
                    .map((e) => [
                        e.tagName,
                        e.className,
                        e.getBoundingClientRect().width,
                    ]),
            })),
        );
        assert.ok(
            await admin.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 2,
            ),
            `${path} mobile overflow`,
        );
    }

    lastPage = engineer;
    await engineer.goto(`${ui}/maintenance-projects/${project.id}`);
    await engineer
        .getByRole('button', { name: 'Open account menu', exact: true })
        .last()
        .click();
    assert.equal(
        await engineer
            .getByRole('menuitem', { name: 'Settings', exact: true })
            .getAttribute('href'),
        '/dd-phase3/settings',
    );
    await engineer.locator('[data-test=logout-button]').click();
    await engineer.waitForURL(/\/login|\/$/);
    await engineer.goBack();
    await engineer.getByLabel('Email address').waitFor();
    assert.equal(
        await engineer
            .getByRole('heading', {
                name: 'Unified browser project',
                exact: true,
            })
            .count(),
        0,
    );
    console.log(
        'Back-navigation login view at',
        new URL(engineer.url()).pathname,
    );
    assert.equal(
        (
            await engineer.request.get(`${ui}/maintenance-projects`, {
                maxRedirects: 0,
            })
        ).status(),
        302,
    );
    assert.deepEqual(errors, []);
    console.log(
        'PASS: municipality Cancel/final confirmation; exact saved geometry; cross-LGU/private/Viewer HTTP denial; responsive directories; logout/back protects session.',
    );
} catch (error) {
    console.error('Browser exceptions:', errors);

    if (lastPage) {
        console.error(
            (await lastPage.locator('body').innerText()).slice(0, 3500),
        );
    }

    if (lastPage) {
        await lastPage.screenshot({
            path:
                process.env.UNIFIED_BROWSER_SCREENSHOT ||
                '/tmp/jairoads-unified-failure.png',
            fullPage: true,
        });
    }

    throw error;
} finally {
    await browser.close();
    await storage.close();
}

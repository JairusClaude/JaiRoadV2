// Real Laravel/Fortify sessions and canonical PostgreSQL. Only external map/Storage providers are mocked.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { verifyAuditNotifications } from './audit-notifications.mjs';
import { verifyAuthenticatedHistory } from './authenticated-history.mjs';
import { verifyDuplicatePeriod } from './duplicate-period.mjs';
import { verifyPermanentFileDeletion } from './permanent-file-deletion.mjs';
import { verifyPreservedRelationships } from './preserved-relationships.mjs';
import { pdf, png, startStorageMock } from './private-storage-mock.mjs';
import { verifyDirectoryLayouts } from './responsive-directories.mjs';
import { verifyMobileWorkspaces } from './responsive-workspaces.mjs';
import { verifyRoleAcceptanceMatrix } from './role-acceptance.mjs';
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
    // Exercise the mobile welcome screen and the successful role handoff
    // with the disposable SuperAdmin fixture; all other roles retain the
    // reduced-motion test setup.
    if (email === f.superadmin_email) {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Explore JaiROADS' }).click();
        await page.getByRole('button', { name: 'Continue to sign in' }).click();
        await page.getByLabel('Email address').waitFor({ state: 'visible' });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.setViewportSize({ width: 1440, height: 1080 });
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => {
            const observer = new MutationObserver(() => {
                const overlay = document.querySelector('.jr-auth-handoff');
                if (overlay) {
                    document.documentElement.dataset.testAuthHandoff = overlay.getAttribute('data-role');
                    observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
    await page.getByLabel('Email address').fill(email);
    await page
        .getByLabel('Password', { exact: true })
        .fill('Disposable-Test!123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/dd-phase3\/dashboard|dd-superadmin-landing/);
    if (email === f.superadmin_email) {
        await page.waitForFunction(() => document.documentElement.dataset.testAuthHandoff === 'superadmin');
        await page.locator('.jr-auth-handoff').waitFor({ state: 'detached' });
        await page.emulateMedia({ reducedMotion: 'reduce' });
    }

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

    // Each canonical role must inherit its own icon foreground and background.
    for (const [page, foreground, background] of [
        [engineer, 'rgb(169, 75, 12)', 'rgb(255, 240, 227)'],
        [admin, 'rgb(200, 41, 61)', 'rgb(253, 231, 234)'],
        [viewer, 'rgb(29, 93, 181)', 'rgb(230, 239, 255)'],
    ]) {
        for (const path of ['/maintenance-records', '/monthly-updates', '/road-coverages', '/lgus']) {
            await page.goto(ui + path);
            const icons = page.locator('.jr-metric-card .jr-metric-icon');
            await icons.first().waitFor();
            const colors = await icons.evaluateAll(elements => elements.map(el => {
                const style = getComputedStyle(el);
                return [style.color, style.backgroundColor];
            }));
            for (const pair of colors) assert.deepEqual(pair, [foreground, background], path);
        }
        await page.goto(base + '/dd-phase3/dashboard');
    }

    // Viewer palette is selected from the signed-in canonical role, not URL or preference.
    await viewer.locator('.jr-viewer-workspace').waitFor();
    await viewer.locator('.jr-viewer-brand-logo').first().waitFor();
    await viewer.waitForFunction(() => {
        const logo = document.querySelector('.jr-viewer-brand-logo');

        return logo instanceof HTMLImageElement && logo.complete && logo.naturalWidth > 0;
    });
    const viewerLogo = await viewer.locator('.jr-viewer-brand-logo').first().evaluate(img => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        return { path: new URL(img.src).pathname, cornerAlpha: ctx.getImageData(0, 0, 1, 1).data[3], tile: getComputedStyle(img.parentElement).backgroundColor, shadow: getComputedStyle(img.parentElement).boxShadow };
    });
    assert.equal(viewerLogo.path, '/images/jairoads/peo-ddo-transparent.webp');
    assert.equal(viewerLogo.cornerAlpha, 0);
    assert.equal(viewerLogo.tile, 'rgba(0, 0, 0, 0)');
    assert.equal(viewerLogo.shadow, 'none');
    await viewer.getByRole('heading', { name: 'Road Maintenance Overview' }).waitFor();
    await viewer.getByText('Read-Only Access', { exact: true }).waitFor();
    await viewer.getByRole('button', { name: 'Refresh dashboard' }).waitFor();
    assert.equal(await viewer.locator('.jr-viewer-sidebar .jr-nav-link.jr-active').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(29, 93, 181)');

    for (const other of [engineer, admin, superadmin]) {
        assert.equal(await other.locator('.jr-viewer-workspace').count(), 0);
    }

    await engineer.locator('.jr-engineer-workspace').waitFor();
    await engineer.getByRole('heading', { name: 'Engineering Dashboard', exact: true }).waitFor();
    await engineer.getByText('Technical Workspace', { exact: true }).waitFor();
    await engineer.getByRole('button', { name: 'Refresh dashboard' }).waitFor();
    await engineer.waitForFunction(() => {
        const logo = document.querySelector('.jr-engineer-brand-logo');

        return logo instanceof HTMLImageElement && logo.complete && logo.naturalWidth > 0;
    });
    assert.equal(await engineer.locator('.jr-engineer-sidebar .jr-nav-link.jr-active').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(169, 75, 12)');
    assert.equal(await engineer.locator('.jr-engineer-brand-logo').first().evaluate(el => new URL(el.src).pathname), '/images/jairoads/peo-ddo-transparent.webp');
    assert.equal(await engineer.locator('.jr-engineer-brand-logo').first().evaluate(el => getComputedStyle(el.parentElement).backgroundColor), 'rgba(0, 0, 0, 0)');

    for (const other of [viewer, admin, superadmin]) {
        assert.equal(await other.locator('.jr-engineer-workspace').count(), 0);
    }

    await superadmin.locator('.jr-superadmin-workspace').waitFor();
    await superadmin.getByRole('heading', { name: 'System Command Center', exact: true }).waitFor();
    await superadmin.getByText('Highest Authority · SuperAdmin', { exact: true }).waitFor();
    await superadmin.getByRole('button', { name: 'Refresh dashboard' }).waitFor();
    await superadmin.waitForFunction(() => {
        const logo = document.querySelector('.jr-superadmin-brand-logo');

        return logo instanceof HTMLImageElement && logo.complete && logo.naturalWidth > 0;
    });
    assert.equal(await superadmin.locator('.jr-superadmin-sidebar .jr-nav-link.jr-active').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(81, 38, 155)');
    assert.equal(await superadmin.locator('.jr-superadmin-brand-logo').first().evaluate(el => new URL(el.src).pathname), '/images/jairoads/peo-ddo-transparent.webp');
    assert.equal(await superadmin.locator('.jr-superadmin-brand-logo').first().evaluate(el => getComputedStyle(el.parentElement).backgroundColor), 'rgba(0, 0, 0, 0)');

    for (const other of [viewer, engineer, admin]) {
        assert.equal(await other.locator('.jr-superadmin-workspace').count(), 0);
    }

    await admin.locator('.jr-admin-workspace').waitFor();
    await admin.getByRole('heading', { name: 'Administration Dashboard', exact: true }).waitFor();
    await admin.getByText('Administration Panel', { exact: true }).waitFor();
    await admin.getByRole('button', { name: 'Refresh dashboard' }).waitFor();
    await admin.waitForFunction(() => {
        const logo = document.querySelector('.jr-admin-brand-logo');

        return logo instanceof HTMLImageElement && logo.complete && logo.naturalWidth > 0;
    });
    assert.equal(await admin.locator('.jr-admin-sidebar .jr-nav-link.jr-active').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(200, 41, 61)');
    assert.equal(await admin.locator('.jr-admin-brand-logo').first().evaluate(el => new URL(el.src).pathname), '/images/jairoads/peo-ddo-transparent.webp');
    assert.equal(await admin.locator('.jr-admin-brand-logo').first().evaluate(el => getComputedStyle(el.parentElement).backgroundColor), 'rgba(0, 0, 0, 0)');

    for (const other of [viewer, engineer, superadmin]) {
        assert.equal(await other.locator('.jr-admin-workspace').count(), 0);
    }

    // Decorative motion uses each authenticated role's accent and obeys both preferences.
    for (const [page, rgb] of [[viewer, '96 165 250'], [engineer, '251 146 60'], [admin, '241 107 118'], [superadmin, '167 139 250']]) {
        const layer = page.locator('.jr-sidebar-waves');
        const wave = layer.locator('.jr-sidebar-wave--primary');
        await layer.waitFor();
        assert.equal(await layer.getAttribute('aria-hidden'), 'true');
        assert.equal(await layer.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
        assert.equal(await wave.evaluate(el => getComputedStyle(el).getPropertyValue('--jr-wave-rgb').trim()), rgb);
        // signIn creates a reduced-motion context.
        assert.equal(await wave.evaluate(el => getComputedStyle(el).animationName), 'none');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await wave.evaluate(el => {
            if (getComputedStyle(el).animationName !== 'jr-sidebar-wave-flow') {
throw new Error('Wave animation missing');
}

            if (getComputedStyle(el).animationIterationCount !== 'infinite') {
throw new Error('Wave does not loop');
}

            const animation = el.getAnimations()[0];

            if (!animation) {
throw new Error('Wave has no running animation');
}

            animation.pause();
            animation.currentTime = 0;
            const start = getComputedStyle(el).transform;
            animation.currentTime = 5000;
            const middle = getComputedStyle(el).transform;
            animation.play();

            if (start === middle) {
throw new Error('Wave transform is static');
}
        });
        await page.evaluate(() => document.documentElement.classList.add('jr-reduce-motion'));
        assert.equal(await wave.evaluate(el => getComputedStyle(el).animationName), 'none');
        await page.evaluate(() => document.documentElement.classList.remove('jr-reduce-motion'));
        await page.emulateMedia({ reducedMotion: 'reduce' });
    }

    const dashboardMap = engineer.getByRole('region', { name: 'My projects road map' });
    await dashboardMap.waitFor();
    const myProjects = dashboardMap.getByRole('switch', { name: 'My projects only' });
    await dashboardMap.locator('.jr-dashboard-road-mine').first().waitFor();
    await dashboardMap.locator('.jr-dashboard-road-other').first().waitFor();
    const mineCount = await dashboardMap.locator('.jr-dashboard-road-mine').count();
    const roadSelect = dashboardMap.getByRole('combobox', { name: 'Inspect a road' });
    await roadSelect.selectOption({ index: 1 });
    const roadDetails = dashboardMap.getByRole('complementary', { name: 'Road details' });
    await roadDetails.waitFor();
    await roadDetails.getByRole('heading', { name: 'Maintenance project', exact: true }).waitFor();
    await roadDetails.getByRole('button', { name: 'Close road details' }).click();
    await roadDetails.waitFor({ state: 'hidden' });
    await myProjects.check();
    assert.equal(await dashboardMap.locator('.jr-dashboard-road-other').count(), 0);
    assert.equal(await dashboardMap.locator('.jr-dashboard-road-mine').count(), mineCount);
    await myProjects.uncheck();
    await dashboardMap.locator('.jr-dashboard-road-other').first().waitFor();
    assert.equal(await viewer.getByRole('region', { name: 'My projects road map' }).count(), 0);

    await verifyRoleAcceptanceMatrix({
        browser,
        base,
        admin,
        superadmin,
        engineer,
        viewer,
    });

    for (const page of [engineer, admin, viewer, superadmin]) {
        await page.goto(`${ui}/road-coverages`);

        if (page === viewer) {
await page.locator('.jr-viewer-workspace').waitFor();
} else {
assert.equal(await page.locator('.jr-viewer-workspace').count(), 0);
}

        if (page === engineer) {
await page.locator('.jr-engineer-workspace').waitFor();
} else {
assert.equal(await page.locator('.jr-engineer-workspace').count(), 0);
}

        if (page === superadmin) {
await page.locator('.jr-superadmin-workspace').waitFor();
} else {
assert.equal(await page.locator('.jr-superadmin-workspace').count(), 0);
}

        if (page === admin) {
await page.locator('.jr-admin-workspace').waitFor();
} else {
assert.equal(await page.locator('.jr-admin-workspace').count(), 0);
}

        await page
            .getByRole('heading', { name: 'Road Coverages', exact: true })
            .waitFor();
        assert.equal(
            await page
                .getByRole('link', { name: 'Road Coverages', exact: true })
                .first()
                .getAttribute('aria-current'),
            'page',
        );
    }

    console.log(
        'PASS: photographic Fortify login and authenticated canonical navigation for all four roles.',
    );
    await engineer.goto(`${ui}/road-coverages/${f.road_id}`);
    await engineer.locator('.jr-saved-coverage-line').waitFor();
    await engineer.getByText('Test project', { exact: true }).first().waitFor();

    for (const saved of f.geometry_roads) {
        const path = `/road-coverages/${saved.id}`;
        const before = (await props(engineer, path)).coverage;
        await engineer.goto(`${ui}${path}/edit`);

        if (saved.format === 'mapped') {
            await engineer.locator('.jr-control-location').nth(1).waitFor();
            assert.equal(
                await engineer.locator('.jr-control-location').count(),
                2,
            );
        } else if (['legacy', 'feature'].includes(saved.format)) {
            await engineer
                .getByText('Saved alignment retained.', { exact: true })
                .waitFor();
            assert.equal(
                await engineer
                    .getByRole('button', {
                        name: 'Use saved endpoints',
                        exact: true,
                    })
                    .count(),
                1,
            );
        } else {
            const mode = saved.format === 'invalid' ? 'invalid' : 'readonly';
            await engineer.locator(`[data-geometry-mode="${mode}"]`).waitFor();
            assert.equal(
                await engineer
                    .locator('.jr-control-location, .jr-map-location-list')
                    .count(),
                0,
            );
            assert.equal(
                await engineer
                    .getByRole('button', {
                        name: /Use saved endpoints|Start Over|Redraw Road|Draw Road/,
                    })
                    .count(),
                0,
            );

            if (mode === 'invalid') {
                await engineer
                    .getByRole('alert')
                    .filter({ hasText: 'requires administrator review' })
                    .waitFor();
                await engineer
                    .getByRole('button', { name: 'Save Changes', exact: true })
                    .click();
                await engineer
                    .getByText(
                        'The saved geometry requires administrator review before this form can be saved.',
                        { exact: true },
                    )
                    .waitFor();
                assert.deepEqual(
                    (await props(engineer, path)).coverage,
                    before,
                );
                continue;
            }

            await engineer.locator('.jr-saved-coverage-line').waitFor();
            await engineer
                .getByText('This road uses a geometry format', { exact: false })
                .waitFor();
        }

        await choose(engineer, /^Road Condition/, 'Fair');
        const savedResponse = engineer.waitForResponse(
            (r) =>
                r.request().method() === 'PUT' &&
                new URL(r.url()).pathname === `/dd-phase3/ui${path}`,
        );
        await engineer
            .getByRole('button', { name: 'Save Changes', exact: true })
            .click();
        const response = await savedResponse;
        assert.ok(response.status() < 400);
        assert.equal(
            Object.hasOwn(response.request().postDataJSON(), 'geojson'),
            false,
            'Metadata request must omit stored geometry',
        );
        await engineer.waitForURL(`${ui}${path}`);
        const after = (await props(engineer, path)).coverage;
        assert.deepEqual(after.geojson, before.geojson);
        assert.equal(after.kilometers, before.kilometers);
        assert.equal(after.state_category, 'Fair');
        await engineer.goto(`${ui}${path}/edit`);
        await choose(engineer, /^Road Condition/, 'Bad');
        await engineer
            .getByRole('button', { name: 'Cancel', exact: true })
            .click();
        await engineer.waitForURL(`${ui}${path}`);
        assert.deepEqual((await props(engineer, path)).coverage, after);
    }

    console.log(
        'PASS: legacy lines edit safely; multi-lines, collections and higher dimensions use read-only geometry; invalid geometry requires review; metadata save and Cancel preserve stored shapes.',
    );
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
    await editor.locator('[data-reference-state=ready]').waitFor();
    assert.ok(
        (await editor.locator('.jr-reference-road-line').count()) >= 5,
        'Authorized line/collection references render after viewport loading',
    );
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
    const assignedSwitch = engineer.getByRole('switch', { name: 'Show assigned' });
    const assignedRoad = engineer.locator(`input[name="road_coverage_id"][value="${f.road_id}"]`);
    assert.equal(await assignedRoad.count(), 0);
    await assignedSwitch.check();
    await assignedRoad.waitFor({ state: 'visible' });
    assert.equal(await assignedRoad.isDisabled(), true);
    await engineer.getByText('Linked project: Test project', { exact: true }).waitFor();
    await engineer.getByRole('radio', { name: /Unified browser road/ }).check();
    await assignedSwitch.uncheck();
    assert.equal(await assignedRoad.count(), 0);
    assert.equal(await engineer.getByRole('radio', { name: /Unified browser road/ }).isChecked(), true);
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
    const expand = engineer.getByRole('button', {
        name: 'Expand Maintenance Projects submenu',
        exact: true,
    });

    if (await expand.count()) {
        await expand.click();
    }

    await engineer
        .getByRole('link', { name: 'Maintenance Records', exact: true })
        .click();
    await engineer.waitForURL(`${ui}/maintenance-records`);
    await engineer
        .getByRole('heading', { name: 'Maintenance Records', exact: true })
        .waitFor();
    assert.equal(
        await engineer
            .getByRole('link', { name: 'Maintenance Records', exact: true })
            .getAttribute('aria-current'),
        'page',
    );
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
    await verifyDuplicatePeriod({
        engineer,
        admin,
        ui,
        project,
        period,
        record,
        choose,
        csrfPost,
        props,
    });
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
    // File upload is part of the editable Monthly Update form, not its
    // read-only report page. Saving the form uploads the selected media.
    await engineer.goto(`${ui}/monthly-updates/${report.id}/edit`);
    await engineer.locator('input[type=file]').setInputFiles({
        name: 'unified.png',
        mimeType: 'image/png',
        buffer: png,
    });
    await engineer
        .getByRole('button', { name: 'Save Changes', exact: true })
        .click();
    await engineer.getByText('unified.png', { exact: false }).first().waitFor();
    // The form submits media after the monthly-update metadata response.
    // Do not navigate away until the private media row actually exists.

    let originalMediaStored = false;

    for (let attempt = 0; attempt < 30; attempt++) {
        const savedMedia = (await props(engineer, `/monthly-updates/${report.id}`)).media;

        if (savedMedia.some((file) => file.file_name === 'unified.png')) {
            originalMediaStored = true;
            break;
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
    }

    assert.ok(originalMediaStored, 'Original private media must be persisted before later deletion tests');
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

    // Repair 1: use real persisted reports and the visible directory controls.
    for (const month of ['2027-12', '2026-01']) {
        const savedReport = await csrfPost(
            engineer,
            '/dd-phase3/ui/monthly-updates',
            {
                maintenance_id: record.id,
                update_month: month,
                progress_percentage: 15,
            },
        );
        assert.equal(savedReport.status, 200);
    }

    await engineer.goto(`${ui}/monthly-updates`);
    const reports = (await props(engineer, '/monthly-updates')).updates.data;
    const january = reports.find((item) => item.update_month === '2026-01');
    assert.ok(january);
    await engineer.goto(`${ui}/monthly-updates/${january.id}/edit`);
    await engineer.getByLabel(/^Progress Percentage/).fill('16');
    await engineer
        .getByRole('button', { name: /Save Changes|Save Update/ })
        .click();
    await engineer.waitForURL(`${ui}/monthly-updates/${january.id}`);
    // Both modules must return to all three explicit edit origins and keep filters.
    const parentOrigin = `/dd-phase3/ui/maintenance-projects/${project.id}/records/${record.id}`;

    for (const [module, entity, directoryQuery] of [
        ['monthly-updates', january, `?project=${project.id}&year=2026&sort=oldest&page=1`],
        ['maintenance-documents', doc, `?project=${project.id}&sort=oldest&page=1`],
    ]) {
        const directory = `/dd-phase3/ui/${module}`;
        const detail = `${directory}/${entity.id}`;

        for (const origin of [directory + directoryQuery, detail, parentOrigin]) {
            await engineer.goto(base + detail + '/edit?' + new URLSearchParams({ return_to: origin }));

            if (module === 'monthly-updates') {
                await engineer.getByLabel(/^Progress Percentage/).fill('17');
            } else {
                await engineer.getByLabel(/^Document Title/).fill(doc.document_title);
            }

            await engineer.getByRole('button', { name: 'Save Changes', exact: true }).click();
            await engineer.waitForURL((url) => {
                const expected = new URL(base + origin);

                return url.pathname === expected.pathname &&
                    [...expected.searchParams].every(([key, value]) => url.searchParams.get(key) === value) &&
                    [...url.searchParams].length === [...expected.searchParams].length;
            });
        }
    }

    console.log('PASS: both related modules return to directory, own details and parent record after editing.');
    await engineer.goto(`${ui}/monthly-updates?project=${project.id}`);
    const firstMonth = () =>
        engineer
            .locator('.jr-monthly-table tbody tr')
            .first()
            .locator('td')
            .first()
            .innerText();

    for (const [label, mode, month] of [
        ['Oldest Month First', 'oldest', 'January 2026'],
        ['Newest Month First', 'newest', 'December 2027'],
        ['Recently Modified', 'modified', 'January 2026'],
    ]) {
        await choose(engineer, 'Sort monthly updates', label);
        await engineer.waitForURL(
            (url) => url.searchParams.get('sort') === mode,
        );
        await engineer
            .getByLabel('Sort monthly updates')
            .getByText(label, { exact: true })
            .waitFor();
        assert.match(await firstMonth(), new RegExp(month));
        await engineer.reload();
        await engineer
            .getByLabel('Sort monthly updates')
            .getByText(label, { exact: true })
            .waitFor();
        assert.match(await firstMonth(), new RegExp(month));
    }

    await choose(engineer, 'Reporting Year filter', '2027');
    await engineer.waitForURL((url) => url.searchParams.get('year') === '2027');
    await engineer
        .getByLabel('Reporting Year filter')
        .getByText('2027', { exact: true })
        .waitFor();
    assert.equal(
        await engineer.locator('.jr-monthly-table tbody tr').count(),
        1,
    );
    assert.match(await firstMonth(), /December 2027/);
    assert.equal(new URL(engineer.url()).searchParams.get('sort'), 'modified');
    await engineer.reload();
    await engineer
        .getByLabel('Reporting Year filter')
        .getByText('2027', { exact: true })
        .waitFor();
    assert.match(await firstMonth(), /December 2027/);
    console.log(
        'PASS: all three visible monthly sort modes, reporting-year selection, accurate URLs, and filter/order persistence after reload.',
    );

    // SuperAdmin theme and breadcrumb regressions seen in the deployed UI.
    await superadmin.goto(`${ui}/monthly-updates`);
    const collapseSidebar = superadmin.getByRole('button', {
        name: 'Collapse sidebar',
        exact: true,
    });
    const expandSidebar = superadmin.getByRole('button', {
        name: 'Expand sidebar',
        exact: true,
    });
    if (await expandSidebar.isVisible()) {
        await expandSidebar.click();
    }
    await superadmin.waitForFunction(() => {
        const sidebar = document.querySelector('.jr-superadmin-sidebar');
        return sidebar && sidebar.getBoundingClientRect().width >= 240;
    });
    await collapseSidebar.click();
    await superadmin.waitForFunction(() => {
        const sidebar = document.querySelector('.jr-superadmin-sidebar');
        return sidebar && sidebar.getBoundingClientRect().width <= 80;
    });
    await expandSidebar.click();
    await superadmin.waitForFunction(() => {
        const sidebar = document.querySelector('.jr-superadmin-sidebar');
        return sidebar && sidebar.getBoundingClientRect().width >= 240;
    });
    const monthlyMetrics = superadmin.locator(
        '[aria-label="Monthly update statistics"] .jr-metric-card',
    );
    assert.equal(await monthlyMetrics.count(), 2);
    assert.equal(await monthlyMetrics.locator('.jr-metric-icon').count(), 2);
    const monthlyHeader = superadmin.locator('.jr-monthly-table thead th').first();
    assert.equal(
        await monthlyHeader.evaluate((el) => getComputedStyle(el).backgroundColor),
        'rgb(244, 237, 255)',
    );
    const purpleProgress = superadmin
        .locator('.jr-monthly-progress-track > span')
        .first();
    await purpleProgress.waitFor();
    assert.match(
        await purpleProgress.evaluate(
            (bar) => getComputedStyle(bar).backgroundImage,
        ),
        /rgb\(81, 38, 155\)/,
    );
    await superadmin.goto(`${base}/dd-phase3/users`);
    await superadmin.getByRole('heading', {
        name: 'User Management',
        exact: true,
    }).waitFor();
    assert.equal(
        await superadmin.locator('.jr-header-page-title').innerText(),
        'User Management',
    );
    await superadmin
        .getByRole('navigation', { name: 'User management pagination' })
        .waitFor();
    assert.equal(
        await superadmin.locator('.um-table thead th').first().evaluate(
            (el) => getComputedStyle(el).backgroundColor,
        ),
        'rgb(244, 237, 255)',
    );
    console.log('PASS: SuperAdmin sidebar states, monthly metrics, purple headers and progress, shared pagination, and User Management breadcrumb.');

    // Both confirmations use the unchanged server-side impact service and its signed snapshot.
    const openRoadMunicipalityChange = async () => {
        // The reviewed municipality change flow lives in the canonical DD
        // road directory, not the legacy road detail view.
        await engineer.goto(`${base}/dd-phase3/roads`);
        await engineer
            .getByRole('button', {
                name: new RegExp(`Unified browser road.*Coverage ID: ${road.id}`, 's'),
            })
            .click();
        await engineer
            .getByRole('button', { name: 'Change municipality', exact: true })
            .click();
    };
    await openRoadMunicipalityChange();
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
    await openRoadMunicipalityChange();
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
    // Verified active Engineers may read across municipalities. Private file
    // downloads remain authenticated and cannot be edited by non-managers.
    assert.equal(
        (await rogue.request.get(`${base}${doc.download_url}`)).status(),
        200,
    );
    assert.equal(storage.counts.downloads, before + 1);
    assert.equal(
        (
            await rogue.request.get(
                `${ui}/maintenance-projects/${project.id}/records/${record.id}/edit`,
            )
        ).status(),
        403,
    );
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
    assert.ok(
        (await props(rogue, '/maintenance-projects')).projects.data.some(
            (item) => item.id === project.id,
        ),
        'Verified Engineers retain cross-municipality project read access.',
    );

    lastPage = admin;

    await verifyDirectoryLayouts(admin, ui);
    await verifyMobileWorkspaces({ browser, base, admin, superadmin, engineer, viewer, projectId: project.id, recordId: record.id, monthlyId: january.id, documentId: doc.id, roadId: road.id, lguId: road.lgu_id });

    await verifyAuditNotifications({
        admin,
        superadmin,
        engineer,
        viewer,
        base,
        report,
        record,
        fixture: f,
    });

    await verifyPermanentFileDeletion({
        admin,
        superadmin,
        engineer,
        viewer,
        rogue,
        ui,
        base,
        doc,
        report,
        record,
        storage,
        props,
    });

    await verifyPreservedRelationships({
        admin,
        superadmin,
        engineer,
        viewer,
        rogue,
        ui,
        base,
        fixture: f,
        props,
        storage,
    });

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
    await verifyAuthenticatedHistory(
        engineer,
        ui,
        f.engineer_email,
        f.session_cookie_name,
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

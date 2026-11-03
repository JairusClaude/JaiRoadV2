import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { png } from '../Browser/private-storage-mock.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const f = JSON.parse(
    await readFile(process.env.QUARTERLY_BROWSER_FIXTURE, 'utf8'),
);
const base = process.env.QUARTERLY_BROWSER_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');
const browser = await chromium.launch({
    executablePath: process.env.CHROME_EXECUTABLE,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
    });
    await context.route('https://*.tile.openstreetmap.org/**', (r) =>
        r.fulfill({ contentType: 'image/png', body: png }),
    );
    const page = await context.newPage();
    await page.goto(base + '/login');
    await page.getByLabel('Email address').fill(f.engineer_email);
    await page
        .getByLabel('Password', { exact: true })
        .fill('Disposable-Test!123');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL(/dd-phase3\/dashboard/);
    const results = [];

    for (let run = 0; run < 4; run++) {
        const start = performance.now();
        const response = await page.goto(
            base + '/dd-phase3/ui/road-coverages/create',
        );
        await page.locator('.jr-leaflet-map').waitFor();
        await page.evaluate(
            () =>
                new Promise((r) =>
                    requestAnimationFrame(() => requestAnimationFrame(r)),
                ),
        );
        const interactive = performance.now() - start;

        if (await page.locator('[data-reference-state]').count()) {
            await page.locator('[data-reference-state="ready"]').waitFor();
        }

        const complete = performance.now() - start;

        if (run) {
            results.push({
                interactive_ms: Math.round(interactive),
                references_ready_ms: Math.round(complete),
                html_bytes: (await response.body()).length,
            });
        }
    }

    console.log(JSON.stringify({ roads: f.count, samples: results }));
} finally {
    await browser.close();
}

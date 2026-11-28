import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import process from 'node:process';
import { png, startStorageMock } from './private-storage-mock.mjs';

const base = process.env.QUARTERLY_BROWSER_URL;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.equal(process.env.JAIROADS_SCRATCH_APPROVAL, 'DISPOSABLE_LOCAL_ONLY');
const fixture = JSON.parse(
    await readFile(process.env.QUARTERLY_BROWSER_FIXTURE, 'utf8'),
);
const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const storage = await startStorageMock();
const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const evidence = '/tmp/jairoads-directory-review';
await mkdir(evidence, { recursive: true });
const paths = [
    'lgus',
    'monthly-updates',
    'road-coverages',
    'maintenance-records',
    'maintenance-projects',
    'maintenance-documents',
];
const errors = [];

try {
    for (const role of ['engineer', 'admin', 'viewer']) {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 900 },
            reducedMotion: 'reduce',
        });
        await context.route('https://*.tile.openstreetmap.org/**', (route) =>
            route.fulfill({ contentType: 'image/png', body: png }),
        );
        await context.route('https://tile.openstreetmap.org/**', (route) =>
            route.fulfill({ contentType: 'image/png', body: png }),
        );
        const page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(base + '/login');
        await page.getByLabel('Email address').fill(fixture[role + '_email']);
        await page
            .getByLabel('Password', { exact: true })
            .fill('Disposable-Test!123');
        await page
            .getByRole('button', { name: 'Sign in', exact: true })
            .click();
        await page.waitForURL(/workspace\/dashboard/);

        for (const name of paths) {
            const response = await page.goto(base + '/workspace/ui/' + name);
            assert.equal(response?.status(), 200, role + ' ' + name);
            await page.locator('.jr-stage').waitFor();
            const panel = page.locator('.jr-directory-filter-panel');

            // The viewer has a separate read-only projects directory; do not alter it.
            if (
                role === 'viewer' &&
                name === 'maintenance-projects' &&
                !(await panel.count())
            ) {
                continue;
            }

            await panel.waitFor();

            for (const width of [320, 390, 768, 1440]) {
                await page.setViewportSize({ width, height: 844 });
                await page.evaluate(
                    () =>
                        new Promise((resolve) =>
                            requestAnimationFrame(() =>
                                requestAnimationFrame(resolve),
                            ),
                        ),
                );
                const problems = await page.evaluate(() => {
                    const result = [];
                    const close = (a, b) => Math.abs(a - b) <= 2;

                    if (document.documentElement.scrollWidth > innerWidth + 2) {
                        result.push('Viewport overflow');
                    }

                    if (innerWidth <= 767) {
                        for (const head of document.querySelectorAll(
                            '.jr-page-head',
                        )) {
                            const siblings = [];
                            for (
                                let next = head.nextElementSibling;
                                next;
                                next = next.nextElementSibling
                            ) {
                                siblings.push(next);
                            }
                            const firstPanel = siblings.find((element) =>
                                element.matches(
                                    '.jr-directory-summary, .jr-directory-filter-panel, .jr-road-coverage-main-container',
                                ),
                            );
                            if (!firstPanel) continue;
                            const target =
                                firstPanel.querySelector(
                                    '.jr-directory-summary',
                                ) || firstPanel;
                            if (!target.getClientRects().length) continue;
                            const gap =
                                target.getBoundingClientRect().top -
                                head.getBoundingClientRect().bottom;
                            if (
                                gap < 10 ||
                                (head.nextElementSibling === firstPanel &&
                                    gap > 16)
                            ) {
                                result.push('Hero-to-content gutter: ' + gap);
                            }
                        }
                    }

                    const summaries = document.querySelectorAll(
                        '.jr-directory-summary',
                    );

                    for (const summary of summaries) {
                        const cards = [...summary.children];
                        const box = summary.getBoundingClientRect();

                        for (const card of cards) {
                            if (card.scrollWidth > card.clientWidth + 2) {
                                result.push('Metric overflow');
                            }
                        }

                        if (innerWidth <= 390 && cards.length === 3) {
                            const [a, b, c] = cards.map((card) =>
                                card.getBoundingClientRect(),
                            );

                            if (
                                !close(a.width, b.width) ||
                                !close(a.top, b.top) ||
                                !close(c.width, box.width - 2)
                            ) {
                                result.push('Metric imbalance');
                            }
                        }
                    }

                    for (const row of document.querySelectorAll(
                        '.jr-directory-filter-panel .jr-filter-row',
                    )) {
                        const fields = [...row.children];

                        if (
                            innerWidth <= 390 &&
                            fields.length > 1 &&
                            fields.length % 2
                        ) {
                            if (
                                !close(
                                    fields.at(-1).getBoundingClientRect().width,
                                    row.getBoundingClientRect().width,
                                )
                            ) {
                                result.push('Orphan filter');
                            }
                        }

                        for (const field of fields) {
                            const button = field.querySelector(
                                '[data-slot="select-trigger"]',
                            );

                            if (
                                !field.querySelector(
                                    '.jr-directory-filter-label',
                                ) ||
                                !button ||
                                button.getBoundingClientRect().height < 43
                            ) {
                                result.push('Filter touch/caption');
                            }

                            if (field.scrollWidth > field.clientWidth + 2) {
                                result.push('Filter overflow');
                            }
                        }
                    }

                    return result;
                });
                assert.deepEqual(
                    problems,
                    [],
                    role + ' ' + name + ' at ' + width,
                );

                if (
                    role === 'engineer' &&
                    width === 390 &&
                    paths.slice(0, 3).includes(name)
                ) {
                    await page.screenshot({
                        path: evidence + '/' + name + '-390.png',
                        fullPage: false,
                    });
                    await page.evaluate(() =>
                        document.documentElement.classList.add('dark'),
                    );
                    await page.screenshot({
                        path: evidence + '/' + name + '-dark-390.png',
                        fullPage: false,
                    });
                    await page.evaluate(() =>
                        document.documentElement.classList.remove('dark'),
                    );
                }
            }

            console.log(
                'PASS directory balance',
                role,
                name,
                '320/390/768/1440',
            );
        }

        await context.close();
    }

    assert.deepEqual(errors, []);
    console.log('DIRECTORY_BALANCE_QA_PASS');
} finally {
    await browser.close();
    await storage.close();
}

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import process from 'node:process';

export async function verifyDirectoryLayouts(page, ui) {
    const evidence = process.env.UNIFIED_BROWSER_EVIDENCE_DIR;
    const measurements = [];

    if (evidence) {
        await mkdir(evidence, { recursive: true });
    }

    for (const width of [320, 390, 768, 820, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });

        for (const path of [
            '/road-coverages',
            '/maintenance-projects',
            '/monthly-updates',
            '/maintenance-documents',
        ]) {
            await page.goto(`${ui}${path}`);
            await page.getByRole('heading', { level: 1 }).first().waitFor();
            const size = await page.evaluate(() => {
                const content = document
                    .querySelector('.jr-workspace')
                    .getBoundingClientRect();
                const sidebar = document.querySelector('.jr-sidebar-container');
                const side = sidebar?.getBoundingClientRect();

                return {
                    viewport: innerWidth,
                    document: document.documentElement.scrollWidth,
                    contentLeft: content.left,
                    sidebarRight: side?.right ?? 0,
                    sidebarVisible: !!side && side.width > 0 && side.right > 0,
                };
            });
            measurements.push({ path, height: 1000, ...size });
            assert.ok(
                size.document <= width + 1,
                `${path} at ${width}px overflows: ${JSON.stringify(size)}`,
            );

            if (width >= 768) {
                assert.ok(
                    size.sidebarVisible,
                    'The desktop sidebar must be measured',
                );
                assert.ok(
                    size.contentLeft >= size.sidebarRight - 1,
                    `${path}: sidebar overlaps content`,
                );
            }

            const table = page.locator('.jr-table-wrap').first();
            await table.scrollIntoViewIfNeeded();
            await table.evaluate((node) => {
                node.scrollLeft = node.scrollWidth;
            });
            assert.ok(
                await table.evaluate(
                    (node) =>
                        node.scrollWidth <= node.clientWidth ||
                        node.scrollLeft > 0,
                ),
                'Wide table must remain scrollable',
            );

            if (path !== '/monthly-updates') {
                continue;
            }

            if (evidence) {
                await table.evaluate((node) => {
                    node.scrollLeft = 0;
                });
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.screenshot({
                    path: `${evidence}/monthly-${width}-after.png`,
                    fullPage: true,
                });
            }

            await page.getByLabel('Project filter', { exact: true }).click();
            await page
                .getByLabel('Search maintenance projects', { exact: true })
                .fill('Test project');
            await page
                .getByRole('option', { name: 'Test project', exact: true })
                .click();
            await page.waitForURL((url) =>
                /^\d+$/.test(url.searchParams.get('project') || ''),
            );
            await page.getByLabel('Reporting Year filter').click();
            await page
                .getByRole('option', { name: '2026', exact: true })
                .click();
            await page.waitForURL(
                (url) => url.searchParams.get('year') === '2026',
            );
            await page.getByLabel('Sort monthly updates').click();
            await page
                .getByRole('option', {
                    name: 'Oldest Month First',
                    exact: true,
                })
                .click();
            await page.waitForURL(
                (url) => url.searchParams.get('sort') === 'oldest',
            );
            await page
                .getByRole('searchbox', { name: 'Search monthly updates' })
                .fill('Test project');
            await page.waitForURL(
                (url) => url.searchParams.get('search') === 'Test project',
            );
            await page.getByLabel('Reporting Year filter').click();
            await page
                .getByRole('option', { name: 'All Years', exact: true })
                .click();
            await page.waitForURL(
                (url) =>
                    !url.searchParams.get('year') ||
                    url.searchParams.get('year') === 'all',
            );
            await page
                .getByRole('navigation', { name: 'Monthly update pagination' })
                .scrollIntoViewIfNeeded();
            await page
                .getByRole('button', { name: 'Next page', exact: true })
                .click();
            await page.waitForURL(
                (url) => url.searchParams.get('page') === '2',
            );
            assert.ok(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <= innerWidth + 1,
                ),
                `Filters/pagination overflow at ${width}`,
            );
        }
    }

    if (evidence) {
        await writeFile(
            `${evidence}/viewport-measurements.json`,
            JSON.stringify(measurements, null, 2),
        );
    }

    console.log(
        'PASS: 24 directory/viewport measurements; six widths; monthly project/year/sort dropdowns, search, table scrolling, pagination and sidebar separation.',
    );
    console.log('VIEWPORT MEASUREMENTS', JSON.stringify(measurements));
}

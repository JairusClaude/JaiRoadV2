import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';

// Runs on the existing real-session disposable browser fixture, never production.
export async function verifyMobileWorkspaces({
    browser,
    base,
    admin,
    superadmin,
    engineer,
    viewer,
    projectId,
    recordId,
    monthlyId,
    documentId,
    roadId,
    lguId,
}) {
    assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
    const ui = '/workspace/ui';
    const common = [
        '/workspace/dashboard',
        ui + '/maintenance-projects',
        ui + '/maintenance-records',
        ui + '/monthly-updates',
        ui + '/maintenance-documents',
        ui + '/road-coverages',
        ui + '/lgus',
        '/workspace/settings',
        ui + '/maintenance-projects/' + projectId,
        ui + '/maintenance-projects/' + projectId + '/records/' + recordId,
        ui + '/monthly-updates/' + monthlyId,
        ui + '/maintenance-documents/' + documentId,
        ...(roadId ? [ui + '/road-coverages/' + roadId] : []),
        ...(lguId ? [ui + '/lgus/' + lguId] : []),
    ];
    const forms = [
        ui + '/maintenance-projects/create',
        ui + '/road-coverages/create',
        ui + '/monthly-updates/' + monthlyId + '/edit',
        ui + '/maintenance-documents/' + documentId + '/edit',
        ui + '/maintenance-projects/' + projectId + '/records/create',
        ui + '/monthly-updates/create?maintenance_id=' + recordId,
        ui + '/maintenance-documents/create?maintenance_id=' + recordId,
    ];
    const evidence = process.env.UNIFIED_BROWSER_EVIDENCE_DIR;

    if (evidence) {
        await mkdir(evidence, { recursive: true });
    }

    let count = 0;

    for (const [role, page] of Object.entries({
        admin,
        superadmin,
        engineer,
        viewer,
    })) {
        const previous = page.viewportSize();

        try {
            const privileged = role === 'admin' || role === 'superadmin';
            const paths = [
                ...common,
                ...(privileged
                    ? [
                          '/workspace/users',
                          '/workspace/audit-logs',
                          ui + '/lgus/create',
                      ]
                    : []),
                ...(role === 'viewer' ? [] : forms),
            ];

            for (const path of paths) {
                // Exercise a narrow first load, then resize the same page to
                // cover all breakpoints without repeating server work.
                await page.setViewportSize({ width: 320, height: 844 });
                const response = await page.goto(base + path);
                assert.equal(response?.status(), 200, role + ': ' + path);
                await page.locator('.jr-stage').waitFor();

                for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
                    await page.setViewportSize({ width, height: 844 });
                    await page.evaluate(
                        () =>
                            new Promise((resolve) => {
                                requestAnimationFrame(() =>
                                    requestAnimationFrame(resolve),
                                );
                            }),
                    );

                    if (role === 'admin' && path === '/workspace/dashboard') {
                        assert.equal(
                            await page
                                .locator(
                                    '.jr-directory-exploration.jr-admin-dashboard',
                                )
                                .count(),
                            1,
                            'Admin dashboard must retain both styling classes',
                        );
                    }

                    const sizes = await page.evaluate(() => {
                        const stage = document
                            .querySelector('.jr-stage')
                            .getBoundingClientRect();
                        const content = document
                            .querySelector('.jr-content')
                            .getBoundingClientRect();
                        const sidebar = document
                            .querySelector('.jr-sidebar-container')
                            ?.getBoundingClientRect();

                        const overflowing =
                            document.documentElement.scrollWidth >
                            innerWidth + 1
                                ? [...document.querySelectorAll('body *')]
                                      .filter((element) => {
                                          const rectangle =
                                              element.getBoundingClientRect();
                                          const style =
                                              getComputedStyle(element);

                                          return (
                                              rectangle.right >
                                                  innerWidth + 1 &&
                                              rectangle.left < innerWidth + 2 &&
                                              rectangle.width > 0 &&
                                              style.visibility !== 'hidden' &&
                                              style.position !== 'fixed'
                                          );
                                      })
                                      .slice(0, 15)
                                      .map((element) => ({
                                          tag: element.tagName.toLowerCase(),
                                          className:
                                              typeof element.className ===
                                              'string'
                                                  ? element.className.slice(
                                                        0,
                                                        130,
                                                    )
                                                  : '',
                                          right: Math.round(
                                              element.getBoundingClientRect()
                                                  .right,
                                          ),
                                          width: Math.round(
                                              element.getBoundingClientRect()
                                                  .width,
                                          ),
                                      }))
                                : [];

                        return {
                            viewport: innerWidth,
                            document: document.documentElement.scrollWidth,
                            stageLeft: stage.left,
                            stageRight: stage.right,
                            contentRight: content.right,
                            sidebarRight: sidebar?.right ?? 0,
                            overflowing,
                        };
                    });
                    assert.ok(
                        sizes.document <= width + 1 &&
                            sizes.stageRight <= width + 1 &&
                            sizes.contentRight <= width + 1,
                        role +
                            ' ' +
                            width +
                            ' ' +
                            path +
                            ': ' +
                            JSON.stringify(sizes),
                    );

                    if (width === 390) {
                        const overflowingCards = await page
                            .locator('.jr-mobile-table')
                            .evaluateAll((tables) =>
                                tables
                                    .filter((table) => {
                                        const region = table.parentElement;
                                        return (
                                            region.scrollWidth >
                                            region.clientWidth + 1
                                        );
                                    })
                                    .map((table) =>
                                        table.parentElement.getAttribute(
                                            'aria-label',
                                        ),
                                    ),
                            );
                        assert.deepEqual(
                            overflowingCards,
                            [],
                            role +
                                ' ' +
                                path +
                                ' mobile cards fit without swiping',
                        );
                    }

                    if (width < 1024) {
                        assert.ok(
                            sizes.stageLeft < 2,
                            'Mobile drawer must not reserve desktop space',
                        );
                    } else {
                        assert.ok(
                            sizes.stageLeft >= sizes.sidebarRight - 1,
                            'Desktop sidebar overlaps content',
                        );
                    }

                    for (const table of await page
                        .locator(
                            '.jr-table-wrap, .um-table-scroll, [role="region"]:has(>table)',
                        )
                        .all()) {
                        if (!(await table.isVisible())) {
                            continue;
                        }

                        const result = await table.evaluate((el) => {
                            el.scrollLeft = el.scrollWidth;

                            return {
                                visible: el.clientWidth,
                                width: el.scrollWidth,
                                scroll: el.scrollLeft,
                            };
                        });
                        assert.ok(
                            result.width <= result.visible + 1 ||
                                result.scroll > 0,
                            'Table must scroll: ' + role + ' ' + path,
                        );
                    }

                    if (
                        evidence &&
                        width === 390 &&
                        [
                            ui + '/maintenance-projects',
                            ui + '/maintenance-documents',
                            '/workspace/users',
                            '/workspace/dashboard',
                        ].includes(path)
                    ) {
                        await page.screenshot({
                            path:
                                evidence +
                                '/mobile-' +
                                role +
                                '-' +
                                path.split('/').at(-1) +
                                '.png',
                            fullPage: true,
                        });
                    }

                    if (width < 1024 && path === '/workspace/dashboard') {
                        const trigger = page.getByRole('button', {
                            name: 'Open navigation',
                            exact: true,
                        });
                        await trigger.click();
                        const drawer = page.locator(
                            '[data-slot="sidebar"][data-mobile="true"]',
                        );
                        await drawer.waitFor({ state: 'visible' });
                        const drawerBox = await drawer.boundingBox();
                        assert.ok(
                            drawerBox &&
                                drawerBox.width < width &&
                                drawerBox.height <= 845,
                        );
                        const nav = drawer.getByRole('navigation', {
                            name: 'Main navigation',
                        });
                        await nav
                            .getByRole('link', {
                                name: 'Monthly Updates',
                                exact: true,
                            })
                            .click();
                        await drawer.waitFor({ state: 'hidden' });
                        await page.waitForURL('**/monthly-updates');
                        await trigger.click();
                        await drawer.waitFor({ state: 'visible' });
                        await page.keyboard.press('Escape');
                        await drawer.waitFor({ state: 'hidden' });
                        await page.goto(base + path);
                        await page.locator('.jr-stage').waitFor();
                    }

                    count++;
                }
            }
        } finally {
            if (previous) {
                await page.setViewportSize(previous);
            }
        }
    }

    // Real Chromium mobile emulation, with touch and the same authenticated
    // disposable sessions. Read-only; the original role contexts stay intact.
    for (const [role, page] of Object.entries({
        admin,
        superadmin,
        engineer,
        viewer,
    })) {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true,
            reducedMotion: 'reduce',
            storageState: await page.context().storageState(),
        });

        try {
            const phone = await context.newPage();
            await phone.goto(base + ui + '/maintenance-projects');
            await phone.locator('.jr-stage').waitFor();
            const geometry = await phone.evaluate(() => ({
                layout: innerWidth,
                scroll: document.documentElement.scrollWidth,
                touch: navigator.maxTouchPoints,
                dark: document.documentElement.classList.contains('dark'),
            }));
            assert.equal(geometry.layout, 390, role + ' mobile viewport meta');
            assert.ok(
                geometry.touch > 0 && geometry.scroll <= 391,
                role + ' touch layout',
            );
            const projects = phone.getByRole('region', {
                name: 'Maintenance Projects table',
            });
            const rows = projects.getByRole('table').locator('tbody tr');
            const firstProject = rows.first();
            await firstProject.waitFor();
            assert.ok(
                await projects.evaluate(
                    (element) =>
                        element.scrollWidth <= element.clientWidth + 1 &&
                        getComputedStyle(element.querySelector('tbody tr'))
                            .display === 'grid',
                ),
                role + ' can read project fields without swiping sideways',
            );
            const municipality = firstProject.locator(
                '[data-mobile-label="Municipality"]',
            );
            await municipality.waitFor();
            assert.match(
                await municipality.evaluate(
                    (element) => getComputedStyle(element, '::before').content,
                ),
                /Municipality/,
            );
            const action = firstProject.locator('.jr-action-trigger');

            if (await action.isVisible()) {
                const button = await action.boundingBox();
                assert.ok(
                    button && button.width >= 44 && button.height >= 44,
                    role + ' project actions have a phone-sized touch target',
                );
            }

            const selectProjects = phone.getByRole('button', {
                name: 'Select projects',
                exact: true,
            });

            if (
                (await selectProjects.isVisible()) &&
                (await selectProjects.isEnabled())
            ) {
                await selectProjects.tap();
                await projects
                    .getByRole('checkbox', {
                        name: 'Select all projects on this page',
                    })
                    .waitFor({ state: 'visible' });
                await phone
                    .getByRole('button', {
                        name: 'Cancel selection',
                        exact: true,
                    })
                    .tap();
            }

            const header = phone.locator('.jr-global-header');
            assert.equal(
                await header.evaluate(
                    (element) => getComputedStyle(element).position,
                ),
                'sticky',
                role + ' navigation stays available on long pages',
            );
            await phone
                .getByRole('button', { name: 'Open navigation', exact: true })
                .tap();
            const drawer = phone.locator(
                '[data-slot="sidebar"][data-mobile="true"]',
            );
            await drawer.waitFor({ state: 'visible' });
            await drawer
                .getByRole('button', { name: 'Close navigation', exact: true })
                .tap();
            await drawer.waitFor({ state: 'hidden' });
            await phone
                .locator('html')
                .evaluate((el) => el.classList.add('dark'));
            assert.ok(
                await phone.evaluate(
                    () => document.documentElement.scrollWidth <= 391,
                ),
                role + ' mobile dark mode',
            );

            if (evidence) {
                await phone.screenshot({
                    path: evidence + '/touch-dark-' + role + '.png',
                    fullPage: true,
                });
            }
        } finally {
            await context.close();
        }
    }

    console.log(
        'PASS: ' +
            count +
            ' all-role workspace viewport checks, mobile menu navigation, local table scrolling, desktop separation and four touch/dark-mode checks.',
    );
}

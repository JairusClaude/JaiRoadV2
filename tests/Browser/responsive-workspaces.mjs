import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import process from 'node:process';

// Runs on the existing real-session disposable browser fixture, never production.
export async function verifyMobileWorkspaces({ base, admin, superadmin, engineer, viewer, projectId, recordId, monthlyId, documentId }) {
    assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/);
    const ui = '/dd-phase3/ui';
    const common = [
        '/dd-phase3/dashboard', ui + '/maintenance-projects', ui + '/maintenance-records',
        ui + '/monthly-updates', ui + '/maintenance-documents', ui + '/road-coverages',
        ui + '/lgus', '/dd-phase3/settings',
        ui + '/maintenance-projects/' + projectId,
        ui + '/maintenance-projects/' + projectId + '/records/' + recordId,
        ui + '/monthly-updates/' + monthlyId, ui + '/maintenance-documents/' + documentId,
    ];
    const forms = [
        ui + '/maintenance-projects/create', ui + '/road-coverages/create',
        ui + '/monthly-updates/' + monthlyId + '/edit', ui + '/maintenance-documents/' + documentId + '/edit',
    ];
    const evidence = process.env.UNIFIED_BROWSER_EVIDENCE_DIR;
    if (evidence) await mkdir(evidence, { recursive:true });
    let count = 0;
    for (const [role, page] of Object.entries({ admin, superadmin, engineer, viewer })) {
        const previous = page.viewportSize();
        try {
            for (const width of [320,390,768,1024]) {
                await page.setViewportSize({ width, height: 844 });
                const privileged = role === 'admin' || role === 'superadmin';
                const paths = [...common, ...(privileged ? ['/dd-phase3/users','/dd-phase3/audit-logs',ui+'/lgus/create'] : []), ...(role === 'viewer' ? [] : forms)];
                for (const path of paths) {
                    const response = await page.goto(base + path);
                    assert.ok(response && response.status() < 400, role + ': ' + path);
                    await page.locator('.jr-stage').waitFor();
                    const sizes = await page.evaluate(() => {
                        const stage = document.querySelector('.jr-stage').getBoundingClientRect();
                        const content = document.querySelector('.jr-content').getBoundingClientRect();
                        const sidebar = document.querySelector('.jr-sidebar-container')?.getBoundingClientRect();
                        return { viewport:innerWidth, document:document.documentElement.scrollWidth, stageLeft:stage.left, stageRight:stage.right, contentRight:content.right, sidebarRight:sidebar?.right ?? 0 };
                    });
                    assert.ok(sizes.document <= width+1 && sizes.stageRight <= width+1 && sizes.contentRight <= width+1, role + ' ' + width + ' ' + path + ': ' + JSON.stringify(sizes));
                    if (width < 1024) assert.ok(sizes.stageLeft < 2, 'Mobile drawer must not reserve desktop space');
                    else assert.ok(sizes.stageLeft >= sizes.sidebarRight - 1, 'Desktop sidebar overlaps content');
                    for (const table of await page.locator('.jr-table-wrap, .um-table-scroll, [role="region"]:has(>table)').all()) {
                        if (!(await table.isVisible())) continue;
                        const result = await table.evaluate(el => {
                            el.scrollLeft = el.scrollWidth;
                            return { visible:el.clientWidth, width:el.scrollWidth, scroll:el.scrollLeft };
                        });
                        assert.ok(result.width <= result.visible + 1 || result.scroll > 0, 'Table must scroll: ' + role + ' ' + path);
                    }
                    if (width < 1024 && path === '/dd-phase3/dashboard') {
                        const trigger = page.getByRole('button',{ name:'Open navigation', exact:true });
                        await trigger.click();
                        const drawer = page.locator('[data-slot="sidebar"][data-mobile="true"]');
                        await drawer.waitFor({ state:'visible' });
                        const drawerBox = await drawer.boundingBox();
                        assert.ok(drawerBox && drawerBox.width < width && drawerBox.height <= 845);
                        const nav = drawer.getByRole('navigation',{ name:'Main navigation' });
                        await nav.getByRole('link',{ name:'Monthly Updates',exact:true }).click();
                        await drawer.waitFor({state:'hidden'});
                        await page.waitForURL('**/monthly-updates');
                        await trigger.click();
                        await drawer.waitFor({state:'visible'});
                        await page.keyboard.press('Escape');
                        await drawer.waitFor({state:'hidden'});
                    }
                    if (evidence && width === 390 && [ui+'/maintenance-projects',ui+'/maintenance-documents','/dd-phase3/users','/dd-phase3/dashboard'].includes(path)) {
                        await page.screenshot({path:evidence+'/mobile-'+role+'-'+path.split('/').at(-1)+'.png',fullPage:true});
                    }
                    count++;
                }
            }
        } finally {
            if(previous) await page.setViewportSize(previous);
        }
    }
    console.log('PASS: '+count+' all-role workspace viewport checks, mobile menu navigation, local table scrolling and desktop separation.');
}

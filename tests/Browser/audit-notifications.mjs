import assert from 'node:assert/strict';

/** Real Laravel sessions; no preview identities or notification response mocks. */
export async function verifyAuditNotifications({
    admin,
    superadmin,
    engineer,
    viewer,
    base,
    report,
    record,
    fixture,
}) {
    const result = await engineer.evaluate(
        async ({ base, report, record }) => {
            const cookie = document.cookie
                .split('; ')
                .find((c) => c.startsWith('XSRF-TOKEN='));
            const response = await fetch(
                `${base}/workspace/ops/updates/${report.id}`,
                {
                    method: 'PUT',
                    headers: {
                        Accept: 'application/json',
                        'X-Inertia': 'true',
                        'X-Inertia-Version': JSON.parse(
                            document.querySelector('script[data-page]')
                                .textContent,
                        ).version,
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)),
                    },
                    body: JSON.stringify({
                        maintenance_id: record.id,
                        update_month: report.update_month,
                        progress_percentage: 67,
                        summary_of_text_reports:
                            'Audit browser verified change',
                    }),
                },
            );

            return response.status;
        },
        { base, report, record },
    );
    assert.equal(result, 200);

    for (const page of [admin, superadmin, engineer]) {
        const response = await page.request.get(
            `${base}/jairoads/notifications`,
        );
        assert.equal(response.status(), 200);
        const { notifications } = await response.json();
        assert.ok(
            notifications.some(
                (n) =>
                    n.notification_message ===
                    `Engineer updated MonthlyUpdate #${report.id}.`,
            ),
        );
        assert.equal(
            new Set(notifications.map((n) => n.id)).size,
            notifications.length,
        );

        for (const notice of notifications) {
            assert.deepEqual(Object.keys(notice).sort(), [
                'created_at',
                'id',
                'notification_message',
            ]);
        }
    }

    assert.deepEqual(
        await (
            await viewer.request.get(`${base}/jairoads/notifications`)
        ).json(),
        { notifications: [] },
    );
    await admin.goto(`${base}/workspace/dashboard`);
    await admin
        .getByRole('link', { name: 'Full audit history', exact: true })
        .click();
    await admin
        .getByRole('heading', { name: 'Audit Log', exact: true })
        .waitFor();
    const historyResponse = await admin.request.get(
        `${base}/workspace/audit-logs`,
        {
            headers: {
                'X-Inertia': 'true',
                'X-Inertia-Version': JSON.parse(
                    await admin.locator('script[data-page]').textContent(),
                ).version,
            },
        },
    );
    assert.equal(historyResponse.status(), 200);
    const { props } = await historyResponse.json();
    assert.ok(
        props.events.data.some(
            (e) =>
                e.action === 'UPDATE' &&
                e.entity_type === 'MonthlyUpdate' &&
                Number(e.entity_id) === report.id,
        ),
    );
    // The original inline disclosure is restored; the scroll region contains wide data.
    const activityTable = admin.getByRole('region', {
        name: 'System Activity History',
        exact: true,
    });
    const details = activityTable.locator('details').first();
    const summary = details.locator('summary');
    // Opening a disclosure must not alter any column widths, including at 100% zoom.
    const columnWidths = (region) =>
        region
            .locator('table.jr-audit-grid > thead > tr > th')
            .evaluateAll((cells) =>
                cells.map((cell) => cell.getBoundingClientRect().width),
            );
    const verifyStableDisclosure = async (region, disclosure) => {
        const trigger = disclosure.locator('summary');
        await trigger.scrollIntoViewIfNeeded();
        const before = await columnWidths(region);
        const initialWidth = await region.evaluate((el) => el.scrollWidth);
        await trigger.click();
        assert.equal(await disclosure.evaluate((el) => el.open), true);
        const after = await columnWidths(region);
        assert.equal(after.length, before.length);
        assert.ok(
            after.every((width, index) => Math.abs(width - before[index]) <= 1),
            'Expanding details must not resize columns',
        );
        assert.ok(
            Math.abs(
                (await region.evaluate((el) => el.scrollWidth)) - initialWidth,
            ) <= 1,
            'Expanding details must not change the horizontal scroll range',
        );
        assert.ok(
            await trigger.evaluate(
                (el) =>
                    el.getBoundingClientRect().width <
                    el.closest('td').getBoundingClientRect().width,
            ),
            'Disclosure focus must be confined to the label',
        );
        await trigger.click();
        assert.equal(await disclosure.evaluate((el) => el.open), false);
        assert.ok(
            (await columnWidths(region)).every(
                (width, index) => Math.abs(width - before[index]) <= 1,
            ),
        );
    };
    const authRegion = admin.getByRole('region', {
        name: 'Authentication History',
        exact: true,
    });

    for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
    ]) {
        await admin.setViewportSize(viewport);
        await verifyStableDisclosure(activityTable, details);
        const authDisclosure = authRegion.locator('details').first();

        if (await authDisclosure.count()) {
            await verifyStableDisclosure(authRegion, authDisclosure);
        }
    }

    // A narrow viewport guarantees horizontal overflow even with short audit values.
    await admin.setViewportSize({ width: 390, height: 844 });
    await activityTable.locator('thead th').first().scrollIntoViewIfNeeded();
    await activityTable.evaluate((el) => {
        el.scrollLeft = 0;
    });
    await admin.waitForFunction(() => {
        const el = document.querySelector(
            '[aria-label="System Activity History"]',
        );

        return el?.getAttribute('data-overflow') === 'true';
    });
    const visibleHeader = await activityTable
        .locator('thead th')
        .first()
        .boundingBox();
    const regionBox = await activityTable.boundingBox();
    assert.ok(visibleHeader && regionBox);
    const dragX = Math.min(
        regionBox.x + regionBox.width - 24,
        visibleHeader.x + visibleHeader.width - 12,
    );
    const dragY = visibleHeader.y + visibleHeader.height / 2;
    assert.ok(
        dragX - regionBox.x > 45,
        'Need a visible header area for mouse dragging',
    );
    const distance = Math.min(80, dragX - regionBox.x - 12);
    await admin.mouse.move(dragX, dragY);
    await admin.mouse.down();
    await admin.mouse.move(dragX - distance, dragY, { steps: 8 });
    assert.equal(await activityTable.getAttribute('data-dragging'), 'true');
    await admin.mouse.up();
    assert.ok(
        (await activityTable.evaluate((el) => el.scrollLeft)) > 0,
        'Dragging left reveals later columns',
    );
    assert.equal(await activityTable.getAttribute('data-dragging'), null);
    await admin.mouse.move(dragX - distance, dragY);
    await admin.mouse.down();
    await admin.mouse.move(dragX, dragY, { steps: 8 });
    await admin.mouse.up();
    assert.ok(
        (await activityTable.evaluate((el) => el.scrollLeft)) <= 2,
        'Dragging right returns to the first columns',
    );
    await activityTable.focus();
    await admin.keyboard.press('ArrowRight');
    assert.ok(
        (await activityTable.evaluate((el) => el.scrollLeft)) > 0,
        'Keyboard users can scroll horizontally',
    );
    await admin.keyboard.press('ArrowLeft');
    assert.ok((await activityTable.evaluate((el) => el.scrollLeft)) <= 2);

    for (const viewport of [
        { width: 1440, height: 900 },
        { width: 390, height: 844 },
    ]) {
        await admin.setViewportSize(viewport);
        await summary.scrollIntoViewIfNeeded();
        await summary.click();
        assert.equal(await details.evaluate((el) => el.open), true);
        assert.ok(
            await details.evaluate((el) => {
                const region = el.closest('.jr-audit-table-scroll');

                return (
                    region &&
                    ['auto', 'scroll'].includes(
                        getComputedStyle(region).overflowX,
                    ) &&
                    el.getBoundingClientRect().width >= 350 &&
                    el.scrollWidth <= el.clientWidth + 1
                );
            }),
        );
        await summary.click();
        assert.equal(await details.evaluate((el) => el.open), false);
    }

    await admin.setViewportSize({ width: 1440, height: 900 });
    assert.ok(
        await admin
            .getByRole('navigation', { name: 'Audit history pagination' })
            .isVisible(),
    );
    const next = props.events.links.find((link) => link.label.includes('Next'));
    assert.ok(
        next?.url,
        'Retained historical fixture entries exercise real pagination',
    );
    // Exercise the actual Inertia pagination link, not a direct page.goto.
    const activityNav = admin.getByRole('navigation', {
        name: 'Audit history pagination',
    });
    const nextURL = new URL(next.url, base);
    assert.equal(nextURL.origin, new URL(base).origin);
    const nextResponse = admin.waitForResponse(
        (response) =>
            new URL(response.url()).pathname === nextURL.pathname &&
            new URL(response.url()).searchParams.get('page') ===
                nextURL.searchParams.get('page') &&
            response.request().headers()['x-inertia'] === 'true',
    );
    await activityNav.getByRole('link', { name: /Next/ }).click();
    const nextResult = await nextResponse;
    assert.equal(nextResult.status(), 200);
    const older = (await nextResult.json()).props.events.data;
    await activityNav
        .locator('[aria-current="page"]')
        .getByText('2', { exact: true })
        .waitFor();
    assert.ok(older.length > 0);
    assert.ok(
        older.every(
            (e) => !props.events.data.some((first) => first.id === e.id),
        ),
    );

    const authNav = admin.getByRole('navigation', {
        name: 'Authentication history pagination',
    });

    if (await authNav.getByRole('link', { name: /Next/ }).count()) {
        const authNext = authNav.getByRole('link', { name: /Next/ });
        const authURL = new URL(await authNext.getAttribute('href'), base);
        assert.equal(authURL.origin, new URL(base).origin);
        assert.equal(authURL.searchParams.get('page'), '2');
        const authResponse = admin.waitForResponse(
            (response) =>
                new URL(response.url()).pathname === authURL.pathname &&
                new URL(response.url()).searchParams.get('auth_page') === '2' &&
                response.request().headers()['x-inertia'] === 'true',
        );
        await authNext.click();
        assert.equal((await authResponse).status(), 200);
        await authNav
            .locator('[aria-current="page"]')
            .getByText('2', { exact: true })
            .waitFor();
        assert.equal(new URL(admin.url()).searchParams.get('page'), '2');
    }

    for (const event of older.filter((e) => e.action === 'LOGIN')) {
        assert.ok(
            fixture.audit_history_ids.includes(Number(event.id)),
            'Only seeded historical LOGIN entries remain',
        );
    }

    assert.equal(
        (await engineer.request.get(`${base}/workspace/audit-logs`)).status(),
        403,
    );
    assert.equal(
        (await viewer.request.get(`${base}/workspace/audit-logs`)).status(),
        403,
    );
    await superadmin.goto(`${base}/workspace/audit-logs`);
    await superadmin
        .getByRole('heading', { name: 'Audit Log', exact: true })
        .waitFor();
    const online = superadmin.getByRole('region', {
        name: 'Currently Online Users',
        exact: true,
    });
    const ownRow = online
        .getByRole('row')
        .filter({ has: superadmin.getByText('You', { exact: true }) });
    await ownRow.getByText('SuperAdmin', { exact: true }).waitFor();
    await ownRow.getByText('Active', { exact: true }).waitFor();
    console.log(
        'PASS: one real Engineer update appears in each eligible Admin/SuperAdmin/actor feed; Viewer receives none; safe unique feed IDs; privileged read-only audit snapshots/pagination; historical LOGIN preserved without new authentication events.',
    );
}

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
    const activityTable = admin.getByRole('region', { name: 'System Activity History', exact: true });
    const details = activityTable.locator('details').first();
    const summary = details.locator('summary');
    // A narrow viewport guarantees horizontal overflow even with short audit values.
    await admin.setViewportSize({ width: 390, height: 844 });
    await activityTable.locator('thead th').first().scrollIntoViewIfNeeded();
    await activityTable.evaluate(el => { el.scrollLeft = 0; });
    await admin.waitForFunction(() => {
        const el = document.querySelector('[aria-label="System Activity History"]');
        return el?.getAttribute('data-overflow') === 'true';
    });
    const visibleHeader = await activityTable.locator('thead th').first().boundingBox();
    const regionBox = await activityTable.boundingBox();
    assert.ok(visibleHeader && regionBox);
    const dragX = Math.min(regionBox.x + regionBox.width - 24, visibleHeader.x + visibleHeader.width - 12);
    const dragY = visibleHeader.y + visibleHeader.height / 2;
    assert.ok(dragX - regionBox.x > 45, 'Need a visible header area for mouse dragging');
    const distance = Math.min(80, dragX - regionBox.x - 12);
    await admin.mouse.move(dragX, dragY);
    await admin.mouse.down();
    await admin.mouse.move(dragX - distance, dragY, { steps: 8 });
    assert.equal(await activityTable.getAttribute('data-dragging'), 'true');
    await admin.mouse.up();
    assert.ok(await activityTable.evaluate(el => el.scrollLeft) > 0, 'Dragging left reveals later columns');
    assert.equal(await activityTable.getAttribute('data-dragging'), null);
    await admin.mouse.move(dragX - distance, dragY);
    await admin.mouse.down();
    await admin.mouse.move(dragX, dragY, { steps: 8 });
    await admin.mouse.up();
    assert.ok(await activityTable.evaluate(el => el.scrollLeft) <= 2, 'Dragging right returns to the first columns');
    await activityTable.focus();
    await admin.keyboard.press('ArrowRight');
    assert.ok(await activityTable.evaluate(el => el.scrollLeft) > 0, 'Keyboard users can scroll horizontally');
    await admin.keyboard.press('ArrowLeft');
    assert.ok(await activityTable.evaluate(el => el.scrollLeft) <= 2);



    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        await admin.setViewportSize(viewport);
        await summary.scrollIntoViewIfNeeded();
        await summary.click();
        assert.equal(await details.evaluate(el => el.open), true);
        assert.ok(await details.evaluate(el => {
            const region = el.closest('.jr-audit-table-scroll');

            return region && ['auto', 'scroll'].includes(getComputedStyle(region).overflowX)
                && el.getBoundingClientRect().width >= 350
                && el.scrollWidth <= el.clientWidth + 1;
        }));
        await summary.click();
        assert.equal(await details.evaluate(el => el.open), false);
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
    await admin.goto(next.url);
    const older = JSON.parse(
        await admin.locator('script[data-page]').textContent(),
    ).props.events.data;

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
    console.log(
        'PASS: one real Engineer update appears in each eligible Admin/SuperAdmin/actor feed; Viewer receives none; safe unique feed IDs; privileged read-only audit snapshots/pagination; historical LOGIN preserved without new authentication events.',
    );
}

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
                `${base}/dd-phase3/ops/updates/${report.id}`,
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
        // The Final DD makes an Engineer's own maintenance activity audit-only:
        // no notification is broadcast to administrators or the actor.
        assert.ok(
            !notifications.some(
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
    await admin.goto(`${base}/dd-phase3/dashboard`);
    await admin
        .getByRole('link', { name: 'Full audit history', exact: true })
        .click();
    await admin
        .getByRole('heading', { name: 'Audit Log', exact: true })
        .waitFor();
    const historyResponse = await admin.request.get(
        `${base}/dd-phase3/audit-logs`,
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
    await admin
        .getByText('Safe before / after values', { exact: true })
        .first()
        .click();
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
        (await engineer.request.get(`${base}/dd-phase3/audit-logs`)).status(),
        403,
    );
    assert.equal(
        (await viewer.request.get(`${base}/dd-phase3/audit-logs`)).status(),
        403,
    );
    await superadmin.goto(`${base}/dd-phase3/audit-logs`);
    await superadmin
        .getByRole('heading', { name: 'Audit Log', exact: true })
        .waitFor();
    console.log(
        'PASS: real Engineer update is audit-only without broadcasts; safe recipient-limited notification feeds; privileged read-only audit snapshots/pagination; historical LOGIN preserved without new authentication events.',
    );
}

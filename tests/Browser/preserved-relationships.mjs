import assert from 'node:assert/strict';

export async function verifyPreservedRelationships({
    admin,
    superadmin,
    engineer,
    viewer,
    rogue,
    ui,
    base,
    fixture,
    props,
    storage,
}) {
    const projectId = fixture.project_id;
    const recordId = fixture.record_id;
    const projectPath = `/maintenance-projects/${projectId}`;
    const recordPath = `${projectPath}/records/${recordId}`;
    const before = await props(admin, recordPath);
    const doc = before.documents.find((d) => d.id === fixture.document_id);
    const bytes = await (
        await admin.request.get(`${base}${doc.download_url}`)
    ).body();
    const mediaUrl = `${base}/dd-phase3/files/media/${fixture.media_id}`;
    const mediaBytes = await (await admin.request.get(mediaUrl)).body();
    const csrf = (page, path, method, data = {}) =>
        page.evaluate(
            async ({ path, method, data }) => {
                const cookie = document.cookie
                    .split('; ')
                    .find((v) => v.startsWith('XSRF-TOKEN='));
                const r = await fetch(path, {
                    method,
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)),
                    },
                    body: JSON.stringify(data),
                });

                return {
                    status: r.status,
                    data: r.headers.get('content-type')?.includes('json')
                        ? await r.json()
                        : null,
                };
            },
            { path, method, data },
        );

    for (const page of [engineer, viewer]) {
        assert.equal(
            (
                await csrf(page, `/dd-phase3/ui${projectPath}`, 'DELETE', {
                    confirmation_token: 'not authority',
                })
            ).status,
            403,
        );
        assert.equal(
            (
                await csrf(
                    page,
                    `/dd-phase3/ops/records/${recordId}/unassignment`,
                    'POST',
                    { expected_current_manager_id: fixture.engineer_id },
                )
            ).status,
            403,
        );
    }

    await admin.goto(`${ui}${projectPath}`);
    const initial = storage.counts.compensations;
    await admin
        .getByRole('button', { name: 'Delete Project', exact: true })
        .click();
    let panel = admin.getByRole('dialog', {
        name: 'Delete project?',
        exact: true,
    });
    await panel
        .getByRole('button', { name: 'Delete', exact: true })
        .click({ trial: true });
    assert.match(await panel.innerText(), /RoadCoverage:/);
    assert.match(await panel.innerText(), /preserved/);
    assert.match(await panel.innerText(), /NULL/);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await props(admin, projectPath)).project.id, projectId);
    assert.equal(storage.counts.compensations, initial);
    await admin
        .getByRole('button', { name: 'Delete Project', exact: true })
        .click();
    panel = admin.getByRole('dialog', { name: 'Delete project?', exact: true });
    await panel
        .getByRole('button', { name: 'Delete', exact: true })
        .click({ trial: true });
    // Another authorized actor materially changes assignment after preview.
    assert.equal(
        (
            await csrf(
                superadmin,
                `/dd-phase3/ops/records/${recordId}/unassignment`,
                'POST',
                { expected_current_manager_id: fixture.engineer_id },
            )
        ).status,
        200,
    );
    await panel.getByRole('button', { name: 'Delete', exact: true }).click();
    await panel
        .getByRole('alert')
        .filter({ hasText: /changed/ })
        .waitFor();
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await admin.goto(`${ui}${recordPath}`);
    await admin.getByText('NULL (unassigned)', { exact: true }).waitFor();
    assert.equal((await props(admin, recordPath)).record.engineers_id, null);
    assert.equal(
        (
            await csrf(engineer, `/dd-phase3/ops/records/${recordId}`, 'PUT', {
                project_id: projectId,
                managing_engineer_id: fixture.engineer_id,
                maintenance_year: before.record.year,
                quarter: before.record.quarter,
                start_date: before.record.start_date,
                estimated_duration_days: before.record.estimated_duration_days,
                status: before.record.status,
            })
        ).status,
        403,
    );
    await admin
        .getByRole('button', { name: 'Reassign manager', exact: true })
        .click();
    await admin
        .getByLabel('Replacement ManagingEngineer')
        .selectOption(String(fixture.engineer_id));
    await admin
        .getByRole('button', { name: 'Confirm reassignment', exact: true })
        .click();
    await admin
        .getByText('NULL (unassigned)', { exact: true })
        .waitFor({ state: 'hidden' });
    assert.equal(
        (await props(admin, recordPath)).record.engineers_id,
        fixture.engineer_id,
    );
    await admin.goto(`${ui}${projectPath}`);
    await admin
        .getByRole('button', { name: 'Delete Project', exact: true })
        .click();
    panel = admin.getByRole('dialog', { name: 'Delete project?', exact: true });
    await panel.getByRole('button', { name: 'Delete', exact: true }).click();
    await admin.waitForURL(`${ui}/maintenance-projects`);
    assert.equal(
        storage.counts.compensations,
        initial,
        'Project deletion must issue zero Storage DELETEs',
    );
    const historyUrl = `${base}/dd-phase3/history/records/${recordId}`;
    await admin.goto(historyUrl);
    await admin
        .getByRole('heading', {
            name: `MaintenanceRecord #${recordId}`,
            exact: true,
        })
        .waitFor();
    await admin.getByText('NULL (Project deleted)', { exact: true }).waitFor();
    assert.match(
        await admin.locator('body').innerText(),
        /Previously associated with Project/,
    );
    assert.deepEqual(
        await (await admin.request.get(`${base}${doc.download_url}`)).body(),
        bytes,
    );
    assert.deepEqual(
        await (await admin.request.get(mediaUrl)).body(),
        mediaBytes,
    );
    await superadmin.goto(historyUrl);
    await superadmin
        .getByText('NULL (Project deleted)', { exact: true })
        .waitFor();

    for (const page of [engineer, viewer, rogue]) {
        assert.equal((await page.request.get(historyUrl)).status(), 403);
        assert.equal(
            (await page.request.get(`${base}${doc.download_url}`)).status(),
            403,
        );
        assert.equal((await page.request.get(mediaUrl)).status(), 403);
    }

    console.log(
        'PASS: real Fortify project impact/Cancel/stale-confirmation handling; explicit NULL manager unassignment and reassignment; project-only deletion with zero Storage mutations; Admin-only preserved history, unchanged document/media bytes and Engineer/Viewer/cross-LGU denials.',
    );
}

import assert from 'node:assert/strict';

// Kept under its existing exported name to avoid breaking the unified runner.
// Phase 11L verifies strict parent FKs, NOT detached historical records.
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
    const emptyId = fixture.empty_project;
    assert.ok(Number.isInteger(emptyId) && emptyId > 0);
    const projectPath = `/maintenance-projects/${projectId}`;
    const recordPath = `${projectPath}/records/${recordId}`;
    const before = await props(admin, recordPath);
    const doc = before.documents.find((d) => d.id === fixture.document_id);
    assert.ok(doc, 'Attached document must be present before deletion refusal');
    const documentUrl = `${base}${doc.download_url}`;
    const documentBytes = await (await admin.request.get(documentUrl)).body();
    const mediaUrl = `${base}/workspace/files/media/${fixture.media_id}`;
    const mediaBytes = await (await admin.request.get(mediaUrl)).body();
    const storageBefore = storage.counts.compensations;

    const csrf = (page, path, method, data = {}) =>
        page.evaluate(
            async ({ path, method, data }) => {
                const cookie = document.cookie
                    .split('; ')
                    .find((v) => v.startsWith('XSRF-TOKEN='));

                if (!cookie) {
                    throw new Error('Authenticated test page lacks CSRF cookie');
                }

                const response = await fetch(path, {
                    method,
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)),
                    },
                    body: JSON.stringify(data),
                });

                return { status: response.status };
            },
            { path, method, data },
        );

    for (const page of [admin, superadmin, engineer, viewer]) {
        assert.equal(
            (
                await csrf(
                    page,
                    `/workspace/ops/records/${recordId}/unassignment`,
                    'POST',
                    { expected_current_manager_id: fixture.engineer_id },
                )
            ).status,
            403,
            'Manager unassignment is forbidden for every role',
        );
    }

    for (const page of [engineer, viewer, rogue]) {
        assert.equal(
            (
                await csrf(page, `/workspace/ui${projectPath}`, 'DELETE', {
                    confirmation_token: 'not authority',
                })
            ).status,
            403,
        );
    }

    const blockedPreview = await admin.request.get(
        `${ui}${projectPath}/deletion-preview`,
        { headers: { Accept: 'application/json' } },
    );
    assert.equal(blockedPreview.status(), 200);
    assert.equal(
        (
            await csrf(admin, `/workspace/ui${projectPath}`, 'DELETE', {
                confirmation_token: 'invalid', confirmation: 'YES',
            })
        ).status,
        422,
    );
    await admin.goto(`${ui}${projectPath}`);
    assert.equal(
        await admin.getByRole('button', { name: 'Delete Project', exact: true }).count(),
        1,
        'Referenced project must expose the reviewed deletion action',
    );
    assert.equal((await props(admin, projectPath)).project.id, projectId);
    assert.equal((await props(admin, recordPath)).record.engineers_id, fixture.engineer_id);
    assert.deepEqual(await (await admin.request.get(documentUrl)).body(), documentBytes);
    assert.deepEqual(await (await admin.request.get(mediaUrl)).body(), mediaBytes);
    assert.equal(storage.counts.compensations, storageBefore);
    // All active linked canonical roles may read attached operational files;
    // only managers may perform destructive project actions.
    assert.deepEqual(await (await rogue.request.get(documentUrl)).body(), documentBytes);

    // The separate fixture project has no MaintenanceRecords: UI confirmation
    // may delete it without affecting the referenced project or Storage.
    const emptyPath = `/maintenance-projects/${emptyId}`;
    await admin.goto(`${ui}${emptyPath}`);
    await admin.getByRole('button', { name: 'Delete Project', exact: true }).click();
    let dialog = admin.getByRole('dialog', { name: 'Delete project?', exact: true });
    await dialog.getByText(/RoadCoverage:/).waitFor();
    assert.doesNotMatch(await dialog.innerText(), /project_id.*NULL|detached history/i);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await admin.request.get(`${ui}${emptyPath}`)).status(), 200);
    await admin.getByRole('button', { name: 'Delete Project', exact: true }).click();
    dialog = admin.getByRole('dialog', { name: 'Delete project?', exact: true });
    await dialog.getByText(/RoadCoverage:/).waitFor();
    const confirm = dialog.getByRole('button', { name: 'Delete Project', exact: true });
    assert.equal(await confirm.isDisabled(), true);
    const input = dialog.getByPlaceholder('Type YES');
    await input.fill('NO');
    assert.equal(await confirm.isDisabled(), true);
    await input.fill('YES');
    assert.equal(await confirm.isDisabled(), true);
    const equation = dialog.getByText(/^\d+ \+ \d+ = \?$/);
    await equation.waitFor();
    const numbers = (await equation.innerText()).match(/\d+/g).map(Number);
    assert.equal(await dialog.getByText('This action cannot be undone.', { exact: true }).count(), 0);
    await dialog.getByPlaceholder('Enter answer').fill(String(numbers[0] + numbers[1] + 1));
    await dialog.getByText('Check your answer.', { exact: true }).waitFor();
    assert.equal(await confirm.isDisabled(), true);
    await dialog.getByPlaceholder('Enter answer').fill(String(numbers[0] + numbers[1]));
    await dialog.getByText('Answer correct.', { exact: true }).waitFor();
    await dialog.getByText('Ready to delete. Review the selected data.', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: /webcam|take picture/i, includeHidden: true }).count(), 0);
    assert.equal(await confirm.isEnabled(), true);
    await confirm.click();
    await admin.waitForURL(`${ui}/maintenance-projects`);
    assert.equal((await admin.request.get(`${ui}${emptyPath}`)).status(), 404);
    assert.equal((await props(admin, recordPath)).record.engineers_id, fixture.engineer_id);
    assert.equal(storage.counts.compensations, storageBefore);

    console.log(
        'PASS: dependent project review is available; invalid confirmation and manager unassignment refused; original files retained; empty project Cancel/confirmed deletion.',
    );
}
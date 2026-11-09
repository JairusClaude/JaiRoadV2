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
    const mediaUrl = `${base}/dd-phase3/files/media/${fixture.media_id}`;
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
                    `/dd-phase3/ops/records/${recordId}/unassignment`,
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
                await csrf(page, `/dd-phase3/ui${projectPath}`, 'DELETE', {
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
    assert.equal(blockedPreview.status(), 409);
    assert.equal(
        (
            await csrf(admin, `/dd-phase3/ui${projectPath}`, 'DELETE', {
                confirmation_token: 'invalid',
            })
        ).status,
        422,
    );
    await admin.goto(`${ui}${projectPath}`);
    assert.equal(
        await admin.getByRole('button', { name: 'Delete Project', exact: true }).count(),
        0,
        'Referenced project must not expose the deletion action',
    );
    assert.equal((await props(admin, projectPath)).project.id, projectId);
    assert.equal((await props(admin, recordPath)).record.engineers_id, fixture.engineer_id);
    assert.deepEqual(await (await admin.request.get(documentUrl)).body(), documentBytes);
    assert.deepEqual(await (await admin.request.get(mediaUrl)).body(), mediaBytes);
    assert.equal(storage.counts.compensations, storageBefore);
    assert.equal((await rogue.request.get(documentUrl)).status(), 403);

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
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await admin.waitForURL(`${ui}/maintenance-projects`);
    assert.equal((await admin.request.get(`${ui}${emptyPath}`)).status(), 404);
    assert.equal((await props(admin, recordPath)).record.engineers_id, fixture.engineer_id);
    assert.equal(storage.counts.compensations, storageBefore);

    console.log(
        'PASS: dependent project deletion and manager unassignment refused; original records and private files retained; empty project Cancel/confirmed deletion; no Storage deletion.',
    );
}
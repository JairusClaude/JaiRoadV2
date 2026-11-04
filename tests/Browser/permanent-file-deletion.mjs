import assert from 'node:assert/strict';
import { pdf, png } from './private-storage-mock.mjs';

export async function verifyPermanentFileDeletion({
    admin,
    superadmin,
    engineer,
    viewer,
    rogue,
    ui,
    base,
    doc,
    report,
    record,
    storage,
    props,
}) {
    const csrfDelete = (page, url) =>
        page.evaluate(async (path) => {
            const cookie = document.cookie
                .split('; ')
                .find((c) => c.startsWith('XSRF-TOKEN='));
            const response = await fetch(path, {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(cookie.slice(11)),
                },
            });

            return response.status;
        }, url);
    const documentUrl = `/dd-phase3/files/document/${doc.id}`;

    for (const page of [engineer, viewer, rogue]) {
        assert.equal(await csrfDelete(page, documentUrl), 403);
    }

    // A real web request without CSRF headers must not reach a destructive action.
    const csrfDenied = await admin.request.delete(`${base}${documentUrl}`, {
        headers: { Accept: 'application/json' },
    });
    assert.equal(csrfDenied.status(), 419);

    await admin.goto(
        `${ui}/maintenance-documents/create?maintenance_id=${record.id}`,
    );
    await admin
        .getByLabel(/^Document Title/)
        .fill('Retained sibling inspection');
    await admin.locator('input[type=file]').setInputFiles({
        name: 'retained.pdf',
        mimeType: 'application/pdf',
        buffer: pdf,
    });
    await admin
        .getByRole('button', { name: 'Upload Document', exact: true })
        .click();
    await admin.waitForURL(`${ui}/maintenance-documents`);
    const sibling = (
        await props(
            admin,
            '/maintenance-documents?search=Retained sibling inspection',
        )
    ).documents.data[0];
    const siblingBytes = await (
        await admin.request.get(`${base}${sibling.download_url}`)
    ).body();
    let mutations = 0;
    const count = (request) => {
        if (
            request.method() === 'DELETE' &&
            new URL(request.url()).pathname === documentUrl
        ) {
            mutations++;
        }
    };
    admin.on('request', count);
    await admin.goto(`${ui}/maintenance-documents/${doc.id}`);
    const trigger = admin.getByRole('button', {
        name: 'Delete Document',
        exact: true,
    });
    await trigger.click();
    let panel = admin.getByRole('dialog', { name: 'Delete File Permanently?' });
    await panel.waitFor();
    assert.match(await panel.innerText(), /unified\.pdf/);
    assert.match(await panel.innerText(), /MaintenanceDocument/);
    assert.match(await panel.innerText(), /cannot be undone/);
    assert.match(await panel.innerText(), /private Storage/);
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    await panel.waitFor({ state: 'hidden' });
    assert.equal(mutations, 0);
    assert.equal(
        (await admin.request.get(`${base}${doc.download_url}`)).status(),
        200,
    );
    await trigger.click();
    panel = admin.getByRole('dialog', { name: 'Delete File Permanently?' });
    const confirm = panel.getByRole('button', { name: 'Delete', exact: true });
    await confirm.click({ trial: true });
    const rgb = await confirm.evaluate((element) => {
        const c = document.createElement('canvas');
        c.width = c.height = 1;
        const context = c.getContext('2d');
        context.fillStyle = getComputedStyle(element).backgroundColor;
        context.fillRect(0, 0, 1, 1);

        return Array.from(context.getImageData(0, 0, 1, 1).data);
    });
    assert.ok(
        rgb[0] > rgb[1] * 1.3 && rgb[0] > rgb[2] * 1.3 && rgb[3] > 0,
        `Destructive Delete must be visibly red: ${rgb}`,
    );
    storage.failNextDelete(503);
    await confirm.click();
    await panel
        .getByRole('alert')
        .filter({ hasText: 'Deletion is pending' })
        .waitFor();
    assert.equal(mutations, 1);
    assert.equal(
        (await props(admin, `/maintenance-documents/${doc.id}`)).document.id,
        doc.id,
    );
    assert.equal(
        await admin
            .getByText(`File permanently deleted: ${doc.file_name}`, {
                exact: true,
            })
            .count(),
        0,
    );
    storage.delayNextDelete(350);
    await confirm.click();
    const processing = panel.getByRole('button', {
        name: 'Deleting…',
        exact: true,
    });
    await processing.waitFor();
    assert.equal(await processing.isDisabled(), true);
    await admin.waitForURL(`${ui}/maintenance-documents`);
    await admin
        .getByText(`File permanently deleted: ${doc.file_name}`, {
            exact: true,
        })
        .waitFor();
    assert.equal(mutations, 2);
    assert.equal(
        (
            await admin.request.get(`${ui}/maintenance-documents/${doc.id}`)
        ).status(),
        404,
    );
    assert.deepEqual(
        await (
            await admin.request.get(`${base}${sibling.download_url}`)
        ).body(),
        siblingBytes,
    );
    admin.off('request', count);

    await superadmin.goto(`${ui}/monthly-updates/${report.id}`);
    await superadmin.locator('input[type=file]').setInputFiles({
        name: 'retained.png',
        mimeType: 'image/png',
        buffer: png,
    });
    await superadmin
        .getByRole('button', { name: 'Upload Media', exact: true })
        .click();
    await superadmin
        .getByText('retained.png', { exact: true })
        .first()
        .waitFor();
    const before = await props(superadmin, `/monthly-updates/${report.id}`);
    const retained = before.media.find(
        (file) => file.file_name === 'retained.png',
    );
    const selected = before.media.find(
        (file) => file.file_name === 'unified.png',
    );
    assert.equal(selected.file_path, undefined);
    const retainedBytes = await (
        await superadmin.request.get(`${base}${retained.preview_url}`)
    ).body();
    await superadmin
        .getByRole('button', { name: 'Delete unified.png', exact: true })
        .click();
    panel = superadmin.getByRole('dialog', {
        name: 'Delete File Permanently?',
    });
    await panel.getByText('unified.png', { exact: true }).waitFor();
    assert.match(await panel.innerText(), /MonthlyUpdate/);
    await panel.getByRole('button', { name: 'Delete', exact: true }).click();
    await superadmin
        .getByText('File permanently deleted: unified.png', { exact: true })
        .waitFor();
    const after = await props(superadmin, `/monthly-updates/${report.id}`);
    const {
        media_count: beforeCount,
        photo_count: beforePhotos,
        video_count: beforeVideos,
        other_count: beforeOther,
        ...beforeRow
    } = before.update;
    const {
        media_count: afterCount,
        photo_count: afterPhotos,
        video_count: afterVideos,
        other_count: afterOther,
        ...afterRow
    } = after.update;
    assert.deepEqual(afterRow, beforeRow); // Stored MonthlyUpdate fields never change.
    assert.equal(afterCount, beforeCount - 1);
    assert.equal(afterPhotos, beforePhotos - 1);
    assert.equal(afterVideos, beforeVideos);
    assert.equal(afterOther, beforeOther);
    assert.deepEqual(
        after.media.map((file) => file.id),
        [retained.id],
    );
    assert.deepEqual(
        await (
            await superadmin.request.get(`${base}${retained.preview_url}`)
        ).body(),
        retainedBytes,
    );
    assert.equal(
        (
            await superadmin.request.get(
                `${ui}/maintenance-projects/${record.project_id ?? doc.project.id}`,
            )
        ).status(),
        200,
    );
    console.log(
        'PASS: real Fortify individual file deletion; exact filename/type/parent confirmation; red Delete, neutral Cancel/no mutation; processing guard; pending failure and retry; Admin document/SuperAdmin media deletion; siblings/parents retained; Engineer/Viewer/cross-LGU denials; CSRF enforced.',
    );
}

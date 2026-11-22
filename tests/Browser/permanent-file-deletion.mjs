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
    await admin.goto(`${ui}/maintenance-documents/${sibling.id}`);
    await admin.getByRole('heading', { name: 'Document Attachment', exact: true }).waitFor();
    assert.equal(await admin.getByRole('region', { name: 'Document Attachment' }).getByText('1 file', { exact: true }).isVisible(), true);
    assert.equal(await admin.getByRole('button', { name: 'View', exact: true }).isEnabled(), true);
    assert.equal(await admin.getByRole('link', { name: 'Download', exact: true }).isVisible(), true);
    const siblingBytes = await (
        await admin.request.get(`${base}${sibling.download_url}`)
    ).body();
    await admin.goto(`${ui}/maintenance-documents/${doc.id}/edit`);
    await admin.getByRole('button', { name: `Mark ${doc.file_name} for deletion` }).click();
    await admin.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await admin.request.get(`${base}${doc.download_url}`)).status(), 200);
    await admin.goto(`${ui}/maintenance-documents/${doc.id}/edit`);
    await admin.getByRole('button', { name: `Mark ${doc.file_name} for deletion` }).click();
    await admin.getByRole('button', { name: 'Save Changes', exact: true }).click();
    const documentModal = admin.getByRole('dialog', { name: 'Remove attachment permanently?' });
    await documentModal.waitFor();
    assert.equal(await documentModal.getByRole('button', { name: 'Cancel', exact: true }).evaluate(el => el === document.activeElement), true);
    const previousViewport = admin.viewportSize();
    await admin.setViewportSize({ width: 390, height: 844 });
    const bounds = await documentModal.evaluate(el => {
        const r = el.getBoundingClientRect();

        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight };
    });
    assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 && bounds.bottom <= bounds.height);
    await documentModal.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await admin.request.get(`${base}${doc.download_url}`)).status(), 200);

    if (previousViewport) {
await admin.setViewportSize(previousViewport);
}

    await admin.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await admin.getByRole('dialog', { name: 'Remove attachment permanently?' }).getByRole('button', { name: 'Save and Remove', exact: true }).click();
    await admin.waitForURL(`${ui}/maintenance-documents/${doc.id}`);
    const retainedDocument = (await props(admin, `/maintenance-documents/${doc.id}`)).document;
    assert.equal(retainedDocument.id, doc.id);
    assert.equal(retainedDocument.document_title, doc.document_title);
    assert.equal(retainedDocument.file_name, '');
    assert.equal(retainedDocument.available, false);
    assert.equal(retainedDocument.download_url, null);
    // Match the monthly-update empty state without phantom attachment or file actions.
    await admin.getByRole('heading', { name: retainedDocument.document_title, exact: true }).waitFor();

    for (const width of [1440, 390]) {
        const viewport = admin.viewportSize();
        await admin.setViewportSize({ width, height: 844 });
        assert.equal(await admin.getByRole('heading', { name: 'Document Attachment', exact: true }).isVisible(), true);
        assert.equal(await admin.getByText('No document attachment for this maintenance document.', { exact: true }).isVisible(), true);
        assert.equal(await admin.getByRole('region', { name: 'Document Attachment' }).getByText('0 files', { exact: true }).isVisible(), true);
        assert.equal(await admin.locator('.jr-document-file-row').count(), 0);
        assert.equal(await admin.getByRole('link', { name: 'Download', exact: true }).count(), 0);
        assert.equal(await admin.getByRole('button', { name: /^(View|Download)$/ }).count(), 0);
        assert.equal(await admin.getByRole('heading', { name: 'Document Information', exact: true }).isVisible(), true);

        if (viewport) {
await admin.setViewportSize(viewport);
}
    }

    await admin.reload();
    await admin.getByRole('heading', { name: retainedDocument.document_title, exact: true }).waitFor();
    assert.equal(await admin.getByRole('heading', { name: 'Document Attachment', exact: true }).isVisible(), true);
        assert.equal(await admin.getByText('No document attachment for this maintenance document.', { exact: true }).isVisible(), true);
        assert.equal(await admin.getByRole('region', { name: 'Document Attachment' }).getByText('0 files', { exact: true }).isVisible(), true);
    assert.equal((await admin.request.get(`${base}${doc.download_url}`)).status(), 404);
    assert.deepEqual(await (await admin.request.get(`${base}${sibling.download_url}`)).body(), siblingBytes);

    await superadmin.goto(`${ui}/monthly-updates/${report.id}/edit`);
    await superadmin.locator('input[type=file]').setInputFiles({
        name: 'retained.png',
        mimeType: 'image/png',
        buffer: png,
    });
    await superadmin
        .getByRole('button', { name: 'Save Changes', exact: true })
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
    await superadmin.goto(`${ui}/monthly-updates/${report.id}/edit`);
    await superadmin.getByRole('button', { name: 'Remove unified.png', exact: true }).click();
    await superadmin.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.ok((await props(superadmin, `/monthly-updates/${report.id}`)).media.some((file) => file.id === selected.id));
    await superadmin.goto(`${ui}/monthly-updates/${report.id}/edit`);
    await superadmin.getByRole('button', { name: 'Remove unified.png', exact: true }).click();
    await superadmin.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await superadmin.getByRole('dialog', { name: 'Remove selected media permanently?' }).getByRole('button', { name: 'Save and Remove', exact: true }).click();
    await superadmin.waitForURL(`${ui}/monthly-updates/${report.id}`);
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
        'PASS: attachment edit Cancel preserves files; confirmed Save removes private attachment and retains document/update information; siblings retained; authorization and CSRF enforced.',
    );
}

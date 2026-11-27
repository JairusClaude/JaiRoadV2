import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyOfflineFieldReport({ browser, engineer, draft, passphrase }) {
    const filePromise = engineer.waitForEvent('download');
    await engineer.getByRole('link', { name: 'Download standalone offline report editor' }).click();
    const file = await filePromise;

    const directory = await mkdtemp(join(tmpdir(), 'jairoads-field-report-'));
    const offline = await browser.newContext({ offline: true, acceptDownloads: true, viewport: { width: 320, height: 844 } });

    try {
        const html = join(directory, 'editor.html');
        await file.saveAs(html);
        const page = await offline.newPage();
        const networkRequests = [];
        page.on('request', (request) => {
            if (/^https?:/.test(request.url())) {
                networkRequests.push(request.url());
            }
        });
        await page.goto(pathToFileURL(html).href);

        const fields = {
            'Project ID': draft.project_id,
            'Maintenance record ID': draft.maintenance_id,
            'Reporting month': draft.update_month,
            'Progress percentage': draft.progress_percentage,
            'Progress summary': draft.summary_of_text_reports,
        };

        for (const [label, value] of Object.entries(fields)) {
            await page.getByLabel(label, { exact: true }).fill(value);
        }

        const password = page.getByLabel(/^Draft passphrase/);
        await password.fill(passphrase);
        const draftPromise = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download encrypted draft', exact: true }).click();
        const encrypted = await draftPromise;
        const encryptedPath = join(directory, 'draft.json');
        await encrypted.saveAs(encryptedPath);
        const contents = await readFile(encryptedPath);

        assert.ok(!contents.includes(draft.summary_of_text_reports));
        assert.equal(await password.inputValue(), '');

        await page.reload();
        const summary = page.getByLabel('Progress summary', { exact: true });
        await summary.fill('Unsaved replacement');
        await password.fill('invalid-standalone-passphrase');
        const restore = page.getByLabel(/^Restore an encrypted draft/);
        await restore.setInputFiles(encryptedPath);
        await page.getByText('Wrong passphrase or damaged encrypted draft.', { exact: true }).waitFor();
        assert.equal(await summary.inputValue(), 'Unsaved replacement');
        await password.fill(passphrase);
        await restore.setInputFiles(encryptedPath);
        await page.getByText('Draft restored. Review each field before saving.', { exact: true }).waitFor();

        for (const [label, value] of Object.entries(fields)) {
            assert.equal(await page.getByLabel(label, { exact: true }).inputValue(), value);
        }

        assert.deepEqual(networkRequests, []);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

        return contents;
    } finally {
        await offline.close();
        await rm(directory, { recursive: true, force: true });
    }
}

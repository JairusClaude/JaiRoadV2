import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { decryptDraft, encryptDraft, isEncryptedDraft, maxDraftFileBytes, validateDraftSummary } from '../../resources/js/lib/encrypted-field-draft.mjs';

test('encrypted drafts are portable, authenticated and randomized', async () => {
    const report = { version: 1, summary_of_text_reports: 'Synthetic field report' };
    const passphrase = 'synthetic-only-passphrase';
    const first = await encryptDraft(report, passphrase);
    const second = await encryptDraft(report, passphrase);

    assert.ok(isEncryptedDraft(first));
    assert.ok(!JSON.stringify(first).includes(report.summary_of_text_reports));
    assert.notEqual(first.salt, second.salt);
    assert.notEqual(first.iv, second.iv);
    assert.deepEqual(await decryptDraft(first, passphrase), report);
    await assert.rejects(decryptDraft(first, 'another-test-passphrase'));
    const altered = { ...first, ciphertext: (first.ciphertext[0] === 'A' ? 'B' : 'A') + first.ciphertext.slice(1) };
    await assert.rejects(decryptDraft(altered, passphrase));
    await assert.rejects(encryptDraft(report, 'short'));
    await assert.rejects(decryptDraft({ ...first, iv: 'bad' }, passphrase));
});

test('full-length summaries fit within the encrypted file limit', async () => {
    const escaped = '\u0001'.repeat(20000);
    const unicode = '🛣'.repeat(20000);
    const passphrase = 'synthetic-only-passphrase';

    for (const summary_of_text_reports of [escaped, unicode]) {
        validateDraftSummary(summary_of_text_reports);
        const report = { version: 1, summary_of_text_reports };
        const envelope = await encryptDraft(report, passphrase);
        assert.ok(Buffer.byteLength(JSON.stringify(envelope)) <= maxDraftFileBytes);
        assert.deepEqual(await decryptDraft(envelope, passphrase), report);
    }

    assert.throws(() => validateDraftSummary(unicode + 'x'), /20,000/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decryptDraft, encryptDraft, isEncryptedDraft } from '../../resources/js/lib/encrypted-field-draft.mjs';

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

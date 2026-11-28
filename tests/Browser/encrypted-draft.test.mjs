import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { decryptDraft, encryptDraft, isEncryptedDraft, maxDraftFileBytes, validateDraftSummary } from '../../resources/js/lib/encrypted-field-draft.mjs';
import { canAttemptReceiptQueue, createReceiptQueue, parseReceiptQueue, receiptQuery, queueLifetime } from '../../resources/js/lib/receipt-queue.ts';

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

test('encrypted queue survives reopening with a stable account-bound submission ID and attempted marker', async () => {
    const report = { project_id: '12', maintenance_id: '34', update_month: '2026-11', progress_percentage: '30.00', summary_of_text_reports: 'Synthetic private report' };
    const queue = createReceiptQueue({ ...report, attachments: ['not persisted'] }, 7);
    const passphrase = 'synthetic-queue-passphrase';
    const envelope = await encryptDraft(queue, passphrase);
    const reopened = parseReceiptQueue(await decryptDraft(JSON.parse(JSON.stringify(envelope)), passphrase), 7);

    assert.deepEqual(reopened, queue);
    assert.deepEqual(reopened.report, report);
    assert.ok(!JSON.stringify(envelope).includes(report.summary_of_text_reports));
    assert.ok(!JSON.stringify(envelope).includes(queue.submissionId));
    assert.equal(canAttemptReceiptQueue(reopened), true);
    assert.equal(receiptQuery(reopened).get('submission_id'), queue.submissionId);
    assert.equal(receiptQuery(reopened, false).has('submission_id'), false);
    assert.throws(() => parseReceiptQueue(reopened, 8));
    assert.throws(() => parseReceiptQueue({ ...reopened, expiresAt: reopened.expiresAt + 1 }, 7));
    assert.throws(() => parseReceiptQueue({ ...reopened, report: { ...report, update_month: '0000-01' } }, 7));
    const attempted = parseReceiptQueue(await decryptDraft(await encryptDraft({ ...reopened, attempted: true }, passphrase), passphrase), 7);
    assert.equal(canAttemptReceiptQueue(attempted), false);
    const createdAt = Date.now() - queueLifetime - 1;
    assert.equal(canAttemptReceiptQueue(parseReceiptQueue({ ...queue, createdAt, expiresAt: createdAt + queueLifetime }, 7)), false);
});

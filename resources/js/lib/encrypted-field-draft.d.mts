export const maxDraftFileBytes: number;
export const maxReportSummaryCharacters: number;
export function validateDraftSummary(summary: string): void;

export function encryptDraft(
    data: unknown,
    passphrase: string,
): Promise<{
    format: 'jairoads-encrypted-draft-v1';
    salt: string;
    iv: string;
    ciphertext: string;
}>;

export function isEncryptedDraft(data: unknown): boolean;

export function decryptDraft(
    data: unknown,
    passphrase: string,
): Promise<unknown>;

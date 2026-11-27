const format = 'jairoads-encrypted-draft-v1';
const iterations = 310000;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

const encode = (bytes: Uint8Array) =>
    btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
const decode = (value: string) =>
    Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function keyFor(
    passphrase: string,
    salt: Uint8Array<ArrayBuffer>,
    usage: KeyUsage,
) {
    if (passphrase.length < 12 || passphrase.length > 256) {
        throw new Error('Use a draft passphrase of 12 to 256 characters.');
    }

    const material = await crypto.subtle.importKey(
        'raw',
        encoder.encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey'],
    );

    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        [usage],
    );
}

export async function encryptDraft(data: unknown, passphrase: string) {
    const plaintext = encoder.encode(JSON.stringify(data));

    if (plaintext.length > 90000) {
        throw new Error('Draft exceeds the supported encryption size.');
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await keyFor(passphrase, salt, 'encrypt');
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: encoder.encode(format) },
        key,
        plaintext,
    );

    return {
        format,
        salt: encode(salt),
        iv: encode(iv),
        ciphertext: encode(new Uint8Array(encrypted)),
    };
}

export function isEncryptedDraft(data: unknown): boolean {
    return (
        !!data &&
        typeof data === 'object' &&
        'format' in data &&
        data.format === format
    );
}

export async function decryptDraft(data: unknown, passphrase: string) {
    if (!isEncryptedDraft(data)) {
        throw new Error('Unrecognized encrypted draft.');
    }

    const item = data as Record<string, unknown>;

    if (
        typeof item.salt !== 'string' ||
        typeof item.iv !== 'string' ||
        typeof item.ciphertext !== 'string' ||
        item.salt.length !== 24 ||
        item.iv.length !== 16 ||
        item.ciphertext.length > 120024
    ) {
        throw new Error('Invalid encrypted draft format.');
    }

    const salt = decode(item.salt);
    const iv = decode(item.iv);
    const ciphertext = decode(item.ciphertext);

    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 16) {
        throw new Error('Invalid encrypted draft format.');
    }

    const key = await keyFor(passphrase, salt, 'decrypt');

    try {
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv, additionalData: encoder.encode(format) },
            key,
            ciphertext,
        );

        return JSON.parse(decoder.decode(plaintext)) as unknown;
    } catch {
        throw new Error('Wrong passphrase or damaged encrypted draft.');
    }
}

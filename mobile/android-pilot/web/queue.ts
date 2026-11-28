import { keyFor } from '../../../resources/js/lib/encrypted-field-draft.mjs';

export type Kind = 'road' | 'project' | 'record' | 'monthly' | 'document';
export type Fields = Record<string, string>;
export type Row = { id: number | string; version?: string } & Record<
    string,
    unknown
>;
type Receipt = { operationId: string; id: number; version: string };
type Wire = {
    account_id: number;
    operation_id: string;
    kind: Kind;
    id?: number;
    version?: string;
    fields: Fields;
};
export type Change = {
    operation: string;
    entity: string;
    kind: Kind;
    fields: Fields;
    version?: string;
    wire?: Wire;
    issue?: string;
};
export type Attachment = {
    id: string;
    record: string;
    name: string;
    description: string;
    data: string;
    storedBytes?: number;
    kind?: 'document' | 'media';
    parent?: string;
    title?: string;
    receipt?: Receipt;
    issue?: string;
};
export type FileReference = {
    kind: 'document' | 'media';
    id: number;
    record: number;
    name: string;
    title: string;
    version: string;
    rowVersion?: string;
    available: boolean;
    parent?: number;
    mime?: string;
    description?: string | null;
    uploadedAt?: string;
    uploader?: string;
};
type CachedFile = { key: string; data: string };
type Snapshot = {
    accountId: number;
    engineerId?: number | null;
    role: 'Engineer' | 'Viewer';
    canWrite: boolean;
    canSync: boolean;
    truncated: boolean;
    municipalities: {
        id: number;
        municipality_name: string;
        province?: string | null;
        region?: string | null;
        mayor_first_name?: string | null;
        mayor_middle_name?: string | null;
        mayor_last_name?: string | null;
    }[];
    lguAssignments?: {
        lgu_id: number;
        engineer_id: number;
        first_name: string;
        last_name: string;
        rank: string | null;
        is_active: boolean;
    }[];
    roads: Row[];
    projects: Row[];
    records: Row[];
    monthly?: Row[];
    documents?: Row[];
    documentEdit?: boolean;
    files?: FileReference[];
    fileSync?: boolean;
};
type Workspace = Snapshot & { csrfToken: string };
type State = {
    snapshot: Snapshot;
    pending: Change[];
    confirmed: Record<string, Receipt>;
    attachments: Attachment[];
    cachedFiles?: CachedFile[];
    cachedFileIndex?: { key: string; bytes: number }[];
    dashboard?: unknown;
};
type Encrypted = {
    salt: Uint8Array<ArrayBuffer>;
    iv: Uint8Array<ArrayBuffer>;
    bytes: ArrayBuffer;
};
const endpoint = '/workspace/ui/android-field';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const relation = {
    project: 'road_coverage_id',
    record: 'project_id',
    monthly: 'maintenance_id',
} as const;
const limit = 48 * 1024 * 1024; // Metadata and legacy inline attachments only.
export const fieldFileLimit = 20 * 1024 * 1024;
const fileLimit = fieldFileLimit;
const fallbackFileBudget = 256 * 1024 * 1024;
const maxFileBudget = 2 * 1024 * 1024 * 1024;
const storageReserve = 64 * 1024 * 1024;

async function fileBudget(used: number, pending: boolean) {
    try {
        const estimate = await navigator.storage?.estimate();
        if (estimate?.quota !== undefined && estimate.usage !== undefined) {
            const free = Math.max(0, estimate.quota - estimate.usage - storageReserve);
            return Math.min(maxFileBudget, used + Math.floor(free * (pending ? 0.8 : 0.5)));
        }
    } catch {
        // Older WebViews may not provide a storage estimate.
    }
    return fallbackFileBudget;
}
const encodedFileLimit = Math.ceil(fileLimit / 3) * 4 + 256;
const allowedFileTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
]);
const extensionTypes: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
};
export function attachmentMime(name: string) {
    return extensionTypes[name.split('.').pop()?.toLowerCase() ?? ''] ?? '';
}
function attachmentBlob(data: string, name: string): Blob {
    const comma = data.indexOf(',');
    const type = attachmentMime(name);

    if (
        !type ||
        comma < 0 ||
        !data.startsWith('data:') ||
        !data.slice(0, comma).endsWith(';base64') ||
        data.length > encodedFileLimit
    ) {
        throw new Error('The local attachment format is unavailable.');
    }

    const decoded = atob(data.slice(comma + 1));

    if (!decoded.length || decoded.length > fileLimit) {
        throw new Error('The local attachment is outside the supported size.');
    }

    const bytes = Uint8Array.from(decoded, (character) =>
        character.charCodeAt(0),
    );

    return new Blob([bytes], { type });
}
const fileKey = (file: FileReference) =>
    file.kind + ':' + file.id + ':' + file.version;
function validFileReference(value: FileReference) {
    return (
        value &&
        ['document', 'media'].includes(value.kind) &&
        Number.isSafeInteger(value.id) &&
        value.id > 0 &&
        Number.isSafeInteger(value.record) &&
        value.record > 0 &&
        typeof value.name === 'string' &&
        typeof value.title === 'string' &&
        typeof value.version === 'string' &&
        typeof value.available === 'boolean'
    );
}
export function pendingAttachment(file: Attachment) {
    return !file.receipt && !file.issue && Boolean(file.kind && file.parent);
}
async function readPrivateFile(file: FileReference) {
    const response = await fetch(
        '/workspace/files/' + file.kind + '/' + file.id,
        {
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(120000),
        },
    );
    const mime = (response.headers.get('content-type') || '')
        .split(';')[0]
        .trim();

    if (!response.ok || !allowedFileTypes.has(mime) || !response.body) {
        throw new Error('Private file unavailable.');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;

    try {
        while (true) {
            const { value, done } = await reader.read();

            if (done) {
                break;
            }

            size += value.byteLength;

            if (size > fileLimit) {
                throw new Error('File exceeds the offline size limit.');
            }

            chunks.push(new Uint8Array(value));
        }
    } finally {
        await reader.cancel().catch(() => {});
    }

    if (!size) {
        throw new Error('Empty file.');
    }

    return await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(new Blob(chunks, { type: mime }));
    });
}

export class RequestError extends Error {
    constructor(
        public readonly status: number,
        message = '',
    ) {
        super(message);
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(endpoint + path, {
        ...init,
        cache: 'no-store',
        credentials: 'same-origin',
        redirect: 'manual',
        signal: init.signal ?? AbortSignal.timeout(18000),
        headers: { Accept: 'application/json', ...init.headers },
    });
    const json = response.headers
        .get('content-type')
        ?.includes('application/json');

    if (response.type === 'opaqueredirect') {
        throw new RequestError(401);
    }

    if (!response.ok || !json) {
        const status = response.ok ? 502 : response.status;
        let message = '';

        if (json && [409, 422].includes(status)) {
            const data = await response.json();
            const errors = Object.values(data.errors ?? {}).flat();
            const detail = errors[0] ?? data.message;
            message = typeof detail === 'string' ? detail.slice(0, 250) : '';
        }

        throw new RequestError(status, message);
    }

    return (await response.json()) as T;
}

export async function loadWorkspace(): Promise<Workspace> {
    const data = await request<Workspace>('/workspace?profile=expanded', { signal: AbortSignal.timeout(45000) });

    if (
        !Number.isSafeInteger(data.accountId) ||
        !['Engineer', 'Viewer'].includes(data.role) ||
        typeof data.csrfToken !== 'string' ||
        !Array.isArray(data.records) ||
        !Array.isArray(data.roads) ||
        !Array.isArray(data.projects) ||
        !Array.isArray(data.municipalities)
    ) {
        throw new RequestError(502);
    }

    return data;
}

const database = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('jairoads-field', 1);
        open.onupgradeneeded = () =>
            open.result.createObjectStore('workspaces');
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
    });

async function storage(
    id: string,
    write?: Encrypted,
): Promise<Encrypted | undefined> {
    const db = await database();

    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(
                'workspaces',
                write ? 'readwrite' : 'readonly',
            );
            const store = tx.objectStore('workspaces');
            const operation = write ? store.put(write, id) : store.get(id);
            tx.oncomplete = () =>
                resolve(
                    write
                        ? undefined
                        : (operation.result as Encrypted | undefined),
                );
            tx.onabort = () =>
                reject(tx.error ?? new Error('Local database write failed.'));
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

async function removeStorage(id: string) {
    const db = await database();

    try {
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction('workspaces', 'readwrite');
            tx.objectStore('workspaces').delete(id);
            tx.oncomplete = () => resolve();
            tx.onabort = () =>
                reject(tx.error ?? new Error('Local cleanup failed.'));
            tx.onerror = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}
async function digest(text: string) {
    const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(text));

    return Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');
}

function snapshotOf(workspace: Workspace): Snapshot {
    return {
        accountId: workspace.accountId,
        engineerId: workspace.engineerId,
        role: workspace.role,
        canWrite: workspace.canWrite,
        canSync: workspace.canSync,
        truncated: workspace.truncated,
        municipalities: workspace.municipalities,
        lguAssignments: Array.isArray(workspace.lguAssignments)
            ? workspace.lguAssignments
            : [],
        roads: workspace.roads,
        projects: workspace.projects,
        records: workspace.records,
        monthly: Array.isArray(workspace.monthly) ? workspace.monthly : [],
        documentEdit: workspace.documentEdit === true,
        documents: Array.isArray(workspace.files) ? workspace.files.filter(file => validFileReference(file) && file.kind === 'document' && typeof file.rowVersion === 'string').map(file => ({ id: file.id, version: file.rowVersion, document_title: file.title, description: file.description ?? '' })) : [],
        files: Array.isArray(workspace.files)
            ? workspace.files.filter(validFileReference)
            : [],
        fileSync: workspace.fileSync === true,
    };
}

const tables = {
    road: 'roads',
    project: 'projects',
    record: 'records',
    monthly: 'monthly',
    document: 'documents',
} as const;

export class Vault {
    private writes: Promise<void> = Promise.resolve();

    private constructor(
        private readonly storageId: string,
        private readonly salt: Uint8Array<ArrayBuffer>,
        private readonly encrypt: CryptoKey,
        private readonly decrypt: CryptoKey,
        public state: State,
    ) {}

    private static async access(
        email: string,
        password: string,
        workspace?: Workspace,
    ) {
        const id = await digest(email);
        const prior = await storage(id);

        if (!prior && !workspace) {
            throw new Error('Sign in online on this phone first.');
        }

        const passphrase = await digest(JSON.stringify([email, password]));
        const salt = prior?.salt ?? crypto.getRandomValues(new Uint8Array(16));
        const encrypt = await keyFor(passphrase, salt, 'encrypt');

        const decrypt = await keyFor(passphrase, salt, 'decrypt');

        if (prior) {
            const clear = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: prior.iv,
                    additionalData: encoder.encode(id),
                },
                decrypt,
                prior.bytes,
            );
            const vault = new Vault(
                id,
                salt,
                encrypt,
                decrypt,
                JSON.parse(decoder.decode(clear)) as State,
            );

            if (workspace) {
                await vault.update(workspace);
            }

            return vault;
        }

        const state = {
            snapshot: snapshotOf(workspace!),
            pending: [],
            confirmed: {},
            attachments: [],
        };
        const vault = new Vault(id, salt, encrypt, decrypt, state);
        await vault.persist(state);

        return vault;
    }

    static prepare(email: string, password: string, workspace: Workspace) {
        return this.access(email, password, workspace);
    }

    static open(email: string, password: string) {
        return this.access(email, password);
    }

    private async persist(state: State) {
        const plain = encoder.encode(JSON.stringify(state));

        if (plain.byteLength > limit) {
            throw new Error(
                'This workspace is full. Free some local storage before adding work.',
            );
        }

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const bytes = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv,
                additionalData: encoder.encode(this.storageId),
            },
            this.encrypt,
            plain,
        );
        await storage(this.storageId, { salt: this.salt, iv, bytes });
        this.state = state;
    }

    private change(transform: (state: State) => State | Promise<State>) {
        const task = this.writes.then(async () => {
            const state = await transform(this.state);

            if (state !== this.state) {
                await this.persist(state);
            }
        });
        this.writes = task.catch(() => {});

        return task;
    }

    private assertIdentity(workspace: Workspace) {
        if (
            workspace.accountId !== this.state.snapshot.accountId ||
            workspace.role !== this.state.snapshot.role
        ) {
            throw new RequestError(403);
        }
    }

    private fileStorageKey(key: string) {
        return this.storageId + ':file:' + key;
    }
    private async storeFile(key: string, data: string) {
        const plain = encoder.encode(data);

        if (plain.byteLength > encodedFileLimit) {
            throw new Error('File exceeds the supported size.');
        }

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const id = this.fileStorageKey(key);
        const bytes = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv, additionalData: encoder.encode(id) },
            this.encrypt,
            plain,
        );
        await storage(id, { salt: this.salt, iv, bytes });

        return plain.byteLength;
    }
    private async readFile(key: string) {
        const id = this.fileStorageKey(key);
        const value = await storage(id);

        if (!value) {
            return undefined;
        }

        const clear = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: value.iv,
                additionalData: encoder.encode(id),
            },
            this.decrypt,
            value.bytes,
        );

        return decoder.decode(clear);
    }
    private async deleteFile(key: string) {
        await removeStorage(this.fileStorageKey(key));
    }
    private pendingSize(state: State) {
        return state.attachments.reduce(
            (sum, item) => sum + (item.storedBytes ?? item.data.length),
            0,
        );
    }
    async attachmentData(item: Attachment) {
        const current = this.state.attachments.find(
            (file) => file.id === item.id,
        );

        if (!current) {
            return undefined;
        }

        return current.storedBytes
            ? this.readFile('attachment:' + current.id)
            : current.data;
    }
    async update(workspace: Workspace) {
        this.assertIdentity(workspace);
        const dropped: string[] = [];
        await this.change((state) => {
            const snapshot = snapshotOf(workspace);
            const keys = new Set(
                (snapshot.files ?? [])
                    .filter((file) => file.available)
                    .map(fileKey),
            );
            dropped.push(
                ...(state.cachedFileIndex ?? [])
                    .filter((file) => !keys.has(file.key))
                    .map((file) => file.key),
            );

            return {
                ...state,
                snapshot,
                cachedFileIndex: (state.cachedFileIndex ?? []).filter((file) =>
                    keys.has(file.key),
                ),
                cachedFiles: (state.cachedFiles ?? []).filter((file) =>
                    keys.has(file.key),
                ),
            };
        });

        for (const key of dropped) {
            await this.deleteFile(key).catch(() => {});
        }
    }

    rows(kind: keyof typeof tables): Row[] {
        const rows = new Map(
            (this.state.snapshot[tables[kind]] ?? []).map((row) => [
                String(row.id),
                row,
            ]),
        );

        for (const change of this.state.pending) {
            if (change.kind === kind) {
                rows.set(change.entity, {
                    ...rows.get(change.entity),
                    ...change.fields,
                    id: change.entity,
                    version: change.version,
                });
            }
        }

        return [...rows.values()];
    }

    async cacheDashboard(page: unknown) {
        await this.change((state) => ({ ...state, dashboard: page }));
    }

    async save(
        kind: Kind,
        fields: Fields,
        row?: Row,
        photos: { name: string; data: string }[] = [],
    ) {
        let saved = '';
        const written: string[] = [];

        try {
            await this.change(async (state) => {
                if (!state.snapshot.canWrite) {
                    throw new Error('This workspace only allows viewing.');
                }

                if (kind === 'document' && (!row?.version || !state.snapshot.documentEdit)) {
                    throw new Error('Refresh this document online before editing.');
                }
                const resolved = row
                    ? state.confirmed[String(row.id)]
                    : undefined;
                const entity = String(
                    resolved?.id ?? row?.id ?? crypto.randomUUID(),
                );
                saved = entity;
                const existing = state.pending.find(
                    (entry) => entry.kind === kind && entry.entity === entity,
                );

                if (existing?.wire && !existing.issue) {
                    throw new Error(
                        'This change is waiting for a server receipt. Try again after it syncs.',
                    );
                }

                if (
                    kind === 'monthly' &&
                    state.pending.some(
                        (entry) =>
                            entry.kind === kind &&
                            entry.entity !== entity &&
                            entry.fields.maintenance_id ===
                                fields.maintenance_id &&
                            entry.fields.update_month === fields.update_month,
                    )
                ) {
                    throw new Error(
                        'A report for this record and month is already saved on this phone.',
                    );
                }

                const change = {
                    operation: crypto.randomUUID(),
                    kind,
                    fields,
                    entity,
                    version: resolved?.version ?? row?.version,
                };
                const pending = existing
                    ? state.pending.map((entry) =>
                          entry === existing ? change : entry,
                      )
                    : [...state.pending, change];

                const attachments = [...state.attachments];

                if (photos.length && kind === 'monthly') {
                    if (
                        this.pendingSize(state) +
                            photos.reduce(
                                (sum, photo) => sum + photo.data.length,
                                0,
                            ) >
                        (await fileBudget(this.pendingSize(state), true))
                    ) {
                        throw new Error(
                            'Local attachment storage is full. Synchronize saved work first.',
                        );
                    }

                    for (const photo of photos) {
                        attachmentBlob(photo.data, photo.name);
                        const id = crypto.randomUUID(),
                            key = 'attachment:' + id;
                        const storedBytes = await this.storeFile(
                            key,
                            photo.data,
                        );
                        written.push(key);
                        attachments.push({
                            id,
                            record: fields.maintenance_id,
                            name: photo.name,
                            description: '',
                            data: '',
                            storedBytes,
                            kind: 'media',
                            parent: entity,
                            title: photo.name,
                        });
                    }
                }

                return { ...state, pending, attachments };
            });
        } catch (error) {
            for (const key of written) {
                await this.deleteFile(key).catch(() => {});
            }

            throw error;
        }

        return saved;
    }

    async attach(
        record: string,
        name: string,
        description: string,
        data: string,
        kind: 'document' | 'media',
        parent: string,
        title: string,
    ) {
        const id = crypto.randomUUID(),
            key = 'attachment:' + id;
        let written = false;

        try {
            await this.change(async (state) => {
                if (!state.snapshot.canWrite) {
                    throw new Error('This workspace only allows viewing.');
                }

                attachmentBlob(data, name);

                if (this.pendingSize(state) + data.length > (await fileBudget(this.pendingSize(state), true))) {
                    throw new Error(
                        'Local attachment storage is full. Synchronize saved work first.',
                    );
                }

                const storedBytes = await this.storeFile(key, data);
                written = true;

                return {
                    ...state,
                    attachments: [
                        ...state.attachments,
                        {
                            id,
                            record,
                            name,
                            description,
                            data: '',
                            storedBytes,
                            kind,
                            parent,
                            title,
                        },
                    ],
                };
            });
        } catch (error) {
            if (written) {
                await this.deleteFile(key).catch(() => {});
            }

            throw error;
        }

        return id;
    }

    fileAvailable(file: FileReference) {
        return (
            file.available &&
            Boolean(
                this.state.cachedFileIndex?.some(
                    (entry) => entry.key === fileKey(file),
                ) ||
                this.state.cachedFiles?.some(
                    (entry) => entry.key === fileKey(file),
                ),
            )
        );
    }
    async fileData(file: FileReference) {
        if (!this.fileAvailable(file)) {
            return undefined;
        }

        return (
            this.state.cachedFiles?.find((entry) => entry.key === fileKey(file))
                ?.data ?? (await this.readFile(fileKey(file)))
        );
    }
    private fileDownloads = new Map<string, Promise<void>>();
    async cacheFile(file: FileReference) {
        if (!file.available || this.fileAvailable(file)) {
            return;
        }

        const key = fileKey(file);
        const running = this.fileDownloads.get(key);

        if (running) {
            return running;
        }

        const task = (async () => {
            const data = await readPrivateFile(file);
            let written = false;

            try {
                await this.change(async (state) => {
                    if (
                        !(state.snapshot.files ?? []).some(
                            (entry) =>
                                entry.available && fileKey(entry) === key,
                        )
                    ) {
                        return state;
                    }

                    const current = state.cachedFileIndex ?? [];

                    if (current.some((entry) => entry.key === key)) {
                        return state;
                    }

                    const used =
                        current.reduce((sum, entry) => sum + entry.bytes, 0) +
                        (state.cachedFiles ?? []).reduce(
                            (sum, entry) => sum + entry.data.length,
                            0,
                        );

                    if (used + data.length > await fileBudget(used, false)) {
                        throw new Error(
                            'Offline file cache is full. Existing files were retained.',
                        );
                    }

                    const bytes = await this.storeFile(key, data);
                    written = true;

                    return {
                        ...state,
                        cachedFileIndex: [...current, { key, bytes }],
                    };
                });
            } catch (error) {
                if (written) {
                    await this.deleteFile(key).catch(() => {});
                }

                throw error;
            }
        })();
        this.fileDownloads.set(key, task);

        try {
            await task;
        } finally {
            this.fileDownloads.delete(key);
        }
    }
    private fileRetry = new Map<string, number>();
    async prepareFiles(
        workspace: Workspace,
        shouldContinue: () => boolean,
        onProgress: () => void = () => {},
    ) {
        this.assertIdentity(workspace);

        for (const file of this.state.snapshot.files ?? []) {
            if (!shouldContinue()) {
                return;
            }

            if (
                !file.available ||
                this.fileAvailable(file) ||
                (this.fileRetry.get(fileKey(file)) ?? 0) > Date.now()
            ) {
                continue;
            }

            try {
                await this.cacheFile(file);
                onProgress();
            } catch {
                this.fileRetry.set(fileKey(file), Date.now() + 5 * 60 * 1000);
            }
        }

        if (!shouldContinue()) {
            return;
        }

        const retired: Attachment[] = [];
        await this.change((state) => {
            const remaining = state.attachments.filter((item) => {
                if (!item.receipt) {
                    return true;
                }

                const confirmed = state.snapshot.files?.find(
                    (file) =>
                        file.kind === (item.kind ?? 'document') &&
                        file.id === item.receipt?.id,
                );

                if (!confirmed || !this.fileAvailable(confirmed)) {
                    return true;
                }

                retired.push(item);

                return false;
            });

            return retired.length
                ? { ...state, attachments: remaining }
                : state;
        });

        for (const item of retired) {
            if (item.storedBytes) {
                await this.deleteFile('attachment:' + item.id).catch(() => {});
            }
        }

        onProgress();
    }

    async syncAttachments(workspace: Workspace) {
        this.assertIdentity(workspace);

        if (!workspace.fileSync) {
            return;
        }

        if (!workspace.canWrite || !workspace.canSync) {
            throw new RequestError(503);
        }

        for (const item of this.state.attachments.filter(pendingAttachment)) {
            const parent = item.parent!;
            const id = /^[1-9]\d*$/.test(parent)
                ? Number(parent)
                : this.state.confirmed[parent]?.id;

            if (!id) {
                continue;
            }

            const kind = item.kind!;
            // Decoding data URLs locally avoids a fetch blocked by the shell CSP.
            let blob: Blob;

            try {
                blob = attachmentBlob(
                    (await this.attachmentData(item)) ?? '',
                    item.name,
                );
            } catch {
                await this.change((state) => ({
                    ...state,
                    attachments: state.attachments.map((file) =>
                        file.id === item.id
                            ? {
                                  ...file,
                                  issue: 'Local file format needs review; original bytes retained.',
                              }
                            : file,
                    ),
                }));
                continue;
            }

            const payload = new FormData();
            payload.set('account_id', String(workspace.accountId));
            payload.set('operation_id', item.id);
            payload.set('kind', kind);
            payload.set('parent_id', String(id));
            payload.set(
                'document_title',
                item.title || item.name.slice(0, 255),
            );
            payload.set('description', item.description);
            payload.set('file', blob, item.name);
            let receipt: Receipt;

            try {
                receipt = await request<Receipt>('/attachments', {
                    method: 'POST',
                    headers: { 'X-CSRF-TOKEN': workspace.csrfToken },
                    body: payload,
                    signal: AbortSignal.timeout(180000),
                });
            } catch (error) {
                if (
                    error instanceof RequestError &&
                    [403, 409, 422].includes(error.status)
                ) {
                    await this.change((state) => ({
                        ...state,
                        attachments: state.attachments.map((file) =>
                            file.id === item.id
                                ? {
                                      ...file,
                                      issue:
                                          error.message ||
                                          'Server validation or authorization needs review. Local file retained.',
                                  }
                                : file,
                        ),
                    }));
                    continue;
                }

                throw error;
            }

            if (
                receipt.operationId !== item.id ||
                !Number.isSafeInteger(receipt.id) ||
                receipt.id < 1 ||
                typeof receipt.version !== 'string'
            ) {
                throw new RequestError(502);
            }

            await this.change((state) => ({
                ...state,
                attachments: state.attachments.map((file) =>
                    file.id === item.id ? { ...file, receipt } : file,
                ),
            }));
        }
    }

    private wire(change: Change): Wire | null {
        const fields = { ...change.fields };
        const name = change.kind === 'road' || change.kind === 'document' ? null : relation[change.kind];

        if (name && !/^\d+$/.test(fields[name])) {
            const parent = this.state.confirmed[fields[name]];

            if (!parent) {
                return null;
            }

            fields[name] = String(parent.id);
        }

        const id = /^\d+$/.test(change.entity)
            ? Number(change.entity)
            : undefined;

        return {
            account_id: this.state.snapshot.accountId,
            operation_id: change.operation,
            kind: change.kind,
            id,
            version: id ? change.version : undefined,
            fields,
        };
    }

    async sync(workspace: Workspace) {
        this.assertIdentity(workspace);

        if (!workspace.canWrite || !workspace.canSync) {
            throw new RequestError(503);
        }

        for (const item of this.state.pending) {
            if (item.issue) {
                continue;
            }

            const wire = item.wire ?? this.wire(item);

            if (!wire) {
                continue;
            }

            let current = false;
            const replace = (patch: Partial<Change>) =>
                this.change((state) => {
                    current = state.pending.some(
                        (entry) => entry.operation === item.operation,
                    );

                    return current
                        ? {
                              ...state,
                              pending: state.pending.map((entry) =>
                                  entry.operation === item.operation
                                      ? { ...entry, ...patch }
                                      : entry,
                              ),
                          }
                        : state;
                });

            if (!item.wire) {
                await replace({ wire });

                if (!current) {
                    continue;
                }
            }

            let receipt: Receipt;

            try {
                receipt = await request<Receipt>('/operations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': workspace.csrfToken,
                    },
                    body: JSON.stringify(wire),
                });
            } catch (error) {
                if (
                    error instanceof RequestError &&
                    [403, 404, 409, 422].includes(error.status)
                ) {
                    await replace({
                        issue:
                            error.message ||
                            'The server could not authorize or validate this change.',
                    });
                    continue;
                }

                throw error;
            }

            if (
                receipt.operationId !== item.operation ||
                !Number.isSafeInteger(receipt.id) ||
                receipt.id < 1 ||
                typeof receipt.version !== 'string'
            ) {
                throw new RequestError(502);
            }

            await this.change((state) => {
                const snapshot = { ...state.snapshot };

                {
                    const table = tables[item.kind];
                    const old = (snapshot[table] ?? []).find(
                        (row) => row.id === receipt.id,
                    );
                    const fields = { ...wire.fields };
                    const geometry = fields.geojson;
                    delete fields.geojson;
                    snapshot[table] = [
                        ...(snapshot[table] ?? []).filter(
                            (row) => row.id !== receipt.id,
                        ),
                        {
                            ...old,
                            ...fields,
                            ...(geometry
                                ? { geojson: JSON.parse(geometry) }
                                : {}),
                            id: receipt.id,
                            version: receipt.version,
                        },
                    ];
                }

                if (item.kind === 'document') {
                    snapshot.files = (snapshot.files ?? []).map(file => file.kind === 'document' && file.id === receipt.id ? { ...file, title: wire.fields.document_title, description: wire.fields.description, rowVersion: receipt.version } : file);
                }
                return {
                    ...state,
                    snapshot,
                    pending: state.pending.filter(
                        (entry) => entry.operation !== item.operation,
                    ),
                    attachments:
                        item.kind === 'record'
                            ? state.attachments.map((file) =>
                                  file.record === item.entity
                                      ? {
                                            ...file,
                                            record: String(receipt.id),
                                            parent:
                                                file.kind === 'document'
                                                    ? String(receipt.id)
                                                    : file.parent,
                                        }
                                      : file,
                              )
                            : state.attachments,
                    confirmed: /^\d+$/.test(item.entity)
                        ? state.confirmed
                        : { ...state.confirmed, [item.entity]: receipt },
                };
            });
        }
    }
}

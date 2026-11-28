import { keyFor } from '../../../resources/js/lib/encrypted-field-draft.mjs';

export type Kind = 'road' | 'project' | 'record' | 'monthly';
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
    available: boolean;
};
type CachedFile = { key: string; data: string };
type Snapshot = {
    accountId: number;
    role: 'Engineer' | 'Viewer';
    canWrite: boolean;
    canSync: boolean;
    truncated: boolean;
    municipalities: { id: number; municipality_name: string }[];
    roads: Row[];
    projects: Row[];
    records: Row[];
    monthly?: Row[];
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
const limit = 24 * 1024 * 1024;
const fileLimit = 4 * 1024 * 1024;
const cacheBudget = 8 * 1024 * 1024; // Encoded bytes; leave capacity for pending work.
const allowedFileTypes = new Set([
    'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp',
]);
const fileKey = (file: FileReference) => file.kind + ':' + file.id + ':' + file.version;
function validFileReference(value: FileReference) {
    return value && ['document', 'media'].includes(value.kind) &&
        Number.isSafeInteger(value.id) && value.id > 0 &&
        Number.isSafeInteger(value.record) && value.record > 0 &&
        typeof value.name === 'string' && typeof value.title === 'string' &&
        typeof value.version === 'string' && typeof value.available === 'boolean';
}
export function pendingAttachment(file: Attachment) {
    return !file.receipt && !file.issue && Boolean(file.kind && file.parent);
}
async function readPrivateFile(file: FileReference) {
    const response = await fetch('/workspace/files/' + file.kind + '/' + file.id, {
        credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        signal: AbortSignal.timeout(20000),
    });
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim();
    if (!response.ok || !allowedFileTypes.has(mime) || !response.body) throw new Error('Private file unavailable.');
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > fileLimit) throw new Error('File exceeds the offline size limit.');
            chunks.push(new Uint8Array(value));
        }
    } finally {
        await reader.cancel().catch(() => {});
    }
    if (!size) throw new Error('Empty file.');
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
    const data = await request<Workspace>('/workspace');

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

async function digest(text: string) {
    const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(text));

    return Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');
}

function snapshotOf(workspace: Workspace): Snapshot {
    return {
        accountId: workspace.accountId,
        role: workspace.role,
        canWrite: workspace.canWrite,
        canSync: workspace.canSync,
        truncated: workspace.truncated,
        municipalities: workspace.municipalities,
        roads: workspace.roads,
        projects: workspace.projects,
        records: workspace.records,
        monthly: Array.isArray(workspace.monthly) ? workspace.monthly : [],
        files: Array.isArray(workspace.files) ? workspace.files.filter(validFileReference) : [],
        fileSync: workspace.fileSync === true,
    };
}

const tables = {
    road: 'roads',
    project: 'projects',
    record: 'records',
    monthly: 'monthly',
} as const;

export class Vault {
    private writes: Promise<void> = Promise.resolve();

    private constructor(
        private readonly storageId: string,
        private readonly salt: Uint8Array<ArrayBuffer>,
        private readonly encrypt: CryptoKey,
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

        if (prior) {
            const decrypt = await keyFor(passphrase, salt, 'decrypt');
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
        const vault = new Vault(id, salt, encrypt, state);
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

    private change(transform: (state: State) => State) {
        const task = this.writes.then(async () => {
            const state = transform(this.state);

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

    async update(workspace: Workspace) {
        this.assertIdentity(workspace);
        await this.change((state) => {
            const snapshot = snapshotOf(workspace);
            const keys = new Set((snapshot.files ?? []).filter((file) => file.available).map(fileKey));
            return { ...state, snapshot, cachedFiles: (state.cachedFiles ?? []).filter((file) => keys.has(file.key)) };
        });
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

    async save(kind: Kind, fields: Fields, row?: Row) {
        await this.change((state) => {
            if (!state.snapshot.canWrite) {
                throw new Error('This workspace only allows viewing.');
            }

            const resolved = row ? state.confirmed[String(row.id)] : undefined;
            const entity = String(
                resolved?.id ?? row?.id ?? crypto.randomUUID(),
            );
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
                        entry.fields.maintenance_id === fields.maintenance_id &&
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

            return { ...state, pending };
        });
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
        await this.change((state) => {
            if (!state.snapshot.canWrite) {
                throw new Error('This workspace only allows viewing.');
            }

            return {
                ...state,
                attachments: [
                    ...state.attachments,
                    {
                        id: crypto.randomUUID(),
                        record,
                        name,
                        description,
                        data,
                        kind,
                        parent,
                        title,
                    },
                ],
            };
        });
    }

    fileData(file: FileReference) {
        return this.state.cachedFiles?.find((entry) => entry.key === fileKey(file))?.data;
    }

    async cacheFile(file: FileReference) {
        if (!file.available || this.fileData(file)) return;
        const data = await readPrivateFile(file);
        await this.change((state) => {
            if (!(state.snapshot.files ?? []).some((entry) => entry.available && fileKey(entry) === fileKey(file))) return state;
            const current = (state.cachedFiles ?? []).filter((entry) => entry.key !== fileKey(file));
            const cachedFiles = [...current, { key: fileKey(file), data }];
            while (cachedFiles.reduce((total, entry) => total + entry.data.length, 0) > cacheBudget) cachedFiles.shift();
            if (!cachedFiles.some((entry) => entry.key === fileKey(file))) return state;
            return { ...state, cachedFiles };
        });
    }

    // Automatically prepare small authorized files without delaying dashboard login.
    async prepareFiles(workspace: Workspace, shouldContinue: () => boolean) {
        this.assertIdentity(workspace);
        for (const file of (this.state.snapshot.files ?? []).slice(0, 8)) {
            if (!shouldContinue()) return;
            if (!file.available || this.fileData(file)) continue;
            // Don't churn the bounded cache or crowd out encrypted pending work.
            const used = (this.state.cachedFiles ?? []).reduce((sum, entry) => sum + entry.data.length, 0);
            if (used >= cacheBudget / 2) break;
            try { await this.cacheFile(file); } catch { /* Unavailable or oversized: directory shows no local copy. */ }
        }
    }

    async syncAttachments(workspace: Workspace) {
        this.assertIdentity(workspace);
        if (!workspace.fileSync) return;
        if (!workspace.canWrite || !workspace.canSync) throw new RequestError(503);
        for (const item of this.state.attachments.filter(pendingAttachment)) {
            const parent = item.parent!;
            const id = /^[1-9]\d*$/.test(parent) ? Number(parent) : this.state.confirmed[parent]?.id;
            if (!id) continue;
            const kind = item.kind!;
            const blob = await (await fetch(item.data)).blob();
            if (blob.size > fileLimit || !blob.size) continue;
            const payload = new FormData();
            payload.set('account_id', String(workspace.accountId));
            payload.set('operation_id', item.id);
            payload.set('kind', kind);
            payload.set('parent_id', String(id));
            payload.set('document_title', item.title || item.name.slice(0, 255));
            payload.set('description', item.description);
            payload.set('file', blob, item.name);
            let receipt: Receipt;
            try {
                receipt = await request<Receipt>('/attachments', {
                    method: 'POST',
                    headers: { 'X-CSRF-TOKEN': workspace.csrfToken },
                    body: payload,
                    signal: AbortSignal.timeout(60000),
                });
            } catch (error) {
                if (error instanceof RequestError && [403, 409, 422].includes(error.status)) {
                    await this.change((state) => ({
                        ...state,
                        attachments: state.attachments.map((file) => file.id === item.id
                            ? { ...file, issue: error.message || 'Server validation or authorization needs review. Local file retained.' } : file),
                    }));
                    continue;
                }
                throw error;
            }
            if (receipt.operationId !== item.id || !Number.isSafeInteger(receipt.id) ||
                receipt.id < 1 || typeof receipt.version !== 'string') throw new RequestError(502);
            await this.change((state) => ({
                ...state,
                attachments: state.attachments.map((file) => file.id === item.id ? { ...file, receipt } : file),
            }));
        }
    }

    private wire(change: Change): Wire | null {
        const fields = { ...change.fields };
        const name = change.kind === 'road' ? null : relation[change.kind];

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
                                      ? { ...file, record: String(receipt.id), parent: file.kind === 'document' ? String(receipt.id) : file.parent }
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

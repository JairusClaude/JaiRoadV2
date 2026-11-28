import '../../../resources/css/jairoads-role-components.css';
import { labels, renderFields, titleFor, validateFields } from './field-forms';
import type { Tab } from './field-forms';
import { loadWorkspace, RequestError } from './queue';
import type { Fields, Row, Vault } from './queue';
import './style.css';

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
const form = el<HTMLFormElement>('field-form');
const field = el('field-reports');
const editor = el('field-editor');
const directory = el('field-directory');
const discard = el<HTMLDialogElement>('discard-field-dialog');
const banner = el('field-banner');
let vault: Vault;
let tab: Tab = 'project';
let editing: Row | undefined;
let dirty = false;
let busy = false;
let checking = false;
let reachable = false;
let savedLocally = false;
let synced = false;
let hideSync: number;

function note(text: string, target = 'field-message') {
    const message = el(target);
    message.textContent = text;
    message.hidden = !text;
}

function showStatus() {
    const { pending } = vault.state;
    const message = !navigator.onLine
        ? savedLocally
            ? 'Offline Mode — Changes saved locally'
            : 'Offline Mode — Working locally'
        : checking && pending.length
          ? 'Connection restored — Synchronizing'
          : !reachable
            ? 'Server unavailable — Working locally'
            : pending.length
              ? 'Pending synchronization'
              : synced
                ? 'All changes synced'
                : '';
    banner.hidden = !message;
    field.classList.toggle('has-field-banner', Boolean(message));
    el('field-banner-text').textContent = message;
    el('field-wifi-off').hidden = navigator.onLine;
    el('online-dashboard').hidden =
        !reachable || !navigator.onLine || !editor.hidden;
}

function action(label: string, click: () => void) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary';
    button.textContent = label;
    button.addEventListener('click', click);

    return button;
}

function item(title: string, detail = '') {
    const row = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = title;
    row.append(name);

    if (detail) {
        const text = document.createElement('p');
        text.textContent = detail;
        row.append(text);
    }

    return row;
}

function renderDirectory() {
    const { snapshot, pending, attachments } = vault.state;
    el('directory-title').textContent = labels[tab][0];
    const create = el<HTMLButtonElement>('new-field-item');
    create.hidden = !snapshot.canWrite;
    create.textContent = 'Add ' + labels[tab][1];

    for (const button of document.querySelectorAll<HTMLButtonElement>(
        '#field-tabs [data-tab]',
    )) {
        button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
    }

    let rows: HTMLLIElement[];

    if (tab === 'files') {
        rows = attachments.map((attachment) => {
            const entry = item(
                attachment.name,
                'Saved locally · ' +
                    (attachment.description || 'Available on this device'),
            );
            const file = document.createElement('a');
            file.href = attachment.data;
            file.download = attachment.name;
            file.textContent = 'Download local copy';
            entry.append(file);

            return entry;
        });
    } else if (tab === 'monthly') {
        rows = pending
            .filter(({ kind }) => kind === 'monthly')
            .map((change) =>
                item(
                    titleFor('monthly', change.fields),
                    change.issue || 'Pending synchronization',
                ),
            );
    } else {
        const kind = tab;
        rows = vault.rows(kind).map((row) => {
            const pendingEdit = pending.find(
                (change) =>
                    change.kind === kind && change.entity === String(row.id),
            );
            const reference =
                kind === 'road'
                    ? `${row.pavement_type} · ${row.kilometers} km · ${row.state_category}`
                    : kind === 'record'
                      ? String(row.status)
                      : String(row.description ?? '');
            const entry = item(
                titleFor(kind, row),
                pendingEdit
                    ? (pendingEdit.issue ??
                          'Saved locally · Pending synchronization')
                    : reference,
            );

            if (snapshot.canWrite) {
                const edit = action('Edit ' + labels[kind][1], () =>
                    openEditor(row),
                );
                edit.disabled = Boolean(
                    pendingEdit?.wire && !pendingEdit.issue,
                );
                entry.append(edit);
            }

            return entry;
        });
    }

    el('field-items').replaceChildren(
        ...(rows.length
            ? rows
            : [
                  item(
                      'No ' + labels[tab][0].toLowerCase() + ' saved here yet.',
                  ),
              ]),
    );
    el('field-outbox').hidden = pending.length === 0;
    el('field-pending').replaceChildren(
        ...pending.map((change) => {
            const detail =
                change.issue ||
                'Waiting for the server or a related record to sync.';

            return item(titleFor(change.kind, change.fields), detail);
        }),
    );
    showStatus();
}

function openEditor(row?: Row) {
    if (busy) {
        return;
    }

    editing = row;
    dirty = false;
    el('editor-title').textContent = (row ? 'Edit ' : 'Add ') + labels[tab][1];
    const inputs = el('field-inputs');
    inputs.replaceChildren();
    renderFields(inputs, vault, tab, row);
    note('', 'field-error');
    editor.hidden = false;
    directory.hidden = true;
    showStatus();
    inputs
        .querySelector<HTMLElement>(
            'input:not([type=hidden]), select, textarea',
        )
        ?.focus();
}

function closeEditor() {
    editing = undefined;
    dirty = false;
    form.reset();
    editor.hidden = true;
    directory.hidden = false;
    renderDirectory();
}

function leave(then: () => void) {
    if (busy) {
        return;
    }

    if (!dirty) {
        then();

        return;
    }

    discard.returnValue = 'keep';
    discard.addEventListener(
        'close',
        () => {
            if (discard.returnValue === 'discard') {
                then();
            }
        },
        { once: true },
    );
    discard.showModal();
}

function getFile(file: File) {
    if (
        !file.size ||
        file.size > 4 * 1024 * 1024 ||
        !/\.(jpe?g|png|webp|pdf|docx|xlsx|pptx)$/i.test(file.name)
    ) {
        throw new Error('Choose a supported photo or document up to 4 MB.');
    }

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(file);
    });
}

async function refresh() {
    if (busy || checking || !navigator.onLine || document.hidden) {
        showStatus();

        return;
    }

    const hadChanges = vault.state.pending.some(({ issue }) => !issue);
    checking = true;
    showStatus();

    try {
        const workspace = await loadWorkspace();
        reachable = true;

        if (
            workspace.accountId !== vault.state.snapshot.accountId ||
            workspace.role !== vault.state.snapshot.role
        ) {
            throw new RequestError(401);
        }

        if (hadChanges) {
            await vault.sync(workspace);
        }

        // Keep locally acknowledged rows until the next normal sign-in refresh.
        // A bounded server snapshot can omit an item just saved in the field.
        synced = hadChanges && vault.state.pending.length === 0;

        if (synced) {
            clearTimeout(hideSync);
            hideSync = window.setTimeout(() => {
                synced = false;
                showStatus();
            }, 3500);
        }

        if (editor.hidden) {
            note('');
        }
    } catch (error) {
        const status = error instanceof RequestError ? error.status : 0;
        reachable = status >= 400 && status < 500;

        if (status === 401 || status === 419) {
            note(
                'Your online session expired. Sign in again when connected to sync. Your local work is still saved.',
            );
        } else if (status === 403) {
            note(
                'The server could not authorize synchronization. Local changes are still saved.',
            );
        } else if (status === 429) {
            note(
                'Synchronization will retry shortly. Local changes are still saved.',
            );
        } else if (navigator.onLine) {
            note(
                status >= 500
                    ? 'JaiROADS could not complete synchronization. Local changes are still saved.'
                    : 'Could not reach JaiROADS. Local changes are still saved.',
            );
        }
    } finally {
        checking = false;
        renderDirectory();
    }
}

form.addEventListener('input', () => {
    dirty = true;
});
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (busy) {
        return;
    }

    busy = true;

    try {
        const data = new FormData(form);

        if (tab === 'files') {
            const file = data.get('attachment');

            if (!(file instanceof File)) {
                throw new Error('Choose a photo or document first.');
            }

            await vault.attach(
                String(data.get('maintenance_id')),
                file.name,
                String(data.get('description')),
                await getFile(file),
            );
            note(
                'File saved locally. Upload through the online workspace when connected.',
            );
        } else {
            const values = Object.fromEntries(data) as Fields;
            validateFields(tab, values, editing);
            await vault.save(tab, values, editing);
            note(
                'Saved locally. Changes will sync when JaiROADS is available.',
            );
        }

        savedLocally = true;
        closeEditor();
    } catch (error) {
        note(
            error instanceof Error
                ? error.message
                : 'Could not save locally. Your entries are still here.',
            'field-error',
        );
    } finally {
        busy = false;
    }

    void refresh();
});
el('field-tabs').addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        'button[data-tab]',
    );

    if (button) {
        leave(() => {
            tab = button.dataset.tab as Tab;
            closeEditor();
        });
    }
});
el('new-field-item').addEventListener('click', () => openEditor());
el('cancel-edit').addEventListener('click', () => leave(closeEditor));
el('lock').addEventListener('click', () => leave(() => location.reload()));
window.addEventListener('jairoads-back', (event) => {
    if (discard.open) {
        event.preventDefault();
        discard.close('keep');
    } else if (!editor.hidden || busy || checking) {
        event.preventDefault();
        leave(closeEditor);
    }
});
window.addEventListener('offline', () => {
    reachable = false;
    showStatus();
});
window.addEventListener('online', () => void refresh());
window.addEventListener('jairoads-resume', () => void refresh());
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        void refresh();
    }
});

export function openFieldReports(workspace: Vault, offlineSignIn: boolean) {
    vault = workspace;
    reachable = !offlineSignIn;
    history.replaceState(null, '', '#field-reports');
    el('sign-in-screen').hidden = true;
    document.body.classList.add('field-reports-open');
    field.classList.add(
        vault.state.snapshot.role === 'Engineer'
            ? 'jr-engineer-workspace'
            : 'jr-viewer-workspace',
    );
    el('workspace-role').textContent = vault.state.snapshot.role + ' workspace';
    field.hidden = false;
    renderDirectory();
    field.focus({ preventScroll: true });

    if (vault.state.snapshot.truncated) {
        note(
            'Recent assigned work is available offline. Older records are available in the online dashboard.',
        );
    }

    void refresh();
    window.setInterval(() => void refresh(), 30_000);
}

import '../../../resources/css/jairoads-role-components.css';
import { labels, renderFields, titleFor, validateFields } from './field-forms';
import type { Tab } from './field-forms';
import { hostMode } from './host-mode';
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
const menu = el<HTMLDialogElement>('field-menu');
const opening = el('open-dashboard-status');
const banner = el('field-banner');
let vault: Vault;
let tab: Tab = 'project';
let home = true;
let visibleLocally = false;
let nativeLink: boolean | undefined;
let ready = false;
const connected = () => nativeLink ?? navigator.onLine;
const systemDark = matchMedia('(prefers-color-scheme: dark)');

function applyWorkspaceAppearance() {
    let appearance = 'light';
    try { appearance = localStorage.getItem('appearance') ?? 'light'; } catch { /* Use default. */ }
    const dark = appearance === 'dark' || (appearance === 'system' && systemDark.matches);
    field.dataset.appearance = dark ? 'dark' : 'light';
    field.style.colorScheme = dark ? 'dark' : 'light';
}
systemDark.addEventListener('change', applyWorkspaceAppearance);
window.addEventListener('storage', (event) => {
    if (event.key === 'appearance' || event.key === null) applyWorkspaceAppearance();
});
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
    const message = !connected()
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
    el('field-wifi-off').hidden = connected() && reachable;
    el('online-dashboard').hidden =
        !reachable || !connected() || !editor.hidden || !visibleLocally;
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
    el('workspace-page-title').textContent = editor.hidden
        ? (home ? 'Dashboard' : labels[tab][0])
        : el('editor-title').textContent;
    el('field-home').hidden = !home || !editor.hidden;
    directory.hidden = home || !editor.hidden;

    for (const kind of ['project', 'record', 'road'] as const) {
        el(kind + '-count').textContent = String(vault.rows(kind).length);
    }

    if (vault.state.snapshot.truncated && home && el('field-message').hidden) {
        note('Only your most recent assigned records are available offline.');
    }

    const create = el<HTMLButtonElement>('new-field-item');
    create.hidden = !snapshot.canWrite;
    create.textContent = 'Add ' + labels[tab][1];

    for (const button of document.querySelectorAll<HTMLButtonElement>(
        '#field-tabs [data-tab]',
    )) {
        button.setAttribute(
            'aria-pressed',
            String(button.dataset.tab === (home ? 'home' : tab)),
        );
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
    el('workspace-page-title').textContent = el('editor-title').textContent;
    el('field-home').hidden = true;
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

function presentLocal(path = '') {
    if (!ready) {
        return;
    }

    const focus = !visibleLocally;

    if (focus) {
        const page = (
            {
                'maintenance-projects': 'project',
                'maintenance-records': 'record',
                'road-coverages': 'road',
                'monthly-updates': 'monthly',
                'maintenance-documents': 'files',
            } as Record<string, Tab>
        )[path.replace(/^\/workspace\/ui\//, '').split('/')[0]];

        if (page) {
            home = false;
            tab = page;
        }
    }

    visibleLocally = true;
    applyWorkspaceAppearance();
    opening.hidden = true;
    field.hidden = false;
    renderDirectory();

    if (focus) {
        field.focus({ preventScroll: true });
    }
}

function goOnline(allowPending = false) {
    if (
        !connected() ||
        !reachable ||
        !editor.hidden ||
        menu.open ||
        busy ||
        (!allowPending && vault.state.pending.length)
    ) {
        return;
    }

    if (!hostMode('show-online')) {
        location.replace('/dashboard');
    }
}

function showCachedWorkspace() {
    hostMode('show-local');
    presentLocal();
}

async function refresh() {
    if (!ready) {
        return;
    }

    if (busy || checking || !connected()) {
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
        } else if (!visibleLocally && !vault.state.pending.length) {
            await vault.update(workspace);
        }

        // Keep locally acknowledged rows until the next normal sign-in refresh.
        // A bounded server snapshot can omit an item just saved in the field.
        synced = hadChanges && vault.state.pending.length === 0;

        if (synced) {
            clearTimeout(hideSync);
            hideSync = window.setTimeout(() => {
                synced = false;
                showStatus();
                goOnline();
            }, 1700);
        }

        if (editor.hidden) {
            note('');
        }

        if (visibleLocally && !synced) {
            goOnline();
        }
    } catch (error) {
        const status = error instanceof RequestError ? error.status : 0;
        reachable = status === 429;

        // A failed background snapshot/sync request is not proof that the
        // already-open hosted dashboard is offline. Native link loss and main
        // frame failures are handled separately; never replace a healthy page.
        if (!connected()) {
            showCachedWorkspace();
        }

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
        } else if (connected()) {
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
function selectPage(page: Tab | 'home') {
    leave(() => {
        home = page === 'home';

        if (page !== 'home') {
            tab = page;
        }

        if (menu.open) {
            menu.close();
        }

        closeEditor();
    });
}

el('field-menu-open').addEventListener('click', () => menu.showModal());
el('field-menu-close').addEventListener('click', () => menu.close());
el('field-tabs').addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        'button[data-tab]',
    );

    if (button) {
        selectPage(button.dataset.tab as Tab | 'home');
    }
});
el('field-home').addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        'button[data-cached-page]',
    );

    if (button) {
        selectPage(button.dataset.cachedPage as Tab);
    }
});
el('new-field-item').addEventListener('click', () => openEditor());
el('cancel-edit').addEventListener('click', () => leave(closeEditor));
el('online-dashboard').addEventListener('click', () => goOnline(true));
el('lock').addEventListener('click', () =>
    leave(() => {
        hostMode('lock');
        location.reload();
    }),
);
window.addEventListener('jairoads-back', (event) => {
    if (menu.open) {
        event.preventDefault();
        menu.close();
    } else if (discard.open) {
        event.preventDefault();
        discard.close('keep');
    } else if (!editor.hidden || busy) {
        event.preventDefault();
        leave(closeEditor);
    } else if (!home && ready) {
        event.preventDefault();
        selectPage('home');
    }
});
function linkDown() {
    if (ready) {
        reachable = false;
        showCachedWorkspace();
    }
}
window.addEventListener('offline', linkDown);
window.addEventListener('online', () => void refresh());
window.addEventListener('jairoads-link-down', () => {
    nativeLink = false;
    linkDown();
});
window.addEventListener('jairoads-link-up', () => {
    nativeLink = true;
    void refresh();
});
window.addEventListener('jairoads-local-shown', (event) => {
    presentLocal((event as CustomEvent<string>).detail ?? '');
});
window.addEventListener('jairoads-hosted-shown', () => {
    visibleLocally = false;
    savedLocally = false;
    field.hidden = true;
    opening.hidden = true;
});
window.addEventListener('jairoads-hosted-error', () => {
    if (ready) {
        reachable = false;
        showCachedWorkspace();
    }
});
window.addEventListener('jairoads-resume', () => void refresh());
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        void refresh();
    }
});

export function openFieldReports(workspace: Vault, offlineSignIn: boolean) {
    vault = workspace;
    applyWorkspaceAppearance();
    ready = true;
    reachable = !offlineSignIn;
    history.replaceState(null, '', '#field-reports');
    el('sign-in-screen').hidden = true;
    document.body.classList.add('field-reports-open');
    field.classList.add(
        vault.state.snapshot.role === 'Engineer'
            ? 'jr-engineer-workspace'
            : 'jr-viewer-workspace',
    );
    el('workspace-role').textContent = vault.state.snapshot.role;
    hostMode('cache-ready');

    if (offlineSignIn || !connected()) {
        showCachedWorkspace();
    } else {
        opening.hidden = false;

        if (!hostMode('show-online')) {
            location.replace('/dashboard');
        }
    }

    void refresh();
    window.setInterval(() => void refresh(), 30_000);
}

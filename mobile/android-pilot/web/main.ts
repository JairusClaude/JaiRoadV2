import '../../../resources/css/jairoads-role-components.css';
import { labels, renderFields, titleFor, validateFields } from './field-forms';
import type { Tab } from './field-forms';
import { hostMode } from './host-mode';
import { exportLocalFile } from './host-mode';
import { updateOfflineMap } from './offline-map';
import {
    attachmentMime,
    loadWorkspace,
    pendingAttachment,
    RequestError,
} from './queue';
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

    try {
        appearance = localStorage.getItem('appearance') ?? 'light';
    } catch {
        /* Use default. */
    }

    const dark =
        appearance === 'dark' ||
        (appearance === 'system' && systemDark.matches);
    field.dataset.appearance = dark ? 'dark' : 'light';
    field.style.colorScheme = dark ? 'dark' : 'light';
}
systemDark.addEventListener('change', applyWorkspaceAppearance);
window.addEventListener('storage', (event) => {
    if (event.key === 'appearance' || event.key === null) {
        applyWorkspaceAppearance();
    }
});
let editing: Row | undefined;
let dirty = false;
let busy = false;
let checking = false;
let reachable = false;
let savedLocally = false;
let synced = false;
let hideSync: number;
let preparingFiles = false;
let sharedActive = false;
let sharedFrame: HTMLIFrameElement | undefined;
function fieldStatus() {
    const offline = !connected() || !reachable;
    const pending = pendingCount();
    const files = (vault.state.snapshot.files ?? []).filter(
        (file) => file.available,
    );
    const cached = files.filter((file) => vault.fileAvailable(file)).length;

    return {
        offline,
        message: offline
            ? pending
                ? 'Offline Mode — Saved locally · Waiting for internet'
                : 'Offline Mode'
            : checking && pending
              ? 'Synchronizing saved work…'
              : pending
                ? 'Pending synchronization'
                : unresolvedFileCount()
                  ? 'Some local files need review'
                  : synced
                    ? 'All changes synced'
                    : preparingFiles && cached < files.length
                      ? 'Preparing offline files (' +
                        cached +
                        '/' +
                        files.length +
                        ')'
                      : cached < files.length
                        ? 'Offline files: ' +
                          cached +
                          '/' +
                          files.length +
                          ' ready'
                        : '',
    };
}
function signalShared() {
    if (!sharedFrame?.contentWindow) {
        return;
    }

    const target = sharedFrame.contentWindow;
    target.dispatchEvent(new Event('jairoads-field-status'));
}
let detailsOpen = false;
const pendingCount = () =>
    vault.state.pending.length +
    vault.state.attachments.filter(pendingAttachment).length;
const unresolvedFileCount = () =>
    vault.state.attachments.filter(
        (file) => !file.receipt && !pendingAttachment(file),
    ).length;

function note(text: string, target = 'field-message') {
    const message = el(target);
    message.textContent = text;
    message.hidden = !text;
}

function showStatus() {
    if (sharedActive) {
        signalShared();

        return;
    }

    const pending = pendingCount();
    const message = !connected()
        ? savedLocally
            ? 'Offline Mode — Saved locally · Waiting for internet'
            : 'Offline Mode — Working locally'
        : checking && pending
          ? 'Connection restored — Synchronizing'
          : !reachable
            ? 'Server unavailable — Working locally'
            : pending
              ? 'Pending synchronization'
              : unresolvedFileCount()
                ? 'Some local files need review'
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

function localFileAction(
    entry: HTMLLIElement,
    read: () => Promise<string | undefined>,
    name: string,
) {
    entry.append(
        action('Open / save local copy', async () => {
            try {
                const data = await read();

                if (!data) {
                    throw new Error('Local copy unavailable.');
                }

                exportLocalFile(name, data);
            } catch {
                note(
                    'Could not open this local file. Your saved work has not been removed.',
                );
            }
        }),
    );
}

function renderOfflineMap() {
    const panel = el('field-map');
    const show = visibleLocally && (home || tab === 'road') && !detailsOpen;
    panel.hidden = !show;

    if (!show) {
        return;
    }

    const coords =
        !editor.hidden && tab === 'road'
            ? form.querySelector<HTMLTextAreaElement>(
                  'textarea[name=coordinates]',
              )
            : null;
    updateOfflineMap(el('offline-road-map'), vault.rows('road'), coords);
}

function renderDirectory() {
    if (sharedActive) {
        signalShared();

        return;
    }

    const { snapshot, pending, attachments } = vault.state;
    el('directory-title').textContent = labels[tab][0];
    el('workspace-page-title').textContent = editor.hidden
        ? home
            ? 'Dashboard'
            : labels[tab][0]
        : el('editor-title').textContent;
    el('field-home').hidden = !home || !editor.hidden || detailsOpen;
    directory.hidden = home || !editor.hidden || detailsOpen;

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
        rows = (snapshot.files ?? []).map((reference) => {
            const available = vault.fileAvailable(reference);
            const entry = item(
                reference.title || reference.name,
                available
                    ? 'Available offline · ' + reference.name
                    : 'No local copy · Requires internet',
            );

            if (available) {
                localFileAction(
                    entry,
                    () => vault.fileData(reference),
                    reference.name,
                );
            } else if (connected() && reachable && reference.available) {
                entry.append(
                    action('Save for offline use', async () => {
                        try {
                            await vault.cacheFile(reference);
                            renderDirectory();
                        } catch {
                            note(
                                'Could not cache this file. It may be unavailable, too large, or local storage may be full.',
                            );
                        }
                    }),
                );
            }

            return entry;
        });
        rows.push(
            ...attachments.map((attachment) => {
                const entry = item(
                    attachment.name,
                    attachment.receipt
                        ? 'Synced · Local copy retained'
                        : attachment.issue ||
                              (pendingAttachment(attachment)
                                  ? 'Saved locally · Waiting for internet / server'
                                  : 'Saved locally · Earlier attachment requires review'),
                );
                localFileAction(
                    entry,
                    () => vault.attachmentData(attachment),
                    attachment.name,
                );

                return entry;
            }),
        );
    } else if (tab === 'monthly') {
        rows = vault.rows('monthly').map((row) => {
            const change = pending.find(
                (entry) =>
                    entry.kind === 'monthly' && entry.entity === String(row.id),
            );
            const entry = item(
                titleFor('monthly', row),
                change?.issue ||
                    (change
                        ? 'Saved locally · Pending synchronization'
                        : String(row.progress_percentage ?? '') + '% progress'),
            );
            entry.append(
                action('View details', () => openDetails('monthly', row)),
            );

            return entry;
        });
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

            entry.append(action('View details', () => openDetails(kind, row)));

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
    el('field-outbox').hidden =
        pendingCount() === 0 && unresolvedFileCount() === 0;
    el('field-pending').replaceChildren(
        ...pending.map((change) => {
            const detail =
                change.issue ||
                'Waiting for the server or a related record to sync.';

            return item(titleFor(change.kind, change.fields), detail);
        }),
        ...attachments
            .filter((file) => !file.receipt)
            .map((file) =>
                item(
                    file.name,
                    file.issue ||
                        (pendingAttachment(file)
                            ? 'Saved locally · Waiting for internet / server'
                            : 'Local file retained; review required'),
                ),
            ),
    );
    renderOfflineMap();
    showStatus();
}

function openDetails(
    kind: 'road' | 'project' | 'record' | 'monthly',
    row: Row,
) {
    detailsOpen = true;
    const target = el('field-detail-content');
    target.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = titleFor(kind, row);
    target.append(heading);
    const labels: Record<string, string> = {
        road_name: 'Road name',
        lgu_id: 'Municipality ID',
        pavement_type: 'Pavement',
        state_category: 'Road condition',
        kilometers: 'Length (km)',
        project_title: 'Project title',
        description: 'Description',
        maintenance_year: 'Year',
        quarter: 'Quarter',
        status: 'Status',
        start_date: 'Start date',
        complete_date: 'Completion date',
        estimated_duration_days: 'Estimated duration (days)',
        update_month: 'Reporting month',
        progress_percentage: 'Progress (%)',
        summary_of_text_reports: 'Report notes',
    };

    for (const [key, label] of Object.entries(labels)) {
        if (row[key] === undefined || row[key] === null) {
            continue;
        }

        const term = document.createElement('p');
        term.textContent = label + ': ' + String(row[key]);
        target.append(term);
    }

    const related =
        kind === 'project'
            ? vault
                  .rows('record')
                  .filter((r) => String(r.project_id) === String(row.id))
            : kind === 'record'
              ? vault
                    .rows('monthly')
                    .filter((r) => String(r.maintenance_id) === String(row.id))
              : [];

    for (const child of related) {
        target.append(
            action(
                titleFor(kind === 'project' ? 'record' : 'monthly', child),
                () =>
                    openDetails(
                        kind === 'project' ? 'record' : 'monthly',
                        child,
                    ),
            ),
        );
    }

    const recordIds =
        kind === 'project'
            ? related.map((r) => String(r.id))
            : kind === 'record'
              ? [String(row.id)]
              : kind === 'monthly'
                ? [String(row.maintenance_id)]
                : [];

    for (const file of (vault.state.snapshot.files ?? []).filter((f) =>
        recordIds.includes(String(f.record)),
    )) {
        const entry = item(
            file.title || file.name,
            vault.fileAvailable(file)
                ? 'Available offline'
                : 'Requires internet',
        );

        if (vault.fileAvailable(file)) {
            localFileAction(entry, () => vault.fileData(file), file.name);
        }

        target.append(entry);
    }

    for (const file of vault.state.attachments.filter((f) =>
        recordIds.includes(f.record),
    )) {
        const entry = item(
            file.name,
            file.receipt ? 'Synced · Local copy retained' : 'Saved locally',
        );
        localFileAction(entry, () => vault.attachmentData(file), file.name);
        target.append(entry);
    }

    el('field-detail').hidden = false;
    renderDirectory();
}
function closeDetails() {
    detailsOpen = false;
    el('field-detail').hidden = true;
    el('field-detail-content').replaceChildren();
    renderDirectory();
}
el('field-detail-back').addEventListener('click', closeDetails);

function openEditor(row?: Row) {
    if (busy) {
        return;
    }

    if (detailsOpen) {
        closeDetails();
    }

    editing = row;
    dirty = false;
    el('editor-title').textContent = (row ? 'Edit ' : 'Add ') + labels[tab][1];
    const inputs = el('field-inputs');
    inputs.replaceChildren();
    renderFields(inputs, vault, tab, row);
    note('', 'field-error');
    editor.hidden = false;
    renderOfflineMap();
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
        file.size > 20 * 1024 * 1024 ||
        !/\.(jpe?g|png|webp|pdf|docx|xlsx|pptx)$/i.test(file.name)
    ) {
        throw new Error('Choose a supported photo or document up to 20 MB.');
    }

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsDataURL(
            new Blob([file], { type: attachmentMime(file.name) }),
        );
    });
}

function presentLocal(path = '') {
    if (!ready || sharedActive) {
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
    if (sharedActive) {
        signalShared();

        return;
    }

    if (
        !connected() ||
        !reachable ||
        !editor.hidden ||
        menu.open ||
        busy ||
        (!allowPending && pendingCount())
    ) {
        return;
    }

    if (!hostMode('show-online')) {
        location.replace('/dashboard');
    }
}

function showCachedWorkspace() {
    if (sharedActive) {
        signalShared();

        return;
    }

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

    const hadChanges =
        vault.state.pending.some(({ issue }) => !issue) ||
        vault.state.attachments.some(pendingAttachment);
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
            await vault.syncAttachments(workspace);
        } else if (
            (!visibleLocally || sharedActive) &&
            !vault.state.pending.length
        ) {
            await vault.update(workspace);
        }

        // Keep locally acknowledged rows until the next normal sign-in refresh.
        // A bounded server snapshot can omit an item just saved in the field.
        synced =
            hadChanges && pendingCount() === 0 && unresolvedFileCount() === 0;

        if (!preparingFiles && workspace.fileSync) {
            preparingFiles = true;
            const active = vault;
            void active
                .prepareFiles(
                    workspace,
                    () => ready && active === vault && connected(),
                    () => {
                        if (ready && active === vault) {
                            showStatus();
                        }
                    },
                )
                .finally(() => {
                    preparingFiles = false;

                    if (ready && active === vault) {
                        showStatus();

                        if (visibleLocally && editor.hidden) {
                            renderDirectory();
                        }
                    }
                });
        }

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

    if (tab === 'road') {
        renderOfflineMap();
    }
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

            const record = String(data.get('maintenance_id'));
            const photo = /\.(jpe?g|png|webp)$/i.test(file.name);
            const report = String(data.get('monthly_update_id') || '');

            if (
                !vault.rows('record').some((row) => String(row.id) === record)
            ) {
                throw new Error('Choose an available maintenance record.');
            }

            if (
                photo &&
                !vault
                    .rows('monthly')
                    .some(
                        (row) =>
                            String(row.id) === report &&
                            String(row.maintenance_id) === record,
                    )
            ) {
                throw new Error(
                    'Choose a monthly update for this maintenance record before attaching a photo.',
                );
            }

            await vault.attach(
                record,
                file.name,
                String(data.get('description')),
                await getFile(file),
                photo ? 'media' : 'document',
                photo ? report : record,
                String(data.get('document_title') || file.name).slice(0, 255),
            );
            note(
                'Saved locally — Waiting for internet connection to synchronize the file.',
            );
        } else {
            const values = Object.fromEntries(data) as Fields;
            validateFields(tab, values, editing);
            await vault.save(tab, values, editing);
            note(
                'Saved locally — Waiting for internet connection. Changes will synchronize automatically.',
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
        detailsOpen = false;
        el('field-detail').hidden = true;
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
    if (sharedActive && sharedFrame?.contentWindow) {
        event.preventDefault();
        const target = sharedFrame.contentWindow;
        target.dispatchEvent(new Event('jairoads-field-back'));

        return;
    }

    if (menu.open) {
        event.preventDefault();
        menu.close();
    } else if (discard.open) {
        event.preventDefault();
        discard.close('keep');
    } else if (detailsOpen) {
        event.preventDefault();
        closeDetails();
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

export async function openFieldReports(
    workspace: Vault,
    offlineSignIn: boolean,
) {
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
    opening.hidden = false;
    const { openSharedWorkspace } = await import('./shared-workspace');
    const frame = document.createElement('iframe');
    frame.title = 'JaiROADS workspace';
    frame.id = 'shared-workspace';
    frame.style.cssText =
        'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:10;background:white';
    const activated = await openSharedWorkspace(vault, frame, {
        status: fieldStatus,
        offlineSignIn,
        onSaved: () => {
            savedLocally = true;
            showStatus();
            void refresh();
        },
        onUnavailable: () => {
            reachable = false;
            showStatus();
        },
        onOnline: () => {
            reachable = true;
            showStatus();
        },
        onLock: () => {
            hostMode('lock');
            location.reload();
        },
    });

    if (activated) {
        sharedActive = true;
        sharedFrame = frame;
        field.hidden = true;
        opening.hidden = true;
        hostMode('show-local');
        document.body.append(frame);
        frame.src = '/jairoads-android-pilot/workspace.html';
        window.setTimeout(() => {
            if (frame.dataset.ready === 'true' || sharedFrame !== frame) {
                return;
            }

            sharedActive = false;
            sharedFrame = undefined;
            delete (window as Window & { JaiRoadsSharedWorkspace?: unknown })
                .JaiRoadsSharedWorkspace;
            frame.remove();

            if (connected() && reachable) {
                opening.hidden = false;
                goOnline(true);
            } else {
                showCachedWorkspace();
                note(
                    'The shared workspace could not start. Saved work remains available in recovery mode.',
                );
            }
        }, 18000);
    } else if (offlineSignIn || !connected()) {
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
